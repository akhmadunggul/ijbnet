import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../middleware/auth';
import { decryptNullable } from '../utils/crypto';
import { buildCandidatePdfHtml } from '../utils/candidatePdf';
import { buildShokumuHtml } from '../utils/shokumuTemplate';
import { buildGakkenHtml } from '../utils/gakkenTemplate';
import { config } from '../config';
import { translateId2Ja } from '../utils/translate';
import { renderPdf, isPdfError } from '../utils/browserPool';
import {
  parseBody,
  patchMeSchema,
  putCareerSchema,
  putCertSchema,
  putEduSchema,
  putTestSchema,
  patchShokumuSchema,
  patchGakkenResumeSchema,
} from '../utils/candidateSchemas';
import {
  Candidate,
  CandidateJapaneseTest,
  CandidateCareer,
  CandidateBodyCheck,
  CandidateWeeklyTest,
  CandidateIntroVideo,
  CandidateCertification,
  CandidateEducationHistory,
  ToolsDictionary,
  AuditLog,
  Notification,
  User,
  Lpk,
  SswSectorField,
  ConsentClause,
  CandidateTimeline,
  BatchCandidate,
  InterviewProposal,
  GlobalSettings,
  CandidateGakkenResume,
  CandidateGakkenCompany,
} from '../db/models/index';
import { recordTimelineEvent, currentAgeHours } from '../utils/timeline';
import { notifyUser } from '../utils/notify';
import { serializeCandidate } from '../serializers/candidate';
import { calcCompleteness } from '../utils/completeness';
import { validateImageBuffer, savePhoto } from '../utils/storage';
import type { PhotoSlot } from '../utils/storage';
import { encrypt } from '../utils/crypto';
import { cacheGet, cacheSet, cacheDel } from '../utils/redis';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/** Drop the cached /candidates/me response for a given user. Fire-and-forget. */
function invalidateMe(userId: string): void {
  cacheDel(`cand:me:${userId}`).catch(() => { /* ignore */ });
}

function serializeTimeline(events: CandidateTimeline[]): unknown[] {
  return events.map((e, i) => {
    const json = e.toJSON() as unknown as Record<string, unknown>;
    if (i === events.length - 1) {
      json['currentAgeHours'] = currentAgeHours(e.occurredAt);
    }
    return json;
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── GET /api/candidates/ssw-options — SSW sector/field lookup (all auth roles) ─
router.get('/ssw-options', authenticate, async (_req: Request, res: Response): Promise<void> => {
  const rows = await SswSectorField.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC']],
    attributes: ['id', 'kubun', 'sectorId', 'sectorJa', 'fieldId', 'fieldJa', 'sortOrder'],
  });
  res.json(rows.map((r) => r.toJSON()));
});

// ── GET /api/candidates/lpks — public list for onboarding dropdown ────────────
router.get('/lpks', authenticate, requireRole('candidate'), async (_req: Request, res: Response): Promise<void> => {
  const CACHE_KEY = 'lpks:active';
  const cached = await cacheGet(CACHE_KEY);
  if (cached) { res.json(JSON.parse(cached)); return; }

  const lpks = await Lpk.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'city'],
    order: [['name', 'ASC']],
  });
  const payload = { lpks: lpks.map((l) => l.toJSON()) };
  await cacheSet(CACHE_KEY, JSON.stringify(payload), 300);
  res.json(payload);
});

// All candidate routes require auth + candidate role
router.use(authenticate, requireRole('candidate'));

// ── Helper: find candidate by userId ─────────────────────────────────────────
async function findMyCandidate(userId: string) {
  return Candidate.findOne({
    where: { userId },
    include: [
      { model: CandidateJapaneseTest, as: 'tests', required: false },
      { model: CandidateCareer, as: 'career', required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
      { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
      { model: CandidateWeeklyTest, as: 'weeklyTests', required: false },
      { model: CandidateIntroVideo, as: 'videos', required: false },
      { model: ToolsDictionary, as: 'tools', required: false },
      { model: CandidateCertification, as: 'certifications', required: false },
      { model: CandidateEducationHistory, as: 'educationHistory', required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
    ],
  });
}

// ── Per-user PDF rate limiter ─────────────────────────────────────────────────
// 5 PDF exports per user per 5 minutes — prevents the Chromium spawn bomb.
const pdfLimiter = rateLimit({
  windowMs: 5 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.sub ?? req.ip ?? 'anon',
  handler: (_req, res) => {
    res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many PDF requests. Please wait a few minutes.' });
  },
});

// ── GET /api/candidates/me ────────────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const cacheKey = `cand:me:${req.user!.sub}`;
  const cached = await cacheGet(cacheKey);
  if (cached) { res.json(JSON.parse(cached)); return; }

  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.json({ candidate: null, isNewUser: true });
    return;
  }

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const completeness = calcCompleteness(data);

  const activeClause = await ConsentClause.findOne({ where: { isActive: true }, attributes: ['id'] });
  const consentUpToDate =
    candidate.consentGiven === true &&
    activeClause !== null &&
    candidate.consentClauseId === activeClause.id;

  const payload = {
    candidate: {
      ...serializeCandidate(data, 'candidate'),
      completeness,
      consentUpToDate,
      activeConsentClauseId: activeClause?.id ?? null,
    },
  };
  await cacheSet(cacheKey, JSON.stringify(payload), 10);
  res.json(payload);
});

