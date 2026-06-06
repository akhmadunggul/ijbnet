import { Router } from 'express';
import { fn, col, Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireRole } from '../middleware/auth';
import { AbExperiment, AbAssignment, AbEvent, User } from '../db/models';
import type { AbTargeting } from '../db/models/AbExperiment';
import { isEligible, pickVariant } from '../utils/ab';

const router = Router();
router.use(authenticate);

// ── Any authenticated user ────────────────────────────────────────────────────

// Returns variant assignments for all active experiments the current user qualifies for.
// Creates assignment records on first call (deterministic — same result if re-run).
router.get('/assignments', async (req, res) => {
  const jwt = req.user!;
  const userId = jwt.sub;
  const now = new Date();

  const experiments = await AbExperiment.findAll({
    where: {
      status: 'active',
      [Op.and]: [
        { [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: now } }] },
        { [Op.or]: [{ endDate:   null }, { endDate:   { [Op.gte]: now } }] },
      ],
    },
  });

  // Only fetch lpkId from DB if any active experiment uses lpk scope
  const needsLpk = experiments.some(e => e.targeting.scope === 'lpk');
  let lpkId: string | null = null;
  if (needsLpk) {
    const dbUser = await User.findByPk(userId, { attributes: ['lpkId'] });
    lpkId = dbUser?.lpkId ?? null;
  }

  const result: Record<string, string> = {};

  for (const exp of experiments) {
    const expJson = exp.toJSON();
    if (!isEligible({ id: userId, role: jwt.role, lpkId }, expJson.targeting)) continue;

    let assignment = await AbAssignment.findOne({
      where: { experimentId: expJson.id, userId },
    });

    if (!assignment) {
      const variantKey = pickVariant(userId, expJson.id, expJson.variants);
      assignment = await AbAssignment.create({
        id: uuidv4(),
        experimentId: expJson.id,
        userId,
        variantKey,
      });
    }

    result[expJson.name] = assignment.variantKey;
  }

  res.json({ assignments: result });
});

// Records an experiment event for the current user (impression, conversion, custom).
router.post('/event', async (req, res) => {
  const user = req.user!;
  const { experimentName, event, metadata } = req.body as {
    experimentName?: string;
    event?: string;
    metadata?: Record<string, unknown>;
  };

  if (!experimentName || !event) {
    res.status(400).json({ error: 'experimentName and event are required' });
    return;
  }

  const userId = req.user!.sub;
  const exp = await AbExperiment.findOne({ where: { name: experimentName } });
  if (!exp) { res.status(404).json({ error: 'Experiment not found' }); return; }

  const assignment = await AbAssignment.findOne({
    where: { experimentId: exp.id, userId },
  });
  if (!assignment) { res.status(400).json({ error: 'User not assigned to this experiment' }); return; }

  await AbEvent.create({
    id: uuidv4(),
    experimentId: exp.id,
    userId,
    variantKey: assignment.variantKey,
    event,
    metadata: metadata ?? null,
  });

  res.json({ ok: true });
});

// ── Superadmin only ───────────────────────────────────────────────────────────

const adminRouter = Router();
adminRouter.use(requireRole('super_admin'));

// List all experiments
adminRouter.get('/experiments', async (_req, res) => {
  const experiments = await AbExperiment.findAll({ order: [['createdAt', 'DESC']] });

  // Attach total assignment count per experiment
  const counts = await AbAssignment.findAll({
    attributes: ['experimentId', [fn('COUNT', col('id')), 'total']],
    group: ['experimentId'],
    raw: true,
  }) as unknown as { experimentId: string; total: string }[];

  const countMap = Object.fromEntries(counts.map(c => [c.experimentId, parseInt(c.total, 10)]));

  res.json({
    experiments: experiments.map(e => ({
      ...e.toJSON(),
      totalAssignments: countMap[e.id] ?? 0,
    })),
  });
});

