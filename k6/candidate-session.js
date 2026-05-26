/**
 * IJBNet — Candidate Full-Session Load Test (20 VUs)
 *
 * Simulates 20 concurrent candidates doing a realistic portal session:
 *   load profile page → check timeline → edit a field → save → refetch
 *
 * Prerequisites
 * ─────────────
 * 1. Ensure all 20 k6 test accounts exist in the database:
 *      docker compose -f docker-compose.prod.yml exec backend sh -c \
 *        "cd /app/apps/backend && NODE_ENV=production npx sequelize-cli db:seed \
 *         --seed 20250101000100-k6-test-candidates.ts"
 *
 * 2. Set LOAD_TEST_BYPASS_KEY in the server .env — this header bypasses the
 *    per-IP login rate limiter so all 20 logins can complete in setup().
 *
 * 3. Pre-fetch tokens (they expire in 15 min — do this right before running):
 *      eval "$(bash k6/get-tokens.sh https://jinzai.jobagus.id)"
 *
 * 4. Run:
 *      k6 run \
 *        --env BASE_URL=https://jinzai.jobagus.id \
 *        --env BYPASS_KEY=$LOAD_TEST_BYPASS_KEY \
 *        --env TOKEN_CANDIDATE_1=$TOKEN_CANDIDATE_1 \
 *        --env TOKEN_CANDIDATE_2=$TOKEN_CANDIDATE_2 \
 *        --env TOKEN_CANDIDATE_3=$TOKEN_CANDIDATE_3 \
 *        --env TOKEN_CANDIDATE_4=$TOKEN_CANDIDATE_4 \
 *        --env TOKEN_CANDIDATE_5=$TOKEN_CANDIDATE_5 \
 *        --env TOKEN_CANDIDATE_6=$TOKEN_CANDIDATE_6 \
 *        --env TOKEN_CANDIDATE_7=$TOKEN_CANDIDATE_7 \
 *        --env TOKEN_CANDIDATE_8=$TOKEN_CANDIDATE_8 \
 *        --env TOKEN_CANDIDATE_9=$TOKEN_CANDIDATE_9 \
 *        --env TOKEN_CANDIDATE_10=$TOKEN_CANDIDATE_10 \
 *        --env TOKEN_CANDIDATE_11=$TOKEN_CANDIDATE_11 \
 *        --env TOKEN_CANDIDATE_12=$TOKEN_CANDIDATE_12 \
 *        --env TOKEN_CANDIDATE_13=$TOKEN_CANDIDATE_13 \
 *        --env TOKEN_CANDIDATE_14=$TOKEN_CANDIDATE_14 \
 *        --env TOKEN_CANDIDATE_15=$TOKEN_CANDIDATE_15 \
 *        --env TOKEN_CANDIDATE_16=$TOKEN_CANDIDATE_16 \
 *        --env TOKEN_CANDIDATE_17=$TOKEN_CANDIDATE_17 \
 *        --env TOKEN_CANDIDATE_18=$TOKEN_CANDIDATE_18 \
 *        --env TOKEN_CANDIDATE_19=$TOKEN_CANDIDATE_19 \
 *        --env TOKEN_CANDIDATE_20=$TOKEN_CANDIDATE_20 \
 *        k6/candidate-session.js
 *
 *    Or without pre-supplied tokens (setup() will login sequentially,
 *    requires BYPASS_KEY to avoid rate limiting):
 *      k6 run \
 *        --env BASE_URL=https://jinzai.jobagus.id \
 *        --env BYPASS_KEY=$LOAD_TEST_BYPASS_KEY \
 *        k6/candidate-session.js
 *
 * Load profile
 * ────────────
 *   0 → 20 VUs over 30 s  (ramp up)
 *  20 VUs for 2 min        (steady state)
 *  20 → 0 VUs over 30 s   (ramp down)
 *  Total wall time: ~3 min
 *
 * Each VU is pinned to one account (__VU mod 20), so there is no shared
 * state or write contention between virtual users.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────────
const loginFailRate   = new Rate('login_failures');
const profileLoadTime = new Trend('profile_load_ms',  true);
const profileSaveTime = new Trend('profile_save_ms',  true);
const errorRate       = new Rate('app_errors');

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE_URL   = __ENV.BASE_URL   || 'https://jinzai.jobagus.id';
const API        = `${BASE_URL}/api`;
const BYPASS_KEY = __ENV.BYPASS_KEY || '';

const ACCOUNTS = Array.from({ length: 20 }, (_, i) => ({
  email:  `k6.cand${i + 1}@candidate.ijbnet.org`,
  envKey: `TOKEN_CANDIDATE_${i + 1}`,
}));

// ── Options ────────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp up
    { duration: '2m',  target: 20 },   // steady state
    { duration: '30s', target: 0  },   // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // < 1 % HTTP errors
    http_req_duration: ['p(95)<2000'],  // 95th pct < 2 s overall
    profile_load_ms:   ['p(95)<1500'],  // profile fetch < 1.5 s
    profile_save_ms:   ['p(95)<2000'],  // profile PATCH < 2 s
    login_failures:    ['rate<0.02'],   // < 2 % login failures in setup
    app_errors:        ['rate<0.01'],   // < 1 % app-level 5xx
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function authParams(token, tag) {
  const h = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (BYPASS_KEY) h['X-Load-Test-Key'] = BYPASS_KEY;
  return { headers: h, tags: { name: tag } };
}

function checkOk(res, context) {
  const ok = res.status >= 200 && res.status < 500;
  errorRate.add(res.status >= 500 ? 1 : 0);
  if (res.status >= 500) {
    console.warn(`[${context}] ${res.status} — ${(res.body || '').slice(0, 120)}`);
  }
  return ok;
}

function jitter(min, max) {
  return min + Math.random() * (max - min);
}

// ── setup() — runs once; logs in all 20 accounts ──────────────────────────────
export function setup() {
  const loginH = { 'Content-Type': 'application/json' };
  if (BYPASS_KEY) loginH['X-Load-Test-Key'] = BYPASS_KEY;

  const tokens = ACCOUNTS.map((acc, i) => {
    // Use pre-supplied env token to avoid hitting the rate limiter at all
    const pre = __ENV[acc.envKey] || null;
    if (pre) {
      console.log(`  → pre-supplied: ${acc.email}`);
      return pre;
    }

    // Stagger logins 2 s apart so burst doesn't trip the per-IP rate limiter
    if (i > 0) sleep(2);

    const res = http.post(
      `${API}/auth/login`,
      JSON.stringify({ email: acc.email, password: 'Demo1234!' }),
      { headers: loginH },
    );

    if (res.status !== 200) {
      console.error(`  ✗ login failed ${acc.email}: ${res.status} — ${res.body}`);
      loginFailRate.add(1);
      return null;
    }

    let token = null;
    try { token = res.json().accessToken; } catch { /* ignore */ }
    if (token) {
      console.log(`  ✓ logged in: ${acc.email}`);
    } else {
      console.error(`  ✗ no token in response for ${acc.email}`);
      loginFailRate.add(1);
    }
    return token;
  });

  const valid = tokens.filter(Boolean).length;
  console.log(`\nSetup complete — ${valid}/20 tokens ready\n`);
  if (valid === 0) {
    console.error('No tokens obtained. Pass BYPASS_KEY or pre-supply TOKEN_CANDIDATE_* vars.');
  }

  return { tokens };
}

