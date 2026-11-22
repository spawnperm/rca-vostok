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

# Record the image currently serving traffic so --rollback has a target.
#
# The previous version of this script read `.current-sha`, which does not exist
# on a first deploy — so nothing was recorded and --rollback had no target.
# Fall back to asking Docker which non-`latest` tags exist and treating the
# newest as current.
PREV_SHA=$(cat .current-sha 2>/dev/null || true)
if [ -z "$PREV_SHA" ]; then
  PREV_SHA=$(docker images rca-vostok --format '{{.Tag}} {{.CreatedAt}}' \
    | grep -v '^latest ' | sort -k2 -r | head -1 | awk '{print $1}')
fi

if [ -n "$PREV_SHA" ] && [ "$PREV_SHA" != "$SHA" ]; then
  if docker image inspect "rca-vostok:$PREV_SHA" >/dev/null 2>&1; then
    docker tag "rca-vostok:$PREV_SHA" rca-vostok:latest 2>/dev/null || true
    echo "$PREV_SHA" > .last-good-sha
    echo "rollback target: rca-vostok:$PREV_SHA"
  fi
elif [ "$PREV_SHA" = "$SHA" ]; then
  # Redeploying the same commit: keep whatever rollback target already exists.
  [ -f .last-good-sha ] && echo "rollback target unchanged: $(cat .last-good-sha)"
else
  echo "no previous image found — this is the first tagged deploy"
fi

docker compose build app
docker tag rca-vostok:latest "rca-vostok:$SHA"
docker compose up -d --no-build --wait --wait-timeout 120 app

echo "$SHA" > .current-sha
echo "deployed $SHA (tagged rca-vostok:$SHA)"
REMOTE
