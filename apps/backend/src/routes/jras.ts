import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { isUUID } from 'validator';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validateUuidParam } from '../middleware/rbac';
import {
  User,
  AuditLog,
  GlobalSettings,
  JrasInstrument,
  JrasItem,
  JrasReviewer,
  JrasReview,
  JrasCommitteeMember,
  JrasRiskRule,
} from '../db/models/index';
import { notifyUser, notifyByRole } from '../utils/notify';
import {
  JRAS_DIMENSION_KEYS,
  JRAS_DEFAULT_REVIEW_QUOTA,
  type JrasReviewQuota,
  type JrasReviewerType,
} from '@ijbnet/shared';

const router = Router();

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

// ── GlobalSettings helpers ────────────────────────────────────────────────────

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await GlobalSettings.findOne({ where: { key } });
  if (!row) return fallback;
  return (row.toJSON() as unknown as Record<string, unknown>)['value'] as T;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  const [row] = await GlobalSettings.findOrCreate({
    where: { key },
    defaults: { id: uuidv4(), key, value },
  });
  await row.update({ value });
}

async function getReviewQuota(): Promise<JrasReviewQuota> {
  const q = await getSetting<Partial<JrasReviewQuota>>('jras_review_quota', JRAS_DEFAULT_REVIEW_QUOTA);
  return {
    ex_ssw: typeof q.ex_ssw === 'number' ? q.ex_ssw : JRAS_DEFAULT_REVIEW_QUOTA.ex_ssw,
    jp_hr: typeof q.jp_hr === 'number' ? q.jp_hr : JRAS_DEFAULT_REVIEW_QUOTA.jp_hr,
  };
}

// Status persetujuan instrumen pada versi berjalan: berapa approve per tipe
// reviewer vs kuota yang dikonfigurasi superadmin.
async function computeApprovalStatus(instrument: JrasInstrument): Promise<{
  quota: JrasReviewQuota;
  approvals: Record<JrasReviewerType, number>;
  quotaMet: boolean;
}> {
  const [quota, reviews] = await Promise.all([
    getReviewQuota(),
    JrasReview.findAll({
      where: { instrumentId: instrument.id, instrumentVersion: instrument.version, verdict: 'approve' },
    }),
  ]);
  const approvals: Record<JrasReviewerType, number> = { ex_ssw: 0, jp_hr: 0, expert: 0 };
  if (reviews.length > 0) {
    const reviewers = await JrasReviewer.findAll({
      where: { userId: reviews.map((r) => r.reviewerUserId) },
    });
    const typeByUser = new Map(reviewers.map((r) => [r.userId, r.reviewerType]));
    for (const r of reviews) {
      const t = typeByUser.get(r.reviewerUserId);
      if (t) approvals[t] += 1;
    }
  }
  const quotaMet = approvals.ex_ssw >= quota.ex_ssw && approvals.jp_hr >= quota.jp_hr;
  return { quota, approvals, quotaMet };
}