// Create experiment
adminRouter.post('/experiments', async (req, res) => {
  const { name, description, hypothesis, variants, targeting, metric, startDate, endDate } = req.body as {
    name?: string;
    description?: string;
    hypothesis?: string;
    variants?: { key: string; name: string; weight: number }[];
    targeting?: { scope: string };
    metric?: string;
    startDate?: string;
    endDate?: string;
  };

  if (!name || !variants?.length) {
    res.status(400).json({ error: 'name and variants are required' });
    return;
  }
  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
  if (totalWeight !== 100) {
    res.status(400).json({ error: 'Variant weights must sum to 100' });
    return;
  }

  const exp = await AbExperiment.create({
    id: uuidv4(),
    name,
    description: description ?? null,
    hypothesis: hypothesis ?? null,
    variants,
    targeting: (targeting as AbTargeting) ?? { scope: 'all' as const },
    metric: metric ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  });

  res.status(201).json({ experiment: exp.toJSON() });
});

// Get single experiment with per-variant results
adminRouter.get('/experiments/:id', async (req, res) => {
  const exp = await AbExperiment.findByPk(req.params.id);
  if (!exp) { res.status(404).json({ error: 'Not found' }); return; }

  const assignmentCounts = await AbAssignment.findAll({
    where: { experimentId: exp.id },
    attributes: ['variantKey', [fn('COUNT', col('id')), 'count']],
    group: ['variantKey'],
    raw: true,
  }) as unknown as { variantKey: string; count: string }[];

  const eventCounts = await AbEvent.findAll({
    where: { experimentId: exp.id },
    attributes: ['variantKey', 'event', [fn('COUNT', col('id')), 'count']],
    group: ['variantKey', 'event'],
    raw: true,
  }) as unknown as { variantKey: string; event: string; count: string }[];

  const assignMap = Object.fromEntries(assignmentCounts.map(r => [r.variantKey, parseInt(r.count, 10)]));

  const variants = exp.variants.map(v => {
    const assignments = assignMap[v.key] ?? 0;
    const events: Record<string, number> = {};
    for (const e of eventCounts.filter(r => r.variantKey === v.key)) {
      events[e.event] = parseInt(e.count, 10);
    }
    const conversions = exp.metric ? (events[exp.metric] ?? 0) : 0;
    return { ...v, assignments, events, conversionRate: assignments > 0 ? conversions / assignments : 0 };
  });

  res.json({ experiment: exp.toJSON(), variants });
});

// Update experiment (name/description/hypothesis/status/variants/targeting/metric/dates)
adminRouter.put('/experiments/:id', async (req, res) => {
  const exp = await AbExperiment.findByPk(req.params.id);
  if (!exp) { res.status(404).json({ error: 'Not found' }); return; }

  const { name, description, hypothesis, status, variants, targeting, metric, startDate, endDate } = req.body;

  if (variants !== undefined) {
    const total = (variants as { weight: number }[]).reduce((s, v) => s + v.weight, 0);
    if (total !== 100) { res.status(400).json({ error: 'Variant weights must sum to 100' }); return; }
  }

  await exp.update({
    ...(name        !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(hypothesis  !== undefined && { hypothesis }),
    ...(status      !== undefined && { status }),
    ...(variants    !== undefined && { variants }),
    ...(targeting   !== undefined && { targeting }),
    ...(metric      !== undefined && { metric }),
    ...(startDate   !== undefined && { startDate }),
    ...(endDate     !== undefined && { endDate }),
  });

  res.json({ experiment: exp.toJSON() });
});

// Delete experiment — only drafts
adminRouter.delete('/experiments/:id', async (req, res) => {
  const exp = await AbExperiment.findByPk(req.params.id);
  if (!exp) { res.status(404).json({ error: 'Not found' }); return; }
  if (exp.status !== 'draft') {
    res.status(400).json({ error: 'Only draft experiments can be deleted' });
    return;
  }
  await exp.destroy();
  res.json({ ok: true });
});

router.use('/admin', adminRouter);

export default router;
