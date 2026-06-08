/**
 * surveys.ts — standalone survey/angket system
 *
 * Completely isolated from candidate/batch/LPK business logic.
 * No audit log, no serializeCandidate, no RBAC scoping on business entities.
 *
 * Public (no auth):
 *   GET  /active               — featured active survey + questions
 *   POST /:id/respond          — submit a response (rate-limited)
 *
 * Superadmin only (authenticate + requireRole('super_admin')):
 *   GET    /                   — list all surveys
 *   POST   /                   — create survey
 *   GET    /:id                — get survey with questions
 *   PUT    /:id                — update survey
 *   DELETE /:id                — delete survey
 *   POST   /:id/questions      — add question
 *   PUT    /:id/questions/:qid — update question
 *   DELETE /:id/questions/:qid — delete question
 *   GET    /:id/stats          — response statistics
 */

import { Router, Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { isUUID } from 'validator';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../middleware/auth';
import {
  Survey,
  SurveyQuestion,
  SurveyResponse,
  SurveyAnswer,
} from '../db/survey-models/index';
import type { QuestionType, QuestionOption } from '../db/models/SurveyQuestion';

const router = Router();

// ── Rate limiter: 10 submissions per 5 minutes per IP ───────────────────────
const submitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const raw = req.ip ?? '';
    return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
  },
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many submissions from this IP.' },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

/** Hash IP for privacy — stored but not reversible */
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

/**
 * Auto-activate surveys whose publishedAt has passed and status is still 'draft'.
 * Called at query time — no cron needed.
 */
async function autoActivateDue(): Promise<void> {
  await Survey.update(
    { status: 'active' },
    {
      where: {
        status: 'draft',
        publishedAt: { [Op.lte]: new Date() },
      },
    },
  );
}

// ── PUBLIC: GET /surveys/active ──────────────────────────────────────────────
router.get(
  '/active',
  wrap(async (_req, res) => {
    await autoActivateDue();

    const now = new Date();
    const survey = await Survey.findOne({
      where: {
        status: 'active',
        isFeatured: 1,
        publishedAt: { [Op.lte]: now },
        [Op.or]: [{ closedAt: null }, { closedAt: { [Op.gt]: now } }],
      },
      include: [
        {
          model: SurveyQuestion,
          as: 'questions',
          order: [['sortOrder', 'ASC']],
        },
      ],
      order: [[{ model: SurveyQuestion, as: 'questions' }, 'sortOrder', 'ASC']],
    });

    if (!survey) {
      res.status(404).json({ error: 'NO_ACTIVE_SURVEY' });
      return;
    }

    res.json(survey.toJSON());
  }),
);

// ── PUBLIC: POST /surveys/:id/respond ────────────────────────────────────────
router.post(
  '/:id/respond',
  submitLimiter,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!isUUID(id, 4) && !/^[0-9a-f-]{36}$/i.test(id)) {
      res.status(400).json({ error: 'INVALID_ID' });
      return;
    }

    const survey = await Survey.findByPk(id);
    if (!survey) {
      res.status(404).json({ error: 'SURVEY_NOT_FOUND' });
      return;
    }

    const now = new Date();
    const isOpen =
      survey.status === 'active' &&
      survey.publishedAt !== null &&
      survey.publishedAt <= now &&
      (survey.closedAt === null || survey.closedAt > now);

    if (!isOpen) {
      res.status(409).json({ error: 'SURVEY_NOT_OPEN' });
      return;
    }

    const { respondentToken, answers } = req.body as {
      respondentToken: string;
      answers: { questionId: string; answerText?: string; answerOptions?: string[] }[];
    };

    if (!respondentToken || typeof respondentToken !== 'string') {
      res.status(400).json({ error: 'INVALID_TOKEN' });
      return;
    }

    // Duplicate check
    const existing = await SurveyResponse.findOne({ where: { respondentToken } });
    if (existing) {
      res.status(409).json({ error: 'ALREADY_RESPONDED' });
      return;
    }

    // Load questions to validate required fields
    const questions = await SurveyQuestion.findAll({
      where: { surveyId: id },
      order: [['sortOrder', 'ASC']],
    });

    const answerMap = new Map(
      (answers ?? []).map((a) => [a.questionId, a]),
    );

    for (const q of questions) {
      if (!q.required) continue;
      const a = answerMap.get(q.id);
      const hasText = a?.answerText && a.answerText.trim().length > 0;
      const hasOptions = Array.isArray(a?.answerOptions) && a!.answerOptions.length > 0;
      if (!hasText && !hasOptions) {
        res.status(422).json({
          error: 'MISSING_REQUIRED',
          questionId: q.id,
        });
        return;
      }
    }

    const rawIp = req.ip ?? '';
    const ip = rawIp.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;

    const response = await SurveyResponse.create({
      surveyId: id,
      respondentToken,
      ipHash: hashIp(ip),
      submittedAt: now,
    });

    const answerRows = (answers ?? [])
      .filter((a) => questions.some((q) => q.id === a.questionId))
      .map((a) => ({
        responseId: response.id,
        questionId: a.questionId,
        answerText: a.answerText ?? null,
        answerOptions: a.answerOptions ?? null,
      }));

    if (answerRows.length > 0) {
      await SurveyAnswer.bulkCreate(answerRows);
    }

    res.status(201).json({ success: true, responseId: response.id });
  }),
);

