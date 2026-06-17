import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Op, fn, col } from 'sequelize';
import { isUUID, isEmail } from 'validator';
import bcrypt from 'bcrypt';
import nodeCrypto from 'crypto';
import multer from 'multer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
import { authenticate, requireRole } from '../middleware/auth';
import { redisClient, cacheGet, cacheSet, cacheDel } from '../utils/redis';
import { getMetrics, recordDbError, getMetricsRange, type MetricsRange } from '../utils/monitor';
import { config } from '../config';
import { validateUuidParam } from '../middleware/rbac';
import {
  sequelize,
  User,
  Company,
  Lpk,
  Candidate,
  CandidateBodyCheck,
  CandidateJapaneseTest,
  CandidateCareer,
  CandidateEducationHistory,
  Batch,
  BatchCandidate,
  InterviewProposal,
  AuditLog,
  ConsentClause,
  GlobalSettings,
} from '../db/models/index';
import { serializeCandidate, serializeUser } from '../serializers/candidate';
import { candidateIncludes } from '../utils/candidateIncludes';
import { calcCompleteness, setCompletenessMode, type CompletenessMode } from '../utils/completeness';
import { deleteCandidatePhotos } from '../utils/storage';
import { decryptNullable, encrypt } from '../utils/crypto';
import { getDeepSeekApiKey } from '../utils/translate';

const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

function generatePassword(len = 16): string {
  return nodeCrypto.randomBytes(24).toString('base64').slice(0, len);
}

const router = Router();

// ── GET /api/superadmin/consent-clause/active — PUBLIC (no auth) ──────────────
// Candidates must read the clause before consenting, so this must be unauthenticated.
router.get('/consent-clause/active', wrap(async (_req, res) => {
  const clause = await ConsentClause.findOne({ where: { isActive: true } });
  if (!clause) {
    res.json({ clause: null });
    return;
  }
  const c = clause.toJSON() as unknown as Record<string, unknown>;
  res.json({
    clause: {
      id:          c['id'],
      version:     c['version'],
      content:     c['content'],
      contentJa:   c['contentJa'] ?? null,
      publishedAt: c['publishedAt'] ?? null,
    },
  });
}));

