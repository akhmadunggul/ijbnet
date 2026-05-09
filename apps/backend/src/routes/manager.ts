import { Router, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { authenticate, requireRole } from '../middleware/auth';
import {
  Candidate,
  CandidateJapaneseTest,
  CandidateCareer,
  CandidateBodyCheck,
  CandidateWeeklyTest,
  CandidateIntroVideo,
  ToolsDictionary,
  CandidateCertification,
  CandidateEducationHistory,
  AuditLog,
  User,
  Lpk,
  Batch,
  BatchCandidate,
  InterviewProposal,
  Company,
  RecruitmentRequest,
} from '../db/models/index';
import { serializeCandidate } from '../serializers/candidate';
import { calcCompleteness } from '../utils/completeness';
import { notifyUser, notifyByRole } from '../utils/notify';
import { sendEmail } from '../utils/email';
import {
  batchActivatedHtml, batchActivatedSubject,
} from '../emails/batchActivated';
import {
  interviewScheduledRecruiterHtml, interviewScheduledRecruiterSubject,
  interviewScheduledCandidateHtml, interviewScheduledCandidateSubject,
} from '../emails/interviewScheduled';
import {
  interviewResultHtml, interviewResultSubject,
} from '../emails/interviewResult';
import { recordTimelineEvent, currentAgeHours } from '../utils/timeline';
import { CandidateTimeline } from '../db/models/CandidateTimeline';
import { isUUID } from 'validator';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

const router = Router();
router.use(authenticate, requireRole('manager'));

// ── Async wrapper ─────────────────────────────────────────────────────────────
function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

// ── Audit helper ──────────────────────────────────────────────────────────────
async function audit(
  req: Request,
  action: string,
  entityType = 'candidate',
  entityId?: string,
  targetCandidateId?: string,
  payload?: Record<string, unknown>,
) {
  await AuditLog.create({
    userId: req.user!.sub,
    action,
    entityType,
    entityId: entityId ?? null,
    targetCandidateId: targetCandidateId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: payload ?? null,
  });
}

// ── Full candidate includes (fresh each call to avoid circular ref) ───────────
function candidateIncludes() {
  return [
    { model: CandidateJapaneseTest, as: 'tests', required: false },
    { model: CandidateCareer, as: 'career', required: false },
    { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
    { model: CandidateWeeklyTest, as: 'weeklyTests', required: false },
    { model: CandidateIntroVideo, as: 'videos', required: false },
    { model: ToolsDictionary, as: 'tools', required: false },
    { model: CandidateCertification, as: 'certifications', required: false },
    { model: CandidateEducationHistory, as: 'educationHistory', required: false },
  ];
}

// ── GET /api/manager/stats ───────────────────────────────────────────────────
router.get('/stats', wrap(async (_req: Request, res: Response): Promise<void> => {
  const [allCandidates, activeBatches, pendingApprovals] = await Promise.all([
    Candidate.findAll({ attributes: ['profileStatus'] }),
    Batch.count({ where: { status: { [Op.in]: ['active', 'selection'] } } }),
    BatchCandidate.count({ where: { isSelected: true, isConfirmed: false } }),
  ]);

  const candidatesByStatus: Record<string, number> = {};
  for (const c of allCandidates) {
    candidatesByStatus[c.profileStatus] = (candidatesByStatus[c.profileStatus] ?? 0) + 1;
  }

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const interviewsThisWeek = await InterviewProposal.count({
    where: {
      status: 'scheduled',
      finalDate: { [Op.between]: [now, weekLater] },
    },
  });

  res.json({ candidatesByStatus, activeBatches, pendingApprovals, interviewsThisWeek });
}));

// ── GET /api/manager/companies ────────────────────────────────────────────────
router.get('/companies', wrap(async (_req: Request, res: Response): Promise<void> => {
  const companies = await Company.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'nameJa'],
    order: [['name', 'ASC']],
  });
  res.json({ companies: companies.map((c) => c.toJSON()) });
}));

// ── GET /api/manager/lpks ─────────────────────────────────────────────────────
router.get('/lpks', wrap(async (_req: Request, res: Response): Promise<void> => {
  const lpks = await Lpk.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'city'],
    order: [['name', 'ASC']],
  });
  res.json({ lpks: lpks.map((l) => l.toJSON()) });
}));

