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
  AuditLog,
  User,
  Batch,
  BatchCandidate,
  InterviewProposal,
  Company,
} from '../db/models/index';
import { serializeCandidate } from '../serializers/candidate';
import { calcCompleteness } from '../utils/completeness';
import { notifyByRole, notifyUser } from '../utils/notify';
import { isUUID } from 'validator';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authenticate, requireRole('recruiter'));

// ── Async error wrapper ───────────────────────────────────────────────────────
function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getRecruiterCompanyId(userId: string): Promise<string | null> {
  const user = await User.findByPk(userId, { attributes: ['companyId'] });
  return user?.companyId ?? null;
}

async function getActiveBatch(companyId: string) {
  return Batch.findOne({
    where: { companyId, status: { [Op.in]: ['active', 'selection', 'approved'] } },
    include: [{ model: Company, as: 'company', attributes: ['id', 'name', 'nameJa'] }],
    order: [['createdAt', 'DESC']],
  });
}

function candidateIncludes() {
  return [
    { model: CandidateJapaneseTest, as: 'tests', required: false },
    { model: CandidateCareer, as: 'career', required: false },
    { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
    { model: CandidateWeeklyTest, as: 'weeklyTests', required: false },
    { model: CandidateIntroVideo, as: 'videos', required: false },
    { model: ToolsDictionary, as: 'tools', required: false },
  ];
}

function serializeBatchCandidate(bcJson: Record<string, unknown>): Record<string, unknown> {
  const candidateData = (bcJson['candidate'] as Record<string, unknown>) ?? {};
  const completeness = calcCompleteness(candidateData);
  return {
    id: bcJson['id'],
    batchId: bcJson['batchId'],
    candidateId: bcJson['candidateId'],
    isSelected: bcJson['isSelected'],
    isConfirmed: bcJson['isConfirmed'],
    selectedAt: bcJson['selectedAt'],
    confirmedAt: bcJson['confirmedAt'],
    candidate: { ...serializeCandidate(candidateData, 'recruiter'), completeness },
    proposal: (bcJson['proposal'] as Record<string, unknown>) ?? null,
  };
}

// ── GET /api/recruiter/batch ──────────────────────────────────────────────────
router.get('/batch', wrap(async (req: Request, res: Response): Promise<void> => {
  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Recruiter is not assigned to a company.' });
    return;
  }

  const batch = await getActiveBatch(companyId);
  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'No active batch found for your company.' });
    return;
  }

  const allocations = await BatchCandidate.findAll({
    where: { batchId: batch.id, isConfirmed: false },
    include: [
      {
        model: Candidate,
        as: 'candidate',
        required: true,
        include: candidateIncludes(),
      },
      { model: InterviewProposal, as: 'proposal', required: false },
    ],
  });

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'VIEW_CANDIDATE_LIST',
    entityType: 'batch',
    entityId: batch.id,
    targetCandidateId: null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: { batchId: batch.id },
  });

  const candidates = allocations.map((bc) => serializeBatchCandidate(bc.toJSON() as unknown as Record<string, unknown>));

  const selectedCount = allocations.filter((bc) => bc.isSelected).length;
  const confirmedCount = allocations.filter((bc) => bc.isConfirmed).length;

  const batchData = batch.toJSON() as unknown as Record<string, unknown>;

  res.json({
    batch: { ...batchData, selectedCount, confirmedCount },
    candidates,
  });
}));