// ── GET /api/superadmin/candidate-tab-config — PUBLIC ────────────────────────
// Candidate portal reads this to know which tabs to display.
router.get('/candidate-tab-config', wrap(async (_req, res) => {
  const cached = await cacheGet('gs:tab_config');
  if (cached) { res.json(JSON.parse(cached)); return; }
  const row = await GlobalSettings.findOne({ where: { key: 'candidate_tab_config' } });
  const defaultConfig = { tab1: true, tab2: true, tab3: true, tab4: true, tab5: true, tab6: true, tab7: true, tab8: true, tab9: true };
  const payload = { config: row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] : defaultConfig };
  await cacheSet('gs:tab_config', JSON.stringify(payload), 60);
  res.json(payload);
}));

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 6)}****${key.slice(-4)}`;
}

// ── GET /api/superadmin/translation-status — PUBLIC ──────────────────────────
router.get('/translation-status', wrap(async (_req, res) => {
  const activeKey = await getDeepSeekApiKey();
  const services = [
    {
      id: 'deepseek',
      name: 'DeepSeek API',
      model: 'deepseek-chat',
      endpoint: 'https://api.deepseek.com',
      keyConfigured: !!activeKey,
    },
  ];
  res.json({ services });
}));

// ── POST /api/superadmin/translation-status/test — PUBLIC ────────────────────
router.post('/translation-status/test', wrap(async (req, res) => {
  const { serviceId } = req.body as { serviceId?: string };

  if (serviceId === 'deepseek') {
    const apiKey = await getDeepSeekApiKey();
    if (!apiKey) {
      res.json({ status: 'not_configured', latencyMs: null });
      return;
    }
    const start = Date.now();
    try {
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'こんにちは' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const latencyMs = Date.now() - start;
      let errorDetail: string | null = null;
      if (!resp.ok) {
        try {
          const body = await resp.json() as Record<string, unknown>;
          const msg = (body['error'] as Record<string, unknown> | null)?.['message']
            ?? body['message']
            ?? JSON.stringify(body);
          errorDetail = String(msg).slice(0, 200);
        } catch { errorDetail = `HTTP ${resp.status}`; }
      }
      res.json({ status: resp.ok ? 'online' : 'error', latencyMs, httpStatus: resp.status, errorDetail });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      res.json({ status: 'offline', latencyMs: Date.now() - start, errorDetail: msg });
    }
    return;
  }

  res.status(400).json({ error: 'UNKNOWN_SERVICE' });
}));

// ── GET /api/superadmin/translation-api-config — superadmin only ─────────────
// (placed before the auth middleware so it is PUBLIC for status check;
//  write access is auth-gated in the PUT below after router.use(authenticate))
router.get('/translation-api-config', wrap(async (_req, res) => {
  const dbRow = await GlobalSettings.findOne({ where: { key: 'deepseek_api_key' } });
  if (dbRow) {
    const encrypted = (dbRow.toJSON() as unknown as Record<string, unknown>)['value'];
    if (typeof encrypted === 'string' && encrypted) {
      const plain = decryptNullable(encrypted);
      res.json({ keySource: 'db', keyMasked: plain ? maskApiKey(plain) : null });
      return;
    }
  }
  const envKey = process.env['DEEPSEEK_API_KEY'];
  if (envKey) {
    res.json({ keySource: 'env', keyMasked: maskApiKey(envKey) });
    return;
  }
  res.json({ keySource: 'none', keyMasked: null });
}));

// ── GET /api/superadmin/translation-config — PUBLIC ──────────────────────────
router.get('/translation-config', wrap(async (_req, res) => {
  const cached = await cacheGet('gs:translate');
  if (cached) { res.json(JSON.parse(cached)); return; }
  const row = await GlobalSettings.findOne({ where: { key: 'auto_translate_enabled' } });
  const payload = { enabled: row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] !== false : true };
  await cacheSet('gs:translate', JSON.stringify(payload), 60);
  res.json(payload);
}));

// ── GET /api/superadmin/cv-font — PUBLIC ─────────────────────────────────────
router.get('/cv-font', wrap(async (_req, res) => {
  const cached = await cacheGet('gs:cv_font');
  if (cached) { res.json(JSON.parse(cached)); return; }
  const row = await GlobalSettings.findOne({ where: { key: 'cv_font' } });
  const payload = { fontKey: row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] : 'ms-mincho' };
  await cacheSet('gs:cv_font', JSON.stringify(payload), 60);
  res.json(payload);
}));

// ── GET /api/superadmin/cv-layout — PUBLIC ───────────────────────────────────
router.get('/cv-layout', wrap(async (_req, res) => {
  const cached = await cacheGet('gs:cv_layout');
  if (cached) { res.json(JSON.parse(cached)); return; }
  const row = await GlobalSettings.findOne({ where: { key: 'cv_layout' } });
  const payload = { layout: row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] : 'layout1' };
  await cacheSet('gs:cv_layout', JSON.stringify(payload), 60);
  res.json(payload);
}));

// ── GET /api/superadmin/completeness-mode — PUBLIC ───────────────────────────
router.get('/completeness-mode', wrap(async (_req, res) => {
  const cached = await cacheGet('gs:completeness');
  if (cached) { res.json(JSON.parse(cached)); return; }
  const row = await GlobalSettings.findOne({ where: { key: 'completeness_mode' } });
  const payload = { mode: row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] : 'legacy' };
  await cacheSet('gs:completeness', JSON.stringify(payload), 60);
  res.json(payload);
}));

// ── GET /api/superadmin/photo-bg-color — PUBLIC ───────────────────────────────
router.get('/photo-bg-color', wrap(async (_req, res) => {
  const row = await GlobalSettings.findOne({ where: { key: 'photo_bg_color' } });
  const color = row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] as string : '';
  res.json({ color, enabled: Boolean(color) });
}));

// ── GET /api/superadmin/recruiter-selection-columns — PUBLIC ─────────────────
router.get('/recruiter-selection-columns', wrap(async (_req, res) => {
  const row = await GlobalSettings.findOne({ where: { key: 'recruiter_selection_columns' } });
  const defaultConfig = {
    foto: true, nama: true, ju: true, pendidikan: true, program: true,
    bahasaJp: true, cekFisik: true, fotoBadan: true, video: true, profil: true, resume: true, pilih: true,
  };
  res.json({ config: row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] : defaultConfig });
}));

// ── GET /api/superadmin/journey-visualization — PUBLIC ───────────────────────
router.get('/journey-visualization', wrap(async (_req, res) => {
  const row = await GlobalSettings.findOne({ where: { key: 'journey_visualization' } });
  const mode = row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] : 'graphical';
  res.json({ mode });
}));

// ── GET /api/superadmin/shokumu-config — PUBLIC ──────────────────────────────
router.get('/shokumu-config', wrap(async (_req, res) => {
  const [enabledRow, layoutRow, mergeRow, rolloutModeRow, rolloutLpkRow, templateRow, recruiterRow] = await Promise.all([
    GlobalSettings.findOne({ where: { key: 'shokumu_enabled' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_layout' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_merge_cv' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_rollout_mode' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_rollout_lpk_ids' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_template' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_recruiter_enabled' } }),
  ]);
  const enabled          = enabledRow      ? (enabledRow.toJSON()      as unknown as Record<string, unknown>)['value'] === true  : false;
  const layout           = layoutRow       ? String((layoutRow.toJSON() as unknown as Record<string, unknown>)['value'] ?? 'reverse') : 'reverse';
  const mergeCv          = mergeRow        ? (mergeRow.toJSON()        as unknown as Record<string, unknown>)['value'] === true  : false;
  const rolloutMode      = rolloutModeRow  ? String((rolloutModeRow.toJSON()  as unknown as Record<string, unknown>)['value'] ?? 'all') : 'all';
  const rolloutLpkIds    = rolloutLpkRow
    ? ((rolloutLpkRow.toJSON() as unknown as Record<string, unknown>)['value'] as string[] | null) ?? []
    : [];
  const template         = templateRow  ? String((templateRow.toJSON()  as unknown as Record<string, unknown>)['value'] ?? 'generic') : 'generic';
  const recruiterEnabled = recruiterRow ? (recruiterRow.toJSON() as unknown as Record<string, unknown>)['value'] === true : false;
  res.json({ enabled, layout, mergeCv, rolloutMode, rolloutLpkIds, template, recruiterEnabled });
}));

// ── GET /api/superadmin/cv-lang-config — PUBLIC ───────────────────────────────
router.get('/cv-lang-config', wrap(async (_req, res) => {
  const [modeRow, lpkIdsRow] = await Promise.all([
    GlobalSettings.findOne({ where: { key: 'cv_lang_mode' } }),
    GlobalSettings.findOne({ where: { key: 'cv_lang_ja_lpk_ids' } }),
  ]);
  const mode = modeRow ? String((modeRow.toJSON() as unknown as Record<string, unknown>)['value'] ?? 'bilingual') : 'bilingual';
  const jaLpkIds = lpkIdsRow
    ? ((lpkIdsRow.toJSON() as unknown as Record<string, unknown>)['value'] as string[] | null) ?? []
    : [];
  res.json({ mode, jaLpkIds });
}));

// ── GET /api/superadmin/cv-version-config — PUBLIC ───────────────────────────
router.get('/cv-version-config', wrap(async (_req, res) => {
  const [v2Row, v3Row] = await Promise.all([
    GlobalSettings.findOne({ where: { key: 'cv_v2_lpk_ids' } }),
    GlobalSettings.findOne({ where: { key: 'cv_v3_lpk_ids' } }),
  ]);
  const v2LpkIds: string[] = v2Row
    ? ((v2Row.toJSON() as unknown as Record<string, unknown>)['value'] as string[] | null) ?? []
    : [];
  const v3LpkIds: string[] = v3Row
    ? ((v3Row.toJSON() as unknown as Record<string, unknown>)['value'] as string[] | null) ?? []
    : [];
  res.json({ v2LpkIds, v3LpkIds });
}));

// ── GET /api/superadmin/jp-learning-config — PUBLIC ──────────────────────────
router.get('/jp-learning-config', wrap(async (_req, res) => {
  const row = await GlobalSettings.findOne({ where: { key: 'jp_learning_lpk_ids' } });
  const lpkIds: string[] = row
    ? ((row.toJSON() as unknown as Record<string, unknown>)['value'] as string[] | null) ?? []
    : [];
  res.json({ lpkIds });
}));

router.use(authenticate, requireRole('super_admin'));

// ── System Stats ──────────────────────────────────────────────────────────────
router.get('/system/stats', wrap(async (_req, res) => {
  const [
    totalUsers,
    usersByRoleRaw,
    totalCandidates,
    candidatesByStatusRaw,
    totalBatches,
    batchesByStatusRaw,
    proposedCount,
    scheduledCount,
    completedCount,
    recentAuditRaw,
  ] = await Promise.all([
    User.count(),
    User.findAll({ attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['role'], raw: true }),
    Candidate.count(),
    Candidate.findAll({ attributes: ['profileStatus', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['profileStatus'], raw: true }),
    Batch.count(),
    Batch.findAll({ attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['status'], raw: true }),
    InterviewProposal.count({ where: { status: 'proposed' } }),
    InterviewProposal.count({ where: { status: 'scheduled' } }),
    InterviewProposal.count({ where: { status: 'completed' } }),
    AuditLog.findAll({
      include: [{ model: User, as: 'user', attributes: ['name', 'email', 'role'], required: false }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
  ]);

  const byRole: Record<string, number> = {};
  for (const r of usersByRoleRaw as unknown as Array<{ role: string; count: string }>) {
    byRole[r.role] = parseInt(r.count, 10);
  }

  const byStatus: Record<string, number> = {};
  for (const s of candidatesByStatusRaw as unknown as Array<{ profileStatus: string; count: string }>) {
    byStatus[s.profileStatus] = parseInt(s.count, 10);
  }

  const batchByStatus: Record<string, number> = {};
  let activeBatches = 0;
  for (const b of batchesByStatusRaw as unknown as Array<{ status: string; count: string }>) {
    batchByStatus[b.status] = parseInt(b.count, 10);
    if (b.status === 'active') activeBatches = parseInt(b.count, 10);
  }

  let dbStatus: 'ok' | 'error' = 'ok';
  try { await sequelize.authenticate(); } catch { dbStatus = 'error'; }

  res.json({
    users: { total: totalUsers, byRole },
    candidates: { total: totalCandidates, byStatus },
    batches: { total: totalBatches, active: activeBatches, byStatus: batchByStatus },
    interviews: { proposed: proposedCount, scheduled: scheduledCount, completed: completedCount },
    dbStatus,
    recentAuditEntries: recentAuditRaw.map(e => e.toJSON()),
  });
}));

// ── GET /api/superadmin/system/health ────────────────────────────────────────
router.get('/system/health', wrap(async (_req, res) => {
  let dbStatus: 'ok' | 'error' = 'ok', dbMs = 0;
  try {
    const t0 = Date.now();
    await sequelize.authenticate();
    dbMs = Date.now() - t0;
  } catch (err) {
    dbStatus = 'error';
    recordDbError(err as Error);
  }

  let redisStatus: 'ok' | 'error' = 'ok', redisMs = 0;
  try {
    const t0 = Date.now();
    await redisClient.ping();
    redisMs = Date.now() - t0;
  } catch {
    redisStatus = 'error';
  }

  const mem = process.memoryUsage();
  const nodeOptions = process.env['NODE_OPTIONS'] ?? '';
  const match = nodeOptions.match(/--max-old-space-size=(\d+)/);
  const limitMb = match ? parseInt(match[1]!, 10) : 1536;
  const metrics = getMetrics();
  const degraded = dbStatus !== 'ok' || redisStatus !== 'ok' || metrics.errors5xx_1h >= 10;

  res.json({
    status: degraded ? 'degraded' : 'ok',
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsedMb:  Math.round(mem.heapUsed  / 1_048_576),
      heapTotalMb: Math.round(mem.heapTotal / 1_048_576),
      rssMb:       Math.round(mem.rss       / 1_048_576),
      limitMb,
    },
    db:    { status: dbStatus,    responseMs: dbMs },
    redis: { status: redisStatus, responseMs: redisMs },
    metrics,
    alerts: {
      email:    Boolean(config.ALERT_EMAIL),
      telegram: Boolean(config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID),
    },
  });
}));

// ── GET /api/superadmin/system/metrics-history ───────────────────────────────
router.get('/system/metrics-history', wrap(async (req, res) => {
  const allowed: MetricsRange[] = ['1h', '1d', '1w', '1m'];
  const raw = req.query['range'] as string | undefined;
  const range: MetricsRange = allowed.includes(raw as MetricsRange) ? (raw as MetricsRange) : '1h';

  res.json({
    history: await getMetricsRange(range),
    limits: {
      maxUsers:      config.MONITOR_MAX_USERS,
      maxDbRpm:      config.MONITOR_MAX_DB_RPM,
      maxHttpRpm:    config.MONITOR_MAX_HTTP_RPM,
      maxResponseMs: config.MONITOR_MAX_RESPONSE_MS,
      maxCpuPct:     config.MONITOR_MAX_CPU_PCT,
      maxErrorPct:   config.MONITOR_MAX_ERROR_PCT,
    },
  });
}));

// ── PUT /api/superadmin/translation-api-config ───────────────────────────────
router.put('/translation-api-config', wrap(async (req, res) => {
  const { apiKey, skipValidation } = req.body as { apiKey?: string | null; skipValidation?: boolean };

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    // Clear DB key — fall back to env var
    await GlobalSettings.destroy({ where: { key: 'deepseek_api_key' } });
    const envKey = process.env['DEEPSEEK_API_KEY'];
    res.json({ keySource: envKey ? 'env' : 'none', keyMasked: envKey ? maskApiKey(envKey) : null });
    return;
  }

  const trimmed = apiKey.trim();

  // Validate the key against DeepSeek before persisting (unless explicitly skipped)
  if (!skipValidation) {
    try {
      const testResp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trimmed}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!testResp.ok) {
        let detail = `HTTP ${testResp.status}`;
        try {
          const body = await testResp.json() as Record<string, unknown>;
          const msg = (body['error'] as Record<string, unknown> | null)?.['message'] ?? body['message'];
          if (msg) detail = `${testResp.status}: ${String(msg).slice(0, 150)}`;
        } catch { /* ignore */ }
        res.status(422).json({ error: 'KEY_VALIDATION_FAILED', detail });
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      res.status(422).json({ error: 'KEY_VALIDATION_FAILED', detail: msg });
      return;
    }
  }

  const encrypted = encrypt(trimmed);
  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'deepseek_api_key' },
    defaults: { key: 'deepseek_api_key', value: encrypted },
  });
  if (!created) await row.update({ value: encrypted });

  res.json({ keySource: 'db', keyMasked: maskApiKey(trimmed) });
}));

// ── PUT /api/superadmin/translation-config ───────────────────────────────────
router.put('/translation-config', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const enabled = body['enabled'] !== false;

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'auto_translate_enabled' },
    defaults: { key: 'auto_translate_enabled', value: enabled },
  });
  if (!created) {
    await row.update({ value: enabled });
  }

  await cacheDel('gs:translate');
  res.json({ enabled });
}));

// ── PUT /api/superadmin/recruiter-selection-columns ──────────────────────────
router.put('/recruiter-selection-columns', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const validKeys = ['foto', 'nama', 'ju', 'pendidikan', 'program', 'bahasaJp', 'cekFisik', 'fotoBadan', 'video', 'profil', 'resume', 'pilih'];
  const config: Record<string, boolean> = {};
  for (const k of validKeys) {
    config[k] = body[k] !== false;
  }

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'recruiter_selection_columns' },
    defaults: { key: 'recruiter_selection_columns', value: config },
  });
  if (!created) {
    await row.update({ value: config });
  }

  res.json({ config });
}));

// ── PUT /api/superadmin/cv-font ───────────────────────────────────────────────
router.put('/cv-font', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const validKeys = ['ms-mincho', 'yu-mincho', 'yu-gothic', 'noto-serif-jp', 'noto-sans-jp'];
  const fontKey = validKeys.includes(String(body['fontKey'])) ? String(body['fontKey']) : 'ms-mincho';

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'cv_font' },
    defaults: { key: 'cv_font', value: fontKey },
  });
  if (!created) {
    await row.update({ value: fontKey });
  }

  await cacheDel('gs:cv_font');
  res.json({ fontKey });
}));

// ── PUT /api/superadmin/cv-layout ────────────────────────────────────────────
router.put('/cv-layout', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const validLayouts = ['layout1', 'layout2'];
  const layout = validLayouts.includes(String(body['layout'])) ? String(body['layout']) : 'layout1';

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'cv_layout' },
    defaults: { key: 'cv_layout', value: layout },
  });
  if (!created) {
    await row.update({ value: layout });
  }

  await cacheDel('gs:cv_layout');
  res.json({ layout });
}));

// ── PUT /api/superadmin/cv-lang-config ───────────────────────────────────────
router.put('/cv-lang-config', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const mode = body['mode'] === 'lpk' ? 'lpk' : 'bilingual';
  const rawLpkIds = Array.isArray(body['jaLpkIds']) ? body['jaLpkIds'] : [];
  const jaLpkIds = (rawLpkIds as unknown[]).filter((id): id is string => typeof id === 'string' && isUUID(id));

  const upsert = async (key: string, value: unknown) => {
    const [row, created] = await GlobalSettings.findOrCreate({ where: { key }, defaults: { key, value } });
    if (!created) await row.update({ value });
  };

  await Promise.all([
    upsert('cv_lang_mode', mode),
    upsert('cv_lang_ja_lpk_ids', jaLpkIds),
  ]);

  res.json({ mode, jaLpkIds });
}));

// ── PUT /api/superadmin/cv-version-config ────────────────────────────────────
router.put('/cv-version-config', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;

  const filterUUIDs = (raw: unknown): string[] =>
    (Array.isArray(raw) ? raw as unknown[] : [])
      .filter((id): id is string => typeof id === 'string' && isUUID(id));

  const v2LpkIds = filterUUIDs(body['v2LpkIds']);
  const v3LpkIds = filterUUIDs(body['v3LpkIds']);

  const upsert = async (key: string, value: string[]) => {
    const [row, created] = await GlobalSettings.findOrCreate({ where: { key }, defaults: { key, value } });
    if (!created) await row.update({ value });
  };

  await Promise.all([upsert('cv_v2_lpk_ids', v2LpkIds), upsert('cv_v3_lpk_ids', v3LpkIds)]);

  res.json({ v2LpkIds, v3LpkIds });
}));

// ── PUT /api/superadmin/photo-bg-color ───────────────────────────────────────
router.put('/photo-bg-color', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const enabled = Boolean(body['enabled']);
  const rawColor = ((body['color'] as string) ?? '').trim();
  const color = enabled && /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor : '';

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'photo_bg_color' },
    defaults: { key: 'photo_bg_color', value: color },
  });
  if (!created) await row.update({ value: color });

  res.json({ color, enabled: Boolean(color) });
}));

// ── PUT /api/superadmin/completeness-mode ────────────────────────────────────
router.put('/completeness-mode', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const valid: CompletenessMode[] = ['legacy', 'cv'];
  const mode: CompletenessMode = valid.includes(body['mode'] as CompletenessMode)
    ? (body['mode'] as CompletenessMode)
    : 'legacy';

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'completeness_mode' },
    defaults: { key: 'completeness_mode', value: mode },
  });
  if (!created) await row.update({ value: mode });

  setCompletenessMode(mode);
  // Broadcast to sibling workers in cluster mode so their in-memory mode stays in sync
  if (process.send) process.send({ type: 'SET_COMPLETENESS_MODE', mode });
  await cacheDel('gs:completeness');
  res.json({ mode });
}));

// ── PUT /api/superadmin/journey-visualization ─────────────────────────────────
router.put('/journey-visualization', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const valid = ['text', 'graphical'];
  const mode = valid.includes(String(body['mode'])) ? String(body['mode']) : 'graphical';

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'journey_visualization' },
    defaults: { key: 'journey_visualization', value: mode },
  });
  if (!created) await row.update({ value: mode });

  res.json({ mode });
}));

// ── GET /api/superadmin/interview-decision-config ────────────────────────────
router.get('/interview-decision-config', wrap(async (_req, res) => {
  const row = await GlobalSettings.findOne({ where: { key: 'interview_decision_deadline_days' } });
  const days = row ? Number((row.toJSON() as unknown as Record<string, unknown>)['value'] ?? 7) : 7;
  res.json({ deadlineDays: days });
}));

// ── PUT /api/superadmin/interview-decision-config ────────────────────────────
router.put('/interview-decision-config', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const raw = Number(body['deadlineDays']);
  const deadlineDays = [7, 14].includes(raw) ? raw : 7;

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'interview_decision_deadline_days' },
    defaults: { key: 'interview_decision_deadline_days', value: deadlineDays },
  });
  if (!created) await row.update({ value: deadlineDays });

  res.json({ deadlineDays });
}));

// ── PUT /api/superadmin/shokumu-config ───────────────────────────────────────
router.put('/shokumu-config', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const enabled = body['enabled'] === true;
  const validLayouts = ['chronological', 'reverse', 'career'];
  const layout = validLayouts.includes(String(body['layout'])) ? String(body['layout']) : 'reverse';
  const mergeCv = body['mergeCv'] === true;
  const rolloutMode = body['rolloutMode'] === 'lpk' ? 'lpk' : 'all';
  const rawLpkIds = Array.isArray(body['rolloutLpkIds']) ? body['rolloutLpkIds'] : [];
  const rolloutLpkIds = (rawLpkIds as unknown[]).filter((id): id is string => typeof id === 'string' && isUUID(id));
  const template = body['template'] === 'gakken' ? 'gakken' : 'generic';
  const recruiterEnabled = body['recruiterEnabled'] === true;

  const upsert = async (key: string, value: unknown) => {
    const [row, created] = await GlobalSettings.findOrCreate({ where: { key }, defaults: { key, value } });
    if (!created) await row.update({ value });
  };

  await Promise.all([
    upsert('shokumu_enabled', enabled),
    upsert('shokumu_layout', layout),
    upsert('shokumu_merge_cv', mergeCv),
    upsert('shokumu_rollout_mode', rolloutMode),
    upsert('shokumu_rollout_lpk_ids', rolloutLpkIds),
    upsert('shokumu_template', template),
    upsert('shokumu_recruiter_enabled', recruiterEnabled),
  ]);

  res.json({ enabled, layout, mergeCv, rolloutMode, rolloutLpkIds, template, recruiterEnabled });
}));

// ── PUT /api/superadmin/candidate-tab-config ──────────────────────────────────
router.put('/candidate-tab-config', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const validKeys = ['tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8','tab9'];
  const config: Record<string, boolean> = {};
  for (const k of validKeys) {
    config[k] = body[k] !== false;
  }

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'candidate_tab_config' },
    defaults: { key: 'candidate_tab_config', value: config },
  });
  if (!created) {
    await row.update({ value: config });
  }

  await cacheDel('gs:tab_config');
  res.json({ config });
}));

// ── User Management ───────────────────────────────────────────────────────────
router.get('/users', wrap(async (req, res) => {
  const { role, isActive, search, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (role) where['role'] = role;
  if (isActive !== undefined && isActive !== '') where['isActive'] = isActive === 'true';
  if (search) {
    const s = search.replace(/[%_\\]/g, '\\$&');
    where[Op.or as unknown as string] = [
      { name: { [Op.like]: `%${s}%` } },
      { email: { [Op.like]: `%${s}%` } },
    ];
  }
  const limit = Math.min(parseInt(pageSize, 10), 100);
  const offset = (parseInt(page, 10) - 1) * limit;

  const { count, rows } = await User.findAndCountAll({
    where,
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name'], required: false },
      { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    subQuery: false,
  });

  res.json({
    users: rows.map(u => serializeUser(u.toJSON() as unknown as Record<string, unknown>)),
    total: count,
    page: parseInt(page, 10),
    pageSize: limit,
  });
}));

router.post('/users', wrap(async (req, res) => {
  const { email, name, role, password, companyId, lpkId } = req.body as Record<string, string | undefined>;

  if (!email || !isEmail(email)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid email required.' });
    return;
  }
  if (!name) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Name required.' });
    return;
  }
  const VALID_ROLES = ['candidate', 'admin', 'manager', 'recruiter', 'super_admin'];
  if (!role || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid role required.' });
    return;
  }
  if (role === 'recruiter' && (!companyId || !isUUID(companyId))) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Recruiter must be assigned to a company.' });
    return;
  }
  if (role === 'admin' && (!lpkId || !isUUID(lpkId))) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Admin must be assigned to an LPK.' });
    return;
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'CONFLICT', message: 'Email already in use.' });
    return;
  }

  const autoGenerated = !password;
  const rawPassword = password || generatePassword();
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const user = await User.create({
    email,
    name,
    role: role as 'candidate' | 'admin' | 'manager' | 'recruiter' | 'super_admin',
    passwordHash,
    companyId: companyId && isUUID(companyId) ? companyId : null,
    lpkId: lpkId && isUUID(lpkId) ? lpkId : null,
  });

  const resp: Record<string, unknown> = {
    user: serializeUser(user.toJSON() as unknown as Record<string, unknown>),
  };
  if (autoGenerated) resp['tempPassword'] = rawPassword;
  res.status(201).json(resp);
}));

router.get('/users/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const user = await User.findByPk(req.params['id'], {
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name'], required: false },
      { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
    ],
  });
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
}));

router.put('/users/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const { id } = req.params as { id: string };
  const user = await User.findByPk(id);
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const { name, role, companyId, lpkId, isActive } = req.body as Record<string, unknown>;
  type RoleType = 'candidate' | 'admin' | 'manager' | 'recruiter' | 'super_admin';
  const updates: Partial<{ name: string | null; role: RoleType; companyId: string | null; lpkId: string | null; isActive: boolean }> = {};

  if (name !== undefined) updates.name = String(name);
  if (id !== req.user!.sub) {
    if (role !== undefined) updates.role = role as RoleType;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
  }
  if (companyId !== undefined) updates.companyId = companyId && isUUID(String(companyId)) ? String(companyId) : null;
  if (lpkId !== undefined) updates.lpkId = lpkId && isUUID(String(lpkId)) ? String(lpkId) : null;

  // Determine the effective role after this update
  const effectiveRole = updates.role ?? user.role;
  const effectiveCompanyId = updates.companyId !== undefined ? updates.companyId : user.companyId;
  const effectiveLpkId = updates.lpkId !== undefined ? updates.lpkId : user.lpkId;

  if (effectiveRole === 'recruiter' && !effectiveCompanyId) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Recruiter must be assigned to a company.' });
    return;
  }
  if (effectiveRole === 'admin' && !effectiveLpkId) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Admin must be assigned to an LPK.' });
    return;
  }

  await user.update(updates);
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
}));

router.patch('/users/:id/activate', validateUuidParam('id'), wrap(async (req, res) => {
  const user = await User.findByPk(req.params['id']);
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  await user.update({ isActive: true, deactivatedAt: null });
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
}));

router.patch('/users/:id/deactivate', validateUuidParam('id'), wrap(async (req, res) => {
  const user = await User.findByPk(req.params['id']);
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (user.id === req.user!.sub) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot deactivate your own account.' });
    return;
  }
  await user.update({ isActive: false, deactivatedAt: new Date() });
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
}));

router.patch('/users/:id/reset-password', validateUuidParam('id'), wrap(async (req, res) => {
  const user = await User.findByPk(req.params['id']);
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  const rawPassword = generatePassword();
  const passwordHash = await bcrypt.hash(rawPassword, 12);
  await user.update({ passwordHash });
  res.json({ tempPassword: rawPassword });
}));

// ── Company Management ────────────────────────────────────────────────────────
router.get('/companies', wrap(async (_req, res) => {
  const companies = await Company.findAll({ order: [['name', 'ASC']] });
  const companyIds = companies.map((c) => c.id);
  const recruiterCounts = companyIds.length
    ? (await User.findAll({
        where: { companyId: { [Op.in]: companyIds }, role: 'recruiter' },
        attributes: ['companyId', [fn('COUNT', col('id')), 'recruiterCount']],
        group: ['companyId'],
        raw: true,
      }) as unknown as Array<{ companyId: string; recruiterCount: string }>)
    : [];
  const recruiterMap = new Map(recruiterCounts.map((r) => [r.companyId, parseInt(r.recruiterCount, 10)]));
  const result = companies.map((c) => ({ ...c.toJSON(), recruiterCount: recruiterMap.get(c.id) ?? 0 }));
  res.json({ companies: result });
}));

router.post('/companies', wrap(async (req, res) => {
  const { name, nameJa, contactPerson, email, phone } = req.body as Record<string, string | undefined>;
  if (!name) { res.status(400).json({ error: 'BAD_REQUEST', message: 'Name required.' }); return; }
  const company = await Company.create({ name, nameJa: nameJa ?? null, contactPerson: contactPerson ?? null, email: email ?? null, phone: phone ?? null });
  res.status(201).json({ company: company.toJSON() });
}));

router.get('/companies/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const company = await Company.findByPk(req.params['id']);
  if (!company) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  const recruiterCount = await User.count({ where: { companyId: company.id, role: 'recruiter' } });
  res.json({ company: { ...company.toJSON(), recruiterCount } });
}));

router.put('/companies/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const company = await Company.findByPk(req.params['id']);
  if (!company) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  const { name, nameJa, contactPerson, email, phone } = req.body as Record<string, string | undefined>;
  await company.update({
    name: name ?? company.name,
    nameJa: nameJa !== undefined ? (nameJa || null) : company.nameJa,
    contactPerson: contactPerson !== undefined ? (contactPerson || null) : company.contactPerson,
    email: email !== undefined ? (email || null) : company.email,
    phone: phone !== undefined ? (phone || null) : company.phone,
  });
  res.json({ company: company.toJSON() });
}));

router.patch('/companies/:id/deactivate', validateUuidParam('id'), wrap(async (req, res) => {
  const company = await Company.findByPk(req.params['id']);
  if (!company) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  await company.update({ isActive: false });
  res.json({ company: company.toJSON() });
}));

// ── LPK Management ────────────────────────────────────────────────────────────
router.get('/lpks', wrap(async (_req, res) => {
  const lpks = await Lpk.findAll({
    include: [{ model: User, as: 'adminUser', attributes: ['id', 'name', 'email'], required: false }],
    order: [['name', 'ASC']],
  });
  res.json({ lpks: lpks.map(l => l.toJSON()) });
}));

router.post('/lpks', wrap(async (req, res) => {
  const { name, city, province, contactPerson, email, phone, assignedAdmin } = req.body as Record<string, string | undefined>;
  if (!name) { res.status(400).json({ error: 'BAD_REQUEST', message: 'Name required.' }); return; }
  const lpk = await Lpk.create({
    name,
    city: city ?? null,
    province: province ?? null,
    contactPerson: contactPerson ?? null,
    email: email ?? null,
    phone: phone ?? null,
    assignedAdmin: assignedAdmin && isUUID(assignedAdmin) ? assignedAdmin : null,
  });
  await cacheDel('lpks:active');
  res.status(201).json({ lpk: lpk.toJSON() });
}));

router.get('/lpks/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const lpk = await Lpk.findByPk(req.params['id'], {
    include: [{ model: User, as: 'adminUser', attributes: ['id', 'name', 'email'], required: false }],
  });
  if (!lpk) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ lpk: lpk.toJSON() });
}));

router.put('/lpks/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const lpk = await Lpk.findByPk(req.params['id']);
  if (!lpk) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  const { name, city, province, contactPerson, email, phone, assignedAdmin } = req.body as Record<string, string | undefined>;
  await lpk.update({
    name: name ?? lpk.name,
    city: city !== undefined ? (city || null) : lpk.city,
    province: province !== undefined ? (province || null) : lpk.province,
    contactPerson: contactPerson !== undefined ? (contactPerson || null) : lpk.contactPerson,
    email: email !== undefined ? (email || null) : lpk.email,
    phone: phone !== undefined ? (phone || null) : lpk.phone,
    assignedAdmin: assignedAdmin !== undefined
      ? (assignedAdmin && isUUID(assignedAdmin) ? assignedAdmin : null)
      : lpk.assignedAdmin,
  });
  await cacheDel('lpks:active');
  res.json({ lpk: lpk.toJSON() });
}));

router.patch('/lpks/:id/deactivate', validateUuidParam('id'), wrap(async (req, res) => {
  const lpk = await Lpk.findByPk(req.params['id']);
  if (!lpk) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  await lpk.update({ isActive: false });
  await cacheDel('lpks:active');
  res.json({ lpk: lpk.toJSON() });
}));

// ── Candidates (super admin view) ─────────────────────────────────────────────
router.get('/candidates', wrap(async (req, res) => {
  const { search, profileStatus, sswKubun, lpkId, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (profileStatus) where['profileStatus'] = profileStatus;
  if (sswKubun) where['sswKubun'] = sswKubun;
  if (lpkId && isUUID(lpkId)) where['lpkId'] = lpkId;
  if (search) {
    where[Op.or as unknown as string] = [
      { fullName: { [Op.like]: `%${search}%` } },
      { candidateCode: { [Op.like]: `%${search}%` } },
    ];
  }
  const limit = Math.min(parseInt(pageSize, 10), 100);
  const offset = (parseInt(page, 10) - 1) * limit;

  const { count, rows } = await Candidate.findAndCountAll({
    where,
    include: [
      ...candidateIncludes(),
      { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const candidates = rows.map(c => {
    const data = c.toJSON() as unknown as Record<string, unknown>;
    const completeness = calcCompleteness(data);
    return { ...serializeCandidate(data, 'super_admin'), completeness };
  });

  res.json({ candidates, total: count, page: parseInt(page, 10), pageSize: limit });
}));

// ── PATCH /api/superadmin/candidates/:id/lpk ─────────────────────────────────
router.patch('/candidates/:id/lpk', validateUuidParam('id'), wrap(async (req, res) => {
  const { id } = req.params as { id: string };
  const { lpkId } = req.body as { lpkId: string };

  if (!lpkId || !isUUID(lpkId)) {
    res.status(400).json({ error: 'INVALID_LPK_ID' });
    return;
  }

  const [candidate, lpk] = await Promise.all([
    Candidate.findByPk(id),
    Lpk.findOne({ where: { id: lpkId, isActive: true } }),
  ]);

  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (!lpk) { res.status(404).json({ error: 'LPK_NOT_FOUND' }); return; }

  await candidate.update({ lpkId });

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'ASSIGN_LPK',
    entityType: 'candidate',
    entityId: id,
    targetCandidateId: id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: { lpkId, lpkName: (lpk.toJSON() as unknown as Record<string, unknown>)['name'] },
  });

  res.json({ message: 'LPK assigned.', lpkId, lpkName: (lpk.toJSON() as unknown as Record<string, unknown>)['name'] });
}));

router.get('/candidates/:id/sensitive', validateUuidParam('id'), wrap(async (req, res) => {
  const { id } = req.params as { id: string };
  const candidate = await Candidate.findByPk(id, {
    include: [{ model: CandidateBodyCheck, as: 'bodyCheck', required: false }],
  });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const bodyCheck = data['bodyCheck'] as Record<string, unknown> | null;

  const nik = decryptNullable(data['nikEncrypted'] as string | null);
  const bankAccount = decryptNullable(data['bankAccountEncrypted'] as string | null);
  const vision = bodyCheck ? decryptNullable(bodyCheck['visionEncrypted'] as string | null) : null;
  const tattoo = bodyCheck ? decryptNullable(bodyCheck['tattooEncrypted'] as string | null) : null;

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'VIEW_SENSITIVE_DATA',
    entityType: 'candidate',
    entityId: id,
    targetCandidateId: id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: { fields: ['nik', 'bankAccount', 'vision', 'tattoo'] },
  });

  res.json({ nik, bankAccount, vision, tattoo });
}));

router.delete('/candidates/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const { id } = req.params as { id: string };
  const { confirmCode } = req.body as { confirmCode?: string };

  const candidate = await Candidate.findByPk(id);
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  if (!confirmCode || confirmCode !== candidate.candidateCode) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Confirmation code does not match candidate code.' });
    return;
  }

  const { candidateCode, fullName, userId } = candidate;

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'CANDIDATE_DELETED',
    entityType: 'candidate',
    entityId: id,
    targetCandidateId: id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: { candidateCode, fullName, requestedBy: req.user!.email },
  });

  await deleteCandidatePhotos(id);
  await candidate.destroy();
  if (userId) {
    await User.destroy({ where: { id: userId } });
  }

  res.json({ deleted: true, candidateCode });
}));

// ── Audit Log ─────────────────────────────────────────────────────────────────
router.get('/audit-logs/actions', wrap(async (_req, res) => {
  const actions = await AuditLog.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('action')), 'action']],
    raw: true,
  });
  res.json({ actions: actions.map(a => (a as unknown as { action: string }).action) });
}));

router.get('/audit-logs', wrap(async (req, res) => {
  const { userId, action, entityType, dateFrom, dateTo, page = '1', pageSize = '50', format } = req.query as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (userId && isUUID(userId)) where['userId'] = userId;
  if (action) where['action'] = action;
  if (entityType) where['entityType'] = entityType;
  if (dateFrom || dateTo) {
    const dateWhere: Record<string, Date> = {};
    if (dateFrom) dateWhere[Op.gte as unknown as string] = new Date(dateFrom);
    if (dateTo) dateWhere[Op.lte as unknown as string] = new Date(dateTo);
    where['createdAt'] = dateWhere;
  }

  const limit = Math.min(parseInt(pageSize, 10), 200);
  const offset = (parseInt(page, 10) - 1) * limit;

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['name', 'email', 'role'], required: false }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  if (format === 'csv') {
    const header = 'Timestamp,User Email,User Role,Action,Entity Type,Entity ID,Target Candidate ID,IP Address';
    const lines = rows.map(r => {
      const j = r.toJSON() as unknown as Record<string, unknown>;
      const u = j['user'] as Record<string, string> | null;
      return [
        r.createdAt?.toISOString() ?? '',
        u?.['email'] ?? '',
        u?.['role'] ?? '',
        r.action,
        r.entityType ?? '',
        r.entityId ?? '',
        r.targetCandidateId ?? '',
        r.ipAddress ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`) .join(',');
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    res.send([header, ...lines].join('\n'));
    return;
  }

  res.json({ auditLogs: rows.map(r => r.toJSON()), total: count, page: parseInt(page, 10), pageSize: limit });
}));

