-- Pengaturan Web jadi daftar kunci tetap (lib/webConfig.js). Nama dan jabatan penandatangan
-- receipt berupa teks, bukan URL gambar, jadi butuh kolom sendiri.
-- psql -v ON_ERROR_STOP=1 -f "DB/15. add value_text and unique description dim_web_config.sql"
-- Aman dijalankan ulang.

begin;

alter table dim_web_config add column if not exists value_text text;

-- Satu baris per kunci. Kalau sudah ada duplikat, migrasi berhenti supaya admin memilih
-- sendiri baris mana yang dipertahankan, bukan dihapus diam-diam.
do $$
declare
  dupes text;
begin
  select string_agg(d.name, ', ') into dupes
    from (
      select lower(description) as name
        from dim_web_config
       where description is not null
       group by lower(description)
      having count(*) > 1
    ) d;
  if dupes is not null then
    raise exception 'dim_web_config punya deskripsi ganda: %. Hapus salah satunya dulu.', dupes;
  end if;
end $$;

create unique index if not exists dim_web_config_description_key
    on dim_web_config (lower(description));

commit;
