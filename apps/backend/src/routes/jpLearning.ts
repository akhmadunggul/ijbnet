import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { authenticate, requireRole } from '../middleware/auth';
import { JpTopic, JpLesson, JpExercise, JpCandidateProgress } from '../db/models';

const router = Router();

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
}

// All endpoints require a logged-in candidate
router.use(authenticate, requireRole('candidate'));

// ── GET /api/jp/topics ────────────────────────────────────────────────────────
// Returns all topics for the candidate's level with per-lesson progress counts.
router.get('/topics', wrap(async (req, res) => {
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

  // Fetch all progress rows for this candidate in one query
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
// Returns a lesson with its exercises and the candidate's existing progress.
router.get('/lessons/:lessonId', wrap(async (req, res) => {
  const candidateId = (req as unknown as { user: { candidateId: string } }).user.candidateId;
  const { lessonId } = req.params;

  const lesson = await JpLesson.findByPk(lessonId, {
    include: [{
      model: JpExercise,
      as: 'exercises',
      order: [['sortOrder', 'ASC']],
    }],
  });
  if (!lesson) { res.status(404).json({ error: 'Lesson not found' }); return; }

  const progress = await JpCandidateProgress.findOne({ where: { candidateId, lessonId } });

  res.json({
    ...lesson.toJSON(),
    progress: progress ? progress.toJSON() : null,
  });
}));

// ── POST /api/jp/lessons/:lessonId/complete ───────────────────────────────────
// Marks a lesson as complete (upsert). For quiz lessons, records score/total.
router.post('/lessons/:lessonId/complete', wrap(async (req, res) => {
  const candidateId = (req as unknown as { user: { candidateId: string } }).user.candidateId;
  const { lessonId } = req.params;
  const { score, total } = req.body as { score?: number; total?: number };

  const lesson = await JpLesson.findByPk(lessonId);
  if (!lesson) { res.status(404).json({ error: 'Lesson not found' }); return; }

  const [progress, created] = await JpCandidateProgress.findOrCreate({
    where: { candidateId, lessonId },
    defaults: {
      id: uuid(),
      candidateId,
      lessonId,
      completedAt: new Date(),
      score: score ?? null,
      total: total ?? null,
    },
  });

  // If already exists and new score is better, update
  if (!created && score != null && total != null) {
    const existing = progress.score ?? 0;
    if (score > existing) {
      await progress.update({ score, total, completedAt: new Date() });
    }
  }

  res.json(progress.toJSON());
}));

// ── GET /api/jp/progress ──────────────────────────────────────────────────────
// Summary: completed lessons, total lessons, per-topic breakdown.
router.get('/progress', wrap(async (req, res) => {
  const candidateId = (req as unknown as { user: { candidateId: string } }).user.candidateId;

  const [allLessons, completedRows] = await Promise.all([
    JpLesson.findAll({ attributes: ['id', 'topicId', 'type'] }),
    JpCandidateProgress.findAll({ where: { candidateId }, attributes: ['lessonId', 'score', 'total'] }),
  ]);

  const completedMap = new Map(completedRows.map((r) => [r.lessonId, r]));
  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => completedMap.has(l.id)).length;

  // Per-topic breakdown
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