// ── POST /api/recruiter/batches/:batchId/select ───────────────────────────────
router.post('/batches/:batchId/select', wrap(async (req: Request, res: Response): Promise<void> => {
  const { batchId } = req.params as { batchId: string };

  if (!isUUID(batchId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid batch ID.' });
    return;
  }

  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const batch = await Batch.findOne({
    where: { id: batchId, companyId, status: { [Op.in]: ['active', 'selection'] } },
  });
  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Batch not found or not accessible.' });
    return;
  }

  const { candidateIds } = req.body as { candidateIds?: string[] };
  if (!Array.isArray(candidateIds)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'candidateIds must be an array.' });
    return;
  }

  const limit = batch.interviewCandidateLimit ?? batch.quotaTotal ?? 999;
  if (candidateIds.length > limit) {
    res.status(422).json({
      error: 'QUOTA_EXCEEDED',
      message: `Cannot select more than ${limit} candidates.`,
    });
    return;
  }

  // Validate all IDs are in the batch
  const allAllocations = await BatchCandidate.findAll({ where: { batchId } });
  const allocMap = new Map(allAllocations.map((a) => [a.candidateId, a]));

  for (const cid of candidateIds) {
    if (!allocMap.has(cid)) {
      res.status(422).json({ error: 'INVALID_CANDIDATE', message: `Candidate ${cid} is not in this batch.` });
      return;
    }
  }

  const newSet = new Set(candidateIds);

  // Cannot deselect already-confirmed candidates
  for (const [cid, alloc] of allocMap) {
    if (alloc.isConfirmed && !newSet.has(cid)) {
      res.status(422).json({
        error: 'CANNOT_DESELECT_CONFIRMED',
        message: `Candidate ${cid} is already confirmed and cannot be deselected.`,
      });
      return;
    }
  }

  // Update selections
  const now = new Date();
  await Promise.all(
    allAllocations.map((alloc) => {
      const shouldSelect = newSet.has(alloc.candidateId);
      if (alloc.isSelected !== shouldSelect && !alloc.isConfirmed) {
        return alloc.update({
          isSelected: shouldSelect,
          selectedAt: shouldSelect ? now : null,
        });
      }
      return Promise.resolve();
    }),
  );

  // Update batch status to 'selection'
  if (batch.status === 'active') {
    await batch.update({ status: 'selection' });
  }

  // Notify all managers
  await notifyByRole(
    'manager',
    'BATCH_SELECTED',
    'リクルーターが候補者を選択しました / Rekruter telah memilih kandidat',
    `Batch ${batch.batchCode ?? batch.id}: ${candidateIds.length} candidates selected.`,
    'batch',
    batch.id,
  );

  // Audit each selected candidate
  await Promise.all(
    candidateIds.map((cid) =>
      AuditLog.create({
        userId: req.user!.sub,
        action: 'BATCH_SELECT',
        entityType: 'batch_candidate',
        entityId: allocMap.get(cid)?.id ?? null,
        targetCandidateId: cid,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        payload: { batchId },
      }),
    ),
  );

  // Return updated counts + batch status
  const updatedAllocations = await BatchCandidate.findAll({ where: { batchId } });
  const updatedBatch = await Batch.findByPk(batchId, { attributes: ['id', 'status'] });
  res.json({
    message: 'Selection saved.',
    selectedCount: updatedAllocations.filter((a) => a.isSelected).length,
    confirmedCount: updatedAllocations.filter((a) => a.isConfirmed).length,
    batch: updatedBatch?.toJSON() ?? null,
  });
}));

// ── GET /api/recruiter/confirmed ──────────────────────────────────────────────
router.get('/confirmed', wrap(async (req: Request, res: Response): Promise<void> => {
  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const batch = await getActiveBatch(companyId);
  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const allocations = await BatchCandidate.findAll({
    where: { batchId: batch.id, isSelected: true },
    include: [
      {
        model: Candidate,
        as: 'candidate',
        required: true,
        include: candidateIncludes(),
      },
      { model: InterviewProposal, as: 'proposal', required: false },
    ],
  });

  const candidates = allocations.map((bc) => serializeBatchCandidate(bc.toJSON() as unknown as Record<string, unknown>));

  res.json({ candidates });
}));