// ── SUPERADMIN middleware ─────────────────────────────────────────────────────
router.use(authenticate, requireRole('super_admin'));

// ── GET /surveys — list all surveys ─────────────────────────────────────────
router.get(
  '/',
  wrap(async (_req, res) => {
    const surveys = await Survey.findAll({
      attributes: [
        'id', 'slug', 'titleId', 'titleJa', 'status',
        'publishedAt', 'closedAt', 'isFeatured', 'createdAt', 'updatedAt',
        [fn('COUNT', col('responses.id')), 'responseCount'],
      ],
      include: [
        {
          model: SurveyResponse,
          as: 'responses',
          attributes: [],
        },
      ],
      group: ['Survey.id'],
      order: [['createdAt', 'DESC']],
    });

    res.json(surveys.map((s) => s.toJSON()));
  }),
);

// ── POST /surveys — create survey ────────────────────────────────────────────
router.post(
  '/',
  wrap(async (req, res) => {
    const { titleId, titleJa, descriptionId, descriptionJa, slug, publishedAt, closedAt, isFeatured } =
      req.body as {
        titleId: string;
        titleJa: string;
        descriptionId?: string;
        descriptionJa?: string;
        slug: string;
        publishedAt?: string | null;
        closedAt?: string | null;
        isFeatured?: number;
      };

    if (!titleId || !titleJa || !slug) {
      res.status(400).json({ error: 'MISSING_FIELDS', message: 'titleId, titleJa, slug are required.' });
      return;
    }

    const survey = await Survey.create({
      titleId,
      titleJa,
      descriptionId: descriptionId ?? null,
      descriptionJa: descriptionJa ?? null,
      slug,
      status: 'draft',
      publishedAt: publishedAt ? new Date(publishedAt) : null,
      closedAt: closedAt ? new Date(closedAt) : null,
      isFeatured: isFeatured ?? 0,
    });

    res.status(201).json(survey.toJSON());
  }),
);

// ── GET /surveys/:id — get survey with questions ─────────────────────────────
router.get(
  '/:id',
  wrap(async (req, res) => {
    const { id } = req.params;
    const survey = await Survey.findByPk(id, {
      include: [
        {
          model: SurveyQuestion,
          as: 'questions',
          order: [['sortOrder', 'ASC']],
        },
      ],
      order: [[{ model: SurveyQuestion, as: 'questions' }, 'sortOrder', 'ASC']],
    });

    if (!survey) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    res.json(survey.toJSON());
  }),
);

