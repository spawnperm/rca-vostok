#!/usr/bin/env bash
# Backs up the rca-vostok PostgreSQL database into Garage S3.
#
# Usage (from the deploy host, in the directory holding docker-compose.yml):
#   ./deploy/backup.sh
#
# Requires: docker, a running rca-postgres container, and the S3 credentials
# from .env. Schedule it with cron for regular dumps.
set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env without exporting unrelated shell state.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${GARAGE_S3_ACCESS_KEY:?GARAGE_S3_ACCESS_KEY is required}"
: "${GARAGE_S3_SECRET_KEY:?GARAGE_S3_SECRET_KEY is required}"
BUCKET="${GARAGE_S3_BUCKET:-rca-vostok-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
KEY="postgres/rca_vostok_${STAMP}.sql.gz"

if ! docker ps --format '{{.Names}}' | grep -qx rca-postgres; then
  echo "[backup] rca-postgres is not running" >&2
  exit 1
fi

echo "[backup] dumping ${POSTGRES_DB}"
docker exec -i rca-postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  --no-owner --no-privileges \
  | gzip -9 \
  | docker run --rm -i \
      --network rca-vostok_rca \
      -e AWS_ACCESS_KEY_ID="${GARAGE_S3_ACCESS_KEY}" \
      -e AWS_SECRET_ACCESS_KEY="${GARAGE_S3_SECRET_KEY}" \
      -e AWS_DEFAULT_REGION=garage \
      amazon/aws-cli:2.19.3 \
      --endpoint-url http://garage:3900 \
      s3 cp - "s3://${BUCKET}/${KEY}"

echo "[backup] uploaded s3://${BUCKET}/${KEY}"

# Retention: delete objects whose date stamp is older than the cutoff.
CUTOFF=$(date -u -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null \
  || date -u -v-"${RETENTION_DAYS}"d +%Y%m%d)

echo "[backup] pruning dumps older than ${RETENTION_DAYS} days (cutoff ${CUTOFF})"
docker run --rm \
  --network rca-vostok_rca \
  -e AWS_ACCESS_KEY_ID="${GARAGE_S3_ACCESS_KEY}" \
  -e AWS_SECRET_ACCESS_KEY="${GARAGE_S3_SECRET_KEY}" \
  -e AWS_DEFAULT_REGION=garage \
  amazon/aws-cli:2.19.3 \
  --endpoint-url http://garage:3900 \
  s3 ls "s3://${BUCKET}/postgres/" \
  | awk -v cutoff="${CUTOFF}" \
      '$1 != "" { d=$1; gsub(/-/,"",d); if (d < cutoff) print $4 }' \
  | while read -r old; do
      [ -n "${old}" ] || continue
      echo "[backup] removing ${old}"
      docker run --rm \
        --network rca-vostok_rca \
        -e AWS_ACCESS_KEY_ID="${GARAGE_S3_ACCESS_KEY}" \
        -e AWS_SECRET_ACCESS_KEY="${GARAGE_S3_SECRET_KEY}" \
        -e AWS_DEFAULT_REGION=garage \
        amazon/aws-cli:2.19.3 \
        --endpoint-url http://garage:3900 \
        s3 rm "s3://${BUCKET}/${old}"
    done

echo "[backup] done"
