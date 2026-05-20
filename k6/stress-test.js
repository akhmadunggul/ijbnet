/**
 * IJBNet Stress Test — K6
 *
 * Usage:
 *   k6 run --env BASE_URL=https://staging.example.com k6/stress-test.js
 *
 * Scenarios (100 total VUs at steady state):
 *   candidates  70 VUs — browse profile, save fields, check timeline
 *   admins      15 VUs — list candidates, view detail, check dashboard
 *   managers    10 VUs — stats, batches list (the N+1 fix target), candidate pool
 *   recruiters   5 VUs — browse batch, view CV, check interviews
 *
 * The login rate limiter (10 req / 15 min) means VUs cannot log in independently.
 * setup() acquires all tokens once; VUs share them via round-robin on __VU index.
 *
 * Key things this test catches:
 *   - MySQL connection pool exhaustion (ER_CON_COUNT_ERROR in response body)
 *   - Slow queries under load (p95 > 2 s threshold)
 *   - Error rate spikes from any role
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────────────────────
const errorRate   = new Rate('app_errors');
const dbPoolErrors = new Rate('db_pool_errors');   // ER_CON_COUNT_ERROR / acquire timeout
const loginErrors  = new Counter('login_failures');

// ── Configuration ──────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API      = `${BASE_URL}/api`;

export const options = {
  scenarios: {
    candidates: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 70 },   // ramp up
        { duration: '60s', target: 70 },   // steady
        { duration: '10s', target: 0  },   // ramp down
      ],
      exec: 'candidateFlow',
      gracefulRampDown: '5s',
    },
    admins: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 15 },
        { duration: '60s', target: 15 },
        { duration: '10s', target: 0  },
      ],
      exec: 'adminFlow',
      gracefulRampDown: '5s',
    },
    managers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '60s', target: 10 },
        { duration: '10s', target: 0  },
      ],
      exec: 'managerFlow',
      gracefulRampDown: '5s',
    },
    recruiters: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 5 },
        { duration: '60s', target: 5 },
        { duration: '10s', target: 0 },
      ],
      exec: 'recruiterFlow',
      gracefulRampDown: '5s',
    },
  },

  thresholds: {
    http_req_failed:  ['rate<0.01'],          // <1 % HTTP errors overall
    http_req_duration: ['p(95)<2000'],        // 95th percentile under 2 s
    app_errors:        ['rate<0.01'],         // <1 % application-level errors
    db_pool_errors:    ['rate<0.001'],        // essentially zero DB pool errors
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function headers(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

/** Record whether the response indicates a DB pool problem. */
function checkDbPool(res) {
  const body = res.body || '';
  const isDbError = body.includes('ER_CON_COUNT_ERROR')
    || body.includes('acquire timeout')
    || body.includes('Too many connections')
    || body.includes('ConnectionAcquireTimeoutError');
  dbPoolErrors.add(isDbError ? 1 : 0);
  return isDbError;
}

/** Record generic app error (non-2xx that isn't a known 4xx). */
function checkAppError(res, context) {
  const ok = res.status >= 200 && res.status < 500;
  errorRate.add(!ok ? 1 : 0);
  if (!ok && res.status >= 500) {
    console.warn(`[${context}] ${res.status} — ${(res.body || '').slice(0, 120)}`);
  }
  checkDbPool(res);
  return ok;
}

function get(url, token, tag) {
  const res = http.get(url, { ...headers(token), tags: { name: tag } });
  checkAppError(res, tag);
  return res;
}

function patch(url, token, body, tag) {
  const res = http.patch(url, JSON.stringify(body), { ...headers(token), tags: { name: tag } });
  checkAppError(res, tag);
  return res;
}

/** Parse JSON safely — return null on parse failure. */
function json(res) {
  try { return res.json(); } catch { return null; }
}