async function auditAction(req: Request, action: string, entityId: string, payload: Record<string, unknown>): Promise<void> {
  await AuditLog.create({
    userId: req.user!.sub,
    action,
    entityType: 'jras_instrument',
    entityId,
    targetCandidateId: null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload,
  });
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const dimensionEnum = z.enum(['language', 'culture', 'legal', 'psych', 'finance', 'motivation', 'observation']);

const instrumentMetaSchema = z.object({
  dimensionKey: dimensionEnum,
  type: z.enum(['sjt', 'likert', 'quiz', 'observation']),
  titleId: z.string().min(1).max(200),
  titleJa: z.string().min(1).max(200),
  descriptionId: z.string().max(5000).nullish(),
  descriptionJa: z.string().max(5000).nullish(),
}).strict();

const itemSchema = z.object({
  type: z.enum(['sjt', 'likert', 'quiz']),
  promptId: z.string().min(1).max(5000),
  promptJa: z.string().min(1).max(5000),
  options: z.array(z.object({ labelId: z.string().min(1).max(1000), labelJa: z.string().min(1).max(1000) }).strict()).min(2).max(10),
  scoring: z.object({
    scoringType: z.enum(['weighted', 'keyed', 'likert']),
    weights: z.array(z.number().min(0).max(1)).optional(),
    correctIndex: z.number().int().min(0).optional(),
    reverse: z.boolean().optional(),
    rationale: z.string().max(5000).optional(),
  }).strict(),
  criticalFlag: z.boolean().optional(),
  sensitive: z.boolean().optional(),
}).strict().superRefine((item, ctx) => {
  const { scoring, options, type } = item;
  if (scoring.scoringType === 'weighted') {
    if (!scoring.weights || scoring.weights.length !== options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'weights harus sepanjang jumlah pilihan' });
    }
  }
  if (scoring.scoringType === 'keyed') {
    if (scoring.correctIndex === undefined || scoring.correctIndex >= options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'correctIndex wajib dan harus menunjuk salah satu pilihan' });
    }
  }
  // Rationale wajib untuk SJT — bobot tanpa alasan tidak boleh masuk item bank
  if (type === 'sjt' && (!scoring.rationale || scoring.rationale.trim().length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rationale wajib diisi untuk item SJT' });
  }
});

const itemsSchema = z.array(itemSchema).min(1).max(100);

const reviewSchema = z.object({
  verdict: z.enum(['approve', 'request_changes']),
  note: z.string().max(5000).optional(),
  itemNotes: z.array(z.object({
    itemId: z.string().uuid(),
    verdict: z.enum(['ok', 'needs_change']),
    comment: z.string().max(2000).optional(),
  }).strict()).optional(),
}).strict();

// ═══════════════════════════════════════════════════════════════════════════
// REVIEWER — /api/jras/reviewer/* (role: reviewer; tidak ada akses data kandidat)
// ═══════════════════════════════════════════════════════════════════════════

const reviewerRouter = Router();
reviewerRouter.use(authenticate, requireRole('reviewer'));

// Reviewer harus terdaftar aktif di jras_reviewers
async function getActiveReviewer(userId: string): Promise<JrasReviewer | null> {
  return JrasReviewer.findOne({ where: { userId, active: true } });
}

reviewerRouter.get('/me', wrap(async (req, res) => {
  const reviewer = await getActiveReviewer(req.user!.sub);
  if (!reviewer) { res.status(403).json({ error: 'REVIEWER_NOT_REGISTERED' }); return; }
  const [pendingCount, doneCount] = await Promise.all([
    JrasInstrument.count({ where: { status: 'in_review' } }),
    JrasReview.count({ where: { reviewerUserId: req.user!.sub } }),
  ]);
  res.json({ ...reviewer.toJSON(), pendingCount, doneCount });
}));

reviewerRouter.get('/queue', wrap(async (req, res) => {
  const reviewer = await getActiveReviewer(req.user!.sub);
  if (!reviewer) { res.status(403).json({ error: 'REVIEWER_NOT_REGISTERED' }); return; }

  const instruments = await JrasInstrument.findAll({
    where: { status: 'in_review' },
    order: [['sentToReviewAt', 'ASC']],
    include: [{ model: JrasItem, as: 'items', attributes: ['id'] }],
  });

  const myReviews = await JrasReview.findAll({ where: { reviewerUserId: req.user!.sub } });
  const myReviewKey = new Set(myReviews.map((r) => `${r.instrumentId}:${r.instrumentVersion}`));

  res.json(instruments.map((i) => {
    const json = i.toJSON() as unknown as Record<string, unknown> & { items?: { id: string }[] };
    return {
      ...json,
      items: undefined,
      itemCount: json.items?.length ?? 0,
      alreadyReviewed: myReviewKey.has(`${i.id}:${i.version}`),
    };
  }));
}));