// ── PUT /surveys/:id — update survey ─────────────────────────────────────────
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { id } = req.params;
    const survey = await Survey.findByPk(id);
    if (!survey) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const {
      titleId, titleJa, descriptionId, descriptionJa, slug,
      status, publishedAt, closedAt, isFeatured,
    } = req.body as Partial<{
      titleId: string;
      titleJa: string;
      descriptionId: string | null;
      descriptionJa: string | null;
      slug: string;
      status: 'draft' | 'active' | 'closed';
      publishedAt: string | null;
      closedAt: string | null;
      isFeatured: number;
    }>;

    if (titleId !== undefined) survey.titleId = titleId;
    if (titleJa !== undefined) survey.titleJa = titleJa;
    if (descriptionId !== undefined) survey.descriptionId = descriptionId;
    if (descriptionJa !== undefined) survey.descriptionJa = descriptionJa;
    if (slug !== undefined) survey.slug = slug;
    if (status !== undefined) survey.status = status;
    if (publishedAt !== undefined) survey.publishedAt = publishedAt ? new Date(publishedAt) : null;
    if (closedAt !== undefined) survey.closedAt = closedAt ? new Date(closedAt) : null;
    if (isFeatured !== undefined) survey.isFeatured = isFeatured;

    await survey.save();
    res.json(survey.toJSON());
  }),
);

// ── DELETE /surveys/:id ───────────────────────────────────────────────────────
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { id } = req.params;
    const survey = await Survey.findByPk(id);
    if (!survey) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    await survey.destroy();
    res.status(204).end();
  }),
);

// ── POST /surveys/:id/questions — add question ───────────────────────────────
router.post(
  '/:id/questions',
  wrap(async (req, res) => {
    const { id } = req.params;
    const survey = await Survey.findByPk(id);
    if (!survey) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const { type, questionId, questionJa, required, options, sortOrder } = req.body as {
      type: QuestionType;
      questionId: string;
      questionJa: string;
      required?: number;
      options?: QuestionOption[] | null;
      sortOrder?: number;
    };

    if (!type || !questionId || !questionJa) {
      res.status(400).json({ error: 'MISSING_FIELDS' });
      return;
    }

    const maxOrder = await SurveyQuestion.max<number, SurveyQuestion>('sortOrder', {
      where: { surveyId: id },
    });

    const question = await SurveyQuestion.create({
      surveyId: id,
      type,
      questionId,
      questionJa,
      required: required ?? 1,
      options: options ?? null,
      sortOrder: sortOrder ?? ((maxOrder ?? 0) + 1),
    });

    res.status(201).json(question.toJSON());
  }),
);

// ── PUT /surveys/:id/questions/:qid — update question ────────────────────────
router.put(
  '/:id/questions/:qid',
  wrap(async (req, res) => {
    const { id, qid } = req.params;
    const question = await SurveyQuestion.findOne({ where: { id: qid, surveyId: id } });
    if (!question) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const { type, questionId, questionJa, required, options, sortOrder } = req.body as Partial<{
      type: QuestionType;
      questionId: string;
      questionJa: string;
      required: number;
      options: QuestionOption[] | null;
      sortOrder: number;
    }>;

    if (type !== undefined) question.type = type;
    if (questionId !== undefined) question.questionId = questionId;
    if (questionJa !== undefined) question.questionJa = questionJa;
    if (required !== undefined) question.required = required;
    if (options !== undefined) question.options = options;
    if (sortOrder !== undefined) question.sortOrder = sortOrder;

    await question.save();
    res.json(question.toJSON());
  }),
);

// ── DELETE /surveys/:id/questions/:qid ───────────────────────────────────────
router.delete(
  '/:id/questions/:qid',
  wrap(async (req, res) => {
    const { id, qid } = req.params;
    const question = await SurveyQuestion.findOne({ where: { id: qid, surveyId: id } });
    if (!question) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    await question.destroy();
    res.status(204).end();
  }),
);

