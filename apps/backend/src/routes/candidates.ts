import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth';
import {
  Candidate,
  CandidateJapaneseTest,
  CandidateCareer,
  CandidateBodyCheck,
  CandidateWeeklyTest,
  CandidateIntroVideo,
  ToolsDictionary,
  AuditLog,
  Notification,
  User,
} from '../db/models/index';
import { serializeCandidate } from '../serializers/candidate';
import { calcCompleteness } from '../utils/completeness';
import { validateImageBuffer, savePhoto } from '../utils/storage';
import type { PhotoSlot } from '../utils/storage';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// All candidate routes require auth + candidate role
router.use(authenticate, requireRole('candidate'));

// ── Helper: find candidate by userId ─────────────────────────────────────────
async function findMyCandidate(userId: string) {
  return Candidate.findOne({
    where: { userId },
    include: [
      { model: CandidateJapaneseTest, as: 'tests', required: false },
      { model: CandidateCareer, as: 'career', required: false },
      { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
      { model: CandidateWeeklyTest, as: 'weeklyTests', required: false },
      { model: CandidateIntroVideo, as: 'videos', required: false },
      { model: ToolsDictionary, as: 'tools', required: false },
    ],
  });
}

// ── Fields a candidate cannot update themselves ───────────────────────────────
const BLOCKED_FIELDS = new Set([
  'candidateCode', 'userId', 'lpkId', 'profileStatus', 'isLocked',
  'nikEncrypted', 'bankAccountEncrypted', 'internalNotes', 'id',
  'createdAt', 'updatedAt',
]);

// ── GET /api/candidates/me ────────────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Candidate profile not found.' });
    return;
  }

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const completeness = calcCompleteness(data);

  res.json({
    candidate: { ...serializeCandidate(data, 'candidate'), completeness },
  });
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

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!BLOCKED_FIELDS.has(k)) updates[k] = v;
  }

  await candidate.update(updates);

  const fresh = await findMyCandidate(req.user!.sub);
  const data = fresh!.toJSON() as unknown as Record<string, unknown>;
  res.json({ candidate: { ...serializeCandidate(data, 'candidate'), completeness: calcCompleteness(data) } });
});

// ── PATCH /api/candidates/me/consent ─────────────────────────────────────────
router.patch('/me/consent', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  await candidate.update({ consentGiven: true, consentGivenAt: new Date() });

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'CONSENT_GIVEN',
    entityType: 'candidate',
    entityId: candidate.id,
    targetCandidateId: candidate.id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: null,
  });

  res.json({ message: 'Consent recorded.' });
});

// ── POST /api/candidates/me/submit ───────────────────────────────────────────
router.post('/me/submit', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
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

  // Notify all admin + manager users
  const admins = await User.findAll({ where: { role: ['admin', 'manager'], isActive: true } });
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

  const { entries } = req.body as { entries: Array<{
    companyName?: string; division?: string; skillGroup?: string; period?: string; sortOrder?: number;
  }> };

  await CandidateCareer.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    await CandidateCareer.bulkCreate(
      entries.map((e, i) => ({
        id: uuidv4(),
        candidateId: candidate.id,
        companyName: e.companyName ?? null,
        division: e.division ?? null,
        skillGroup: e.skillGroup ?? null,
        period: e.period ?? null,
        sortOrder: e.sortOrder ?? i,
      })),
    );
  }

  const career = await CandidateCareer.findAll({ where: { candidateId: candidate.id }, order: [['sortOrder', 'ASC']] });
  res.json({ career: career.map((c) => c.toJSON()) });
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

  const { entries } = req.body as { entries: Array<{
    testName?: string; score?: number; pass?: boolean; testDate?: string;
  }> };

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
      await validateImageBuffer(req.file.buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid file.';
      res.status(422).json({ error: 'INVALID_FILE', message: msg });
      return;
    }

    const { urlPath } = await savePhoto(candidate.id, slot as PhotoSlot, req.file.buffer);

    const updateField = slot === 'closeup' ? 'closeupUrl' : 'fullbodyUrl';
    await candidate.update({ [updateField]: urlPath });

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
router.get('/me/export', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

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

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  // Exclude raw encrypted fields
  const { nikEncrypted: _n, bankAccountEncrypted: _b, ...exportData } = data as {
    nikEncrypted?: unknown;
    bankAccountEncrypted?: unknown;
  } & Record<string, unknown>;

  const filename = `${candidate.candidateCode}-data.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(exportData);
});

export default router;