reviewerRouter.get('/instruments/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const reviewer = await getActiveReviewer(req.user!.sub);
  if (!reviewer) { res.status(403).json({ error: 'REVIEWER_NOT_REGISTERED' }); return; }

  const instrument = await JrasInstrument.findByPk(req.params['id'], {
    include: [{ model: JrasItem, as: 'items' }],
  });
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const myReview = await JrasReview.findOne({
    where: { instrumentId: instrument.id, reviewerUserId: req.user!.sub },
    order: [['instrumentVersion', 'DESC']],
  });

  // Reviewer hanya boleh melihat instrumen dalam antrean review,
  // atau instrumen yang pernah ia review (riwayat).
  if (instrument.status !== 'in_review' && !myReview) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const instJson = instrument.toJSON() as unknown as Record<string, unknown> & { items?: { orderNo: number }[] };
  instJson.items = (instJson.items ?? []).sort((a, b) => a.orderNo - b.orderNo);
  res.json({ ...instJson, myReview: myReview ? myReview.toJSON() : null });
}));

reviewerRouter.post('/instruments/:id/review', validateUuidParam('id'), wrap(async (req, res) => {
  const reviewer = await getActiveReviewer(req.user!.sub);
  if (!reviewer) { res.status(403).json({ error: 'REVIEWER_NOT_REGISTERED' }); return; }

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    return;
  }

  const instrument = await JrasInstrument.findByPk(req.params['id']);
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (instrument.status !== 'in_review') {
    res.status(409).json({ error: 'NOT_IN_REVIEW', message: 'Instrumen tidak sedang dalam tahap review.' });
    return;
  }

  const existing = await JrasReview.findOne({
    where: { instrumentId: instrument.id, instrumentVersion: instrument.version, reviewerUserId: req.user!.sub },
  });
  if (existing) {
    res.status(409).json({ error: 'ALREADY_REVIEWED', message: 'Anda sudah mereview versi instrumen ini.' });
    return;
  }

  // Validasi itemNotes menunjuk item milik instrumen ini
  if (parsed.data.itemNotes && parsed.data.itemNotes.length > 0) {
    const itemIds = new Set(
      (await JrasItem.findAll({ where: { instrumentId: instrument.id }, attributes: ['id'] })).map((i) => i.id),
    );
    if (!parsed.data.itemNotes.every((n) => itemIds.has(n.itemId))) {
      res.status(422).json({ error: 'VALIDATION_ERROR', message: 'itemNotes menunjuk item yang tidak dikenal.' });
      return;
    }
  }

  const review = await JrasReview.create({
    instrumentId: instrument.id,
    instrumentVersion: instrument.version,
    reviewerUserId: req.user!.sub,
    verdict: parsed.data.verdict,
    note: parsed.data.note ?? null,
    itemNotesJson: parsed.data.itemNotes ?? null,
    submittedAt: new Date(),
  });

  if (parsed.data.verdict === 'request_changes') {
    // Kembali ke draft untuk direvisi superadmin; versi naik saat dikirim ulang.
    await instrument.update({ status: 'draft' });
    await notifyByRole(
      'super_admin',
      'JRAS_CHANGES_REQUESTED',
      'Instrumen JRAS perlu revisi',
      `Reviewer meminta perubahan pada instrumen "${instrument.titleId}".`,
      'jras_instrument',
      instrument.id,
    );
  } else {
    const { quotaMet } = await computeApprovalStatus(instrument);
    if (quotaMet) {
      await instrument.update({ status: 'approved' });
      await notifyByRole(
        'super_admin',
        'JRAS_INSTRUMENT_APPROVED',
        'Instrumen JRAS lolos kuota review',
        `Instrumen "${instrument.titleId}" memenuhi kuota persetujuan dan siap diaktifkan.`,
        'jras_instrument',
        instrument.id,
      );
    }
  }

  res.status(201).json(review.toJSON());
}));