// ── POST /api/recruiter/interviews/:batchCandidateId/propose ─────────────────
router.post('/interviews/:batchCandidateId/propose', wrap(async (req: Request, res: Response): Promise<void> => {
  const { batchCandidateId } = req.params as { batchCandidateId: string };

  if (!isUUID(batchCandidateId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid ID.' });
    return;
  }

  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const batch = await getActiveBatch(companyId);
  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const allocation = await BatchCandidate.findOne({
    where: { id: batchCandidateId, batchId: batch.id },
  });
  if (!allocation) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'BatchCandidate not found.' });
    return;
  }
  if (!allocation.isSelected) {
    res.status(422).json({ error: 'NOT_SELECTED', message: 'Candidate must be selected before proposing dates.' });
    return;
  }

  // Check no active proposal
  const existing = await InterviewProposal.findOne({
    where: {
      batchCandidateId,
      status: { [Op.in]: ['scheduled', 'completed'] },
    },
  });
  if (existing) {
    res.status(422).json({ error: 'PROPOSAL_EXISTS', message: 'An active proposal already exists.' });
    return;
  }

  const { proposedDates } = req.body as { proposedDates?: string[] };
  if (!Array.isArray(proposedDates) || proposedDates.length === 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'proposedDates must be a non-empty array.' });
    return;
  }
  if (proposedDates.length > 3) {
    res.status(422).json({ error: 'TOO_MANY_DATES', message: 'Maximum 3 proposed dates allowed.' });
    return;
  }

  // Delete any existing 'proposed' or 'cancelled' proposal first
  await InterviewProposal.destroy({
    where: { batchCandidateId, status: { [Op.in]: ['proposed', 'cancelled'] } },
  });

  const proposal = await InterviewProposal.create({
    id: uuidv4(),
    batchCandidateId,
    proposedBy: req.user!.sub,
    proposedDates,
    status: 'proposed',
  });

  // Notify LPK admin for this candidate
  if (allocation.candidateId) {
    const candidate = await Candidate.findByPk(allocation.candidateId, {
      attributes: ['lpkId', 'fullName', 'candidateCode'],
    });
    if (candidate) {
      const adminUsers = await User.findAll({
        where: { role: 'admin', lpkId: candidate.lpkId, isActive: true },
      });
      await Promise.all(
        adminUsers.map((u) =>
          notifyUser(
            u.id,
            'INTERVIEW_PROPOSED',
            `Jadwal wawancara diusulkan: ${candidate.fullName}`,
            `Rekruter mengusulkan jadwal wawancara untuk kandidat ${candidate.candidateCode}.`,
            'interview_proposal',
            proposal.id,
          ),
        ),
      );
    }
  }

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'INTERVIEW_PROPOSE',
    entityType: 'interview_proposal',
    entityId: proposal.id,
    targetCandidateId: allocation.candidateId,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: { proposedDates, batchCandidateId },
  });

  res.status(201).json({ proposal: proposal.toJSON() });
}));

// ── GET /api/recruiter/interviews ─────────────────────────────────────────────
router.get('/interviews', wrap(async (req: Request, res: Response): Promise<void> => {
  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const batch = await getActiveBatch(companyId);
  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const allocations = await BatchCandidate.findAll({
    where: { batchId: batch.id },
    attributes: ['id'],
  });
  const bcIds = allocations.map((a) => a.id);

  if (bcIds.length === 0) {
    res.json({ proposals: [] });
    return;
  }

  const { status } = req.query as { status?: string };
  const where: Record<string, unknown> = { batchCandidateId: { [Op.in]: bcIds } };
  if (status) where['status'] = status;

  const proposals = await InterviewProposal.findAll({
    where,
    include: [
      {
        model: BatchCandidate,
        as: 'batchCandidate',
        include: [
          {
            model: Candidate,
            as: 'candidate',
            attributes: ['id', 'candidateCode', 'fullName', 'sswFieldId', 'sswFieldJa', 'closeupUrl'],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  res.json({ proposals: proposals.map((p) => p.toJSON()) });
}));

export default router;