// ── Main VU function ───────────────────────────────────────────────────────────
export default function (data) {
  // Each VU is pinned to a fixed account — no shared write contention
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  if (!token) { sleep(2); return; }

  // ── 1. Load profile page ────────────────────────────────────────────────────
  // The frontend fires these three requests on CandidateProfile mount.
  group('load profile page', () => {
    const t0 = Date.now();
    const profileRes = http.get(
      `${API}/candidates/me`,
      authParams(token, 'GET /candidates/me'),
    );
    profileLoadTime.add(Date.now() - t0);

    check(profileRes, {
      'profile 200':    (r) => r.status === 200,
      'has candidate':  (r) => { try { return !!r.json().candidate; } catch { return false; } },
    });
    checkOk(profileRes, 'GET /candidates/me');

    // Tab config + LPK list load in parallel (same as React useQuery)
    http.batch([
      { method: 'GET', url: `${API}/superadmin/candidate-tab-config`, params: authParams(token, 'GET /tab-config') },
      { method: 'GET', url: `${API}/candidates/lpks`,                  params: authParams(token, 'GET /lpks') },
    ]);
  });

  sleep(jitter(2, 4)); // user reads the page

  // ── 2. Check status timeline ────────────────────────────────────────────────
  group('check timeline', () => {
    const res = http.get(
      `${API}/candidates/me/timeline`,
      authParams(token, 'GET /me/timeline'),
    );
    check(res, { 'timeline 200': (r) => r.status === 200 });
    checkOk(res, 'GET /me/timeline');
  });

  sleep(jitter(1, 3)); // browsing tabs

  // ── 3. Edit and save a profile field ────────────────────────────────────────
  // Writes hobbies — lightweight, no translation trigger, no file I/O.
  // Each VU writes a unique value to avoid false-cache reads.
  group('save profile field', () => {
    const t0 = Date.now();
    const res = http.patch(
      `${API}/candidates/me`,
      JSON.stringify({ hobbies: `membaca, olahraga (vu${__VU}-${Date.now()})` }),
      authParams(token, 'PATCH /candidates/me'),
    );
    profileSaveTime.add(Date.now() - t0);

    check(res, { 'save 200': (r) => r.status === 200 });
    checkOk(res, 'PATCH /candidates/me');
  });

  sleep(jitter(1, 2));

  // ── 4. Re-fetch profile (mirrors React Query invalidateQueries on save) ─────
  group('refetch after save', () => {
    const res = http.get(
      `${API}/candidates/me`,
      authParams(token, 'GET /candidates/me'),
    );
    check(res, { 'refetch 200': (r) => r.status === 200 });
    checkOk(res, 'GET /candidates/me refetch');
  });

  sleep(jitter(2, 5)); // user reviews result before next iteration begins
}
