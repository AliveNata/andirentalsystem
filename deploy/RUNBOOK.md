# Runbook deploy ARMJ (rentcar.alyxlabs.tech)

Login ke VPS: `ssh <deploy-user>@<VPS_IP>`, lalu `sudo -i`. Semua perintah di VPS di bawah dijalankan sebagai root lewat `sudo -i`, kecuali yang jelas jalan dari laptop. Repo di-clone ke `/opt/rentcar`, semua perintah `docker compose` dijalankan dari `/opt/rentcar/deploy` (project compose `rentcar`). File kerja sementara (cek AC-9, skema, dump restore) ada di `/var/tmp/rentcar-work`, dihapus di akhir deploy.

Aturan di VPS ini, karena host ini dipakai bareng app lain:
- Jangan sentuh container, volume, network, atau site nginx app lain di host ini. Yang boleh disentuh cuma yang namanya `rentcar`.
- Jangan jalanin `docker system prune`, `docker volume prune`, `docker network prune`, atau `docker compose down -v`. Perintah itu bisa nyentuh punya app lain atau hapus data ARMJ.
- Jangan pakai `psql` host atau port 5432/5433 (punya app lain). Semua perintah DB lewat `docker compose exec -T postgres ...` dari `/opt/rentcar/deploy`.
- Di nginx cuma file `rentcar.alyxlabs.tech` dan `snippets/rentcar-headers.conf` yang boleh disentuh. Selalu `nginx -t` dulu, baru `systemctl reload nginx`. Jangan `restart`.

Isi folder `deploy/`:
| File | Fungsi |
|---|---|
| `docker-compose.yml` | service `app` (127.0.0.1:5005, rootfs read-only) dan `postgres` (tanpa port publik) |
| `.env.production.example` | contoh isi `deploy/.env`, tanpa nilai rahasia |
| `build-frontend.sh` | build `project/dist` di Docker lalu publish ke `/var/www/rentcar` |
| `nginx/rentcar.alyxlabs.tech.conf` | site nginx host (HTTP dulu, certbot nambah HTTPS), rate limit login |
| `nginx/rentcar-headers.conf` | header keamanan, dipasang ke `/etc/nginx/snippets/` setelah certbot |
| `check-uploads.sh` | cek read-only file upload di volume vs nama file di DB (T10) |
| `backup.sh` | backup harian DB dan foto ke `/var/backups/rentcar`, simpan 7 hari |
| `systemd/rentcar-backup.{service,timer}` | jadwal backup tiap hari 02:30 WIB (19:30 UTC) |

Dua role DB: `DB_USER` (`armj`, superuser dan owner tabel) buat migrasi, restore, dan backup. App login pakai `APP_DB_USER` (`armj_app`, dibuat `DB/17`), tanpa hak DDL.

---

## 1. Deploy pertama

### 1.1 Cek awal (read-only)
```bash
ss -tlnp | grep -E ':5005|:5434' || echo "port bebas"
docker ps --format '{{.Names}}\t{{.Ports}}'
test -e /opt/rentcar && echo "STOP: /opt/rentcar sudah ada" || echo "ok"
test -e /etc/nginx/sites-available/rentcar.alyxlabs.tech && echo "STOP: site sudah ada" || echo "ok"
test -e /etc/nginx/snippets/rentcar-headers.conf && echo "STOP: snippet sudah ada" || echo "ok"
grep -rn 'rentcar_login' /etc/nginx && echo "STOP: nama zone rentcar_login sudah dipakai" || echo "zone ok"
```
Siapkan folder kerja (pemiliknya user SSH, biar `scp` dari laptop bisa nulis ke sini):
```bash
install -d -m 700 -o <deploy-user> -g <deploy-user> /var/tmp/rentcar-work
```
Simpan status domain lain buat dibandingin nanti (AC-9). Daftar domain dibaca dari site nginx yang aktif, jadi nggak perlu ditulis di sini:
```bash
W=/var/tmp/rentcar-work
grep -hoE '^[[:space:]]*server_name[[:space:]]+[^;]+' /etc/nginx/sites-enabled/* \
  | awk '{for(i=2;i<=NF;i++) print $i}' \
  | grep -vE '^(_|localhost|rentcar\.alyxlabs\.tech)$|^[*~.]' | sort -u > "$W/ac9-domains.txt"
wc -l < "$W/ac9-domains.txt"
while read -r d; do
  printf '%s %s\n' "$d" "$(curl -s -o /dev/null -w '%{http_code}' "https://$d/")"
done < "$W/ac9-domains.txt" > "$W/ac9-before.txt"
```

