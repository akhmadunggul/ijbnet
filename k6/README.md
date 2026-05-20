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

## Running the stress test

```bash
# Against staging
k6 run --env BASE_URL=https://staging.jinzai.jobagus.id k6/stress-test.js

# Against local backend
k6 run --env BASE_URL=http://localhost:3001 k6/stress-test.js

# Quick smoke test — 10 VUs for 15 s
k6 run --env BASE_URL=http://localhost:3001 \
  --stage 5s:10,30s:10,5s:0 \
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