// ── GET /api/superadmin/consent-clause/history ───────────────────────────────
router.get('/consent-clause/history', wrap(async (req, res) => {
  const page     = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query['pageSize'] as string) ?? '20', 10)));
  const offset   = (page - 1) * pageSize;

  const { count, rows } = await ConsentClause.findAndCountAll({
    include: [
      { model: User, as: 'publisher', attributes: ['name', 'email'], required: false },
      { model: User, as: 'creator',   attributes: ['name', 'email'], required: false },
      { model: ConsentClause, as: 'superseder', attributes: ['version'], required: false },
    ],
    order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    limit:  pageSize,
    offset,
  });

  const items = rows.map((r) => {
    const c = r.toJSON() as unknown as Record<string, unknown>;
    return {
      id:            c['id'],
      version:       c['version'],
      content:       typeof c['content'] === 'string' ? c['content'].slice(0, 200) : null,
      contentJa:     typeof c['contentJa'] === 'string' ? (c['contentJa'] as string).slice(0, 200) : null,
      isActive:      c['isActive'],
      publishedAt:   c['publishedAt'],
      supersededAt:  c['supersededAt'],
      sourceType:    c['sourceType'],
      sourcePdfName: c['sourcePdfName'],
      publisher:     c['publisher'] ?? null,
      creator:       c['creator'] ?? null,
      superseder:    c['superseder'] ? { version: (c['superseder'] as Record<string, unknown>)['version'] } : null,
    };
  });

  res.json({ clauses: items, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) });
}));