reviewerRouter.get('/my-reviews', wrap(async (req, res) => {
  const reviews = await JrasReview.findAll({
    where: { reviewerUserId: req.user!.sub },
    order: [['submittedAt', 'DESC']],
    include: [{
      model: JrasInstrument,
      as: 'instrument',
      attributes: ['id', 'titleId', 'titleJa', 'dimensionKey', 'type', 'status', 'version'],
    }],
  });
  res.json(reviews.map((r) => r.toJSON()));
}));

// ═══════════════════════════════════════════════════════════════════════════
// SUPERADMIN — /api/jras/superadmin/*
// ═══════════════════════════════════════════════════════════════════════════

const superadminRouter = Router();
superadminRouter.use(authenticate, requireRole('super_admin'));

// ── Instrumen ────────────────────────────────────────────────────────────────

superadminRouter.get('/instruments', wrap(async (req, res) => {
  const { status } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (status) where['status'] = status;

  const instruments = await JrasInstrument.findAll({
    where,
    order: [['createdAt', 'DESC']],
    include: [
      { model: JrasItem, as: 'items', attributes: ['id'] },
      { model: JrasReview, as: 'reviews', attributes: ['id', 'instrumentVersion', 'verdict'] },
    ],
  });

  res.json(instruments.map((i) => {
    const json = i.toJSON() as unknown as Record<string, unknown> & {
      items?: { id: string }[];
      reviews?: { instrumentVersion: number; verdict: string }[];
    };
    const currentReviews = (json.reviews ?? []).filter((r) => r.instrumentVersion === i.version);
    return {
      ...json,
      items: undefined,
      reviews: undefined,
      itemCount: json.items?.length ?? 0,
      approveCount: currentReviews.filter((r) => r.verdict === 'approve').length,
      changesCount: currentReviews.filter((r) => r.verdict === 'request_changes').length,
    };
  }));
}));

superadminRouter.post('/instruments', wrap(async (req, res) => {
  const parsed = instrumentMetaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    return;
  }
  const instrument = await JrasInstrument.create({
    ...parsed.data,
    descriptionId: parsed.data.descriptionId ?? null,
    descriptionJa: parsed.data.descriptionJa ?? null,
    createdBy: req.user!.sub,
  });
  res.status(201).json(instrument.toJSON());
}));

// Import instrumen lengkap (metadata + items) dari JSON — untuk draft item bank
superadminRouter.post('/instruments/import', wrap(async (req, res) => {
  const importSchema = z.object({
    instrument: instrumentMetaSchema,
    items: itemsSchema,
  }).strict();
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    return;
  }

  const instrument = await JrasInstrument.create({
    ...parsed.data.instrument,
    descriptionId: parsed.data.instrument.descriptionId ?? null,
    descriptionJa: parsed.data.instrument.descriptionJa ?? null,
    createdBy: req.user!.sub,
  });
  await JrasItem.bulkCreate(parsed.data.items.map((item, idx) => ({
    instrumentId: instrument.id,
    orderNo: idx,
    type: item.type,
    promptId: item.promptId,
    promptJa: item.promptJa,
    optionsJson: item.options,
    scoringJson: item.scoring,
    criticalFlag: item.criticalFlag ?? false,
    sensitive: item.sensitive ?? false,
  })));

  await auditAction(req, 'JRAS_INSTRUMENT_IMPORT', instrument.id, {
    titleId: instrument.titleId,
    itemCount: parsed.data.items.length,
  });
  res.status(201).json({ ...instrument.toJSON(), itemCount: parsed.data.items.length });
}));

superadminRouter.get('/instruments/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const instrument = await JrasInstrument.findByPk(req.params['id'], {
    include: [
      { model: JrasItem, as: 'items' },
      {
        model: JrasReview,
        as: 'reviews',
        include: [{ model: User, as: 'reviewer', attributes: ['id', 'name', 'email'] }],
      },
    ],
  });
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const approval = await computeApprovalStatus(instrument);
  const reviewerRows = await JrasReviewer.findAll();
  const typeByUser = new Map(reviewerRows.map((r) => [r.userId, r.reviewerType]));

  const json = instrument.toJSON() as unknown as Record<string, unknown> & {
    items?: { orderNo: number }[];
    reviews?: { reviewerUserId: string }[];
  };
  json.items = (json.items ?? []).sort((a, b) => a.orderNo - b.orderNo);
  json.reviews = (json.reviews ?? []).map((r) => ({
    ...r,
    reviewerType: typeByUser.get(r.reviewerUserId) ?? null,
  }));
  res.json({ ...json, approval });
}));

