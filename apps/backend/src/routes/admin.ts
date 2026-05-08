import { Router, Request, Response } from 'express';
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
} from '../db/models/index';
import { serializeCandidate } from '../serializers/candidate';
import { calcCompleteness } from '../utils/completeness';
import { encryptNullable } from '../utils/crypto';
import { notifyUser, notifyByRole } from '../utils/notify';
import { extractYoutubeId } from '../utils/youtube';
import { recordTimelineEvent } from '../utils/timeline';
import { CandidateTimeline } from '../db/models/CandidateTimeline';
import { isUUID } from 'validator';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authenticate, requireRole('admin'));

// ── Helper: get admin's lpkId ────────────────────────────────────────────────
async function getAdminLpkId(adminUserId: string): Promise<string | null> {
  const user = await User.findByPk(adminUserId, { attributes: ['lpkId'] });
  return user?.lpkId ?? null;
}

// ── Helper: find candidate scoped to admin's LPK ─────────────────────────────
async function findScopedCandidate(candidateId: string, lpkId: string) {
  if (!isUUID(candidateId)) return null;
  return Candidate.findOne({
    where: { id: candidateId, lpkId },
    include: [
      { model: CandidateJapaneseTest, as: 'tests', required: false },
      { model: CandidateCareer, as: 'career', required: false },
      { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
      { model: CandidateWeeklyTest, as: 'weeklyTests', required: false },
      { model: CandidateIntroVideo, as: 'videos', required: false },
      { model: ToolsDictionary, as: 'tools', required: false },
      { model: CandidateCertification, as: 'certifications', required: false },
      { model: CandidateEducationHistory, as: 'educationHistory', required: false },
    ],
  });
}

// ── Helper: log audit ────────────────────────────────────────────────────────
async function audit(
  req: Request,
  action: string,
  candidateId?: string,
  payload?: Record<string, unknown>,
) {
  await AuditLog.create({
    userId: req.user!.sub,
    action,
    entityType: 'candidate',
    entityId: candidateId ?? null,
    targetCandidateId: candidateId ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: payload ?? null,
  });
}

// ── GET /api/admin/candidates ─────────────────────────────────────────────────
router.get('/candidates', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Admin is not assigned to an LPK.' });
    return;
  }

  const { search, profileStatus, sswKubun, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(pageSize, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const where: Record<string, unknown> = { lpkId };
  if (profileStatus) where['profileStatus'] = profileStatus;
  if (sswKubun) where['sswKubun'] = sswKubun;
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
      { model: CandidateIntroVideo, as: 'videos', required: false },
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });

  await audit(req, 'VIEW_CANDIDATE_LIST');

  const candidates = rows.map((c) => {
    const data = c.toJSON() as unknown as Record<string, unknown>;
    const completeness = calcCompleteness(data);
    return { ...serializeCandidate(data, 'admin'), completeness };
  });

  res.json({ candidates, total: count, page: parseInt(page, 10) || 1, pageSize: limit });
});

// ── GET /api/admin/candidates/:id ─────────────────────────────────────────────
router.get('/candidates/:id', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const candidate = await findScopedCandidate(req.params['id']!, lpkId);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  await audit(req, 'VIEW_CANDIDATE', candidate.id);

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const completeness = calcCompleteness(data);

  res.json({ candidate: { ...serializeCandidate(data, 'admin'), completeness } });
});

// ── PATCH /api/admin/candidates/:id ──────────────────────────────────────────
router.patch('/candidates/:id', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!isUUID(req.params['id']!, 4)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid candidate ID.' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const { internalNotes } = req.body as { internalNotes?: string };
  await candidate.update({ internalNotes: internalNotes ?? null });

  await audit(req, 'UPDATE_CANDIDATE', candidate.id, { fields: ['internalNotes'] });

  res.json({ message: 'Updated.' });
});