### 1.2 Clone repo
```bash
git clone <URL repo AliveNata/andirentalsystem> /opt/rentcar
cd /opt/rentcar
git checkout <branch atau tag yang sudah di-review>
git log -1 --oneline
```

### 1.3 Isi `deploy/.env`
```bash
cd /opt/rentcar/deploy
cp .env.production.example .env
chmod 600 .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # buat SESSION_SECRET
openssl rand -hex 32                                                         # buat DB_PASSWORD
openssl rand -hex 32                                                         # buat APP_DB_PASSWORD (beda dari DB_PASSWORD)
sed -i "s/^APP_TAG=.*/APP_TAG=$(git rev-parse --short HEAD)/" .env
nano .env
```
Isi `SESSION_SECRET`, `DB_PASSWORD`, `APP_DB_PASSWORD`, `EMAIL_USER`, `EMAIL_PASS`. `APP_DB_USER` biarkan `armj_app`. Pakai nilai hex, jangan ada `$`, kutip, atau spasi. `ALLOWED_ORIGINS` harus persis `https://rentcar.alyxlabs.tech`. Jangan tampilkan isi `.env` di layar yang dibagikan.

Cek config tanpa nampilin rahasia:
```bash
docker compose config --quiet && echo "compose ok"
```

### 1.4 Build image app
```bash
cd /opt/rentcar/deploy
docker compose build app
docker run --rm "rentcar-app:$(grep ^APP_TAG= .env | cut -d= -f2)" node -v   # v24.22.3 atau lebih baru
docker run --rm "rentcar-app:$(grep ^APP_TAG= .env | cut -d= -f2)" id -u     # 1000, bukan 0
```

### 1.5 Start postgres dan migrasi (urutan kontrak bagian 5)
```bash
cd /opt/rentcar/deploy
docker compose up -d --wait postgres
docker compose ps postgres          # status healthy
```
Password admin sekali pakai (baris seed ini dihapus lagi oleh restore di 1.6, jangan disimpan):
```bash
ADMIN_PW="$(openssl rand -hex 16)"
psql_armj() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U armj -d armj "$@"; }

psql_armj -v admin_password="$ADMIN_PW" < "../DB/dim_user & dim_cars.sql"
psql_armj < "../DB/dim_cust.sql"
psql_armj < "../DB/3. create policy dim_cust.sql"
psql_armj < "../DB/4. add payment proof & history log dim_cust.sql"
psql_armj < "../DB/5. add delete reason tracking dim_cust.sql"
psql_armj < "../DB/6. create dim_web_config.sql"
psql_armj < "../DB/7. add missing columns dim_car.sql"
psql_armj < "../DB/8. create fact_transaction.sql"
psql_armj < "../DB/9. create dim_bank and dim_loyalty_poin.sql"
psql_armj < "../DB/10. generalize history_log.sql"
psql_armj < "../DB/11. add full_name dim_user.sql"
psql_armj < "../DB/12. align dim_cust and dim_user with code.sql"
psql_armj -v apply=true < "../DB/13. add customer_id and rental_cost fact_transaction.sql"
psql_armj -v apply=true < "../DB/14. unique booking_code fact_transaction.sql"
psql_armj < "../DB/15. add value_text and unique description dim_web_config.sql"
psql_armj < "../DB/16. create app_session.sql"
unset ADMIN_PW
```
`DB/13` dan `DB/14` wajib pakai `-v apply=true`: default-nya dry-run lalu rollback, dan tanpa itu `fact_transaction` nggak punya `customer_id`, `rental_cost`, `receipt_logs`, dan unique `booking_code`, jadi load data di 1.6 gagal. Jalankan satu per satu. Kalau ada yang error, stop, jangan lanjut ke file berikutnya. Nama file harus sama dengan isi `ls ../DB`; kalau beda, pakai nama yang ada. `DB/17` (role app) belum dijalankan di sini, tapi di 1.6 setelah restore.

