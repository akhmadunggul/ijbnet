import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { authenticate, requireRole } from '../middleware/auth';
import { JpTopic, JpLesson, JpExercise, JpCandidateProgress, GlobalSettings, Candidate } from '../db/models';

const router = Router();

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
}

// All endpoints require a logged-in candidate
router.use(authenticate, requireRole('candidate'));

// ── LPK gate helper ───────────────────────────────────────────────────────────
async function getEnabledLpkIds(): Promise<string[]> {
  const row = await GlobalSettings.findOne({ where: { key: 'jp_learning_lpk_ids' } });
  if (!row) return [];
  const val = (row.toJSON() as unknown as Record<string, unknown>)['value'];
  return Array.isArray(val) ? (val as string[]) : [];
}

async function isEnabledForCandidate(userId: string): Promise<boolean> {
  const enabledIds = await getEnabledLpkIds();
  if (enabledIds.length === 0) {
    console.log('[jpLearning] gate: no LPKs configured in jp_learning_lpk_ids');
    return false;
  }
  const candidate = await Candidate.findOne({ where: { userId }, attributes: ['id', 'lpkId'] });
  if (!candidate) {
    console.log(`[jpLearning] gate: no candidate found for userId=${userId}`);
    return false;
  }
  if (!candidate.lpkId) {
    console.log(`[jpLearning] gate: candidate ${candidate.id} has null lpkId`);
    return false;
  }
  const allowed = enabledIds.includes(candidate.lpkId);
  if (!allowed) {
    console.log(`[jpLearning] gate: candidate lpkId=${candidate.lpkId} not in enabledIds=${JSON.stringify(enabledIds)}`);
  }
  return allowed;
}

// ── GET /api/jp/available ─────────────────────────────────────────────────────
// Lightweight check: can the current candidate access JP learning?
router.get('/available', wrap(async (req, res) => {
  const enabled = await isEnabledForCandidate(req.user!.sub);
  res.json({ enabled });
}));

// ── GET /api/jp/topics ────────────────────────────────────────────────────────
router.get('/topics', wrap(async (req, res) => {
  if (!(await isEnabledForCandidate(req.user!.sub))) {
    res.status(403).json({ error: 'JP learning not available for your LPK' });
    return;
  }

  const candidateId = (req as unknown as { user: { candidateId: string } }).user.candidateId;

  const topics = await JpTopic.findAll({
    where: { level: 'A1' },
    order: [['sortOrder', 'ASC']],
    include: [{
      model: JpLesson,
      as: 'lessons',
      attributes: ['id', 'sortOrder', 'titleJa', 'titleId', 'type'],
      order: [['sortOrder', 'ASC']],
    }],
  });

  const progress = await JpCandidateProgress.findAll({ where: { candidateId } });
  const completedSet = new Set(progress.map((p) => p.lessonId));

  const data = topics.map((topic) => {
    const t = topic.toJSON() as unknown as Record<string, unknown> & { lessons?: { id: string }[] };
    const lessons = t.lessons ?? [];
    return {
      ...t,
      lessons: lessons.map((l) => ({ ...l, completed: completedSet.has(l.id) })),
      completedCount: lessons.filter((l) => completedSet.has(l.id)).length,
      totalCount: lessons.length,
    };
  });

  res.json(data);
}));

// ── GET /api/jp/lessons/:lessonId ─────────────────────────────────────────────
router.get('/lessons/:lessonId', wrap(async (req, res) => {
  if (!(await isEnabledForCandidate(req.user!.sub))) {
    res.status(403).json({ error: 'JP learning not available for your LPK' });
    return;
  }

  const candidateId = (req as unknown as { user: { candidateId: string } }).user.candidateId;
  const { lessonId } = req.params;

  const lesson = await JpLesson.findByPk(lessonId, {
    include: [{ model: JpExercise, as: 'exercises', order: [['sortOrder', 'ASC']] }],
  });
  if (!lesson) { res.status(404).json({ error: 'Lesson not found' }); return; }

  const progress = await JpCandidateProgress.findOne({ where: { candidateId, lessonId } });
  res.json({ ...lesson.toJSON(), progress: progress ? progress.toJSON() : null });
}));

// ── POST /api/jp/lessons/:lessonId/complete ───────────────────────────────────
router.post('/lessons/:lessonId/complete', wrap(async (req, res) => {
  if (!(await isEnabledForCandidate(req.user!.sub))) {
    res.status(403).json({ error: 'JP learning not available for your LPK' });
    return;
  }

  const candidateId = (req as unknown as { user: { candidateId: string } }).user.candidateId;
  const { lessonId } = req.params;
  const { score, total } = req.body as { score?: number; total?: number };

  const lesson = await JpLesson.findByPk(lessonId);
  if (!lesson) { res.status(404).json({ error: 'Lesson not found' }); return; }

  const [progress, created] = await JpCandidateProgress.findOrCreate({
    where: { candidateId, lessonId },
    defaults: { id: uuid(), candidateId, lessonId, completedAt: new Date(), score: score ?? null, total: total ?? null },
  });

  if (!created && score != null && total != null && score > (progress.score ?? 0)) {
    await progress.update({ score, total, completedAt: new Date() });
  }

  res.json(progress.toJSON());
}));

// ── GET /api/jp/progress ──────────────────────────────────────────────────────
router.get('/progress', wrap(async (req, res) => {
  if (!(await isEnabledForCandidate(req.user!.sub))) {
    res.status(403).json({ error: 'JP learning not available for your LPK' });
    return;
  }

  const candidateId = (req as unknown as { user: { candidateId: string } }).user.candidateId;

  const [allLessons, completedRows] = await Promise.all([
    JpLesson.findAll({ attributes: ['id', 'topicId', 'type'] }),
    JpCandidateProgress.findAll({ where: { candidateId }, attributes: ['lessonId', 'score', 'total'] }),
  ]);

  const completedMap = new Map(completedRows.map((r) => [r.lessonId, r]));
  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => completedMap.has(l.id)).length;

  const topicMap: Record<string, { total: number; completed: number }> = {};
  for (const l of allLessons) {
    if (!topicMap[l.topicId]) topicMap[l.topicId] = { total: 0, completed: 0 };
    topicMap[l.topicId].total++;
    if (completedMap.has(l.id)) topicMap[l.topicId].completed++;
  }

  res.json({
    totalLessons,
    completedLessons,
    percentComplete: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    byTopic: topicMap,
  });
}));

export default router;
