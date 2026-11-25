#!/usr/bin/env bash
# Smoke test for a running NexusHarness instance.
#
# Usage:
#   ./scripts/smoke-test.sh [BASE_URL]
#
# Defaults to http://127.0.0.1:3100 (the port from docker-compose.dev.yml).
# Exits non-zero on the first failed probe so it can gate a local check or CI.
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3100}"
TENANT="acme"
failures=0

probe() {
  local method="$1" path="$2" expected="$3" label="$4" auth="${5:-}"
  local code
  if [[ -n "$auth" ]]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -X "$method" \
      -H "Authorization: Bearer $auth" -H "X-Tenant-Subdomain: $TENANT" "$BASE_URL$path")
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -X "$method" \
      -H "X-Tenant-Subdomain: $TENANT" "$BASE_URL$path")
  fi
  if [[ "$code" == "$expected" ]]; then
    printf '  ok   %-42s %s\n' "$label" "$code"
  else
    printf '  FAIL %-42s got %s, want %s\n' "$label" "$code" "$expected"
    failures=$((failures + 1))
  fi
}

echo "Smoke testing $BASE_URL (tenant: $TENANT)"

probe GET /api/health 200 "liveness probe"
probe GET /api/ready 200 "readiness probe"
probe GET /api/openapi.json 200 "OpenAPI 3.1 spec"
probe GET /api/crm/deals 401 "deals require auth (no token)"

TOKEN=$(curl -s -m 15 -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' -H "X-Tenant-Subdomain: $TENANT" \
  -d '{"userId":"usr_alexey"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [[ -z "$TOKEN" ]]; then
  echo "  FAIL superadmin login returned no token"
  failures=$((failures + 1))
else
  echo "  ok   superadmin login issued a token"
  probe GET /api/crm/deals 200 "deals list" "$TOKEN"
  probe GET /api/crm/contacts 200 "contacts list" "$TOKEN"
  probe GET /api/crm/pipelines 200 "pipelines list" "$TOKEN"
  probe GET /api/social/cabinet 200 "social cabinet" "$TOKEN"
  probe GET /api/marketplace/verdaccio/modules 200 "plugin modules" "$TOKEN"
  probe GET /api/system/health 200 "system health" "$TOKEN"
  probe GET /api/metrics 200 "Prometheus metrics" "$TOKEN"
fi

if [[ "$failures" -gt 0 ]]; then
  echo "FAILED: $failures probe(s) did not match expectations"
  exit 1
fi
echo "All probes passed."