// ── GET /api/superadmin/consent-clause/:id ────────────────────────────────────
router.get('/consent-clause/:id', wrap(async (req, res) => {
  if (!isUUID(req.params['id'] ?? '', 4)) { res.status(400).json({ error: 'INVALID_ID' }); return; }
  const clause = await ConsentClause.findByPk(req.params['id'], {
    include: [
      { model: User, as: 'publisher', attributes: ['name', 'email'], required: false },
      { model: User, as: 'creator',   attributes: ['name', 'email'], required: false },
      { model: ConsentClause, as: 'superseder', attributes: ['version'], required: false },
    ],
  });
  if (!clause) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ clause: clause.toJSON() });
}));

// ── POST /api/superadmin/consent-clause ───────────────────────────────────────
router.post('/consent-clause', wrap(async (req, res) => {
  const { content, contentJa, version, sourceType, sourcePdfName } =
    req.body as { content?: string; contentJa?: string; version?: string; sourceType?: string; sourcePdfName?: string };

  if (!content || !version) {
    res.status(422).json({ error: 'MISSING_FIELDS', message: 'content and version are required.' });
    return;
  }
  if (!/^\d+\.\d+$/.test(version)) {
    res.status(422).json({ error: 'INVALID_VERSION', message: 'Version must be in X.Y format.' });
    return;
  }
  const existing = await ConsentClause.findOne({ where: { version } });
  if (existing) {
    res.status(409).json({ error: 'VERSION_EXISTS', message: `Version ${version} already exists.` });
    return;
  }

  const newId = uuidv4();

  await sequelize.transaction(async (t) => {
    const currentActive = await ConsentClause.findOne({ where: { isActive: true }, transaction: t });

    await ConsentClause.create({
      id:            newId,
      version,
      content,
      contentJa:     contentJa ?? null,
      isActive:      true,
      publishedAt:   new Date(),
      publishedBy:   req.user!.sub,
      createdBy:     req.user!.sub,
      sourceType:    (sourceType === 'pdf' ? 'pdf' : 'manual') as 'manual' | 'pdf',
      sourcePdfName: sourcePdfName ?? null,
    }, { transaction: t });

    if (currentActive) {
      await currentActive.update({
        isActive:     false,
        supersededAt: new Date(),
        supersededBy: newId,
      }, { transaction: t });
    }
  });

  const clause = await ConsentClause.findByPk(newId);

  await AuditLog.create({
    userId:     req.user!.sub,
    action:     'CONSENT_CLAUSE_PUBLISHED',
    entityType: 'consent_clause',
    entityId:   newId,
    ipAddress:  req.ip ?? null,
    userAgent:  req.headers['user-agent'] ?? null,
    payload:    { version },
  });

  res.status(201).json({ clause: clause!.toJSON() });
}));