superadminRouter.put('/instruments/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const instrument = await JrasInstrument.findByPk(req.params['id']);
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (instrument.status !== 'draft') {
    res.status(409).json({ error: 'NOT_DRAFT', message: 'Hanya instrumen draft yang bisa diedit.' });
    return;
  }
  const parsed = instrumentMetaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    return;
  }
  await instrument.update(parsed.data);
  res.json(instrument.toJSON());
}));

superadminRouter.put('/instruments/:id/items', validateUuidParam('id'), wrap(async (req, res) => {
  const instrument = await JrasInstrument.findByPk(req.params['id']);
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (instrument.status !== 'draft') {
    res.status(409).json({ error: 'NOT_DRAFT', message: 'Hanya instrumen draft yang bisa diedit.' });
    return;
  }
  const parsed = itemsSchema.safeParse(req.body?.items);
  if (!parsed.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    return;
  }

  await JrasItem.destroy({ where: { instrumentId: instrument.id } });
  const items = await JrasItem.bulkCreate(parsed.data.map((item, idx) => ({
    instrumentId: instrument.id,
    orderNo: idx,
    type: item.type,
    promptId: item.promptId,
    promptJa: item.promptJa,
    optionsJson: item.options,
    scoringJson: item.scoring,
    criticalFlag: item.criticalFlag ?? false,
    sensitive: item.sensitive ?? false,
  })));
  res.json(items.map((i) => i.toJSON()));
}));

superadminRouter.delete('/instruments/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const instrument = await JrasInstrument.findByPk(req.params['id']);
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (instrument.status !== 'draft') {
    res.status(409).json({ error: 'NOT_DRAFT', message: 'Hanya instrumen draft yang bisa dihapus.' });
    return;
  }
  await instrument.destroy();
  res.json({ deleted: true });
}));

superadminRouter.post('/instruments/:id/send-to-review', validateUuidParam('id'), wrap(async (req, res) => {
  const instrument = await JrasInstrument.findByPk(req.params['id']);
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (instrument.status !== 'draft') {
    res.status(409).json({ error: 'NOT_DRAFT', message: 'Hanya instrumen draft yang bisa dikirim ke review.' });
    return;
  }
  const itemCount = await JrasItem.count({ where: { instrumentId: instrument.id } });
  if (itemCount === 0) {
    res.status(409).json({ error: 'NO_ITEMS', message: 'Instrumen tanpa item tidak bisa direview.' });
    return;
  }

  // Bila versi berjalan sudah pernah direview (request_changes), naikkan versi
  // agar siklus review dimulai bersih dan skor antar versi tetap sebanding.
  const priorReviews = await JrasReview.count({
    where: { instrumentId: instrument.id, instrumentVersion: instrument.version },
  });
  const version = priorReviews > 0 ? instrument.version + 1 : instrument.version;

  await instrument.update({ status: 'in_review', version, sentToReviewAt: new Date() });
  await auditAction(req, 'JRAS_SEND_TO_REVIEW', instrument.id, { titleId: instrument.titleId, version });

  // Notifikasi semua reviewer aktif — reviewer baru otomatis melihat antrean
  const reviewers = await JrasReviewer.findAll({ where: { active: true } });
  await Promise.all(reviewers.map((r) =>
    notifyUser(
      r.userId,
      'JRAS_REVIEW_REQUESTED',
      'Instrumen JRAS menunggu review Anda',
      `Instrumen "${instrument.titleId}" (v${version}) dikirim untuk review.`,
      'jras_instrument',
      instrument.id,
    ),
  ));

  res.json(instrument.toJSON());
}));