// ── PATCH /api/candidates/me ──────────────────────────────────────────────────
router.patch('/me', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED', message: 'Your profile is locked by a manager.' });
    return;
  }

  const parsed = parseBody(patchMeSchema, req.body, res);
  if (parsed === null) return;

  // Build updates — strip undefined (omitted optional fields)
  const { lpkId: lpkIdInput, ...rest } = parsed;
  const updates: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );

  // lpkId: allow setting once (only when not yet assigned)
  if (lpkIdInput && !candidate.lpkId) {
    const lpk = await Lpk.findOne({ where: { id: lpkIdInput, isActive: true } });
    if (lpk) updates['lpkId'] = lpk.id;
  }

  // Auto-translate Indonesian → Japanese for self-intro, motivation, self-PR
  const translateSetting = await GlobalSettings.findOne({ where: { key: 'auto_translate_enabled' } });
  const autoTranslateEnabled = translateSetting
    ? (translateSetting.toJSON() as unknown as Record<string, unknown>)['value'] !== false
    : true;

  const translatePairs: Array<{ idKey: string; jaKey: string }> = [
    { idKey: 'selfIntroId',  jaKey: 'selfIntroJa'  },
    { idKey: 'motivationId', jaKey: 'motivationJa' },
    { idKey: 'selfPrId',     jaKey: 'selfPrJa'     },
  ];
  if (autoTranslateEnabled) await Promise.all(
    translatePairs.map(async ({ idKey, jaKey }) => {
      const idText = (updates[idKey] ?? (candidate as unknown as Record<string, unknown>)[idKey]) as string | null | undefined;
      const jaText = (updates[jaKey] ?? (candidate as unknown as Record<string, unknown>)[jaKey]) as string | null | undefined;
      if (!idText || jaText) return;
      const translated = await translateId2Ja(idText, { userId: req.user!.sub, context: 'auto-save' });
      if (translated) updates[jaKey] = translated;
    }),
  );

  await candidate.update(updates);
  invalidateMe(req.user!.sub);

  const fresh = await findMyCandidate(req.user!.sub);
  const data = fresh!.toJSON() as unknown as Record<string, unknown>;
  res.json({ candidate: { ...serializeCandidate(data, 'candidate'), completeness: calcCompleteness(data) } });
});

// ── PATCH /api/candidates/me/consent ─────────────────────────────────────────
router.patch('/me/consent', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  try {
    const candidate = await findMyCandidate(req.user!.sub);
    if (!candidate) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const { clauseId } = req.body as { clauseId?: string };

    const activeClause = await ConsentClause.findOne({ where: { isActive: true } });
    if (!activeClause) {
      res.status(422).json({ error: 'NO_ACTIVE_CLAUSE', message: 'No active consent clause found.' });
      return;
    }
    if (!clauseId || clauseId !== activeClause.id) {
      res.status(422).json({ error: 'INVALID_CLAUSE', message: 'Clause ID must match the current active clause.' });
      return;
    }

    await candidate.update({
      consentGiven: true,
      consentGivenAt: new Date(),
      consentClauseId: clauseId,
    });

    // Audit log and timeline are supplementary — don't let failures block the response.
    AuditLog.create({
      userId: req.user!.sub,
      action: 'CONSENT_GIVEN',
      entityType: 'candidate',
      entityId: candidate.id,
      targetCandidateId: candidate.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: clauseId ? { clauseId } : null,
    }).catch((e) => console.error('[consent] audit log failed:', e));

    recordTimelineEvent(candidate.id, 'consent_given', req.user!.sub, 'candidate')
      .catch((e) => console.error('[consent] timeline event failed:', e));

    invalidateMe(req.user!.sub);
    res.json({ message: 'Consent recorded.' });
  } catch (err) {
    console.error('[PATCH /me/consent] error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── PATCH /api/candidates/me/nik ─────────────────────────────────────────────
router.patch('/me/nik', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED', message: 'Your profile is locked by a manager.' });
    return;
  }

  const { nik } = req.body as { nik?: string };
  if (!nik || !/^\d{16}$/.test(nik)) {
    res.status(422).json({ error: 'INVALID_NIK', message: 'NIK must be exactly 16 digits.' });
    return;
  }

  await candidate.update({ nikEncrypted: encrypt(nik) });
  invalidateMe(req.user!.sub);

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'UPDATE_NIK',
    entityType: 'candidate',
    entityId: candidate.id,
    targetCandidateId: candidate.id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: null,
  });

  res.json({ message: 'NIK updated successfully.' });
});

// ── POST /api/candidates/me/submit ───────────────────────────────────────────
router.post('/me/submit', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  if (!candidate.lpkId) {
    res.status(422).json({ error: 'LPK_REQUIRED', message: 'You must select your LPK before submitting.' });
    return;
  }
  if (!candidate.consentGiven) {
    res.status(422).json({ error: 'CONSENT_REQUIRED', message: 'Consent must be given before submitting.' });
    return;
  }
  if (candidate.profileStatus !== 'incomplete') {
    res.status(422).json({ error: 'INVALID_STATUS', message: 'Profile has already been submitted.' });
    return;
  }

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const { pct } = calcCompleteness(data);
  if (pct < 100) {
    res.status(422).json({ error: 'INCOMPLETE_PROFILE', message: `Profile is only ${pct}% complete.` });
    return;
  }

  await candidate.update({ profileStatus: 'submitted' });
  invalidateMe(req.user!.sub);

  // Notify managers (global) + admins scoped to this candidate's LPK
  const admins = await User.findAll({
    where: {
      isActive: true,
      [Op.or]: [
        { role: 'manager' },
        { role: 'admin', lpkId: candidate.lpkId },
      ],
    },
  });
  await Notification.bulkCreate(
    admins.map((a) => ({
      id: uuidv4(),
      userId: a.id,
      type: 'PROFILE_SUBMITTED',
      title: `New submission: ${candidate.fullName}`,
      body: `Candidate ${candidate.candidateCode} has submitted their profile.`,
      isRead: false,
      referenceType: 'candidate',
      referenceId: candidate.id,
    })),
  );

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'PROFILE_SUBMITTED',
    entityType: 'candidate',
    entityId: candidate.id,
    targetCandidateId: candidate.id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: null,
  });

  await recordTimelineEvent(candidate.id, 'profile_submitted', req.user!.sub, 'candidate');

  res.json({ message: 'Profile submitted successfully.' });
});