Cek skema (langkah 7 kontrak). Di laptop: `pg_dump -s -U <user lokal> -d <db lokal> > schema-local.sql`, copy ke `/var/tmp/rentcar-work/` di VPS, lalu:
```bash
W=/var/tmp/rentcar-work
docker compose exec -T postgres pg_dump -s -U armj -d armj > "$W/schema-prod.sql"
diff <(grep -vE 'OWNER TO|^-- |^\\(un)?restrict' "$W/schema-local.sql") <(grep -vE 'OWNER TO|^-- |^\\(un)?restrict' "$W/schema-prod.sql")
```
Baris `\restrict` / `\unrestrict` disaring karena pg_dump 18 nulis kunci acak di situ. Stop kalau ada beda selain owner atau role.

### 1.6 Restore data dari laptop (T10, Asuna)
Syarat: cleanup QA di laptop udah jalan (T9, `plans/2026-11-22-qa-cleanup.sql` dengan `apply=true`). File dump dan arsip foto dari skrip T10 Asuna ada di folder backup di sebelah repo, di luar git.

Data yang dipindah: `dim_user`, `dim_car`, `dim_web_config`, `dim_loyalty_poin`, `dim_cust`, `fact_transaction`. `history_log` kosong (riwayat sesi QA dihapus, nggak ada yang dipindah). `dim_bank` dan session nggak dipindah. Semua id uuid, jadi nggak ada sequence yang perlu di-reset.
<!-- Jumlah baris dan jumlah file pasti: lihat plans/ (privat). -->

Copy dari laptop (Git Bash), lalu cek checksum di VPS:
```bash
# di laptop
cd ../andirentalsystem-backups
sha256sum -c rentcar_prod_data_2026-11-22.sql.sha256 rentcar_uploads_2026-11-22.tar.gz.sha256
scp rentcar_prod_data_2026-11-22.sql rentcar_prod_data_2026-11-22.sql.sha256 \
    rentcar_uploads_2026-11-22.tar.gz rentcar_uploads_2026-11-22.tar.gz.sha256 \
    <deploy-user>@<VPS_IP>:/var/tmp/rentcar-work/
# di VPS (sudo -i)
cd /var/tmp/rentcar-work && sha256sum -c ./*.sha256 && chmod 600 ./*
```
Folder `/var/tmp/rentcar-work` (mode 700) dibuat di 1.1 dengan pemilik user SSH, jadi `scp` sebagai `<deploy-user>` bisa nulis ke sana; `/root` nggak bisa ditulis user non-root.

Isi dump (skrip T10 yang ngatur, transaksi `begin`/`commit` sendiri): hapus baris seed `andirental` dari langkah 1.5 (biar unique `username` nggak bentrok), lalu `dim_user`, `dim_car`, `dim_web_config`, `dim_loyalty_poin`, `dim_cust`, baru `fact_transaction` dan `history_log` (dua-duanya FK ke `dim_cust`). Trigger log customer lama udah di-drop DB/10, jadi load data nggak nambah baris `history_log`. Load sebagai superuser `armj`, sebelum `DB/17`, tanpa `--single-transaction`:
```bash
cd /opt/rentcar/deploy
docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U armj -d armj < /var/tmp/rentcar-work/rentcar_prod_data_2026-11-22.sql
```
Baris terakhir harus `WARNING:  restore postcheck ok` lalu `COMMIT`. Ada `ERROR` berarti semua di-rollback, nggak ada yang ke-load; stop dan cek pesannya. Setelah restore, semua akun pakai hash password dari laptop; `ADMIN_PW` seed dari 1.5 udah nggak berlaku. Rotasi password T14 tetap jalan.
```bash
docker compose exec -T postgres psql -U armj -d armj -c "select (select count(*) from dim_user) users, (select count(*) from dim_car) car, (select count(*) from dim_web_config) web_config, (select count(*) from dim_loyalty_poin) loyalty, (select count(*) from dim_cust) cust, (select count(*) from fact_transaction) trx, (select count(*) from history_log) hist, (select count(*) from dim_bank) bank;"
docker compose exec -T postgres psql -U armj -d armj -c "select count(*) as trx_without_cust from fact_transaction f left join dim_cust c on c.id = f.customer_id where f.customer_id is not null and c.id is null;"
```
Hasil yang diharapkan: tiap angka sama dengan hitungan di laptop sesudah cleanup T9 (angka pasti di `plans/`, privat), `hist 0`, `bank 0`, dan `trx_without_cust 0` (AC-12).