// ── GET /api/manager/candidates ───────────────────────────────────────────────
router.get('/candidates', wrap(async (req: Request, res: Response): Promise<void> => {
  const { search, profileStatus, sswKubun, lpkId, page = '1', pageSize = '20' } =
    req.query as Record<string, string>;

  const limit = Math.min(parseInt(pageSize, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const where: Record<string, unknown> = {};
  if (profileStatus) where['profileStatus'] = profileStatus;
  if (sswKubun) where['sswKubun'] = sswKubun;
  if (lpkId && isUUID(lpkId)) where['lpkId'] = lpkId;
  if (search) {
    where[Op.or as unknown as string] = [
      { fullName: { [Op.like]: `%${search}%` } },
      { candidateCode: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await Candidate.findAndCountAll({
    where,
    include: [
      { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
      { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });

  await audit(req, 'VIEW_CANDIDATE_LIST', 'candidate');

  const candidates = rows.map((c) => {
    const data = c.toJSON() as unknown as Record<string, unknown>;
    const completeness = calcCompleteness(data);
    return { ...serializeCandidate(data, 'manager'), completeness };
  });

  res.json({ candidates, total: count, page: parseInt(page, 10) || 1, pageSize: limit });
}));

// ── GET /api/manager/candidates/:id ───────────────────────────────────────────
router.get('/candidates/:id', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const candidate = await Candidate.findByPk(id, {
    include: [
      ...candidateIncludes(),
      { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
    ],
  });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  await audit(req, 'VIEW_CANDIDATE', 'candidate', id, id);

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const completeness = calcCompleteness(data);
  res.json({ candidate: { ...serializeCandidate(data, 'manager'), completeness } });
}));

// ── PATCH /api/manager/candidates/:id ─────────────────────────────────────────
router.patch('/candidates/:id', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const candidate = await Candidate.findByPk(id);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const { internalNotes } = req.body as { internalNotes?: string };
  await candidate.update({ internalNotes: internalNotes ?? candidate.internalNotes });

  await audit(req, 'UPDATE_CANDIDATE', 'candidate', id, id, { fields: ['internalNotes'] });

  res.json({ message: 'Updated.' });
}));

// ── GET /api/manager/batches ──────────────────────────────────────────────────
router.get('/batches', wrap(async (req: Request, res: Response): Promise<void> => {
  const { status, companyId, page = '1', pageSize = '20' } = req.query as Record<string, string>;

  const limit = Math.min(parseInt(pageSize, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where['status'] = status;
  if (companyId && isUUID(companyId)) where['companyId'] = companyId;

  const { count, rows } = await Batch.findAndCountAll({
    where,
    include: [{ model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'], required: false }],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });

  const batches = await Promise.all(rows.map(async (b) => {
    const [selectedCount, confirmedCount] = await Promise.all([
      BatchCandidate.count({ where: { batchId: b.id, isSelected: true } }),
      BatchCandidate.count({ where: { batchId: b.id, isConfirmed: true } }),
    ]);
    return { ...(b.toJSON() as unknown as Record<string, unknown>), selectedCount, confirmedCount };
  }));

  res.json({ batches, total: count, page: parseInt(page, 10) || 1, pageSize: limit });
}));

// ── POST /api/manager/batches ─────────────────────────────────────────────────
router.post('/batches', wrap(async (req: Request, res: Response): Promise<void> => {
  const { batchCode, name, companyId, quotaTotal, interviewCandidateLimit, sswFieldFilter, expiryDate } =
    req.body as {
      batchCode?: string;
      name?: string;
      companyId?: string;
      quotaTotal?: number;
      interviewCandidateLimit?: number;
      sswFieldFilter?: string;
      expiryDate?: string;
    };

  if (!batchCode) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'batchCode is required.' });
    return;
  }

  const batch = await Batch.create({
    id: uuidv4(),
    batchCode,
    name: name ?? null,
    companyId: companyId ?? null,
    quotaTotal: quotaTotal ?? null,
    interviewCandidateLimit: interviewCandidateLimit ?? null,
    sswFieldFilter: sswFieldFilter ?? null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    status: 'draft',
    createdBy: req.user!.sub,
  });

  res.status(201).json({ batch: batch.toJSON() });
}));

// ── GET /api/manager/batches/:id ──────────────────────────────────────────────
router.get('/batches/:id', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const batch = await Batch.findByPk(id, {
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'], required: false },
      {
        model: BatchCandidate,
        as: 'allocations',
        required: false,
        include: [
          {
            model: Candidate,
            as: 'candidate',
            required: false,
            include: [
              { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
              { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
            ],
          },
          { model: InterviewProposal, as: 'proposal', required: false },
        ],
      },
    ],
  });

  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const batchJson = batch.toJSON() as unknown as Record<string, unknown>;
  const allocations = ((batchJson['allocations'] as unknown[]) ?? []).map((bc) => {
    const bcData = bc as Record<string, unknown>;
    const candidateData = (bcData['candidate'] as Record<string, unknown>) ?? {};
    const completeness = calcCompleteness(candidateData);
    return {
      ...bcData,
      candidate: { ...serializeCandidate(candidateData, 'manager'), completeness },
    };
  });

  const selectedCount = allocations.filter((a) => (a as Record<string, unknown>)['isSelected']).length;
  const confirmedCount = allocations.filter((a) => (a as Record<string, unknown>)['isConfirmed']).length;

  res.json({
    batch: { ...batchJson, allocations, selectedCount, confirmedCount },
  });
}));

// ── PATCH /api/manager/batches/:id ────────────────────────────────────────────
router.patch('/batches/:id', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const batch = await Batch.findByPk(id, {
    include: [{ model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'], required: false }],
  });
  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['active', 'closed'],
    active: ['closed', 'selection'],
    selection: ['approved', 'closed'],
    approved: ['closed'],
  };

  const { name, status, quotaTotal, interviewCandidateLimit, sswFieldFilter, expiryDate } =
    req.body as {
      name?: string;
      status?: string;
      quotaTotal?: number;
      interviewCandidateLimit?: number;
      sswFieldFilter?: string;
      expiryDate?: string;
    };

  if (status && status !== batch.status) {
    const allowed = VALID_TRANSITIONS[batch.status] ?? [];
    if (!allowed.includes(status)) {
      res.status(422).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot transition batch from '${batch.status}' to '${status}'.`,
      });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates['name'] = name;
  if (status !== undefined) updates['status'] = status;
  if (quotaTotal !== undefined) updates['quotaTotal'] = quotaTotal;
  if (interviewCandidateLimit !== undefined) updates['interviewCandidateLimit'] = interviewCandidateLimit;
  if (sswFieldFilter !== undefined) updates['sswFieldFilter'] = sswFieldFilter;
  if (expiryDate !== undefined) updates['expiryDate'] = expiryDate ? new Date(expiryDate) : null;

  await batch.update(updates);

  // If activating: notify recruiter company
  if (status === 'active' && batch.companyId) {
    const recruiterUsers = await User.findAll({
      where: { role: 'recruiter', companyId: batch.companyId, isActive: true },
    });
    const companyData = (batch as unknown as Record<string, unknown>)['company'] as Record<string, unknown> | null;
    const companyName = (companyData?.['nameJa'] as string) ?? (companyData?.['name'] as string) ?? batch.companyId;
    const batchCode = batch.batchCode ?? id;
    const limit = batch.interviewCandidateLimit ?? batch.quotaTotal ?? 0;

    await Promise.all(
      recruiterUsers.map(async (u) => {
        await notifyUser(
          u.id,
          'BATCH_ACTIVATED',
          `新しいバッチが利用可能です: ${batchCode}`,
          `${limit}名の候補者をご選択いただけます。`,
          'batch',
          id,
        );
        if (u.email) {
          await sendEmail(
            u.email,
            batchActivatedSubject,
            batchActivatedHtml(companyName, batchCode, limit, config.FRONTEND_URL + '/recruiter'),
          );
        }
      }),
    );
  }

  res.json({ batch: batch.toJSON() });
}));

// ── POST /api/manager/batches/:id/allocate ────────────────────────────────────
router.post('/batches/:id/allocate', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const batch = await Batch.findByPk(id);
  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (!['draft', 'active'].includes(batch.status)) {
    res.status(422).json({ error: 'INVALID_STATE', message: 'Batch must be draft or active to allocate.' });
    return;
  }

  const { candidateIds } = req.body as { candidateIds?: string[] };
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'candidateIds must be a non-empty array.' });
    return;
  }

  const now = new Date();
  const results = await Promise.allSettled(
    candidateIds.map(async (cid) => {
      if (!isUUID(cid)) return;

      const candidate = await Candidate.findByPk(cid, { attributes: ['id', 'profileStatus', 'userId'] });
      if (!candidate || candidate.profileStatus !== 'approved') return;

      const [bc, created] = await BatchCandidate.findOrCreate({
        where: { batchId: id, candidateId: cid },
        defaults: {
          id: uuidv4(),
          batchId: id,
          candidateId: cid,
          allocatedBy: req.user!.sub,
          allocatedAt: now,
        },
      });

      if (!created) {
        await bc.update({ allocatedBy: req.user!.sub, allocatedAt: now });
      }

      await audit(req, 'BATCH_ALLOCATE', 'batch_candidate', bc.id, cid, { batchId: id });

      if (created) {
        await recordTimelineEvent(cid, 'batch_allocated', req.user!.sub, 'manager', { batchId: id });
        if (candidate.userId) {
          await notifyUser(
            candidate.userId,
            'BATCH_ALLOCATED',
            'Anda masuk dalam proses rekrutmen',
            'Profil Anda telah dipilih untuk masuk ke dalam proses penempatan.',
            'batch',
            id,
          );
        }
      }
    }),
  );

  const allocated = results.filter((r) => r.status === 'fulfilled').length;
  res.json({ message: `${allocated} candidate(s) allocated.`, allocated });
}));

// ── DELETE /api/manager/batches/:id/allocate/:candidateId ─────────────────────
router.delete('/batches/:id/allocate/:candidateId', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id, candidateId } = req.params as { id: string; candidateId: string };
  if (!isUUID(id) || !isUUID(candidateId)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const bc = await BatchCandidate.findOne({ where: { batchId: id, candidateId } });
  if (!bc) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (bc.isSelected) {
    res.status(422).json({ error: 'ALREADY_SELECTED', message: 'Cannot remove a selected candidate.' });
    return;
  }

  await bc.destroy();
  res.json({ message: 'Allocation removed.' });
}));

// ── PATCH /api/manager/batches/:batchId/candidates/:candidateId/approve ────────
router.patch('/batches/:batchId/candidates/:candidateId/approve', wrap(async (req: Request, res: Response): Promise<void> => {
  const { batchId, candidateId } = req.params as { batchId: string; candidateId: string };
  if (!isUUID(batchId) || !isUUID(candidateId)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const bc = await BatchCandidate.findOne({ where: { batchId, candidateId } });
  if (!bc || !bc.isSelected) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'BatchCandidate not found or not selected.' });
    return;
  }
  if (bc.isConfirmed) {
    res.status(422).json({ error: 'ALREADY_CONFIRMED' });
    return;
  }

  await bc.update({ isConfirmed: true, confirmedAt: new Date() });

  const candidate = await Candidate.findByPk(candidateId, { attributes: ['id', 'fullName', 'email', 'userId'] });
  if (candidate) {
    await candidate.update({ profileStatus: 'confirmed', isLocked: true });

    // Notify candidate
    if (candidate.userId) {
      await notifyUser(
        candidate.userId,
        'PROFILE_CONFIRMED',
        'Profil Anda telah dikonfirmasi / プロフィールが確認されました',
        `Selamat ${candidate.fullName}! Profil Anda telah dikonfirmasi oleh tim IJBNet.`,
        'candidate',
        candidateId,
      );
    }

    // Notify recruiter company for this batch
    const batch = await Batch.findByPk(batchId, { attributes: ['companyId'] });
    if (batch?.companyId) {
      const recruiterUsers = await User.findAll({
        where: { role: 'recruiter', companyId: batch.companyId, isActive: true },
      });
      await Promise.all(
        recruiterUsers.map((u) =>
          notifyUser(
            u.id,
            'CANDIDATE_CONFIRMED',
            `候補者が確定されました: ${candidate.fullName}`,
            `候補者 ${candidate.fullName} がマネージャーにより確定されました。`,
            'candidate',
            candidateId,
          ),
        ),
      );
    }
  }

  await audit(req, 'BATCH_APPROVE', 'batch_candidate', bc.id, candidateId, { batchId });
  await recordTimelineEvent(candidateId, 'manager_confirmed', req.user!.sub, 'manager', { batchId });

  res.json({ message: 'Candidate approved.' });
}));

// ── POST /api/manager/batches/:id/approve-all ─────────────────────────────────
router.post('/batches/:id/approve-all', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const pending = await BatchCandidate.findAll({
    where: { batchId: id, isSelected: true, isConfirmed: false },
  });

  if (pending.length === 0) {
    res.json({ message: 'No pending approvals.', approved: 0 });
    return;
  }

  const now = new Date();
  const batch = await Batch.findByPk(id, { attributes: ['companyId'] });

  await Promise.all(
    pending.map(async (bc) => {
      await bc.update({ isConfirmed: true, confirmedAt: now });

      const candidate = await Candidate.findByPk(bc.candidateId, {
        attributes: ['id', 'fullName', 'email', 'userId'],
      });
      if (candidate) {
        await candidate.update({ profileStatus: 'confirmed', isLocked: true });

        if (candidate.userId) {
          await notifyUser(
            candidate.userId,
            'PROFILE_CONFIRMED',
            'Profil Anda telah dikonfirmasi / プロフィールが確認されました',
            `Selamat ${candidate.fullName}! Profil Anda telah dikonfirmasi.`,
            'candidate',
            bc.candidateId,
          );
        }

        if (batch?.companyId) {
          const recruiterUsers = await User.findAll({
            where: { role: 'recruiter', companyId: batch.companyId, isActive: true },
          });
          await Promise.all(
            recruiterUsers.map((u) =>
              notifyUser(
                u.id,
                'CANDIDATE_CONFIRMED',
                `候補者が確定されました: ${candidate.fullName}`,
                `候補者 ${candidate.fullName} がマネージャーにより確定されました。`,
                'candidate',
                bc.candidateId,
              ),
            ),
          );
        }
      }

      await audit(req, 'BATCH_APPROVE', 'batch_candidate', bc.id, bc.candidateId, { batchId: id });
      await recordTimelineEvent(bc.candidateId, 'manager_confirmed', req.user!.sub, 'manager', { batchId: id });
    }),
  );

  res.json({ message: `${pending.length} candidate(s) approved.`, approved: pending.length });
}));

// ── GET /api/manager/interviews ───────────────────────────────────────────────
router.get('/interviews', wrap(async (req: Request, res: Response): Promise<void> => {
  const { status, batchId, page = '1', pageSize = '20' } = req.query as Record<string, string>;

  const limit = Math.min(parseInt(pageSize, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where['status'] = status;

  // If batchId filter, find bcIds for that batch
  if (batchId && isUUID(batchId)) {
    const bcs = await BatchCandidate.findAll({ where: { batchId }, attributes: ['id'] });
    where['batchCandidateId'] = { [Op.in]: bcs.map((bc) => bc.id) };
  }

  const { count, rows } = await InterviewProposal.findAndCountAll({
    where,
    include: [
      {
        model: BatchCandidate,
        as: 'batchCandidate',
        required: false,
        include: [
          {
            model: Candidate,
            as: 'candidate',
            attributes: ['id', 'candidateCode', 'fullName', 'email'],
            required: false,
          },
          {
            model: Batch,
            as: 'batch',
            attributes: ['id', 'batchCode'],
            required: false,
            include: [
              { model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'], required: false },
            ],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json({
    interviews: rows.map((r) => r.toJSON()),
    total: count,
    page: parseInt(page, 10) || 1,
    pageSize: limit,
  });
}));

// ── PATCH /api/manager/interviews/:proposalId/finalize ────────────────────────
router.patch('/interviews/:proposalId/finalize', wrap(async (req: Request, res: Response): Promise<void> => {
  const { proposalId } = req.params as { proposalId: string };
  if (!isUUID(proposalId)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const proposal = await InterviewProposal.findByPk(proposalId, {
    include: [
      {
        model: BatchCandidate,
        as: 'batchCandidate',
        include: [
          { model: Candidate, as: 'candidate', attributes: ['id', 'candidateCode', 'fullName', 'email', 'userId'] },
          {
            model: Batch,
            as: 'batch',
            include: [{ model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'] }],
          },
        ],
      },
    ],
  });

  if (!proposal) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (proposal.status !== 'proposed') {
    res.status(422).json({ error: 'INVALID_STATE', message: 'Proposal must be in proposed state.' });
    return;
  }

  const { finalDate } = req.body as { finalDate?: string };
  if (!finalDate) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'finalDate is required.' });
    return;
  }

  await proposal.update({ finalDate: new Date(finalDate), status: 'scheduled' });

  // Extract nested data
  const bcData = (proposal as unknown as Record<string, unknown>)['batchCandidate'] as Record<string, unknown> | null;
  const candidateData = (bcData?.['candidate'] as Record<string, unknown>) ?? null;
  const batchData = (bcData?.['batch'] as Record<string, unknown>) ?? null;
  const companyData = (batchData?.['company'] as Record<string, unknown>) ?? null;

  const candidateName = (candidateData?.['fullName'] as string) ?? 'Kandidat';
  const candidateEmail = candidateData?.['email'] as string | null;
  const candidateUserId = candidateData?.['userId'] as string | null;
  const candidateId = candidateData?.['id'] as string | null;
  const companyName = (companyData?.['name'] as string) ?? 'Perusahaan';
  const formattedDate = new Date(finalDate).toLocaleString('id-ID', {
    dateStyle: 'full', timeStyle: 'short',
  });

  // Notify candidate
  if (candidateUserId) {
    await notifyUser(
      candidateUserId,
      'INTERVIEW_SCHEDULED',
      'Jadwal wawancara dikonfirmasi / 面接日程が確定しました',
      `Tanggal: ${formattedDate}`,
      'interview_proposal',
      proposalId,
    );
  }
  if (candidateEmail) {
    await sendEmail(
      candidateEmail,
      interviewScheduledCandidateSubject,
      interviewScheduledCandidateHtml(candidateName, companyName, formattedDate),
    );
  }

  // Notify proposer (recruiter)
  if (proposal.proposedBy) {
    const recruiter = await User.findByPk(proposal.proposedBy, { attributes: ['id', 'email'] });
    if (recruiter) {
      await notifyUser(
        recruiter.id,
        'INTERVIEW_SCHEDULED',
        `面接日程が確定しました: ${candidateName}`,
        `日時: ${formattedDate}`,
        'interview_proposal',
        proposalId,
      );
      if (recruiter.email) {
        await sendEmail(
          recruiter.email,
          interviewScheduledRecruiterSubject,
          interviewScheduledRecruiterHtml(candidateName, formattedDate),
        );
      }
    }
  }

  await audit(req, 'INTERVIEW_FINALIZE', 'interview_proposal', proposalId, candidateId ?? undefined, { finalDate });

  if (candidateId) {
    await recordTimelineEvent(candidateId, 'interview_scheduled', req.user!.sub, 'manager', { proposalId, finalDate });
  }

  res.json({ proposal: proposal.toJSON() });
}));

// ── PATCH /api/manager/interviews/:proposalId/result ─────────────────────────
router.patch('/interviews/:proposalId/result', wrap(async (req: Request, res: Response): Promise<void> => {
  const { proposalId } = req.params as { proposalId: string };
  if (!isUUID(proposalId)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const proposal = await InterviewProposal.findByPk(proposalId, {
    include: [
      {
        model: BatchCandidate,
        as: 'batchCandidate',
        include: [
          { model: Candidate, as: 'candidate', attributes: ['id', 'fullName', 'email', 'userId'] },
          {
            model: Batch,
            as: 'batch',
            include: [{ model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'] }],
          },
        ],
      },
    ],
  });

  if (!proposal) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (proposal.status !== 'scheduled') {
    res.status(422).json({ error: 'INVALID_STATE', message: 'Proposal must be in scheduled state.' });
    return;
  }

  const { result } = req.body as { result?: 'pass' | 'fail' | 'cancelled' };
  if (!result || !['pass', 'fail', 'cancelled'].includes(result)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'result must be pass, fail, or cancelled.' });
    return;
  }

  const newStatus = result === 'cancelled' ? 'cancelled' : 'completed';
  await proposal.update({ status: newStatus });

  const bcData = (proposal as unknown as Record<string, unknown>)['batchCandidate'] as Record<string, unknown> | null;
  const candidateData = (bcData?.['candidate'] as Record<string, unknown>) ?? null;
  const batchData = (bcData?.['batch'] as Record<string, unknown>) ?? null;
  const companyData = (batchData?.['company'] as Record<string, unknown>) ?? null;

  const candidateId = candidateData?.['id'] as string | null;
  const candidateName = (candidateData?.['fullName'] as string) ?? 'Kandidat';
  const candidateEmail = candidateData?.['email'] as string | null;
  const candidateUserId = candidateData?.['userId'] as string | null;
  const companyName = (companyData?.['name'] as string) ?? 'Perusahaan';

  if (candidateId) {
    const interviewStatus = result === 'pass' ? 'pass' : result === 'fail' ? 'fail' : 'cancelled';
    await Candidate.update({ interviewStatus }, { where: { id: candidateId } });
  }

  if (candidateUserId) {
    await notifyUser(
      candidateUserId,
      'INTERVIEW_RESULT',
      result === 'pass' ? 'Selamat! Anda lulus wawancara 🎉' : 'Hasil wawancara Anda',
      result === 'pass'
        ? `Anda telah lulus wawancara dengan ${companyName}.`
        : `Terima kasih telah mengikuti wawancara dengan ${companyName}.`,
      'interview_proposal',
      proposalId,
    );
  }
  if (candidateEmail) {
    await sendEmail(
      candidateEmail,
      interviewResultSubject(result),
      interviewResultHtml(candidateName, companyName, result),
    );
  }

  await audit(req, 'INTERVIEW_RESULT', 'interview_proposal', proposalId, candidateId ?? undefined, { result });

  if (candidateId && (result === 'pass' || result === 'fail')) {
    await recordTimelineEvent(
      candidateId,
      result === 'pass' ? 'interview_passed' : 'interview_failed',
      req.user!.sub,
      'manager',
      { proposalId, result },
    );
  }

  res.json({ proposal: proposal.toJSON() });
}));

// ── POST /api/manager/candidates/:id/provisional-acceptance ──────────────────
router.post('/candidates/:id/provisional-acceptance', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const candidate = await Candidate.findByPk(id, {
    attributes: ['id', 'fullName', 'email', 'userId', 'profileStatus'],
  });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const existing = await CandidateTimeline.findOne({
    where: { candidateId: id, event: 'provisional_acceptance' },
  });
  if (existing) {
    res.status(409).json({ error: 'ALREADY_ISSUED' });
    return;
  }

  await recordTimelineEvent(id, 'provisional_acceptance', req.user!.sub, 'manager');

  if (candidate.userId) {
    await notifyUser(
      candidate.userId,
      'PROVISIONAL_ACCEPTANCE',
      '仮内定が発行されました / Surat Penerimaan Sementara Diterbitkan',
      `Selamat ${candidate.fullName}! Surat penerimaan sementara (仮内定) telah diterbitkan.`,
      'candidate',
      id,
    );
  }

  await audit(req, 'PROVISIONAL_ACCEPTANCE', 'candidate', id, id);

  res.json({ message: 'Provisional acceptance issued.' });
}));

// ── GET /api/manager/candidates/:id/timeline ─────────────────────────────────
router.get('/candidates/:id/timeline', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const candidate = await Candidate.findByPk(id, { attributes: ['id'] });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const events = await CandidateTimeline.findAll({
    where: { candidateId: id },
    include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'role'], required: false }],
    order: [['occurredAt', 'ASC']],
  });

  res.json({
    timeline: events.map((e, i) => {
      const json = e.toJSON() as unknown as Record<string, unknown>;
      if (i === events.length - 1) json['currentAgeHours'] = currentAgeHours(e.occurredAt);
      return json;
    }),
  });
}));

// ── GET /api/manager/requests ─────────────────────────────────────────────────
router.get('/requests', wrap(async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query as { status?: string };
  const where: Record<string, unknown> = {};
  if (status) where['status'] = status;

  const requests = await RecruitmentRequest.findAll({
    where,
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'] },
      { model: User, as: 'requester', attributes: ['id', 'name'] },
      { model: Batch, as: 'batch', attributes: ['id', 'batchCode', 'name', 'status', 'quotaTotal'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  res.json({ requests: requests.map((r) => r.toJSON()) });
}));

// ── GET /api/manager/requests/:id ────────────────────────────────────────────
router.get('/requests/:id', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) { res.status(400).json({ error: 'BAD_REQUEST' }); return; }

  const request = await RecruitmentRequest.findByPk(id, {
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'] },
      { model: User, as: 'requester', attributes: ['id', 'name'] },
      { model: Batch, as: 'batch', attributes: ['id', 'batchCode', 'name', 'status', 'quotaTotal'] },
    ],
  });

  if (!request) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ request: request.toJSON() });
}));

// ── POST /api/manager/requests/:id/confirm ────────────────────────────────────
router.post('/requests/:id/confirm', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) { res.status(400).json({ error: 'BAD_REQUEST' }); return; }

  const request = await RecruitmentRequest.findByPk(id, {
    include: [{ model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'] }],
  });
  if (!request) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (request.status !== 'pending') { res.status(409).json({ error: 'NOT_PENDING' }); return; }

  const { allocatedCount, managerNotes, expiryDate } = req.body as {
    allocatedCount?: number; managerNotes?: string; expiryDate?: string;
  };

  const allocated = Number(allocatedCount) || Math.ceil(request.requestedCount * 1.5);
  const companyData = (request as unknown as Record<string, unknown>)['company'] as Record<string, unknown> | null;
  const companyName = (companyData?.['name'] as string) ?? 'Company';

  // Auto-generate batch label
  const batchCode = request.requestCode;
  const batchName = `[${request.requestCode}] ${request.sswFieldId} (${request.kubun}) — ${companyName}`;

  const batch = await Batch.create({
    batchCode,
    name: batchName,
    companyId: request.companyId,
    quotaTotal: allocated,
    interviewCandidateLimit: allocated,
    sswFieldFilter: request.sswFieldId,
    status: 'active',
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    createdBy: req.user!.sub,
  });

  await request.update({
    status: 'confirmed',
    allocatedCount: allocated,
    batchId: batch.id,
    managerNotes: managerNotes ?? null,
    confirmedAt: new Date(),
  });

  // Notify the recruiter who submitted the request
  const requester = await User.findByPk(request.requestedBy, { attributes: ['id', 'name'] });
  if (requester) {
    await notifyUser(
      requester.id,
      'REQUEST_CONFIRMED',
      `Permintaan ${request.requestCode} dikonfirmasi`,
      `Permintaan Anda untuk ${request.sswFieldId} (${request.kubun}) telah dikonfirmasi. ${allocated} kandidat dialokasikan.`,
      'batch',
      batch.id,
    );
  }

  await audit(req, 'REQUEST_CONFIRMED', 'recruitment_request', id, undefined, { batchId: batch.id, allocated });

  res.json({ request: request.toJSON(), batch: batch.toJSON() });
}));

// ── POST /api/manager/requests/:id/reject ────────────────────────────────────
router.post('/requests/:id/reject', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) { res.status(400).json({ error: 'BAD_REQUEST' }); return; }

  const request = await RecruitmentRequest.findByPk(id);
  if (!request) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (request.status !== 'pending') { res.status(409).json({ error: 'NOT_PENDING' }); return; }

  const { managerNotes } = req.body as { managerNotes?: string };

  await request.update({ status: 'rejected', managerNotes: managerNotes ?? null });

  const requester = await User.findByPk(request.requestedBy, { attributes: ['id'] });
  if (requester) {
    await notifyUser(
      requester.id,
      'REQUEST_REJECTED',
      `Permintaan ${request.requestCode} ditolak`,
      `Permintaan Anda untuk ${request.sswFieldId} (${request.kubun}) tidak dapat diproses saat ini.`,
      'recruitment_request',
      id,
    );
  }

  await audit(req, 'REQUEST_REJECTED', 'recruitment_request', id);

  res.json({ request: request.toJSON() });
}));

export default router;
