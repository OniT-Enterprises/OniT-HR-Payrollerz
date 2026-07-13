#!/usr/bin/env bash
#
# Deploy xefe.tl (Vite SPA) to the Hetzner fleet box.
#
# xefe.tl is served from Hetzner (nginx static SPA at /var/www/xefe.tl/dist/spa,
# API on pm2 `xefe-api` :3201) — NOT Firebase. Firebase is used only for auth /
# firestore / functions (see firebase.json + firestore.rules). The old
# Firebase-Hosting deploy was removed on 2026-07-13.
#
# Usage:
#   ./deploy.sh              # build + rsync + chown + smoke test
#   ./deploy.sh --no-build   # deploy an existing dist/spa without rebuilding
#
# The API (xefe-api) is a separate service; deploy it from server/ as usual.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

SSH_KEY="$HOME/.ssh/id_hetzner"
SERVER="root@65.109.173.122"
REMOTE_DIR="/var/www/xefe.tl/dist/spa"

DO_BUILD=1
for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

# --- 1. Build (Vite -> dist/spa) -----------------------------------------
if [[ $DO_BUILD -eq 1 ]]; then
  echo "→ Building…"
  npm run build
else
  echo "→ Skipping build (--no-build)"
fi

if [[ ! -f dist/spa/index.html ]]; then
  echo "✗ dist/spa/index.html not found — build first." >&2
  exit 1
fi

SSH="ssh -i $SSH_KEY"

# --- 2. Rsync the built SPA ----------------------------------------------
#     --delete clears stale hashed assets. Exclude .well-known so an
#     in-flight ACME challenge isn't wiped.
echo "→ Rsync dist/spa → $SERVER:$REMOTE_DIR …"
rsync -az --delete --exclude='.well-known' -e "$SSH" dist/spa/ "$SERVER:$REMOTE_DIR/"

# --- 3. Fix ownership (nginx serves as www-data) -------------------------
echo "→ chown www-data…"
$SSH "$SERVER" "chown -R www-data:www-data $REMOTE_DIR"

# HTML is served no-cache and JS/CSS are content-hashed, so there is no CF
# cache to purge for a static redeploy.

# --- 4. Smoke test -------------------------------------------------------
echo "→ Smoke test…"
FAIL=0
for path in / /features /robots.txt /sitemap.xml /llms.txt; do
  code=$(curl -so /dev/null -w "%{http_code}" "https://xefe.tl$path" || echo "000")
  if [[ "$code" == "200" ]]; then
    printf "  ✓ %-14s %s\n" "$path" "$code"
  else
    printf "  ✗ %-14s %s\n" "$path" "$code"
    FAIL=1
  fi
done

if [[ $FAIL -eq 1 ]]; then
  echo "✗ Deploy finished but some URLs are not 200 — investigate." >&2
  exit 1
fi

echo "✓ Deploy complete — https://xefe.tl"