// ── GET /surveys/:id/stats ────────────────────────────────────────────────────
router.get(
  '/:id/stats',
  wrap(async (req, res) => {
    const { id } = req.params;
    const survey = await Survey.findByPk(id);
    if (!survey) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const totalResponses = await SurveyResponse.count({ where: { surveyId: id } });

    const questions = await SurveyQuestion.findAll({
      where: { surveyId: id },
      order: [['sortOrder', 'ASC']],
    });

    // Fetch all answers for this survey in one query
    const allAnswers = await SurveyAnswer.findAll({
      include: [
        {
          model: SurveyResponse,
          as: 'response',
          where: { surveyId: id },
          attributes: ['submittedAt'],
        },
      ],
      attributes: ['questionId', 'answerText', 'answerOptions'],
    });

    const questionStats = questions.map((q) => {
      const qAnswers = allAnswers.filter((a) => a.questionId === q.id);

      if (q.type === 'single' || q.type === 'multiple' || q.type === 'rating') {
        // Tally option values
        const tally = new Map<string, number>();
        for (const a of qAnswers) {
          const opts: string[] = Array.isArray(a.answerOptions) ? a.answerOptions : [];
          for (const v of opts) {
            tally.set(v, (tally.get(v) ?? 0) + 1);
          }
        }

        const optionStats = (q.options ?? []).map((opt) => {
          const count = tally.get(opt.value) ?? 0;
          return {
            value: opt.value,
            labelId: opt.labelId,
            labelJa: opt.labelJa,
            count,
            pct: totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0,
          };
        });

        return {
          questionId: q.id,
          type: q.type,
          questionJa: q.questionJa,
          questionTextId: q.questionId,
          responseCount: qAnswers.length,
          options: optionStats,
        };
      } else {
        // text / textarea
        const texts = qAnswers
          .filter((a) => a.answerText && a.answerText.trim().length > 0)
          .map((a) => ({
            text: a.answerText!,
            submittedAt: (a as SurveyAnswer & { response?: { submittedAt: Date } }).response?.submittedAt ?? null,
          }));

        return {
          questionId: q.id,
          type: q.type,
          questionJa: q.questionJa,
          questionTextId: q.questionId,
          responseCount: texts.length,
          texts,
        };
      }
    });

    res.json({
      surveyId: id,
      totalResponses,
      questions: questionStats,
    });
  }),
);

// ── GET /surveys/:id/responses — paginated individual responses ──────────────
router.get(
  '/:id/responses',
  wrap(async (req, res) => {
    const { id } = req.params;
    const survey = await Survey.findByPk(id);
    if (!survey) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'),  10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));

    const total = await SurveyResponse.count({ where: { surveyId: id } });

    const responses = await SurveyResponse.findAll({
      where: { surveyId: id },
      include: [{ model: SurveyAnswer, as: 'answers', attributes: ['questionId', 'answerText', 'answerOptions'] }],
      order: [['submittedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: responses.map((r) => r.toJSON()),
    });
  }),
);

// ── GET /surveys/:id/export.csv — CSV download ───────────────────────────────
router.get(
  '/:id/export.csv',
  wrap(async (req, res) => {
    const { id } = req.params;
    const survey = await Survey.findByPk(id);
    if (!survey) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const questions = await SurveyQuestion.findAll({
      where: { surveyId: id },
      order: [['sortOrder', 'ASC']],
    });

    const responses = await SurveyResponse.findAll({
      where: { surveyId: id },
      include: [{ model: SurveyAnswer, as: 'answers', attributes: ['questionId', 'answerText', 'answerOptions'] }],
      order: [['submittedAt', 'ASC']],
    });

    const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

    const headers = [
      '回答日時',
      ...questions.map((q) => `Q${q.sortOrder} ${q.questionJa.slice(0, 30)}`),
    ];
    const csvRows: string[] = [headers.map(esc).join(',')];

    for (const resp of responses) {
      const respJson = resp.toJSON() as unknown as { submittedAt: string; answers?: { questionId: string; answerText: string | null; answerOptions: string[] | null }[] };
      const answerMap = new Map((respJson.answers ?? []).map((a) => [a.questionId, a]));

      const row = [
        new Date(respJson.submittedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        ...questions.map((q) => {
          const a = answerMap.get(q.id);
          if (!a) return '';
          if (a.answerText) return a.answerText;
          if (Array.isArray(a.answerOptions) && a.answerOptions.length > 0) {
            const opts = (q.options as { value: string; labelJa: string }[] | null) ?? [];
            return a.answerOptions
              .map((v) => opts.find((o) => o.value === v)?.labelJa ?? v)
              .join('、');
          }
          return '';
        }),
      ];
      csvRows.push(row.map(esc).join(','));
    }

    const bom = '﻿';
    const csv = bom + csvRows.join('\r\n');
    const filename = `survey-${survey.slug ?? id}-responses.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }),
);

export default router;