// ── POST /api/superadmin/consent-clause/extract-pdf ──────────────────────────
router.post('/consent-clause/extract-pdf', pdfUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) {
    res.status(422).json({ error: 'NO_FILE', message: 'PDF file is required.' });
    return;
  }
  if (req.file.mimetype !== 'application/pdf') {
    res.status(422).json({ error: 'INVALID_FILE', message: 'File must be a PDF.' });
    return;
  }
  if (!req.file.buffer.slice(0, 5).equals(Buffer.from('%PDF-'))) {
    res.status(422).json({ error: 'INVALID_FILE', message: 'File must be a valid PDF.' });
    return;
  }

  const result = await pdfParse(req.file.buffer);
  res.json({
    extractedText: result.text,
    pageCount:     result.numpages,
    filename:      req.file.originalname,
  });
}));

// ── PATCH /api/superadmin/consent-clause/:id ──────────────────────────────────
router.patch('/consent-clause/:id', wrap(async (req, res) => {
  if (!isUUID(req.params['id'] ?? '', 4)) { res.status(400).json({ error: 'INVALID_ID' }); return; }

  const clause = await ConsentClause.findByPk(req.params['id']);
  if (!clause) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (clause.isActive) {
    res.status(403).json({ error: 'CLAUSE_ACTIVE', message: 'Cannot edit a published/active clause.' });
    return;
  }

  const { content, contentJa } = req.body as { content?: string; contentJa?: string };
  const updates: Partial<{ content: string; contentJa: string }> = {};
  if (content !== undefined) updates.content = content;
  if (contentJa !== undefined) updates.contentJa = contentJa;

  await clause.update(updates);

  await AuditLog.create({
    userId:     req.user!.sub,
    action:     'CONSENT_CLAUSE_UPDATED',
    entityType: 'consent_clause',
    entityId:   clause.id,
    ipAddress:  req.ip ?? null,
    userAgent:  req.headers['user-agent'] ?? null,
    payload:    null,
  });

  res.json({ clause: clause.toJSON() });
}));