Cek nggak ada akun yang masih pakai password default lama. Harus 0 baris:
```bash
docker compose exec -T postgres psql -U armj -d armj <<'SQL'
-- pgcrypto (dari seed) cuma kenal prefix $2a$; hash dari bcrypt di app pakai $2b$, algoritmanya sama.
select username from dim_user
where password like '$2_$%'
  and crypt('Andirental!23', overlay(password placing '$2a$' from 1 for 4))
      = overlay(password placing '$2a$' from 1 for 4);
SQL
```
Kalau ada baris: jangan lanjut ke 1.11 (nginx) sebelum password akun itu diganti. Ganti langsung di DB (bcrypt `$2a$` tetap dibaca app):
```bash
NEW_PW="$(openssl rand -hex 12)"; echo "$NEW_PW"   # kasih ke pemilik akun lewat jalur privat
# variabel psql cuma diisi kalau SQL lewat stdin, bukan lewat -c
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U armj -d armj -v new_pw="$NEW_PW" -v uname='<username>' <<'SQL'
update dim_user set password = crypt(:'new_pw', gen_salt('bf', 10)) where username = :'uname';
SQL
unset NEW_PW
```
Lalu ulang cek di atas sampai 0 baris.

Bikin role app (`DB/17`). Jalan setelah restore, jadi grant pasti kena semua tabel yang ada; tabel baru dari migrasi berikutnya (dibuat `armj`) ikut kena lewat default privileges:
```bash
cd /opt/rentcar/deploy
APP_USER="$(grep '^APP_DB_USER=' .env | cut -d= -f2-)"
APP_PW="$(grep '^APP_DB_PASSWORD=' .env | cut -d= -f2-)"
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U armj -d armj \
  -v app_role="$APP_USER" -v app_password="$APP_PW" < "../DB/17. create app role.sql"
unset APP_PW
docker compose exec -T postgres psql -U armj -d armj -c "select rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin from pg_roles where rolname = '$APP_USER';"
docker compose exec -T postgres psql -U armj -d armj -c "select c.relname as tabel_tanpa_grant from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not has_table_privilege('$APP_USER', c.oid, 'select,insert,update,delete');"
```
Hasil: `rolsuper f, rolcreatedb f, rolcreaterole f, rolbypassrls t, rolcanlogin t`, dan `tabel_tanpa_grant` 0 baris. `BYPASSRLS` sengaja: RLS di `dim_user`, `dim_car`, `dim_cust`, `history_log` sisa Supabase, dan `dim_cust` nggak punya policy UPDATE, jadi tanpa itu update customer dari app diam-diam kena 0 baris. Sebelumnya app login sebagai owner, yang juga melewati RLS. `DB/17` aman dijalankan ulang (sekalian reset password ke nilai `.env`).

