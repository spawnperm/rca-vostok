#!/usr/bin/env bash
# Deploy the current `main` to production, keeping the previous image tagged so
# a bad release can be rolled back in seconds instead of a rebuild.
#
# Usage (from WSL):
#   ./deploy/release.sh            # deploy origin/main
#   ./deploy/release.sh --rollback # restore the previous image tag
#
# Why tags matter: `docker compose build app` overwrites `rca-vostok:latest`, so
# before this script existed a failed deploy could only be undone by fetching an
# older commit and rebuilding — minutes of downtime and no guarantee the build
# is reproducible. Every release now also carries its short SHA.
set -euo pipefail

HOST="${RCA_PROD_HOST:-vostok-prod}"
APP_DIR="${RCA_APP_DIR:-/opt/rca-vostok}"
PROJECT="${RCA_PROJECT:-rca-vostok}"

remote() {
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
    "$HOST" "cd $APP_DIR && $1"
}

if [ "${1:-}" = "--rollback" ]; then
  echo "[release] rolling back to the previously deployed image"
  remote 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/rca-vostok

PREV=$(cat .last-good-sha 2>/dev/null || true)
if [ -z "$PREV" ]; then
  echo "no .last-good-sha recorded — cannot roll back automatically" >&2
  exit 1
fi

if ! docker image inspect "rca-vostok:$PREV" >/dev/null 2>&1; then
  echo "image rca-vostok:$PREV is gone; rebuild it from that commit first" >&2
  exit 1
fi

docker tag "rca-vostok:$PREV" rca-vostok:latest
docker compose up -d --no-build app
echo "rolled back to $PREV"
REMOTE
  exit 0
fi

echo "[release] deploying origin/main"
remote 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/rca-vostok

GIT_TERMINAL_PROMPT=0 git fetch origin main -q
git reset --hard origin/main -q
SHA=$(git rev-parse --short HEAD)
echo "commit: $SHA"

# Remember the image that is currently serving traffic, so --rollback has a
# target even if the new build never becomes healthy.
if docker image inspect rca-vostok:latest >/dev/null 2>&1; then
  PREV_SHA=$(cat .current-sha 2>/dev/null || echo "unknown")
  if [ "$PREV_SHA" != "unknown" ]; then
    docker tag rca-vostok:latest "rca-vostok:$PREV_SHA" 2>/dev/null || true
    echo "$PREV_SHA" > .last-good-sha
    echo "previous image kept as rca-vostok:$PREV_SHA"
  fi
fi

docker compose build app
docker tag rca-vostok:latest "rca-vostok:$SHA"
docker compose up -d --no-build --wait --wait-timeout 120 app

echo "$SHA" > .current-sha
echo "deployed $SHA (tagged rca-vostok:$SHA)"
REMOTE
