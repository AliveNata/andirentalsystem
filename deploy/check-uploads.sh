#!/usr/bin/env bash
# Checks the ARMJ uploads volume against the restored database (T10, AC-12):
#   1. the volume holds the expected number of files,
#   2. every file name referenced by dim_car.image, dim_cust.documents, dim_cust.payment_proof and
#      fact_transaction.{deposit,down,full}_payment exists in the volume,
#   3. every file and directory in the volume is owned by 1000:1000 (the app user in the image).
# Read-only: it changes nothing in the volume or the database. All checks run, then it exits with
# the code of the first failed check.
#
# Usage:
#   check-uploads.sh <uploads path> [expected file count, default 725]
#   check-uploads.sh "$(docker volume inspect -f '{{.Mountpoint}}' rentcar_uploads)"
#
# Exit codes: 0 all checks passed, 1 usage/setup error, 2 postgres not running or query failed,
#             3 file count differs, 4 referenced file missing (or no references / unsafe name),
#             5 wrong owner or group.
# Only file names are printed (random names generated at upload time), never row contents.
set -Eeuo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/rentcar/deploy}"
UPLOADS_UID="${UPLOADS_UID:-1000}"
UPLOADS_GID="${UPLOADS_GID:-1000}"

log() { printf '%s check-uploads: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { local code="$1"; shift; log "ERROR: $*"; exit "$code"; }

[[ $# -ge 1 && $# -le 2 ]] || fail 1 "usage: check-uploads.sh <uploads path> [expected file count]"
uploads_dir="${1%/}"
expected_count="${2:-725}"
[[ "$expected_count" =~ ^[0-9]+$ ]] || fail 1 "expected file count must be a number"
[[ -d "$uploads_dir" ]] || fail 1 "uploads path is not a directory: $uploads_dir"
[[ "$UPLOADS_UID" =~ ^[0-9]+$ && "$UPLOADS_GID" =~ ^[0-9]+$ ]] || fail 1 "UPLOADS_UID/UPLOADS_GID must be numeric"
cd "$COMPOSE_DIR" || fail 1 "compose dir not found: $COMPOSE_DIR"

docker compose ps --status running --services 2>/dev/null | grep -qx postgres \
  || fail 2 "rentcar postgres is not running"

# One row per distinct (source, file name). Names outside [A-Za-z0-9._-] (path separators, '..',
# whitespace) are returned as <unsafe> so they cannot be used to probe paths outside the volume.
read -r -d '' refs_sql <<'SQL' || true
with refs as (
  select 'dim_car.image' as src, r #>> '{}' as fname
  from public.dim_car
  cross join lateral jsonb_path_query(
    case when image ~ '^\s*\[' then image::jsonb else to_jsonb(image) end,
    'lax $[*] ? (@.type() == "string")') as r
  where image is not null and btrim(image) <> ''
  union all
  select 'dim_cust.documents', r #>> '{}'
  from public.dim_cust
  cross join lateral jsonb_path_query(documents, 'lax $.*[*] ? (@.type() == "string")') as r
  union all
  select 'dim_cust.payment_proof', r #>> '{}'
  from public.dim_cust
  cross join lateral jsonb_path_query(payment_proof, 'lax $.**.filename ? (@.type() == "string")') as r
  union all
  select 'fact_transaction.' || p.col, r #>> '{}'
  from public.fact_transaction as f
  cross join lateral (
    values ('deposit_payment', f.deposit_payment),
           ('down_payment', f.down_payment),
           ('full_payment', f.full_payment)
  ) as p (col, doc)
  cross join lateral jsonb_path_query(p.doc, 'lax $.**.filename ? (@.type() == "string")') as r
)
select distinct
  src,
  case when fname ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$' then fname else '<unsafe>' end as fname
from refs
where fname <> ''
order by 1, 2;
SQL

# Single quotes: POSTGRES_USER/POSTGRES_DB are expanded inside the container.
refs="$(printf '%s\n' "$refs_sql" | docker compose exec -T postgres sh -c \
  'psql -X -q -At -v ON_ERROR_STOP=1 -F "|" -U "$POSTGRES_USER" -d "$POSTGRES_DB"')" \
  || fail 2 "query for referenced file names failed"

status=0
mark() { [[ "$status" -ne 0 ]] || status="$1"; }

# 1. file count
file_count="$(find "$uploads_dir" -type f -printf '.' | wc -c)"
if [[ "$file_count" -eq "$expected_count" ]]; then
  log "ok: $file_count files (expected $expected_count)"
else
  log "FAIL: $file_count files, expected $expected_count"
  mark 3
fi

# 2. referenced names exist
ref_total=0
missing=0
unsafe=0
declare -A per_src=()
while IFS='|' read -r src fname; do
  [[ -n "$src" ]] || continue
  ref_total=$((ref_total + 1))
  per_src["$src"]=$(( ${per_src["$src"]:-0} + 1 ))
  if [[ "$fname" == "<unsafe>" ]]; then
    unsafe=$((unsafe + 1))
    log "FAIL: unsafe file name in $src"
  elif [[ ! -f "$uploads_dir/$fname" ]]; then
    missing=$((missing + 1))
    log "FAIL: missing $fname (referenced by $src)"
  fi
done <<< "$refs"

for src in "${!per_src[@]}"; do
  log "references: $src ${per_src[$src]}"
done
if [[ "$ref_total" -eq 0 ]]; then
  log "FAIL: no file references found in the database (data not restored?)"
  mark 4
elif [[ "$missing" -ne 0 || "$unsafe" -ne 0 ]]; then
  log "FAIL: $missing of $ref_total referenced files missing, $unsafe unsafe names"
  mark 4
else
  log "ok: all $ref_total referenced files exist"
fi

# 3. ownership, including the volume root
wrong_owner="$(find "$uploads_dir" \( ! -uid "$UPLOADS_UID" -o ! -gid "$UPLOADS_GID" \) -printf '.' | wc -c)"
if [[ "$wrong_owner" -eq 0 ]]; then
  log "ok: everything owned by $UPLOADS_UID:$UPLOADS_GID"
else
  log "FAIL: $wrong_owner entries not owned by $UPLOADS_UID:$UPLOADS_GID (fix: chown -R $UPLOADS_UID:$UPLOADS_GID <path>)"
  mark 5
fi

if [[ "$status" -eq 0 ]]; then
  log "ok"
fi
exit "$status"