// ── PUT /api/candidates/me/career ─────────────────────────────────────────────
router.put('/me/career', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const body = parseBody(putCareerSchema, req.body, res);
  if (body === null) return;
  const { entries } = body;

  const translateSetting = await GlobalSettings.findOne({ where: { key: 'auto_translate' } });
  const autoTranslate = translateSetting
    ? (translateSetting.toJSON() as unknown as Record<string, unknown>)['value'] !== false
    : true;

  await CandidateCareer.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    const rows = await Promise.all(
      entries.map(async (e, i) => {
        let divisionJa = e.divisionJa ?? null;
        let skillGroupJa = e.skillGroupJa ?? null;
        if (autoTranslate) {
          if (e.division && !divisionJa) {
            const t = await translateId2Ja(e.division, { userId: req.user!.sub, context: 'career-save' });
            if (t) divisionJa = t;
          }
          if (e.skillGroup && !skillGroupJa) {
            const t = await translateId2Ja(e.skillGroup, { userId: req.user!.sub, context: 'career-save' });
            if (t) skillGroupJa = t;
          }
        }
        return {
          id: uuidv4(),
          candidateId: candidate.id,
          companyName: e.companyName ?? null,
          division: e.division ?? null,
          divisionJa,
          skillGroup: e.skillGroup ?? null,
          skillGroupJa,
          period: e.period ?? null,
          startDate: e.startDate ?? null,
          sortOrder: e.sortOrder ?? i,
        };
      }),
    );
    await CandidateCareer.bulkCreate(rows);
  }

  invalidateMe(req.user!.sub);
  const career = await CandidateCareer.findAll({ where: { candidateId: candidate.id }, order: [['startDate', 'ASC'], ['sortOrder', 'ASC']] });
  res.json({ career: career.map((c) => c.toJSON()) });
});

// ── PUT /api/candidates/me/certifications ─────────────────────────────────────
router.put('/me/certifications', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const body = parseBody(putCertSchema, req.body, res);
  if (body === null) return;
  const { entries } = body;

  await CandidateCertification.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    await CandidateCertification.bulkCreate(
      entries.map((e) => ({
        id: uuidv4(),
        candidateId: candidate.id,
        certName: e.certName ?? '',
        certLevel: e.certLevel ?? null,
        issuedDate: e.issuedDate ?? null,
        issuedBy: e.issuedBy ?? null,
      })),
    );
  }

  invalidateMe(req.user!.sub);
  const certifications = await CandidateCertification.findAll({
    where: { candidateId: candidate.id },
    order: [['createdAt', 'ASC']],
  });
  res.json({ certifications: certifications.map((c) => c.toJSON()) });
});

// ── PUT /api/candidates/me/education-history ──────────────────────────────────
router.put('/me/education-history', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const body = parseBody(putEduSchema, req.body, res);
  if (body === null) return;
  const { entries } = body;

  await CandidateEducationHistory.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    await CandidateEducationHistory.bulkCreate(
      entries.map((e, i) => ({
        id: uuidv4(),
        candidateId: candidate.id,
        schoolName: e.schoolName ?? '',
        major: e.major ?? null,
        startDate: e.startDate ?? null,
        endDate: e.endDate ?? null,
        sortOrder: e.sortOrder ?? i,
      })),
    );
  }

  invalidateMe(req.user!.sub);
  const educationHistory = await CandidateEducationHistory.findAll({
    where: { candidateId: candidate.id },
    order: [['sortOrder', 'ASC']],
  });
  res.json({ educationHistory: educationHistory.map((e) => e.toJSON()) });
});

// ── PUT /api/candidates/me/tests ──────────────────────────────────────────────
router.put('/me/tests', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const body = parseBody(putTestSchema, req.body, res);
  if (body === null) return;
  const { entries } = body;

  await CandidateJapaneseTest.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    await CandidateJapaneseTest.bulkCreate(
      entries.map((e) => ({
        id: uuidv4(),
        candidateId: candidate.id,
        testName: e.testName ?? null,
        score: e.score ?? null,
        pass: e.pass ?? null,
        testDate: e.testDate ? new Date(e.testDate) : null,
      })),
    );
  }

  invalidateMe(req.user!.sub);
  const tests = await CandidateJapaneseTest.findAll({ where: { candidateId: candidate.id }, order: [['testDate', 'DESC']] });
  res.json({ tests: tests.map((t) => t.toJSON()) });
});

