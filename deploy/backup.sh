#!/usr/bin/env bash
# Daily ARMJ backup: pg_dump -Fc from the rentcar postgres container plus a tar.gz of the
# uploads volume, into /var/backups/rentcar. Files older than 7 days are removed, but only
# after today's backup succeeded.
#
# Usage:
#   backup.sh            daily backup, rotated
#   backup.sh <label>    manual backup (e.g. baseline, predeploy) into $BACKUP_DIR/manual, never rotated
#
# Exit codes: 0 ok, 1 usage/setup error, 2 postgres container not running, 3 database dump failed,
#             4 uploads archive failed, 5 another backup is running.
# Logs go to stdout/stderr (journald when run by rentcar-backup.service).
set -Eeuo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/rentcar/deploy}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/rentcar}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-rentcar_uploads}"
LOCK_FILE="/run/lock/rentcar-backup.lock"

log() { printf '%s rentcar-backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { local code="$1"; shift; log "ERROR: $*"; exit "$code"; }

label="${1:-}"
if [[ -n "$label" && ! "$label" =~ ^[a-z0-9-]{1,32}$ ]]; then
  fail 1 "label must match [a-z0-9-]{1,32}"
fi

umask 077
exec 9>"$LOCK_FILE" || fail 1 "cannot open lock file $LOCK_FILE"
flock -n 9 || fail 5 "another backup is running"

cd "$COMPOSE_DIR" || fail 1 "compose dir not found: $COMPOSE_DIR"
[[ -f docker-compose.yml && -f .env ]] || fail 1 "docker-compose.yml or .env missing in $COMPOSE_DIR"

if [[ -n "$label" ]]; then
  dest="$BACKUP_DIR/manual"
  suffix="-$label"
else
  dest="$BACKUP_DIR"
  suffix=""
fi
mkdir -p "$dest"
chmod 700 "$BACKUP_DIR" "$dest"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
db_file="$dest/rentcar-db-$ts$suffix.dump"
up_file="$dest/rentcar-uploads-$ts$suffix.tar.gz"
tmp_db="$db_file.partial"
tmp_up="$up_file.partial"
cleanup() { rm -f "$tmp_db" "$tmp_up"; }
trap cleanup EXIT

docker compose ps --status running --services 2>/dev/null | grep -qx postgres \
  || fail 2 "rentcar postgres is not running"

log "dumping database to $db_file"
# Single quotes: POSTGRES_USER/POSTGRES_DB are expanded inside the container.
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$tmp_db" \
  || fail 3 "pg_dump failed"
[[ -s "$tmp_db" ]] || fail 3 "pg_dump produced an empty file"
docker compose exec -T postgres pg_restore --list < "$tmp_db" > /dev/null \
  || fail 3 "pg_restore --list could not read the dump"
mv "$tmp_db" "$db_file"

log "archiving uploads volume $UPLOADS_VOLUME to $up_file"
up_src="$(docker volume inspect -f '{{.Mountpoint}}' "$UPLOADS_VOLUME" 2>/dev/null)" \
  || fail 4 "volume $UPLOADS_VOLUME not found"
[[ -d "$up_src" ]] || fail 4 "volume path $up_src does not exist"
tar -C "$up_src" --numeric-owner -czf "$tmp_up" . || fail 4 "tar failed"
gzip -t "$tmp_up" || fail 4 "uploads archive is corrupt"
mv "$tmp_up" "$up_file"

log "db $(du -h "$db_file" | cut -f1), uploads $(du -h "$up_file" | cut -f1), $(tar -tzf "$up_file" | grep -vc '/$') files"

if [[ -z "$label" ]]; then
  # -mtime +N matches files at least N+1 days old, so this keeps the last RETENTION_DAYS days.
  deleted="$(find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'rentcar-db-*.dump' -o -name 'rentcar-uploads-*.tar.gz' \) \
    -mtime +"$((RETENTION_DAYS - 1))" -print -delete | wc -l)"
  log "rotation removed $deleted file(s) older than $RETENTION_DAYS days"
fi

log "ok"