### 1.7 Copy file upload ke volume uploads
```bash
cd /opt/rentcar/deploy
docker compose create app                # bikin container dan volume rentcar_uploads, belum start
UP="$(docker volume inspect -f '{{.Mountpoint}}' rentcar_uploads)"
echo "$UP"                               # harus .../volumes/rentcar_uploads/_data
tar -xzf /var/tmp/rentcar-work/rentcar_uploads_2026-11-22.tar.gz -C "$UP" --numeric-owner --same-owner
find "$UP" -type f | wc -l               # sama dengan jumlah file di arsip laptop
find "$UP" -not -user 1000 | wc -l       # 0
bash ./check-uploads.sh "$UP"            # read-only, butuh postgres jalan dan data udah ke-load
```
`check-uploads.sh` ngecek tiap nama file yang dirujuk DB (`dim_car.image`, dokumen dan bukti bayar UAT) ada di volume, jumlah file, dan pemilik 1000:1000 (AC-12). Exit: 0 ok, 1 argumen/setup, 2 postgres mati atau query gagal, 3 jumlah file beda, 4 ada file yang dirujuk tapi hilang, 5 pemilik bukan 1000:1000.
<!-- Jumlah file dan jumlah nama yang dirujuk: lihat plans/ (privat). -->

### 1.8 Start app
```bash
cd /opt/rentcar/deploy
docker compose up -d --wait --wait-timeout 120 app
docker compose ps
curl -s http://127.0.0.1:5005/api/health          # {"status":"ok"}
ss -tlnp | grep -E ':5005|:5434'                  # 127.0.0.1:5005 saja
docker inspect -f 'ReadonlyRootfs={{.HostConfig.ReadonlyRootfs}}' rentcar-app-1   # true
docker compose exec -T postgres psql -U armj -d armj -Atc "select usename, count(*) from pg_stat_activity where datname = 'armj' and backend_type = 'client backend' group by 1;"   # koneksi app atas nama armj_app
```

### 1.9 Backup baseline
```bash
chmod 750 /opt/rentcar/deploy/backup.sh /opt/rentcar/deploy/build-frontend.sh
/opt/rentcar/deploy/backup.sh baseline
ls -l /var/backups/rentcar/manual/
```
Baseline udah aman, hapus dump mentah (isinya data customer):
```bash
shred -u /var/tmp/rentcar-work/rentcar_prod_data_2026-11-22.sql
rm -f /var/tmp/rentcar-work/rentcar_uploads_2026-11-22.tar.gz /var/tmp/rentcar-work/*.sha256
```

### 1.10 Frontend ke `/var/www/rentcar`
```bash
/opt/rentcar/deploy/build-frontend.sh
ls /var/www/rentcar                                # index.html, assets/, logo/, ikon
```
Skrip gagal (exit 2) kalau `index.html` masih pakai `./assets`, artinya `vite base` belum `'/'` (F2). Jangan dipaksa, minta fix dulu.

### 1.11 Site nginx (HTTP dulu)
Site nge-include `/etc/nginx/snippets/rentcar-headers.conf`. Header aslinya (termasuk HSTS) baru dipasang di 1.12 setelah HTTPS jalan, jadi sekarang pasang file kosong dulu biar `nginx -t` lolos:
```bash
install -m 644 /dev/null /etc/nginx/snippets/rentcar-headers.conf
cp /opt/rentcar/deploy/nginx/rentcar.alyxlabs.tech.conf /etc/nginx/sites-available/rentcar.alyxlabs.tech
ln -s /etc/nginx/sites-available/rentcar.alyxlabs.tech /etc/nginx/sites-enabled/rentcar.alyxlabs.tech
nginx -t && systemctl reload nginx
curl -s -H 'Host: rentcar.alyxlabs.tech' http://127.0.0.1/api/health
```
Kalau `nginx -t` gagal: `rm /etc/nginx/sites-enabled/rentcar.alyxlabs.tech`, jangan reload.

