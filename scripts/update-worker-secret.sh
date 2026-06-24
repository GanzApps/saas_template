#!/usr/bin/env bash
set -euo pipefail

CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
ACCOUNT_ID="a76e974e7c97043eb60c5a97bb651284"
SCRIPT_NAME="${1:-filevault-api-production}"
SECRET_NAME="${2:-CLERK_WEBHOOK_SECRET}"
SECRET_VALUE="${3:?Usage: $0 <script_name> <secret_name> <secret_value>}"

if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN not set" >&2
  exit 1
fi

API="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/secrets/${SECRET_NAME}"

HTTP=$(curl -s -o /tmp/cf_secret_resp.json -w "%{http_code}" \
  -X PUT "$API" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"name\":\"${SECRET_NAME}\",\"type\":\"secret_text\",\"text\":\"${SECRET_VALUE}\"}")

BODY=$(cat /tmp/cf_secret_resp.json)
SUCCESS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "false")

if [[ "$HTTP" == "200" && "$SUCCESS" == "True" ]]; then
  echo "✅ Secret ${SECRET_NAME} updated on ${SCRIPT_NAME}"
  echo "$BODY" | python3 -m json.tool
else
  echo "❌ Failed (HTTP ${HTTP})"
  echo "$BODY" | python3 -m json.tool
  exit 1
fi
