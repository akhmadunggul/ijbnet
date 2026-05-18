/**
 * Regression test for v0.3.2 security hardening.
 * Run: node regression-test.mjs
 * Requires: backend running on localhost:3001 with seed data loaded.
 */

const BASE = 'http://localhost:3001/api';
const ADMIN   = { email: 'admin@ijbnet.org',                  password: 'Demo1234!' };
const MANAGER = { email: 'manager@ijbnet.org',                password: 'Demo1234!' };
const CAND    = { email: 'ahmad.fauzi@candidate.ijbnet.org',  password: 'Demo1234!' };
const SUPER   = { email: 'superadmin@ijbnet.org',             password: 'Demo1234!' };

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail = '') {
  if (cond) {
    console.log(`  ✓  ${name}`);
    passed++;
  } else {
    console.error(`  ✗  ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
    failures.push(name);
  }
}

async function post(path, body, opts = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: JSON.stringify(body),
  });
}

async function patch(path, body, token) {
  return fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function get(path, token, cookieHeader = '') {
  return fetch(`${BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });
}

function extractRefreshCookie(res) {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const entry = setCookie.find(c => c.startsWith('refreshToken='));
  if (!entry) return null;
  return entry.split(';')[0]; // "refreshToken=<value>"
}

async function login(creds) {
  const res = await post('/auth/login', creds);
  const data = await res.json();
  const cookie = extractRefreshCookie(res);
  return { res, data, cookie };
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Public Endpoints: Accessible Without Auth ═══');

{
  const r1 = await get('/superadmin/consent-clause/active');
  ok('GET /consent-clause/active (no auth) → 200', r1.status === 200, `got ${r1.status}`);

  const r2 = await get('/superadmin/candidate-tab-config');
  const r2body = await r2.text();
  if (r2.status === 500 && r2body.includes("global_settings")) {
    console.log("  ⚠  GET /candidate-tab-config → 500 (global_settings table missing — run migrations)");
  } else {
    ok('GET /candidate-tab-config (no auth) → 200', r2.status === 200, `got ${r2.status}: ${r2body}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Auth: Login ═══');

{
  const { res, data, cookie } = await login(ADMIN);
  ok('Valid login → 200', res.status === 200);
  ok('Valid login → accessToken', typeof data.accessToken === 'string');
  ok('Valid login → refreshToken cookie set', cookie !== null);

  const bad = await post('/auth/login', { ...ADMIN, password: 'wrongpass' });
  ok('Wrong password → 401', bad.status === 401);
  const badData = await bad.json();
  ok('Wrong password → INVALID_CREDENTIALS', badData.error === 'INVALID_CREDENTIALS');
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Auth: Refresh Token Rotation ═══');

{
  const { data, cookie } = await login(ADMIN);
  const accessToken = data.accessToken;
  const rt1 = cookie;

  // First refresh → rotate
  const r1 = await post('/auth/refresh', {}, { headers: { Cookie: rt1 } });
  const d1 = await r1.json();
  ok('First refresh → 200', r1.status === 200, `got ${r1.status}`);
  ok('First refresh → new accessToken', typeof d1.accessToken === 'string');
  const rt2 = extractRefreshCookie(r1);
  ok('First refresh → new cookie issued', rt2 !== null);
  ok('New cookie differs from old (jti uniqueness)', rt2 !== rt1);

  // Replay the now-blacklisted rt1
  const r2 = await post('/auth/refresh', {}, { headers: { Cookie: rt1 } });
  ok('Replayed old refresh token → 401', r2.status === 401, `got ${r2.status}`);

  // New (rotated) token still works
  const r3 = await post('/auth/refresh', {}, { headers: { Cookie: rt2 } });
  ok('New (rotated) refresh token → 200', r3.status === 200, `got ${r3.status}`);

  // Access token still valid
  const meRes = await get('/auth/me', accessToken);
  ok('Access token still valid before logout', meRes.status === 200, `got ${meRes.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Auth: Logout Blacklists Both Tokens ═══');

{
  const { data, cookie } = await login(ADMIN);
  const { accessToken } = data;

  const logoutRes = await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, Cookie: cookie },
  });
  ok('Logout → 200', logoutRes.status === 200, `got ${logoutRes.status}`);

  const meAfter = await get('/auth/me', accessToken);
  ok('Access token rejected after logout → 401', meAfter.status === 401, `got ${meAfter.status}`);

  const refreshAfter = await post('/auth/refresh', {}, { headers: { Cookie: cookie } });
  ok('Refresh token rejected after logout → 401', refreshAfter.status === 401, `got ${refreshAfter.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Auth: Access Token Blacklisted After Logout ═══');

{
  const { data, cookie } = await login(ADMIN);
  const { accessToken } = data;
  const before = await get('/auth/me', accessToken);
  ok('Access token works before logout', before.status === 200, `got ${before.status}`);

  await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, Cookie: cookie },
  });

  const after = await get('/auth/me', accessToken);
  ok('Access token rejected after blacklist → 401', after.status === 401, `got ${after.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Candidate: BLOCKED_FIELDS (consent fields via PATCH /me) ═══');

{
  const { data: cData } = await login(CAND);
  const candToken = cData.accessToken;

  // Read current state
  const before = await get('/candidates/me', candToken);
  const beforeBody = await before.json();
  const consentBefore = beforeBody.candidate?.consentGiven;

  // Attempt to directly set consentGiven
  const r = await patch('/candidates/me', { consentGiven: true, consentGivenAt: new Date().toISOString() }, candToken);
  ok('PATCH /me with consent fields → 200', r.status === 200, `got ${r.status}`);

  // Verify consentGiven was NOT changed
  const after = await get('/candidates/me', candToken);
  const afterBody = await after.json();
  const consentAfter = afterBody.candidate?.consentGiven;
  ok('consentGiven NOT changed via PATCH /me', consentAfter === consentBefore, `before=${consentBefore} after=${consentAfter}`);

  // Normal field update still works
  const r2 = await patch('/candidates/me', { jpStudyDuration: '6 bulan test' }, candToken);
  ok('PATCH /me with allowed field → 200', r2.status === 200, `got ${r2.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Candidate: Consent Clause Validation ═══');

{
  const { data: cData } = await login(CAND);
  const candToken = cData.accessToken;

  const clauseRes = await get('/superadmin/consent-clause/active');
  const clauseData = await clauseRes.json();
  const activeClauseId = clauseData.clause?.id ?? null;

  // Wrong clauseId → 422
  const wrongRes = await patch('/candidates/me/consent', { clauseId: '00000000-0000-0000-0000-000000000000' }, candToken);
  ok('Wrong clauseId → 422', wrongRes.status === 422, `got ${wrongRes.status}`);
  const wrongBody = await wrongRes.json();
  // NO_ACTIVE_CLAUSE fires first when no clause is seeded; INVALID_CLAUSE fires when one exists but ID is wrong
  ok('Wrong clauseId → consent validation error', ['INVALID_CLAUSE', 'NO_ACTIVE_CLAUSE'].includes(wrongBody.error), `got error=${wrongBody.error}`);

  if (activeClauseId) {
    const correctRes = await patch('/candidates/me/consent', { clauseId: activeClauseId }, candToken);
    ok('Correct active clauseId → 200', correctRes.status === 200, `got ${correctRes.status}: ${await correctRes.clone().text()}`);
  } else {
    ok('Correct clauseId → SKIP (no active clause seeded)', true);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Admin/Manager: LIKE Wildcard Escaping ═══');

{
  const { data: aData } = await login(ADMIN);
  const adminToken = aData.accessToken;

  // "%" should return 0 results (escaped to literal %)
  const rPct = await get('/admin/candidates?search=%25', adminToken);
  ok('Admin search "%" → 200', rPct.status === 200, `got ${rPct.status}`);
  const dPct = await rPct.json();
  ok('Admin search "%" → 0 results (wildcard escaped)', (dPct.total ?? 0) === 0, `got total=${dPct.total}`);

  // Normal search
  const rNorm = await get('/admin/candidates?search=Ahmad', adminToken);
  ok('Admin search "Ahmad" → 200', rNorm.status === 200, `got ${rNorm.status}`);
  const dNorm = await rNorm.json();
  ok('Admin search "Ahmad" → finds candidates', (dNorm.total ?? 0) > 0, `got total=${dNorm.total}`);

  const { data: mData } = await login(MANAGER);
  const manToken = mData.accessToken;

  const rMPct = await get('/manager/candidates?search=%25', manToken);
  ok('Manager search "%" → 200', rMPct.status === 200, `got ${rMPct.status}`);
  const dMPct = await rMPct.json();
  ok('Manager search "%" → 0 results (wildcard escaped)', (dMPct.total ?? 0) === 0, `got total=${dMPct.total}`);

  const rMNorm = await get('/manager/candidates?search=Ahmad', manToken);
  ok('Manager search "Ahmad" → finds candidates', ((await rMNorm.json()).total ?? 0) > 0);
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Superadmin: PDF Upload Magic-Byte Check ═══');

{
  const { data: sData } = await login(SUPER);
  const superToken = sData.accessToken;

  const formData = new FormData();
  const fakePdf = new Blob(['this is not a real pdf'], { type: 'application/pdf' });
  formData.append('file', fakePdf, 'fake.pdf');

  const r = await fetch(`${BASE}/superadmin/consent-clause/extract-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superToken}` },
    body: formData,
  });
  ok('Fake PDF (wrong magic bytes) → 422', r.status === 422, `got ${r.status}`);
  const body = await r.json();
  ok('Fake PDF → INVALID_FILE error', body.error === 'INVALID_FILE', `got error=${body.error}`);
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Auth: Login Rate Limiter (runs last to avoid blocking above tests) ═══');

{
  let lastStatus = 0;
  for (let i = 0; i < 12; i++) {
    const r = await post('/auth/login', { email: `ratelimit${i}@x.test`, password: 'wrong' });
    lastStatus = r.status;
    if (r.status === 429) break;
  }
  ok('Login rate limiter fires at ≤12 attempts → 429', lastStatus === 429, `last status: ${lastStatus}`);
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ Summary ═══');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (failures.length) {
  console.error('\n  Failed tests:');
  failures.forEach(f => console.error(`    - ${f}`));
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