### 1.12 DNS, sertifikat, lalu header keamanan
Bikin record A `rentcar` ke `<VPS_IP>` di DNS `alyxlabs.tech`, lalu tunggu sampai resolve:
```bash
dig +short rentcar.alyxlabs.tech A          # harus <VPS_IP>
dig +short rentcar.alyxlabs.tech @1.1.1.1 A
```
Jangan jalanin certbot sebelum dua-duanya balik `<VPS_IP>`. Record A harus langsung ke VPS (bukan lewat proxy/CDN), karena rate limit login dihitung per IP klien.
```bash
certbot --nginx -d rentcar.alyxlabs.tech --redirect
nginx -t && systemctl reload nginx
curl -sI https://rentcar.alyxlabs.tech | head -1   # 200
```
Certbot nambah `listen 443 ssl` dan blok redirect port 80 ke file di `sites-available`. Sejak itu file VPS beda dengan file repo: kalau nanti ada perubahan config site, edit file VPS, jangan ditimpa pakai file repo (baris SSL bakal hilang). Snippet header nggak disentuh certbot, jadi boleh dicopy ulang dari repo.

Setelah HTTPS jalan, pasang header keamanan:
```bash
cp /opt/rentcar/deploy/nginx/rentcar-headers.conf /etc/nginx/snippets/rentcar-headers.conf
nginx -t && systemctl reload nginx
curl -sI https://rentcar.alyxlabs.tech | grep -iE 'strict-transport|x-frame|content-security|permissions-policy|nosniff'
```
Harus muncul `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Content-Security-Policy-Report-Only`, `Permissions-Policy`, `X-Content-Type-Options`. Kalau `nginx -t` gagal: `install -m 644 /dev/null /etc/nginx/snippets/rentcar-headers.conf`, `nginx -t && systemctl reload nginx`.

### 1.13 Aktifkan backup harian
```bash
cp /opt/rentcar/deploy/systemd/rentcar-backup.service /opt/rentcar/deploy/systemd/rentcar-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now rentcar-backup.timer
systemctl list-timers rentcar-backup.timer
systemctl start rentcar-backup.service && journalctl -u rentcar-backup.service -n 20 --no-pager
```
Alternatif cron kalau nggak mau systemd: `30 19 * * * /opt/rentcar/deploy/backup.sh >> /var/log/rentcar-backup.log 2>&1` (jam UTC).

### 1.14 Smoke check
```bash
W=/var/tmp/rentcar-work
curl -sI http://rentcar.alyxlabs.tech | head -3                 # 301 ke https
curl -sI https://rentcar.alyxlabs.tech | head -5                 # 200, index.html no-cache
curl -s -o /dev/null -w '%{http_code}\n' https://rentcar.alyxlabs.tech/halaman-dalam   # 200 (fallback SPA)
curl -s https://rentcar.alyxlabs.tech/api/health                 # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: https://evil.example' https://rentcar.alyxlabs.tech/api/login   # 403
curl -sI https://rentcar.alyxlabs.tech/api/files/<nama-foto> | head -1   # 401 atau 403
docker stats --no-stream rentcar-app-1 rentcar-postgres-1
docker inspect -f '{{.Name}} OOMKilled={{.State.OOMKilled}}' rentcar-app-1 rentcar-postgres-1
while read -r d; do
  printf '%s %s\n' "$d" "$(curl -s -o /dev/null -w '%{http_code}' "https://$d/")"
done < "$W/ac9-domains.txt" | diff "$W/ac9-before.txt" - && echo "AC-9 sama"
```
Dari laptop: `nc -zv -w 3 <VPS_IP> 5005` harus gagal.

Rate limit login (paling akhir, karena IP ini bakal ketahan sekitar satu menit). 12 request cepat, beberapa pertama dapat 400/401/403 dari app, sisanya harus `429`:
```bash
for i in $(seq 1 12); do curl -s -o /dev/null -w '%{http_code} ' -X POST -H 'Content-Type: application/json' -d '{}' https://rentcar.alyxlabs.tech/api/login; done; echo
```
Tunggu sekitar 2 menit sebelum login dari IP yang sama.

Di browser: login, buka satu mobil (foto tampil), refresh di halaman dalam, `docker compose restart app` lalu refresh (masih login, AC-3). Cek `Set-Cookie: armj.sid` di respon login punya `Secure; HttpOnly; SameSite=Lax` (AC-2). Buka DevTools Console dan catat pesan `Content-Security-Policy-Report-Only` (bahan 1.15). Lanjut T14: ganti password akun admin.