// ── setup() — runs once before all VUs start ──────────────────────────────────
export function setup() {
  const credentials = {
    candidates: [
      { email: 'ahmad.fauzi@candidate.ijbnet.org',  password: 'Demo1234!' },
      { email: 'hendra.kusuma@candidate.ijbnet.org', password: 'Demo1234!' },
      { email: 'budi.santoso@candidate.ijbnet.org',  password: 'Demo1234!' },
    ],
    admin:     { email: 'admin@ijbnet.org',          password: 'Demo1234!' },
    manager:   { email: 'manager@ijbnet.org',        password: 'Demo1234!' },
    recruiter: { email: 'recruiter@yamada.co.jp',    password: 'Demo1234!' },
  };

  function login(email, password) {
    const res = http.post(
      `${API}/auth/login`,
      JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (res.status !== 200) {
      loginErrors.add(1);
      console.error(`Login failed for ${email}: ${res.status} ${res.body}`);
      return null;
    }
    return json(res)?.accessToken ?? null;
  }

  const candidateTokens = credentials.candidates.map((c) => login(c.email, c.password));
  const adminToken     = login(credentials.admin.email,     credentials.admin.password);
  const managerToken   = login(credentials.manager.email,   credentials.manager.password);
  const recruiterToken = login(credentials.recruiter.email, credentials.recruiter.password);

  // Pre-fetch candidate IDs so admin/manager/recruiter VUs can request specific profiles.
  let candidateIds = [];
  if (adminToken) {
    const listRes = http.get(`${API}/admin/candidates?pageSize=10`, headers(adminToken));
    const data = json(listRes);
    candidateIds = (data?.candidates ?? []).map((c) => c.id).filter(Boolean);
  }

  // Pre-fetch a batch ID for manager and recruiter flows.
  let batchIds = [];
  if (managerToken) {
    const batchRes = http.get(`${API}/manager/batches?pageSize=5`, headers(managerToken));
    const data = json(batchRes);
    batchIds = (data?.batches ?? []).map((b) => b.id).filter(Boolean);
  }

  return { candidateTokens, adminToken, managerToken, recruiterToken, candidateIds, batchIds };
}

// ── Candidate flow ─────────────────────────────────────────────────────────────
// Simulates a candidate browsing their portal: loads profile, checks timeline,
// occasionally saves a field. Mirrors the real frontend polling cadence.
export function candidateFlow(data) {
  const token = data.candidateTokens[__VU % data.candidateTokens.length];
  if (!token) { sleep(1); return; }

  group('candidate: load dashboard', () => {
    get(`${API}/candidates/me`, token, 'GET /candidates/me');
    sleep(0.3);
    // Tab config and translation config are fetched on CV page load
    get(`${API}/superadmin/candidate-tab-config`, token, 'GET /candidate-tab-config');
    get(`${API}/superadmin/translation-config`,   token, 'GET /translation-config');
  });

  sleep(jitter(1.5, 3));

  group('candidate: check notifications + timeline', () => {
    get(`${API}/candidates/me/timeline`,          token, 'GET /me/timeline');
    get(`${API}/candidates/me/interview/pending`, token, 'GET /me/interview/pending');
  });

  sleep(jitter(2, 4));

  // 30 % of the time, simulate saving a profile field (triggers translation logic + DB write)
  if (Math.random() < 0.30) {
    group('candidate: save profile field', () => {
      patch(
        `${API}/candidates/me`,
        token,
        { selfIntroId: `Saya berpengalaman di bidang manufaktur selama ${Math.floor(Math.random() * 5) + 1} tahun.` },
        'PATCH /candidates/me',
      );
    });
    sleep(jitter(1, 2));
  }

  sleep(jitter(1, 2));
}

// ── Admin flow ─────────────────────────────────────────────────────────────────
// Simulates an LPK admin reviewing candidates: list → detail → dashboard.
export function adminFlow(data) {
  const token = data.adminToken;
  if (!token) { sleep(1); return; }

  group('admin: candidate list', () => {
    const res = get(`${API}/admin/candidates?page=1&pageSize=10`, token, 'GET /admin/candidates');
    // Pick a random ID from the response for the detail request
    const freshIds = (json(res)?.candidates ?? []).map((c) => c.id);
    const ids = freshIds.length ? freshIds : data.candidateIds;

    if (ids.length) {
      sleep(jitter(0.5, 1.5));
      const id = ids[Math.floor(Math.random() * ids.length)];
      group('admin: candidate detail', () => {
        get(`${API}/admin/candidates/${id}`, token, 'GET /admin/candidates/:id');
        sleep(0.3);
        get(`${API}/admin/candidates/${id}/timeline`, token, 'GET /admin/candidates/:id/timeline');
      });
    }
  });

  sleep(jitter(2, 4));

  group('admin: dashboard', () => {
    get(`${API}/admin/dashboard`, token, 'GET /admin/dashboard');
  });

  sleep(jitter(2, 5));
}

// ── Manager flow ───────────────────────────────────────────────────────────────
// Simulates a manager checking stats, the batch list (N+1 fix target), and pool.
export function managerFlow(data) {
  const token = data.managerToken;
  if (!token) { sleep(1); return; }

  group('manager: stats', () => {
    get(`${API}/manager/stats`, token, 'GET /manager/stats');
  });

  sleep(jitter(1, 2));

  group('manager: batches list (N+1 fix target)', () => {
    const res = get(`${API}/manager/batches?pageSize=20`, token, 'GET /manager/batches');
    check(res, {
      'batches have selectedCount': (r) => {
        const batches = json(r)?.batches ?? [];
        return batches.length === 0 || typeof batches[0].selectedCount === 'number';
      },
    });

    // Drill into a batch detail if available
    const batchId = (json(res)?.batches ?? [])[0]?.id ?? data.batchIds[0];
    if (batchId) {
      sleep(jitter(0.5, 1));
      group('manager: batch detail', () => {
        get(`${API}/manager/batches/${batchId}`, token, 'GET /manager/batches/:id');
      });
    }
  });

  sleep(jitter(2, 4));

  group('manager: candidate pool', () => {
    get(`${API}/manager/candidates?pageSize=10`, token, 'GET /manager/candidates');
  });

  sleep(jitter(2, 4));
}

// ── Recruiter flow ─────────────────────────────────────────────────────────────
// Simulates a recruiter browsing the selection batch and viewing candidate CVs.
export function recruiterFlow(data) {
  const token = data.recruiterToken;
  if (!token) { sleep(1); return; }

  group('recruiter: browse batch', () => {
    get(`${API}/recruiter/batch`, token, 'GET /recruiter/batch');
  });

  sleep(jitter(1, 3));

  // View a specific candidate if IDs are available
  if (data.candidateIds.length) {
    const id = data.candidateIds[Math.floor(Math.random() * data.candidateIds.length)];
    group('recruiter: candidate detail', () => {
      get(`${API}/recruiter/candidates/${id}`, token, 'GET /recruiter/candidates/:id');
    });
    sleep(jitter(1, 2));
  }

  group('recruiter: interviews', () => {
    get(`${API}/recruiter/interviews`, token, 'GET /recruiter/interviews');
  });

  sleep(jitter(2, 5));
}

// ── Utilities ──────────────────────────────────────────────────────────────────

/** Random sleep between min and max seconds — simulates human think time. */
function jitter(min, max) {
  return min + Math.random() * (max - min);
}