superadminRouter.post('/instruments/:id/return-to-draft', validateUuidParam('id'), wrap(async (req, res) => {
  const instrument = await JrasInstrument.findByPk(req.params['id']);
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (instrument.status !== 'in_review' && instrument.status !== 'approved') {
    res.status(409).json({ error: 'INVALID_STATUS' });
    return;
  }
  await instrument.update({ status: 'draft' });
  await auditAction(req, 'JRAS_RETURN_TO_DRAFT', instrument.id, { titleId: instrument.titleId });
  res.json(instrument.toJSON());
}));

superadminRouter.post('/instruments/:id/activate', validateUuidParam('id'), wrap(async (req, res) => {
  const instrument = await JrasInstrument.findByPk(req.params['id']);
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (instrument.status !== 'approved') {
    res.status(409).json({ error: 'NOT_APPROVED', message: 'Instrumen harus lolos kuota review sebelum diaktifkan.' });
    return;
  }
  // Tegakkan kuota sekali lagi saat aktivasi (kuota bisa berubah sejak approved)
  const { quotaMet, quota, approvals } = await computeApprovalStatus(instrument);
  if (!quotaMet) {
    res.status(409).json({ error: 'QUOTA_NOT_MET', quota, approvals });
    return;
  }

  // Pensiunkan versi aktif lain pada dimensi+tipe yang sama agar tidak dobel
  await JrasInstrument.update(
    { status: 'retired', retiredAt: new Date() },
    { where: { dimensionKey: instrument.dimensionKey, type: instrument.type, status: 'active' } },
  );

  await instrument.update({ status: 'active', activatedAt: new Date() });
  await auditAction(req, 'JRAS_ACTIVATE_INSTRUMENT', instrument.id, {
    titleId: instrument.titleId,
    version: instrument.version,
    approvals,
  });
  res.json(instrument.toJSON());
}));

superadminRouter.post('/instruments/:id/retire', validateUuidParam('id'), wrap(async (req, res) => {
  const instrument = await JrasInstrument.findByPk(req.params['id']);
  if (!instrument) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (instrument.status !== 'active') {
    res.status(409).json({ error: 'NOT_ACTIVE' });
    return;
  }
  await instrument.update({ status: 'retired', retiredAt: new Date() });
  await auditAction(req, 'JRAS_RETIRE_INSTRUMENT', instrument.id, { titleId: instrument.titleId });
  res.json(instrument.toJSON());
}));

// ── Reviewer management ──────────────────────────────────────────────────────

superadminRouter.get('/reviewers', wrap(async (_req, res) => {
  const reviewers = await JrasReviewer.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'isActive'] }],
    order: [['createdAt', 'ASC']],
  });
  res.json(reviewers.map((r) => r.toJSON()));
}));

superadminRouter.put('/reviewers/:userId', validateUuidParam('userId'), wrap(async (req, res) => {
  const schema = z.object({
    reviewerType: z.enum(['ex_ssw', 'jp_hr', 'expert']).optional(),
    active: z.boolean().optional(),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    return;
  }
  const reviewer = await JrasReviewer.findOne({ where: { userId: req.params['userId'] } });
  if (!reviewer) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  await reviewer.update(parsed.data);
  res.json(reviewer.toJSON());
}));

// ── Komite banding ───────────────────────────────────────────────────────────

superadminRouter.get('/committee', wrap(async (_req, res) => {
  const members = await JrasCommitteeMember.findAll({
    where: { active: true },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
    order: [['createdAt', 'ASC']],
  });
  res.json(members.map((m) => m.toJSON()));
}));

superadminRouter.put('/committee', wrap(async (req, res) => {
  const { userIds } = req.body as { userIds: unknown };
  if (!Array.isArray(userIds) || !userIds.every((id) => typeof id === 'string' && isUUID(id, 4))) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'userIds harus array UUID.' });
    return;
  }
  const users = await User.findAll({ where: { id: userIds } });
  if (users.length !== userIds.length) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Sebagian user tidak ditemukan.' });
    return;
  }

  const existing = await JrasCommitteeMember.findAll();
  const keep = new Set(userIds);
  await Promise.all(existing.map((m) =>
    m.update({ active: keep.has(m.userId) }),
  ));
  const existingIds = new Set(existing.map((m) => m.userId));
  await JrasCommitteeMember.bulkCreate(
    userIds.filter((id) => !existingIds.has(id)).map((userId) => ({ userId, active: true })),
  );

  await auditAction(req, 'JRAS_COMMITTEE_UPDATE', 'committee', { userIds });
  res.json({ userIds });
}));