Hapus sisa file kerja (cek AC-9, skema) setelah semua cek lolos: `rm -rf /var/tmp/rentcar-work`.

### 1.15 CSP enforce (paling cepat sehari setelah go-live)
CSP dikirim sebagai `Content-Security-Policy-Report-Only` dulu: browser cuma lapor pelanggaran di Console, nggak ada yang diblok. Selama sehari, buka Console di halaman utama, form booking (upload dokumen), login, dashboard admin, form mobil (upload foto), detail customer, invoice/receipt, dan web config. Kalau nggak ada pesan pelanggaran CSP sama sekali, ganti ke mode enforce:
```bash
cp /etc/nginx/snippets/rentcar-headers.conf /etc/nginx/snippets/rentcar-headers.conf.bak
sed -i 's/Content-Security-Policy-Report-Only/Content-Security-Policy/' /etc/nginx/snippets/rentcar-headers.conf
nginx -t && systemctl reload nginx
curl -sI https://rentcar.alyxlabs.tech | grep -i '^content-security-policy:'
```
Ulang cek di browser di halaman yang sama. Kalau ada yang rusak: `mv /etc/nginx/snippets/rentcar-headers.conf.bak /etc/nginx/snippets/rentcar-headers.conf && nginx -t && systemctl reload nginx`. Kalau ada pelanggaran di mode Report-Only, jangan enforce; catat directive yang kena dan bawa ke review keamanan. Setelah enforce stabil, samakan file di repo (`deploy/nginx/rentcar-headers.conf`) lewat commit biasa.

---

## 2. Update / redeploy
```bash
cd /opt/rentcar
git fetch && git status                      # pastikan bersih
cd deploy
/opt/rentcar/deploy/backup.sh predeploy      # dump pra-deploy, tidak ikut rotasi
grep ^APP_TAG= .env | cut -d= -f2 > .prev_app_tag
git -C /opt/rentcar pull --ff-only
sed -i "s/^APP_TAG=.*/APP_TAG=$(git rev-parse --short HEAD)/" .env
docker compose build app
```
Kalau rilis ini bawa file migrasi baru di `DB/`, jalankan file barunya saja, satu per satu, sebelum start app. Selalu pakai `-U armj` (owner), bukan role app:
```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U armj -d armj < "../DB/<file baru>.sql"
```
Tabel atau sequence baru yang dibuat `armj` otomatis dapat grant ke `armj_app` (default privileges dari `DB/17`). Kalau migrasi bikin schema baru di luar `public`, atau dijalankan sebagai role lain, jalankan ulang `DB/17` (perintah di 1.6) dan cek `tabel_tanpa_grant`.

Lalu:
```bash
docker compose up -d --wait --wait-timeout 120 app
curl -s http://127.0.0.1:5005/api/health
/opt/rentcar/deploy/build-frontend.sh        # kalau frontend berubah
```
Image lama tetap ada di lokal (tag di `.prev_app_tag`) buat rollback. Bersihkan image rentcar lama secara manual saja, misal `docker image rm rentcar-app:<tag lama>`, jangan pakai prune.

---

## 3. Rollback

### 3.1 Site nginx bikin masalah ke domain lain
```bash
rm /etc/nginx/sites-enabled/rentcar.alyxlabs.tech
nginx -t && systemctl reload nginx
```
File di `sites-available` dan snippet dibiarkan buat dicek.

### 3.2 App versi baru gagal, DB aman
```bash
cd /opt/rentcar/deploy
sed -i "s/^APP_TAG=.*/APP_TAG=$(cat .prev_app_tag)/" .env
docker compose up -d --wait --wait-timeout 120 app
```
Frontend: `rm -rf /var/www/rentcar && mv /var/www/rentcar.prev /var/www/rentcar` (skrip build simpan satu versi sebelumnya).