// ── PATCH /api/admin/candidates/:id/status ────────────────────────────────────
router.patch('/candidates/:id/status', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!isUUID(req.params['id']!, 4)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid candidate ID.' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const { status } = req.body as { status?: string };
  const from = candidate.profileStatus;

  const ALLOWED: Record<string, string[]> = {
    submitted: ['under_review'],
    under_review: ['approved', 'rejected'],
  };

  if (!status || !ALLOWED[from]?.includes(status)) {
    res.status(400).json({
      error: 'INVALID_TRANSITION',
      message: `Cannot transition from '${from}' to '${status ?? '?'}'.`,
    });
    return;
  }

  await candidate.update({ profileStatus: status as 'under_review' | 'approved' | 'rejected' });

  // Notify candidate
  if (candidate.userId) {
    const titleMap: Record<string, string> = {
      under_review: 'Profil Anda sedang direview',
      approved: 'Profil Anda telah disetujui',
      rejected: 'Profil Anda ditolak',
    };
    await notifyUser(
      candidate.userId,
      'STATUS_CHANGED',
      titleMap[status] ?? 'Status profil berubah',
      `Status profil Anda berubah dari ${from} menjadi ${status}.`,
      'candidate',
      candidate.id,
    );
  }

  // If approved, notify all managers
  if (status === 'approved') {
    await notifyByRole(
      'manager',
      'CANDIDATE_APPROVED',
      `Kandidat disetujui: ${candidate.fullName}`,
      `Kandidat ${candidate.candidateCode} telah disetujui oleh admin.`,
      'candidate',
      candidate.id,
    );
  }

  await audit(req, 'UPDATE_STATUS', candidate.id, { from, to: status });

  const eventMap: Record<string, 'profile_under_review' | 'profile_approved' | 'profile_rejected'> = {
    under_review: 'profile_under_review',
    approved: 'profile_approved',
    rejected: 'profile_rejected',
  };
  if (eventMap[status]) {
    await recordTimelineEvent(candidate.id, eventMap[status]!, req.user!.sub, 'admin');
  }

  res.json({ message: 'Status updated.', status });
});

// ── PATCH /api/admin/candidates/:id/lock ─────────────────────────────────────
router.patch('/candidates/:id/lock', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!isUUID(req.params['id']!, 4)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid candidate ID.' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const { isLocked } = req.body as { isLocked?: boolean };
  if (typeof isLocked !== 'boolean') {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'isLocked must be a boolean.' });
    return;
  }

  await candidate.update({ isLocked });

  await audit(req, isLocked ? 'LOCK_CANDIDATE' : 'UNLOCK_CANDIDATE', candidate.id);

  res.json({ message: `Profile ${isLocked ? 'locked' : 'unlocked'}.`, isLocked });
});

// ── POST /api/admin/candidates/:id/body-check ─────────────────────────────────
router.post('/candidates/:id/body-check', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!isUUID(req.params['id']!, 4)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid candidate ID.' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const {
    verifiedHeight,
    verifiedWeight,
    carrySeconds,
    vision,
    tattoo,
    overallResult,
    checkedDate,
  } = req.body as {
    verifiedHeight?: number;
    verifiedWeight?: number;
    carrySeconds?: number;
    vision?: string;
    tattoo?: string;
    overallResult?: 'pass' | 'hold' | 'fail';
    checkedDate?: string;
  };

  const existing = await CandidateBodyCheck.findOne({ where: { candidateId: candidate.id } });

  const fields = {
    verifiedHeight: verifiedHeight ?? null,
    verifiedWeight: verifiedWeight ?? null,
    carrySeconds: carrySeconds ?? null,
    visionEncrypted: encryptNullable(vision ?? null),
    tattooEncrypted: encryptNullable(tattoo ?? null),
    overallResult: overallResult ?? null,
    checkedDate: checkedDate ? new Date(checkedDate) : null,
    checkedBy: req.user!.sub,
  };

  if (existing) {
    await existing.update(fields);
  } else {
    await CandidateBodyCheck.create({ id: uuidv4(), candidateId: candidate.id, ...fields });
  }

  await audit(req, 'UPDATE_BODY_CHECK', candidate.id);

  res.json({ message: 'Body check saved.' });
});

// ── GET /api/admin/candidates/:id/videos ─────────────────────────────────────
router.get('/candidates/:id/videos', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!isUUID(req.params['id']!, 4)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid candidate ID.' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId }, attributes: ['id'] });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const videos = await CandidateIntroVideo.findAll({
    where: { candidateId: candidate.id },
    order: [['sortOrder', 'ASC']],
  });

  res.json({ videos: videos.map((v) => v.toJSON()) });
});

// ── POST /api/admin/candidates/:id/videos ────────────────────────────────────
router.post('/candidates/:id/videos', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!isUUID(req.params['id']!, 4)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid candidate ID.' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId }, attributes: ['id'] });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const { youtubeUrl, label, videoDate } = req.body as {
    youtubeUrl?: string;
    label?: string;
    videoDate?: string;
  };

  if (!youtubeUrl) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'youtubeUrl is required.' });
    return;
  }

  const info = extractYoutubeId(youtubeUrl);
  if (!info) {
    res.status(422).json({ error: 'INVALID_YOUTUBE_URL', message: 'URL YouTube tidak valid.' });
    return;
  }

  const maxRow = await CandidateIntroVideo.findOne({
    where: { candidateId: candidate.id },
    order: [['sortOrder', 'DESC']],
    attributes: ['sortOrder'],
  });
  const nextOrder = maxRow ? (maxRow.sortOrder ?? 0) + 1 : 0;

  const video = await CandidateIntroVideo.create({
    id: uuidv4(),
    candidateId: candidate.id,
    youtubeUrl,
    youtubeId: info.id,
    label: label ?? null,
    videoDate: videoDate ?? null,
    uploadedBy: req.user!.sub,
    sortOrder: nextOrder,
  });

  await audit(req, 'LINK_VIDEO', candidate.id, { youtubeId: info.id });

  res.status(201).json({ video: video.toJSON() });
});

