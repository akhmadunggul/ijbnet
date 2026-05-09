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
  Batch,
  BatchCandidate,
  InterviewProposal,
  Company,
  RecruitmentRequest,
} from '../db/models/index';
import { serializeCandidate } from '../serializers/candidate';
import { calcCompleteness } from '../utils/completeness';
import { notifyByRole, notifyUser } from '../utils/notify';
import { recordTimelineEvent, currentAgeHours } from '../utils/timeline';
import { CandidateTimeline } from '../db/models/CandidateTimeline';
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
    { model: CandidateCertification, as: 'certifications', required: false },
    { model: CandidateEducationHistory, as: 'educationHistory', required: false },
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

  // Confirmed candidates are immutable — always keep them in the set
  // regardless of whether the frontend included them in the submission.
  for (const [cid, alloc] of allocMap) {
    if (alloc.isConfirmed) newSet.add(cid);
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

  // Audit + timeline each selected candidate
  await Promise.all(
    candidateIds.map(async (cid) => {
      await AuditLog.create({
        userId: req.user!.sub,
        action: 'BATCH_SELECT',
        entityType: 'batch_candidate',
        entityId: allocMap.get(cid)?.id ?? null,
        targetCandidateId: cid,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        payload: { batchId },
      });
      const wasSelected = allocMap.get(cid)?.isSelected ?? false;
      if (!wasSelected) {
        await recordTimelineEvent(cid, 'recruiter_selected', req.user!.sub, 'recruiter', { batchId });
      }
    }),
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

// ── GET /api/recruiter/candidates/:id ────────────────────────────────────────
router.get('/candidates/:id', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid candidate ID.' });
    return;
  }

  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const batch = await getActiveBatch(companyId);
  if (!batch) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'No active batch for your company.' });
    return;
  }

  // Scope check: candidate must be allocated to this recruiter's batch
  const allocation = await BatchCandidate.findOne({ where: { batchId: batch.id, candidateId: id } });
  if (!allocation) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Candidate is not in your batch.' });
    return;
  }

  const candidate = await Candidate.findByPk(id, { include: candidateIncludes() });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'VIEW_CANDIDATE',
    entityType: 'candidate',
    entityId: id,
    targetCandidateId: id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: null,
  });

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const completeness = calcCompleteness(data);
  res.json({ candidate: { ...serializeCandidate(data, 'recruiter'), completeness } });
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

  await recordTimelineEvent(
    allocation.candidateId,
    'interview_proposed',
    req.user!.sub,
    'recruiter',
    { proposalId: proposal.id, proposedDates },
  );

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

// ── POST /api/recruiter/interviews/:proposalId/accept ─────────────────────────
router.post('/interviews/:proposalId/accept', wrap(async (req: Request, res: Response): Promise<void> => {
  const { proposalId } = req.params as { proposalId: string };
  if (!isUUID(proposalId)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const proposal = await InterviewProposal.findByPk(proposalId, {
    include: [
      {
        model: BatchCandidate,
        as: 'batchCandidate',
        include: [
          { model: Batch, as: 'batch', attributes: ['id', 'companyId'] },
          { model: Candidate, as: 'candidate', attributes: ['id', 'interviewStatus', 'candidateCode', 'fullName'] },
        ],
      },
    ],
  });

  if (!proposal) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const bcData = (proposal as unknown as Record<string, unknown>)['batchCandidate'] as Record<string, unknown> | null;
  const batchData = (bcData?.['batch'] as Record<string, unknown>) ?? null;
  if (!batchData || batchData['companyId'] !== companyId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const candidateData = (bcData?.['candidate'] as Record<string, unknown>) ?? null;
  const candidateId = candidateData?.['id'] as string | null;
  const interviewStatus = candidateData?.['interviewStatus'] as string | null;

  if (interviewStatus !== 'pass') {
    res.status(422).json({ error: 'INVALID_STATE', message: 'Can only accept a candidate who passed the interview.' });
    return;
  }

  if (!candidateId) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const alreadyAccepted = await CandidateTimeline.findOne({
    where: { candidateId, event: 'recruiter_accepted' },
  });
  if (alreadyAccepted) {
    res.status(422).json({ error: 'ALREADY_ACCEPTED', message: 'Candidate already accepted.' });
    return;
  }

  await recordTimelineEvent(candidateId, 'recruiter_accepted', req.user!.sub, 'recruiter', { proposalId });

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'RECRUITER_ACCEPT',
    entityType: 'interview_proposal',
    entityId: proposalId,
    targetCandidateId: candidateId,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: { proposalId },
  });

  res.json({ message: 'Candidate accepted.' });
}));

