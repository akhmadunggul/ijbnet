#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Get K6 stress-test tokens (valid 15 min).
# Usage: eval "$(bash k6/get-tokens.sh https://jinzai.jobagus.id)"
# This exports TOKEN_CANDIDATE_1..50, TOKEN_ADMIN, TOKEN_MANAGER, TOKEN_RECRUITER
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
T17=$(login 'k6.cand17@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T18=$(login 'k6.cand18@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T19=$(login 'k6.cand19@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T20=$(login 'k6.cand20@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T21=$(login 'k6.cand21@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T22=$(login 'k6.cand22@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T23=$(login 'k6.cand23@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T24=$(login 'k6.cand24@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T25=$(login 'k6.cand25@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T26=$(login 'k6.cand26@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T27=$(login 'k6.cand27@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T28=$(login 'k6.cand28@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T29=$(login 'k6.cand29@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T30=$(login 'k6.cand30@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T31=$(login 'k6.cand31@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T32=$(login 'k6.cand32@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T33=$(login 'k6.cand33@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T34=$(login 'k6.cand34@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T35=$(login 'k6.cand35@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T36=$(login 'k6.cand36@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T37=$(login 'k6.cand37@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T38=$(login 'k6.cand38@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T39=$(login 'k6.cand39@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T40=$(login 'k6.cand40@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T41=$(login 'k6.cand41@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T42=$(login 'k6.cand42@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T43=$(login 'k6.cand43@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T44=$(login 'k6.cand44@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T45=$(login 'k6.cand45@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T46=$(login 'k6.cand46@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T47=$(login 'k6.cand47@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T48=$(login 'k6.cand48@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T49=$(login 'k6.cand49@candidate.ijbnet.org' 'Demo1234!'); sleep 2
T50=$(login 'k6.cand50@candidate.ijbnet.org' 'Demo1234!'); sleep 2
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
echo "export TOKEN_CANDIDATE_17='$T17'"
echo "export TOKEN_CANDIDATE_18='$T18'"
echo "export TOKEN_CANDIDATE_19='$T19'"
echo "export TOKEN_CANDIDATE_20='$T20'"
echo "export TOKEN_CANDIDATE_21='$T21'"
echo "export TOKEN_CANDIDATE_22='$T22'"
echo "export TOKEN_CANDIDATE_23='$T23'"
echo "export TOKEN_CANDIDATE_24='$T24'"
echo "export TOKEN_CANDIDATE_25='$T25'"
echo "export TOKEN_CANDIDATE_26='$T26'"
echo "export TOKEN_CANDIDATE_27='$T27'"
echo "export TOKEN_CANDIDATE_28='$T28'"
echo "export TOKEN_CANDIDATE_29='$T29'"
echo "export TOKEN_CANDIDATE_30='$T30'"
echo "export TOKEN_CANDIDATE_31='$T31'"
echo "export TOKEN_CANDIDATE_32='$T32'"
echo "export TOKEN_CANDIDATE_33='$T33'"
echo "export TOKEN_CANDIDATE_34='$T34'"
echo "export TOKEN_CANDIDATE_35='$T35'"
echo "export TOKEN_CANDIDATE_36='$T36'"
echo "export TOKEN_CANDIDATE_37='$T37'"
echo "export TOKEN_CANDIDATE_38='$T38'"
echo "export TOKEN_CANDIDATE_39='$T39'"
echo "export TOKEN_CANDIDATE_40='$T40'"
echo "export TOKEN_CANDIDATE_41='$T41'"
echo "export TOKEN_CANDIDATE_42='$T42'"
echo "export TOKEN_CANDIDATE_43='$T43'"
echo "export TOKEN_CANDIDATE_44='$T44'"
echo "export TOKEN_CANDIDATE_45='$T45'"
echo "export TOKEN_CANDIDATE_46='$T46'"
echo "export TOKEN_CANDIDATE_47='$T47'"
echo "export TOKEN_CANDIDATE_48='$T48'"
echo "export TOKEN_CANDIDATE_49='$T49'"
echo "export TOKEN_CANDIDATE_50='$T50'"
echo "export TOKEN_ADMIN='$TA'"
echo "export TOKEN_MANAGER='$TM'"
echo "export TOKEN_RECRUITER='$TR'"