// ── POST /api/candidates/me/photos/:slot ──────────────────────────────────────
router.post(
  '/me/photos/:slot',
  upload.single('photo'),
  async (req: Request, res: Response): Promise<void> => {
    const { slot } = req.params as { slot: string };
    if (slot !== 'closeup' && slot !== 'fullbody') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Slot must be closeup or fullbody.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'No file uploaded.' });
      return;
    }

    const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
    if (!candidate) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (candidate.isLocked) {
      res.status(403).json({ error: 'PROFILE_LOCKED' });
      return;
    }

    try {
      validateImageBuffer(req.file.buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid file.';
      res.status(422).json({ error: 'INVALID_FILE', message: msg });
      return;
    }

    const bgRow = await GlobalSettings.findOne({ where: { key: 'photo_bg_color' } });
    const bgColor = bgRow
      ? ((bgRow.toJSON() as unknown as Record<string, unknown>)['value'] as string) || undefined
      : undefined;

    let urlPath: string;
    try {
      ({ urlPath } = await savePhoto(candidate.id, slot as PhotoSlot, req.file.buffer, bgColor));
    } catch (err) {
      console.error('[photo-upload] savePhoto failed:', err);
      res.status(500).json({ error: 'UPLOAD_FAILED', message: 'Failed to process image.' });
      return;
    }

    const updateField = slot === 'closeup' ? 'closeupUrl' : 'fullbodyUrl';
    await candidate.update({ [updateField]: urlPath });
    invalidateMe(req.user!.sub);

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'UPLOAD_PHOTO',
      entityType: 'candidate',
      entityId: candidate.id,
      targetCandidateId: candidate.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: { slot },
    });

    res.json({ url: urlPath });
  },
);

// ── GET /api/candidates/me/export ─────────────────────────────────────────────
router.get('/me/export', pdfLimiter, async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({
    where: { userId: req.user!.sub },
    include: [
      { model: User,                      as: 'user',             attributes: ['name', 'email'], required: false },
      { model: Lpk,                       as: 'lpk',              attributes: ['name', 'city'],  required: false },
      { model: CandidateJapaneseTest,     as: 'tests',            required: false },
      { model: CandidateCareer,           as: 'career',           required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
      { model: CandidateBodyCheck,        as: 'bodyCheck',        required: false },
      { model: CandidateCertification,    as: 'certifications',   required: false },
      { model: CandidateEducationHistory, as: 'educationHistory', required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
    ],
  });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const cj  = candidate.toJSON() as unknown as Record<string, unknown>;
  const nik = decryptNullable(candidate.nikEncrypted ?? null);
  const html = buildCandidatePdfHtml(cj, nik);

  try {
    const pdf = await renderPdf(html, { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' });

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'DATA_EXPORT',
      entityType: 'candidate',
      entityId: candidate.id,
      targetCandidateId: candidate.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${candidate.candidateCode}-data.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (isPdfError(err, 'CHROME_NOT_FOUND')) { res.status(503).json({ error: 'PDF_UNAVAILABLE' }); return; }
    if (isPdfError(err, 'PDF_QUEUE_TIMEOUT')) { res.status(503).json({ error: 'PDF_BUSY', message: 'PDF service is busy. Please try again shortly.' }); return; }
    throw err;
  }
});

// ── GET /api/candidates/me/timeline ──────────────────────────────────────────
router.get('/me/timeline', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub }, attributes: ['id'] });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const events = await CandidateTimeline.findAll({
    where: { candidateId: candidate.id },
    include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'role'], required: false }],
    order: [['occurredAt', 'ASC']],
  });

  res.json({ timeline: serializeTimeline(events) });
});

// ── GET /api/candidates/me/interview/pending ──────────────────────────────────
// Returns the first pending interview proposal for this candidate (status = proposed)
router.get('/me/interview/pending', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub }, attributes: ['id'] });
  if (!candidate) { res.json({ proposal: null }); return; }

  const bcs = await BatchCandidate.findAll({
    where: { candidateId: candidate.id, isSelected: true },
    attributes: ['id'],
  });
  const bcIds = bcs.map((b) => b.id);
  if (!bcIds.length) { res.json({ proposal: null }); return; }

  const { Op } = await import('sequelize');
  const proposal = await InterviewProposal.findOne({
    where: { batchCandidateId: { [Op.in]: bcIds }, status: 'proposed' },
    order: [['createdAt', 'DESC']],
  });

  res.json({ proposal: proposal ? proposal.toJSON() : null });
});

// ── PATCH /api/candidates/me/interviews/:proposalId/confirm-date ──────────────
// Candidate selects their preferred date from the recruiter's proposed options.
// This is called BEFORE the manager finalises. Records interview_date_confirmed.
router.patch('/me/interviews/:proposalId/confirm-date', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  const { proposalId } = req.params as { proposalId: string };

  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub }, attributes: ['id'] });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const proposal = await InterviewProposal.findByPk(proposalId, {
    include: [{ model: BatchCandidate, as: 'batchCandidate', attributes: ['id', 'candidateId'] }],
  });
  if (!proposal) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const bc = (proposal as unknown as Record<string, unknown>)['batchCandidate'] as { candidateId: string } | null;
  if (!bc || bc.candidateId !== candidate.id) {
    res.status(403).json({ error: 'FORBIDDEN' }); return;
  }

  if (proposal.status !== 'proposed') {
    res.status(422).json({ error: 'INVALID_STATE', message: 'Proposal is no longer open for date selection.' }); return;
  }

  const { date } = req.body as { date?: string };
  if (!date || !Array.isArray(proposal.proposedDates) || !proposal.proposedDates.includes(date)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Date must be one of the proposed dates.' }); return;
  }

  if (proposal.candidatePreferredDate) {
    res.status(409).json({ error: 'ALREADY_CONFIRMED', message: 'Preferred date already selected.' }); return;
  }

  await proposal.update({ candidatePreferredDate: date });

  await recordTimelineEvent(
    candidate.id,
    'interview_date_confirmed',
    req.user!.sub,
    'candidate',
    { proposalId, candidatePreferredDate: date },
  );

  // Notify managers that candidate has confirmed their preferred date
  const managers = await User.findAll({ where: { role: 'manager', isActive: true }, attributes: ['id'] });
  await Promise.all(managers.map((m) =>
    notifyUser(
      m.id,
      'CANDIDATE_DATE_CONFIRMED',
      'Kandidat mengkonfirmasi jadwal wawancara',
      `Kandidat telah memilih tanggal wawancara: ${date}. Silakan tetapkan jadwal final.`,
      'interview_proposal',
      proposalId,
    ),
  ));

  res.json({ message: 'Preferred date confirmed.', candidatePreferredDate: date });
});