// ── GET /api/recruiter/candidates/:id/timeline ────────────────────────────────
router.get('/candidates/:id/timeline', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST' });
    return;
  }

  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const batch = await getActiveBatch(companyId);
  if (!batch) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const allocation = await BatchCandidate.findOne({ where: { batchId: batch.id, candidateId: id } });
  if (!allocation) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Candidate is not in your batch.' });
    return;
  }

  // Recruiters see only post-allocation events
  const RECRUITER_EVENTS = [
    'batch_allocated', 'recruiter_selected', 'interview_proposed',
    'interview_date_confirmed', 'interview_scheduled', 'manager_confirmed',
    'interview_passed', 'interview_failed', 'recruiter_accepted',
  ];

  const { Op } = await import('sequelize');
  const events = await CandidateTimeline.findAll({
    where: { candidateId: id, event: { [Op.in]: RECRUITER_EVENTS } },
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

// ── POST /api/recruiter/requests ─────────────────────────────────────────────
router.post('/requests', wrap(async (req: Request, res: Response): Promise<void> => {
  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) { res.status(403).json({ error: 'NO_COMPANY' }); return; }

  const { kubun, sswSectorId, sswSectorJa, sswFieldId, sswFieldJa, requestedCount, notes } = req.body as {
    kubun: string; sswSectorId: string; sswSectorJa: string;
    sswFieldId: string; sswFieldJa: string; requestedCount: number; notes?: string;
  };

  if (!kubun || !sswSectorId || !sswFieldId || !requestedCount || requestedCount < 1) {
    res.status(400).json({ error: 'BAD_REQUEST' }); return;
  }

  const count = await RecruitmentRequest.count({ where: { companyId } });
  const requestCode = `REQ-${String(count + 1).padStart(3, '0')}`;

  const request = await RecruitmentRequest.create({
    requestCode,
    companyId,
    requestedBy: req.user!.sub,
    kubun: kubun as 'SSW1' | 'SSW2' | 'Trainee',
    sswSectorId,
    sswSectorJa: sswSectorJa ?? '',
    sswFieldId,
    sswFieldJa: sswFieldJa ?? '',
    requestedCount: Number(requestedCount),
    notes: notes ?? null,
  });

  res.status(201).json({ request: request.toJSON() });
}));

// ── GET /api/recruiter/requests ───────────────────────────────────────────────
router.get('/requests', wrap(async (req: Request, res: Response): Promise<void> => {
  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) { res.status(403).json({ error: 'NO_COMPANY' }); return; }

  const requests = await RecruitmentRequest.findAll({
    where: { companyId },
    include: [
      { model: User, as: 'requester', attributes: ['id', 'name'] },
      { model: Batch, as: 'batch', attributes: ['id', 'batchCode', 'name', 'status', 'quotaTotal'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  res.json({ requests: requests.map((r) => r.toJSON()) });
}));

// ── GET /api/recruiter/requests/:id ──────────────────────────────────────────
router.get('/requests/:id', wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) { res.status(400).json({ error: 'BAD_REQUEST' }); return; }

  const companyId = await getRecruiterCompanyId(req.user!.sub);
  if (!companyId) { res.status(403).json({ error: 'NO_COMPANY' }); return; }

  const request = await RecruitmentRequest.findOne({
    where: { id, companyId },
    include: [
      { model: User, as: 'requester', attributes: ['id', 'name'] },
      { model: Batch, as: 'batch', attributes: ['id', 'batchCode', 'name', 'status', 'quotaTotal'] },
    ],
  });

  if (!request) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ request: request.toJSON() });
}));

export default router;