// ── POST /api/superadmin/consent-clause/:id/push ──────────────────────────────
// Forces all candidates to re-accept the current active clause by clearing their
// stored consentClauseId (non-destructive — consentGiven history is preserved).
router.post('/consent-clause/:id/push', wrap(async (req, res) => {
  if (!isUUID(req.params['id'] ?? '', 4)) { res.status(400).json({ error: 'INVALID_ID' }); return; }

  const clause = await ConsentClause.findByPk(req.params['id']);
  if (!clause) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (!clause.isActive) {
    res.status(422).json({ error: 'CLAUSE_NOT_ACTIVE', message: 'Only the active clause can be pushed.' });
    return;
  }

  const [affectedCandidates] = await Candidate.update(
    { consentClauseId: null as unknown as string },
    { where: {} },
  );

  await AuditLog.create({
    userId:     req.user!.sub,
    action:     'CONSENT_PUSH',
    entityType: 'consent_clause',
    entityId:   clause.id,
    ipAddress:  req.ip ?? null,
    userAgent:  req.headers['user-agent'] ?? null,
    payload:    null,
  });

  res.json({ message: 'Consent push complete.', affectedCandidates });
}));

// ── PUT /api/superadmin/jp-learning-config ────────────────────────────────────
router.put('/jp-learning-config', wrap(async (req, res) => {
  const { lpkIds } = req.body as { lpkIds: unknown };
  if (!Array.isArray(lpkIds) || !lpkIds.every((id) => typeof id === 'string' && isUUID(id, 4))) {
    res.status(400).json({ error: 'lpkIds must be an array of UUIDs' });
    return;
  }
  const [row] = await GlobalSettings.findOrCreate({
    where: { key: 'jp_learning_lpk_ids' },
    defaults: { id: uuidv4(), key: 'jp_learning_lpk_ids', value: [] },
  });
  await row.update({ value: lpkIds });
  res.json({ lpkIds });
}));

export default router;