// ── GET /api/candidates/me/shokumu ────────────────────────────────────────────
router.get('/me/shokumu', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  const [enabledRow, layoutRow, mergeRow, rolloutModeRow, rolloutLpkRow, templateRow] = await Promise.all([
    GlobalSettings.findOne({ where: { key: 'shokumu_enabled' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_layout' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_merge_cv' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_rollout_mode' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_rollout_lpk_ids' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_template' } }),
  ]);
  const enabled       = enabledRow      ? (enabledRow.toJSON()      as unknown as Record<string, unknown>)['value'] === true  : false;
  const layout        = layoutRow       ? String((layoutRow.toJSON() as unknown as Record<string, unknown>)['value'] ?? 'reverse') : 'reverse';
  const mergeCv       = mergeRow        ? (mergeRow.toJSON()        as unknown as Record<string, unknown>)['value'] === true  : false;
  const rolloutMode   = rolloutModeRow  ? String((rolloutModeRow.toJSON()  as unknown as Record<string, unknown>)['value'] ?? 'all') : 'all';
  const rolloutLpkIds = rolloutLpkRow
    ? ((rolloutLpkRow.toJSON() as unknown as Record<string, unknown>)['value'] as string[] | null) ?? []
    : [];
  const template = templateRow ? String((templateRow.toJSON() as unknown as Record<string, unknown>)['value'] ?? 'generic') : 'generic';

  let eligible = false;
  if (enabled) {
    if (rolloutMode === 'all') {
      eligible = true;
    } else if (rolloutMode === 'lpk') {
      const candidate = await Candidate.findOne({ where: { userId: req.user!.sub }, attributes: ['lpkId'] });
      eligible = candidate?.lpkId != null && rolloutLpkIds.includes(candidate.lpkId);
    }
  }

  res.json({ enabled, layout, mergeCv, eligible, template });
});

// ── PATCH /api/candidates/me/shokumu ─────────────────────────────────────────
router.patch('/me/shokumu', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const body = parseBody(patchShokumuSchema, req.body, res);
  if (body === null) return;

  // Auto-translate enabled?
  const translateSetting = await GlobalSettings.findOne({ where: { key: 'auto_translate_enabled' } });
  const autoTranslate = translateSetting
    ? (translateSetting.toJSON() as unknown as Record<string, unknown>)['value'] !== false
    : true;

  // Update candidate summary fields + auto-translate careerSummaryId → careerSummaryJa
  const candidateUpdates: Record<string, unknown> = {};
  if (body.careerSummaryId !== undefined) candidateUpdates['careerSummaryId'] = body.careerSummaryId ?? null;
  if (body.careerSummaryJa !== undefined) candidateUpdates['careerSummaryJa'] = body.careerSummaryJa ?? null;

  if (autoTranslate && body.careerSummaryId) {
    const existingJa = (candidateUpdates['careerSummaryJa'] ?? (candidate as unknown as Record<string, unknown>)['careerSummaryJa']) as string | null | undefined;
    if (!existingJa) {
      const translated = await translateId2Ja(body.careerSummaryId, { userId: req.user!.sub, context: 'shokumu-save' });
      if (translated) candidateUpdates['careerSummaryJa'] = translated;
    }
  }

  if (Object.keys(candidateUpdates).length > 0) {
    await candidate.update(candidateUpdates);
  }

  // Update individual career entries (verify ownership)
  if (Array.isArray(body.career) && body.career.length > 0) {
    await Promise.all(
      body.career.map(async (entry) => {
        const careerRow = await CandidateCareer.findOne({
          where: { id: entry.id, candidateId: candidate.id },
        });
        if (!careerRow) return;
        const updates: Record<string, unknown> = {};
        if (entry.companyType    !== undefined) updates['companyType']    = entry.companyType    ?? null;
        if (entry.employeeCount  !== undefined) updates['employeeCount']  = entry.employeeCount  ?? null;
        if (entry.annualSales    !== undefined) updates['annualSales']    = entry.annualSales    ?? null;
        if (entry.capitalAmount  !== undefined) updates['capitalAmount']  = entry.capitalAmount  ?? null;
        if (entry.dutiesId       !== undefined) updates['dutiesId']       = entry.dutiesId       ?? null;
        if (entry.dutiesJa       !== undefined) updates['dutiesJa']       = entry.dutiesJa       ?? null;
        if (entry.achievementsId !== undefined) updates['achievementsId'] = entry.achievementsId ?? null;
        if (entry.achievementsJa !== undefined) updates['achievementsJa'] = entry.achievementsJa ?? null;
        if (entry.productId      !== undefined) updates['productId']      = entry.productId      ?? null;
        if (entry.productJa      !== undefined) updates['productJa']      = entry.productJa      ?? null;
        if (entry.jobTitleId     !== undefined) updates['jobTitleId']     = entry.jobTitleId     ?? null;
        if (entry.jobTitleJa     !== undefined) updates['jobTitleJa']     = entry.jobTitleJa     ?? null;
        if (entry.memberRoleId   !== undefined) updates['memberRoleId']   = entry.memberRoleId   ?? null;
        if (entry.memberRoleJa   !== undefined) updates['memberRoleJa']   = entry.memberRoleJa   ?? null;

        // Auto-translate ID fields → JA where JA is absent
        if (autoTranslate) {
          for (const [idKey, jaKey] of [
            ['dutiesId', 'dutiesJa'], ['achievementsId', 'achievementsJa'],
            ['productId', 'productJa'], ['jobTitleId', 'jobTitleJa'], ['memberRoleId', 'memberRoleJa'],
          ] as const) {
            const idText = (updates[idKey] ?? (careerRow as unknown as Record<string, unknown>)[idKey]) as string | null | undefined;
            const jaText = (updates[jaKey] ?? (careerRow as unknown as Record<string, unknown>)[jaKey]) as string | null | undefined;
            if (idText && !jaText) {
              const translated = await translateId2Ja(idText, { userId: req.user!.sub, context: 'shokumu-save' });
              if (translated) updates[jaKey] = translated;
            }
          }
        }

        if (Object.keys(updates).length > 0) await careerRow.update(updates);
      }),
    );
  }

  invalidateMe(req.user!.sub);
  res.json({ message: 'Shokumu data saved.' });
});

// ── GET /api/candidates/me/gakken-resume ─────────────────────────────────────
router.get('/me/gakken-resume', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const [resume, companies] = await Promise.all([
    CandidateGakkenResume.findOne({ where: { candidateId: candidate.id } }),
    CandidateGakkenCompany.findAll({ where: { candidateId: candidate.id }, order: [['sortOrder', 'ASC']] }),
  ]);

  res.json({
    resume: resume ? resume.toJSON() : null,
    companies: companies.map((c) => c.toJSON()),
  });
});

