import { Router } from 'express';
import authRouter from './auth';
import uploadsRouter from './uploads';
import candidatesRouter from './candidates';
import notificationsRouter from './notifications';
import adminRouter from './admin';
import adminImportRouter from './adminImport';
import recruiterRouter from './recruiter';
import managerRouter from './manager';
import superadminRouter from './superadmin';
import exportRouter from './export';
import translateRouter from './translate';
import surveysRouter from './surveys';
import jpLearningRouter from './jpLearning';
import { sequelize } from '../db/connection';
import { redisClient } from '../utils/redis';
import { getMetrics, recordDbError } from '../utils/monitor';
import { register } from '../utils/metrics';

const router = Router();

router.use('/auth', authRouter);
router.use('/uploads', uploadsRouter);
router.use('/candidates', candidatesRouter);
router.use('/notifications', notificationsRouter);
router.use('/admin', adminRouter);
router.use('/admin', adminImportRouter);
router.use('/recruiter', recruiterRouter);
router.use('/manager', managerRouter);
router.use('/superadmin', superadminRouter);
router.use('/export', exportRouter);
router.use('/translate', translateRouter);
router.use('/surveys', surveysRouter);
router.use('/jp', jpLearningRouter);

// Prometheus scrape endpoint — internal Docker network only (blocked externally by Caddy)
router.get('/metrics', async (req, res) => {
  // req.ip may be an IPv4-mapped IPv6 address (::ffff:172.x.x.x) from Docker.
  // Strip the ::ffff: prefix before checking to normalise all formats.
  const raw = req.ip ?? '';
  const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
  const internal =
    ip === '127.0.0.1' || ip === '::1' ||
    ip.startsWith('172.') || ip.startsWith('10.') || ip.startsWith('192.168.');
  if (!internal) {
    res.status(403).end();
    return;
  }
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check — returns rich status for ops dashboards and uptime monitors
router.get('/health', async (_req, res) => {
  let dbStatus = 'ok', dbMs = 0;
  try {
    const t0 = Date.now();
    await sequelize.authenticate();
    dbMs = Date.now() - t0;
  } catch (err) {
    dbStatus = 'error';
    recordDbError(err as Error);
  }

  let redisStatus = 'ok', redisMs = 0;
  try {
    const t0 = Date.now();
    await redisClient.ping();
    redisMs = Date.now() - t0;
  } catch {
    redisStatus = 'error';
  }

  const mem = process.memoryUsage();
  const metrics = getMetrics();
  const degraded = dbStatus !== 'ok' || redisStatus !== 'ok' || metrics.errors5xx_1h >= 10;

  res.status(degraded ? 503 : 200).json({
    status: degraded ? 'degraded' : 'ok',
    uptime:  Math.floor(process.uptime()),
    memory: {
      heapUsedMb:  Math.round(mem.heapUsed  / 1_048_576),
      heapTotalMb: Math.round(mem.heapTotal / 1_048_576),
      rssMb:       Math.round(mem.rss       / 1_048_576),
    },
    db:    { status: dbStatus,    responseMs: dbMs },
    redis: { status: redisStatus, responseMs: redisMs },
    metrics,
    ts: new Date().toISOString(),
  });
});

export default router;
