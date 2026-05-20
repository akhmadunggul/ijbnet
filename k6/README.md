# K6 Stress Tests

## Prerequisites

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (via winget)
winget install k6
```

## One-time setup — seed K6 test accounts on the target server

The stress test uses three dedicated candidate accounts (`k6.cand1`, `k6.cand2`, `k6.cand3`).
Run this once per environment after deploying (idempotent — safe to re-run):

```bash
# Inside the running backend container
docker exec -it ijbnet_backend-1 sh -c \
  "cd /app/apps/backend && NODE_ENV=production npx sequelize-cli db:seed --seed 20250101000100-k6-test-candidates.ts"
```

The seeder attaches the test candidates to the first active LPK in the database.
Demo admin/manager/recruiter accounts (`admin@ijbnet.org` etc.) must also exist (run the
main seeder if they don't).

## Running the stress test

The login endpoint is rate-limited to **10 req / 15 min per IP**, so tokens must be obtained
**before** starting K6 — not during the run.

### Step 1 — get tokens (run once per test session)

```bash
# Tokens are valid for 15 minutes — do this immediately before launching K6
eval "$(bash k6/get-tokens.sh https://jinzai.jobagus.id)"
```

`get-tokens.sh` exports six shell variables:
`TOKEN_CANDIDATE_1`, `TOKEN_CANDIDATE_2`, `TOKEN_CANDIDATE_3`,
`TOKEN_ADMIN`, `TOKEN_MANAGER`, `TOKEN_RECRUITER`

### Step 2 — launch the test

```bash
k6 run \
  --env BASE_URL=https://jinzai.jobagus.id \
  --env TOKEN_CANDIDATE_1=$TOKEN_CANDIDATE_1 \
  --env TOKEN_CANDIDATE_2=$TOKEN_CANDIDATE_2 \
  --env TOKEN_CANDIDATE_3=$TOKEN_CANDIDATE_3 \
  --env TOKEN_ADMIN=$TOKEN_ADMIN \
  --env TOKEN_MANAGER=$TOKEN_MANAGER \
  --env TOKEN_RECRUITER=$TOKEN_RECRUITER \
  k6/stress-test.js
```

#### Against staging

```bash
eval "$(bash k6/get-tokens.sh https://staging.jinzai.jobagus.id)"
k6 run \
  --env BASE_URL=https://staging.jinzai.jobagus.id \
  --env TOKEN_CANDIDATE_1=$TOKEN_CANDIDATE_1 \
  --env TOKEN_CANDIDATE_2=$TOKEN_CANDIDATE_2 \
  --env TOKEN_CANDIDATE_3=$TOKEN_CANDIDATE_3 \
  --env TOKEN_ADMIN=$TOKEN_ADMIN \
  --env TOKEN_MANAGER=$TOKEN_MANAGER \
  --env TOKEN_RECRUITER=$TOKEN_RECRUITER \
  k6/stress-test.js
```

#### Against local backend (loopback — rate limit bypassed automatically)

```bash
k6 run --env BASE_URL=http://localhost:3001 k6/stress-test.js
```

No token pre-supply is needed for localhost because the global rate limiter skips loopback
requests (`127.0.0.1` / `::1`). `setup()` will fall back to inline login.

#### Quick smoke test — 10 VUs for 30 s

```bash
k6 run --env BASE_URL=http://localhost:3001 \
  --env TOKEN_ADMIN=$TOKEN_ADMIN \
  k6/stress-test.js
```

## What it tests

| Scenario | VUs | Key endpoints |
|---|---|---|
| candidates | 70 | `GET /candidates/me`, `PATCH /candidates/me`, translation config, timeline |
| admins | 15 | `GET /admin/candidates`, candidate detail + timeline, dashboard |
| managers | 10 | `GET /manager/stats`, `GET /manager/batches` (N+1 fix), batch detail |
| recruiters | 5 | `GET /recruiter/batch`, candidate detail, interviews |

## Thresholds (test fails if breached)

| Metric | Threshold |
|---|---|
| `http_req_failed` | < 1 % |
| `http_req_duration` p95 | < 2 000 ms |
| `app_errors` | < 1 % |
| `db_pool_errors` | < 0.1 % (essentially zero) |

## Reading the results

After the run K6 prints a summary. Key lines to check:

```
✓ http_req_failed............: 0.00%
✓ http_req_duration...........: p(95)=312ms
✓ db_pool_errors..............: 0.00%
```

If `db_pool_errors` is non-zero, check the backend logs for `ER_CON_COUNT_ERROR`
or `ConnectionAcquireTimeoutError`. Raise `pool.max` in `db/connection.ts`
and re-test.

## Notes

- The login rate limiter (10 req / 15 min) means all logins happen in `setup()`.
  If the staging DB is empty and demo seed data is missing, `setup()` will log
  warnings and VUs that receive a null token will no-op.
- `PATCH /candidates/me` with `selfIntroId` triggers the auto-translate path on
  the backend — useful for verifying the LibreTranslate timeout does not hold
  DB connections.
- Test accounts use password `Demo1234!` and are attached to the first active LPK
  found in the database.
