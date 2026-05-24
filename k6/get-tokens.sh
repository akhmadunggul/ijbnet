#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Get K6 stress-test tokens (valid 15 min).
# Usage: eval "$(bash k6/get-tokens.sh https://jinzai.jobagus.id)"
# This exports TOKEN_CANDIDATE_1..16, TOKEN_ADMIN, TOKEN_MANAGER, TOKEN_RECRUITER
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

T1=$(login  'k6.cand1@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T2=$(login  'k6.cand2@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T3=$(login  'k6.cand3@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T4=$(login  'k6.cand4@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T5=$(login  'k6.cand5@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T6=$(login  'k6.cand6@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T7=$(login  'k6.cand7@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T8=$(login  'k6.cand8@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T9=$(login  'k6.cand9@candidate.ijbnet.org'  'Demo1234!'); sleep 2
T10=$(login 'k6.cand10@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T11=$(login 'k6.cand11@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T12=$(login 'k6.cand12@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T13=$(login 'k6.cand13@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T14=$(login 'k6.cand14@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T15=$(login 'k6.cand15@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T16=$(login 'k6.cand16@candidate.ijbnet.org' 'Demo1234!'); sleep 2
TA=$(login  'admin@ijbnet.org'               'Demo1234!'); sleep 2
TM=$(login  'manager@ijbnet.org'             'Demo1234!'); sleep 2
TR=$(login  'recruiter@yamada.co.jp'         'Demo1234!')

echo "" >&2
echo "Tokens obtained. Run the block below then launch k6:" >&2
echo "" >&2

# Print export statements — caller does: eval "$(bash k6/get-tokens.sh URL)"
echo "export TOKEN_CANDIDATE_1='$T1'"
echo "export TOKEN_CANDIDATE_2='$T2'"
echo "export TOKEN_CANDIDATE_3='$T3'"
echo "export TOKEN_CANDIDATE_4='$T4'"
echo "export TOKEN_CANDIDATE_5='$T5'"
echo "export TOKEN_CANDIDATE_6='$T6'"
echo "export TOKEN_CANDIDATE_7='$T7'"
echo "export TOKEN_CANDIDATE_8='$T8'"
echo "export TOKEN_CANDIDATE_9='$T9'"
echo "export TOKEN_CANDIDATE_10='$T10'"
echo "export TOKEN_CANDIDATE_11='$T11'"
echo "export TOKEN_CANDIDATE_12='$T12'"
echo "export TOKEN_CANDIDATE_13='$T13'"
echo "export TOKEN_CANDIDATE_14='$T14'"
echo "export TOKEN_CANDIDATE_15='$T15'"
echo "export TOKEN_CANDIDATE_16='$T16'"
echo "export TOKEN_ADMIN='$TA'"
echo "export TOKEN_MANAGER='$TM'"
echo "export TOKEN_RECRUITER='$TR'"
