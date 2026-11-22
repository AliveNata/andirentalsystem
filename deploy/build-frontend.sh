#!/usr/bin/env bash
# Build project/dist inside Docker (VITE_API_URL empty, frontend uses /api) and publish it to
# /var/www/rentcar. The previous build is kept in /var/www/rentcar.prev for rollback.
# Run as root on the VPS from anywhere: /opt/rentcar/deploy/build-frontend.sh
#
# Exit codes: 0 ok, 1 build failed, 2 build output looks wrong, 3 publish failed.
set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
WEB_ROOT="${WEB_ROOT:-/var/www/rentcar}"
STAGE_DIR="${WEB_ROOT}.new"
PREV_DIR="${WEB_ROOT}.prev"

log() { printf '%s build-frontend: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

case "$WEB_ROOT" in
  /var/www/rentcar*) ;;
  *) log "refusing WEB_ROOT outside /var/www/rentcar: $WEB_ROOT"; exit 3 ;;
esac

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

log "building frontend from $REPO_DIR"
if ! docker buildx build \
    --target frontend-dist \
    --build-arg VITE_API_URL= \
    --output "type=local,dest=$STAGE_DIR" \
    "$REPO_DIR"; then
  log "docker build failed"
  rm -rf "$STAGE_DIR"
  exit 1
fi

if [[ ! -s "$STAGE_DIR/index.html" || ! -d "$STAGE_DIR/assets" ]]; then
  log "build output has no index.html or assets/, not publishing"
  exit 2
fi
# base must be '/', so asset URLs in index.html are absolute.
if grep -q 'src="\./assets/' "$STAGE_DIR/index.html"; then
  log "index.html still uses ./assets (vite base is not '/'), not publishing"
  exit 2
fi

chown -R root:root "$STAGE_DIR"
find "$STAGE_DIR" -type d -exec chmod 755 {} +
find "$STAGE_DIR" -type f -exec chmod 644 {} +

log "publishing to $WEB_ROOT"
publish_failed() { log "publish failed; check $WEB_ROOT, $PREV_DIR and $STAGE_DIR by hand"; exit 3; }
rm -rf "$PREV_DIR" || publish_failed
if [[ -d "$WEB_ROOT" ]]; then
  mv "$WEB_ROOT" "$PREV_DIR" || publish_failed
fi
mv "$STAGE_DIR" "$WEB_ROOT" || publish_failed

log "done ($(find "$WEB_ROOT" -type f | wc -l) files)"