// ── PATCH /api/candidates/me/gakken-resume ───────────────────────────────────
router.patch('/me/gakken-resume', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (candidate.isLocked) { res.status(403).json({ error: 'PROFILE_LOCKED' }); return; }

  const body = parseBody(patchGakkenResumeSchema, req.body, res);
  if (body === null) return;

  const translateSetting = await GlobalSettings.findOne({ where: { key: 'auto_translate' } });
  const autoTranslate = translateSetting
    ? (translateSetting.toJSON() as unknown as Record<string, unknown>)['value'] !== false
    : true;

  // Build typed resume payload
  const rp = {
    candidateId:             candidate.id,
    careerSummary:           body.careerSummary           ?? null,
    careerSummaryJa:         body.careerSummaryJa         ?? null,
    currentCompanyName:      body.currentCompanyName      ?? null,
    currentBusinessActivity: body.currentBusinessActivity ?? null,
    currentCapital:          body.currentCapital          ?? null,
    currentRevenue:          body.currentRevenue          ?? null,
    currentEmployeeCount:    body.currentEmployeeCount    ?? null,
    skills:                  body.skills                  ?? null,
    skillsJa:                body.skillsJa                ?? null,
    selfPr:                  body.selfPr                  ?? null,
    selfPrJa:                body.selfPrJa                ?? null,
  };

  // Auto-translate ID→JA for resume-level text fields
  if (autoTranslate) {
    for (const [idKey, jaKey] of [
      ['careerSummary', 'careerSummaryJa'],
      ['skills', 'skillsJa'],
      ['selfPr', 'selfPrJa'],
    ] as const) {
      const idText = rp[idKey] as string | null;
      const jaText = rp[jaKey] as string | null;
      if (idText && !jaText) {
        const translated = await translateId2Ja(idText, { userId: req.user!.sub, context: 'gakken-save' });
        if (translated) (rp as Record<string, unknown>)[jaKey] = translated;
      }
    }
  }

  // Upsert resume row
  const existing = await CandidateGakkenResume.findOne({ where: { candidateId: candidate.id } });
  if (existing) {
    await existing.update(rp);
  } else {
    await CandidateGakkenResume.create(rp);
  }

  // Destroy + recreate company entries
  if (Array.isArray(body.companies)) {
    await CandidateGakkenCompany.destroy({ where: { candidateId: candidate.id } });
    if (body.companies.length > 0) {
      const companyRows = await Promise.all(
        body.companies.map(async (entry, i) => {
          let productJa    = entry.productJa    ?? null;
          let dutiesJa     = entry.dutiesJa     ?? null;
          let memberRoleJa = entry.memberRoleJa ?? null;
          if (autoTranslate) {
            if (entry.productId    && !productJa)    { const t = await translateId2Ja(entry.productId,    { userId: req.user!.sub, context: 'gakken-save' }); if (t) productJa    = t; }
            if (entry.dutiesId     && !dutiesJa)     { const t = await translateId2Ja(entry.dutiesId,     { userId: req.user!.sub, context: 'gakken-save' }); if (t) dutiesJa     = t; }
            if (entry.memberRoleId && !memberRoleJa) { const t = await translateId2Ja(entry.memberRoleId, { userId: req.user!.sub, context: 'gakken-save' }); if (t) memberRoleJa = t; }
          }
          return {
            candidateId:  candidate.id,
            period:       entry.period       ?? null,
            productId:    entry.productId    ?? null,
            productJa,
            dutiesId:     entry.dutiesId     ?? null,
            dutiesJa,
            memberRoleId: entry.memberRoleId ?? null,
            memberRoleJa,
            sortOrder:    entry.sortOrder    ?? i,
          };
        }),
      );
      await CandidateGakkenCompany.bulkCreate(companyRows);
    }
  }

  const [updatedResume, updatedCompanies] = await Promise.all([
    CandidateGakkenResume.findOne({ where: { candidateId: candidate.id } }),
    CandidateGakkenCompany.findAll({ where: { candidateId: candidate.id }, order: [['sortOrder', 'ASC']] }),
  ]);

  res.json({
    resume: updatedResume ? updatedResume.toJSON() : null,
    companies: updatedCompanies.map((c) => c.toJSON()),
  });
});

