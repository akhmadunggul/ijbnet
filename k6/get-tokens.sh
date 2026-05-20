#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Get K6 stress-test tokens (valid 15 min).
# Usage: eval "$(bash k6/get-tokens.sh https://jinzai.jobagus.id)"
# This exports TOKEN_CANDIDATE_1..3, TOKEN_ADMIN, TOKEN_MANAGER, TOKEN_RECRUITER
# into your current shell, ready to pass to k6 run.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:-https://jinzai.jobagus.id}"
API="$BASE_URL/api"

login() {
  local EMAIL="$1" PASS="$2"
  local TOKEN
  TOKEN=$(curl -sf -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null || true)
  if [ -z "$TOKEN" ]; then
    echo "  ✗ failed: $EMAIL" >&2
  else
    echo "  ✓ $EMAIL" >&2
  fi
  echo "$TOKEN"
}

echo "Fetching tokens from $BASE_URL ..." >&2

T1=$(login 'k6.cand1@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T2=$(login 'k6.cand2@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T3=$(login 'k6.cand3@candidate.ijbnet.org' 'Demo1234!'); sleep 2
TA=$(login 'admin@ijbnet.org'                   'Demo1234!'); sleep 2
TM=$(login 'manager@ijbnet.org'                 'Demo1234!'); sleep 2
TR=$(login 'recruiter@yamada.co.jp'             'Demo1234!')

echo "" >&2
echo "Tokens obtained. Run the block below then launch k6:" >&2
echo "" >&2

# Print export statements — caller does: eval "$(bash k6/get-tokens.sh URL)"
echo "export TOKEN_CANDIDATE_1='$T1'"
echo "export TOKEN_CANDIDATE_2='$T2'"
echo "export TOKEN_CANDIDATE_3='$T3'"
echo "export TOKEN_ADMIN='$TA'"
echo "export TOKEN_MANAGER='$TM'"
echo "export TOKEN_RECRUITER='$TR'"