// ── Konfigurasi (rollout, bobot, kuota, threshold) ───────────────────────────

superadminRouter.get('/config', wrap(async (_req, res) => {
  const [lpkIds, weights, reviewQuota, thresholds] = await Promise.all([
    getSetting<string[]>('jras_lpk_ids', []),
    getSetting<Record<string, number>>(
      'jras_dimension_weights',
      Object.fromEntries(JRAS_DIMENSION_KEYS.map((k) => [k, 1])),
    ),
    getReviewQuota(),
    getSetting<{ ready: number; risk: number }>('jras_thresholds', { ready: 75, risk: 50 }),
  ]);
  res.json({ lpkIds, weights, reviewQuota, thresholds });
}));

superadminRouter.put('/config', wrap(async (req, res) => {
  const schema = z.object({
    lpkIds: z.array(z.string().uuid()).optional(),
    weights: z.record(dimensionEnum, z.number().min(0).max(10)).optional(),
    reviewQuota: z.object({ ex_ssw: z.number().int().min(0).max(10), jp_hr: z.number().int().min(0).max(10) }).strict().optional(),
    thresholds: z.object({ ready: z.number().min(0).max(100), risk: z.number().min(0).max(100) }).strict().optional(),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.thresholds && parsed.data.thresholds.risk >= parsed.data.thresholds.ready) {
    res.status(422).json({ error: 'VALIDATION_ERROR', message: 'Threshold risk harus lebih kecil dari ready.' });
    return;
  }

  const updates: Array<Promise<void>> = [];
  if (parsed.data.lpkIds) updates.push(setSetting('jras_lpk_ids', parsed.data.lpkIds));
  if (parsed.data.weights) updates.push(setSetting('jras_dimension_weights', parsed.data.weights));
  if (parsed.data.reviewQuota) updates.push(setSetting('jras_review_quota', parsed.data.reviewQuota));
  if (parsed.data.thresholds) updates.push(setSetting('jras_thresholds', parsed.data.thresholds));
  await Promise.all(updates);

  await auditAction(req, 'JRAS_CONFIG_UPDATE', 'config', parsed.data as Record<string, unknown>);
  res.json(parsed.data);
}));

// ── Risk rules (engine berjalan di P3; konfigurasi sudah bisa dikelola) ──────

superadminRouter.get('/risk-rules', wrap(async (_req, res) => {
  const rules = await JrasRiskRule.findAll({ order: [['ruleKey', 'ASC']] });
  res.json(rules.map((r) => r.toJSON()));
}));

superadminRouter.put('/risk-rules/:ruleKey', wrap(async (req, res) => {
  const schema = z.object({
    enabled: z.boolean().optional(),
    severity: z.enum(['yellow', 'red']).optional(),
    configJson: z.record(z.string(), z.unknown()).optional(),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    return;
  }
  const rule = await JrasRiskRule.findOne({ where: { ruleKey: req.params['ruleKey'] } });
  if (!rule) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  await rule.update(parsed.data);
  res.json(rule.toJSON());
}));

router.use('/reviewer', reviewerRouter);
router.use('/superadmin', superadminRouter);

export default router;