// ── GET /api/candidates/me/shokumu-pdf ────────────────────────────────────────
router.get('/me/shokumu-pdf', authenticate, requireRole('candidate'), pdfLimiter, async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({
    where: { userId: req.user!.sub },
    include: [
      { model: CandidateJapaneseTest,     as: 'tests',          required: false },
      { model: CandidateCareer,           as: 'career',         required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
      { model: CandidateCertification,    as: 'certifications', required: false },
      { model: CandidateEducationHistory, as: 'educationHistory', required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
    ],
  });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const [layoutRow, fontRow, templateRow] = await Promise.all([
    GlobalSettings.findOne({ where: { key: 'shokumu_layout' } }),
    GlobalSettings.findOne({ where: { key: 'cv_font' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_template' } }),
  ]);
  const layout   = layoutRow   ? String((layoutRow.toJSON()   as unknown as Record<string, unknown>)['value'] ?? 'reverse')  : 'reverse';
  const font     = fontRow     ? String((fontRow.toJSON()     as unknown as Record<string, unknown>)['value'] ?? 'ms-mincho') : 'ms-mincho';
  const template = templateRow ? String((templateRow.toJSON() as unknown as Record<string, unknown>)['value'] ?? 'generic')  : 'generic';

  const cj = candidate.toJSON() as unknown as Record<string, unknown>;

  // Auto-translate missing Japanese fields before rendering
  const translateRow = await GlobalSettings.findOne({ where: { key: 'auto_translate_enabled' } });
  const autoTranslate = translateRow
    ? (translateRow.toJSON() as unknown as Record<string, unknown>)['value'] !== false
    : true;

  if (autoTranslate) {
    // Candidate-level text fields
    const candidateUpdates: Record<string, string> = {};
    for (const [idKey, jaKey] of [
      ['careerSummaryId', 'careerSummaryJa'],
      ['selfPrId', 'selfPrJa'],
      ['selfIntroId', 'selfIntroJa'],
    ] as const) {
      const idText = cj[idKey] as string | null;
      const jaText = cj[jaKey] as string | null;
      if (idText && !jaText) {
        const translated = await translateId2Ja(idText, { userId: req.user!.sub, context: 'pdf-render' });
        if (translated) { cj[jaKey] = translated; candidateUpdates[jaKey] = translated; }
      }
    }
    if (Object.keys(candidateUpdates).length > 0) await candidate.update(candidateUpdates);

    // Per-career-entry fields
    const career = (cj['career'] as Record<string, unknown>[] | null) ?? [];
    await Promise.all(career.map(async (entry) => {
      const entryUpdates: Record<string, string> = {};
      for (const [idKey, jaKey] of [
        ['dutiesId', 'dutiesJa'], ['achievementsId', 'achievementsJa'],
        ['productId', 'productJa'], ['jobTitleId', 'jobTitleJa'], ['memberRoleId', 'memberRoleJa'],
      ] as const) {
        const idText = entry[idKey] as string | null;
        const jaText = entry[jaKey] as string | null;
        if (idText && !jaText) {
          const translated = await translateId2Ja(idText, { userId: req.user!.sub, context: 'pdf-render' });
          if (translated) { entry[jaKey] = translated; entryUpdates[jaKey] = translated; }
        }
      }
      if (Object.keys(entryUpdates).length > 0 && entry['id']) {
        await CandidateCareer.update(entryUpdates, { where: { id: entry['id'] as string, candidateId: candidate.id } });
      }
    }));
  }

  // Embed closeup photo as base64 — puppeteer's setContent can't load authed API URLs
  const photoFilePath = path.join(config.UPLOADS_DIR, 'candidates', candidate.id, 'closeup.webp');
  try {
    const photoData = await fs.promises.readFile(photoFilePath);
    cj['closeupUrl'] = `data:image/webp;base64,${photoData.toString('base64')}`;
  } catch { /* photo not present on disk, skip */ }

  let html: string;
  if (template === 'gakken') {
    const [gakkenResume, gakkenCompanies] = await Promise.all([
      CandidateGakkenResume.findOne({ where: { candidateId: candidate.id } }),
      CandidateGakkenCompany.findAll({ where: { candidateId: candidate.id }, order: [['sortOrder', 'ASC']] }),
    ]);
    const gr = gakkenResume ? (gakkenResume.toJSON() as unknown as Record<string, unknown>) : null;
    const gc = gakkenCompanies.map((c) => c.toJSON() as unknown as Record<string, unknown>);

    // Auto-translate gakken resume fields
    if (autoTranslate && gr) {
      const grUpdates: Record<string, string> = {};
      for (const [idKey, jaKey] of [
        ['careerSummary', 'careerSummaryJa'], ['skills', 'skillsJa'], ['selfPr', 'selfPrJa'],
      ] as const) {
        const idText = gr[idKey] as string | null;
        const jaText = gr[jaKey] as string | null;
        if (idText && !jaText) {
          const translated = await translateId2Ja(idText, { userId: req.user!.sub, context: 'pdf-render' });
          if (translated) { gr[jaKey] = translated; grUpdates[jaKey] = translated; }
        }
      }
      if (Object.keys(grUpdates).length > 0 && gakkenResume) await gakkenResume.update(grUpdates);

      await Promise.all(gc.map(async (entry, idx) => {
        const entryUpdates: Record<string, string> = {};
        for (const [idKey, jaKey] of [
          ['productId', 'productJa'], ['dutiesId', 'dutiesJa'], ['memberRoleId', 'memberRoleJa'],
        ] as const) {
          const idText = entry[idKey] as string | null;
          const jaText = entry[jaKey] as string | null;
          if (idText && !jaText) {
            const translated = await translateId2Ja(idText, { userId: req.user!.sub, context: 'pdf-render' });
            if (translated) { entry[jaKey] = translated; entryUpdates[jaKey] = translated; }
          }
        }
        if (Object.keys(entryUpdates).length > 0) {
          await CandidateGakkenCompany.update(entryUpdates, { where: { id: gakkenCompanies[idx]!.id, candidateId: candidate.id } });
        }
      }));
    }

    html = buildGakkenHtml(cj, gr, gc, { font, includePhoto: true });
  } else {
    html = buildShokumuHtml(cj, { layout, font, includePhoto: true });
  }

  try {
    const pdf = await renderPdf(html, { top: '15mm', bottom: '15mm', left: '20mm', right: '15mm' });

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'SHOKUMU_EXPORT',
      entityType: 'candidate',
      entityId: candidate.id,
      targetCandidateId: candidate.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${candidate.candidateCode}-shokumu.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (isPdfError(err, 'CHROME_NOT_FOUND')) { res.status(503).json({ error: 'PDF_UNAVAILABLE' }); return; }
    if (isPdfError(err, 'PDF_QUEUE_TIMEOUT')) { res.status(503).json({ error: 'PDF_BUSY', message: 'PDF service is busy. Please try again shortly.' }); return; }
    throw err;
  }
});

// ── GET /api/candidates/me/merged-pdf ─────────────────────────────────────────
router.get('/me/merged-pdf', authenticate, requireRole('candidate'), pdfLimiter, async (req: Request, res: Response): Promise<void> => {
  // Check if merge is enabled
  const mergeRow = await GlobalSettings.findOne({ where: { key: 'shokumu_merge_cv' } });
  const mergeCv  = mergeRow ? (mergeRow.toJSON() as unknown as Record<string, unknown>)['value'] === true : false;
  if (!mergeCv) {
    res.status(403).json({ error: 'MERGE_DISABLED', message: 'Merged PDF is not enabled.' });
    return;
  }

  const candidate = await Candidate.findOne({
    where: { userId: req.user!.sub },
    include: [
      { model: User,                      as: 'user',             attributes: ['name', 'email'], required: false },
      { model: Lpk,                       as: 'lpk',              attributes: ['name', 'city'],  required: false },
      { model: CandidateJapaneseTest,     as: 'tests',            required: false },
      { model: CandidateCareer,           as: 'career',           required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
      { model: CandidateBodyCheck,        as: 'bodyCheck',        required: false },
      { model: CandidateCertification,    as: 'certifications',   required: false },
      { model: CandidateEducationHistory, as: 'educationHistory', required: false, separate: true, order: [['startDate', 'ASC'] as [string, string]] },
    ],
  });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const [layoutRow, fontRow, templateRow] = await Promise.all([
    GlobalSettings.findOne({ where: { key: 'shokumu_layout' } }),
    GlobalSettings.findOne({ where: { key: 'cv_font' } }),
    GlobalSettings.findOne({ where: { key: 'shokumu_template' } }),
  ]);
  const layout   = layoutRow   ? String((layoutRow.toJSON()   as unknown as Record<string, unknown>)['value'] ?? 'reverse')  : 'reverse';
  const font     = fontRow     ? String((fontRow.toJSON()     as unknown as Record<string, unknown>)['value'] ?? 'ms-mincho') : 'ms-mincho';
  const template = templateRow ? String((templateRow.toJSON() as unknown as Record<string, unknown>)['value'] ?? 'generic')  : 'generic';

  const cj  = candidate.toJSON() as unknown as Record<string, unknown>;
  const nik = decryptNullable(candidate.nikEncrypted ?? null);

  // Build CV html, strip closing tags, then append shokumu body content
  const cvHtml = buildCandidatePdfHtml(cj, nik);
  let shokumuHtml: string;
  if (template === 'gakken') {
    const [gakkenResume, gakkenCompanies] = await Promise.all([
      CandidateGakkenResume.findOne({ where: { candidateId: candidate.id } }),
      CandidateGakkenCompany.findAll({ where: { candidateId: candidate.id }, order: [['sortOrder', 'ASC']] }),
    ]);
    shokumuHtml = buildGakkenHtml(
      cj,
      gakkenResume ? (gakkenResume.toJSON() as unknown as Record<string, unknown>) : null,
      gakkenCompanies.map((c) => c.toJSON() as unknown as Record<string, unknown>),
      { font, includePhoto: false },
    );
  } else {
    shokumuHtml = buildShokumuHtml(cj, { layout, font, includePhoto: false });
  }

  // Extract inner body from shokumu HTML (strip html/head/body wrappers)
  const shokumuBody = shokumuHtml
    .replace(/^[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '');

  // Strip closing body/html from CV html and append shokumu content
  const combinedHtml = cvHtml
    .replace(/<\/body>[\s\S]*$/i, '')
    + '\n<div style="page-break-before:always"></div>\n'
    + shokumuBody
    + '\n</body></html>';

  try {
    const pdf = await renderPdf(combinedHtml, { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' });

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'SHOKUMU_EXPORT',
      entityType: 'candidate',
      entityId: candidate.id,
      targetCandidateId: candidate.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: { merged: true },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${candidate.candidateCode}-resume.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (isPdfError(err, 'CHROME_NOT_FOUND')) { res.status(503).json({ error: 'PDF_UNAVAILABLE' }); return; }
    if (isPdfError(err, 'PDF_QUEUE_TIMEOUT')) { res.status(503).json({ error: 'PDF_BUSY', message: 'PDF service is busy. Please try again shortly.' }); return; }
    throw err;
  }
});

export default router;