### 3.3 Migrasi merusak data: balik ke dump pra-deploy atau baseline
```bash
cd /opt/rentcar/deploy
ls -lt /var/backups/rentcar/manual/          # pilih rentcar-db-...-predeploy.dump atau ...-baseline.dump
docker compose stop app
docker compose exec -T postgres pg_restore -U armj -d armj --clean --if-exists --single-transaction --exit-on-error < /var/backups/rentcar/manual/<FILE>.dump
sed -i "s/^APP_TAG=.*/APP_TAG=$(cat .prev_app_tag)/" .env
docker compose up -d --wait --wait-timeout 120 app
```
Grant ke `armj_app` ikut di dump, jadi ke-restore juga. Kalau dump-nya lebih tua dari `DB/17`, jalankan `DB/17` lagi (perintah di 1.6) sebelum start app.

### 3.4 Deploy pertama gagal total
```bash
rm -f /etc/nginx/sites-enabled/rentcar.alyxlabs.tech
nginx -t && systemctl reload nginx
cd /opt/rentcar/deploy
docker compose down                          # tanpa -v, volume rentcar_pgdata dan rentcar_uploads tetap ada
```
Laptop tetap jadi sumber data. Kalau mau mulai dari nol, hapus volume ARMJ dengan nama lengkap saja: `docker volume rm rentcar_pgdata rentcar_uploads` (cek dulu `docker volume ls | grep rentcar_`). Role `armj_app` ada di dalam volume `rentcar_pgdata`, jadi ikut hilang.

---

## 4. Uji restore (AC-15, sekali sebelum go-live lalu tiap bulan)
Restore dump terbaru ke container Postgres sementara tanpa volume, tanpa network, tidak menyentuh container ARMJ maupun app lain.
```bash
LATEST="$(ls -t /var/backups/rentcar/rentcar-db-*.dump | head -1)"; echo "$LATEST"
docker run -d --rm --name rentcar-restore-test --network none \
  -e POSTGRES_USER=armj -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" -e POSTGRES_DB=armj \
  postgres:18.7-trixie@sha256:eb63372c1e05c755f55fa30cbd07aecc443676fc6c0fa90b9002d01537841e1a
until docker exec rentcar-restore-test pg_isready -U armj -d armj; do sleep 2; done
# role dipakai policy RLS dan grant di dump; role level cluster, jadi nggak ikut pg_dump
docker exec rentcar-restore-test psql -U armj -d armj -c "create role authenticated nologin;" -c "create role armj_app nologin;"
docker exec -i rentcar-restore-test pg_restore -U armj -d armj --exit-on-error < "$LATEST"
docker exec rentcar-restore-test psql -U armj -d armj -c "select (select count(*) from dim_car) car, (select count(*) from dim_user) users, (select count(*) from dim_web_config) web_config;"
docker stop rentcar-restore-test             # --rm, container langsung hilang
```
Angka harus sama dengan DB prod saat backup. Kalau `create role` bilang role sudah ada, lanjut saja.

Uji arsip foto:
```bash
LATEST_UP="$(ls -t /var/backups/rentcar/rentcar-uploads-*.tar.gz | head -1)"
tar -tzf "$LATEST_UP" | grep -vc '/$'        # jumlah file sama dengan isi volume
```
Restore foto beneran (kalau volume rusak): `docker compose stop app`, extract ke `$(docker volume inspect -f '{{.Mountpoint}}' rentcar_uploads)`, `chown -R 1000:1000`, `docker compose start app`.

Cek rotasi setelah 8 hari jalan: `ls -l /var/backups/rentcar/` cuma berisi 7 hari terakhir.

## 5. Kode exit backup.sh
| Kode | Arti |
|---|---|
| 0 | sukses |
| 1 | salah pakai atau setup (folder, `.env`, label) |
| 2 | container postgres ARMJ nggak jalan |
| 3 | `pg_dump` gagal atau dump nggak kebaca |
| 4 | arsip foto gagal |
| 5 | backup lain masih jalan |

Log: `journalctl -u rentcar-backup.service`. Kalau gagal, file lama nggak dihapus.