// ── PUT /api/admin/candidates/:id/videos/reorder ─────────────────────────────
router.put('/candidates/:id/videos/reorder', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!isUUID(req.params['id']!, 4)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid candidate ID.' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId }, attributes: ['id'] });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'ids must be an array.' });
    return;
  }

  await Promise.all(
    ids.map((videoId, idx) =>
      CandidateIntroVideo.update(
        { sortOrder: idx },
        { where: { id: videoId, candidateId: candidate.id } },
      ),
    ),
  );

  res.json({ message: 'Reordered.' });
});

// ── DELETE /api/admin/candidates/:id/videos/:videoId ─────────────────────────
router.delete('/candidates/:id/videos/:videoId', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!isUUID(req.params['id']!, 4) || !isUUID(req.params['videoId']!, 4)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid ID.' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId }, attributes: ['id'] });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const deleted = await CandidateIntroVideo.destroy({
    where: { id: req.params['videoId'], candidateId: candidate.id },
  });
  if (!deleted) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Video not found.' });
    return;
  }

  await audit(req, 'DELETE_VIDEO', candidate.id, { videoId: req.params['videoId'] });

  res.json({ message: 'Deleted.' });
});

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
router.get('/audit-logs', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  // Get all candidate IDs in this LPK
  const lpkCandidates = await Candidate.findAll({
    where: { lpkId },
    attributes: ['id'],
  });
  const candidateIds = lpkCandidates.map((c) => c.id);

  if (candidateIds.length === 0) {
    res.json({ logs: [] });
    return;
  }

  const { limit: limitStr = '20', candidateId } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(limitStr, 10) || 20, 100);

  const where: Record<string, unknown> = {
    targetCandidateId: { [Op.in]: candidateIds },
  };
  if (candidateId && isUUID(candidateId) && candidateIds.includes(candidateId)) {
    where['targetCandidateId'] = candidateId;
  }

  const logs = await AuditLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    include: [
      { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'], required: false },
    ],
  });

  res.json({ logs: logs.map((l) => l.toJSON()) });
});

// ── GET /api/admin/dashboard ──────────────────────────────────────────────────
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const [lpk, allCandidates] = await Promise.all([
    Lpk.findByPk(lpkId, { attributes: ['id', 'name'] }),
    Candidate.findAll({
      where: { lpkId },
      include: [
        { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
        { model: CandidateIntroVideo, as: 'videos', required: false },
      ],
    }),
  ]);

  const statusBreakdown: Record<string, number> = {};
  let pendingReview = 0;
  let bodyCheckCompleted = 0;
  let bodyCheckPending = 0;
  let videosLinked = 0;

  for (const c of allCandidates) {
    const ps = c.profileStatus;
    statusBreakdown[ps] = (statusBreakdown[ps] ?? 0) + 1;
    if (ps === 'submitted' || ps === 'under_review') pendingReview++;

    const bc = (c as unknown as Record<string, unknown>)['bodyCheck'];
    if (bc && (bc as Record<string, unknown>)['overallResult']) {
      bodyCheckCompleted++;
    } else {
      bodyCheckPending++;
    }

    const vids = (c as unknown as Record<string, unknown>)['videos'];
    if (Array.isArray(vids)) videosLinked += vids.length;
  }

  // Recent audit logs scoped to LPK candidates
  const candidateIds = allCandidates.map((c) => c.id);
  const recentLogs = candidateIds.length
    ? await AuditLog.findAll({
        where: { targetCandidateId: { [Op.in]: candidateIds } },
        order: [['createdAt', 'DESC']],
        limit: 10,
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'], required: false },
        ],
      })
    : [];

  res.json({
    lpk: lpk?.toJSON() ?? null,
    stats: {
      total: allCandidates.length,
      statusBreakdown,
      pendingReview,
      bodyCheckCompleted,
      bodyCheckPending,
      videosLinked,
    },
    recentLogs: recentLogs.map((l) => l.toJSON()),
  });
});

// ── GET /api/admin/candidates/:id/timeline ────────────────────────────────────
router.get('/candidates/:id/timeline', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  const candidate = await Candidate.findOne({ where: { id: req.params['id'], lpkId }, attributes: ['id'] });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const events = await CandidateTimeline.findAll({
    where: { candidateId: candidate.id },
    include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'role'], required: false }],
    order: [['occurredAt', 'ASC']],
  });

  res.json({ timeline: events.map((e) => e.toJSON()) });
});

export default router;
