import app from './app'; // Express app (middleware + routes)
import cluster from 'cluster';
import { connectDB, sequelize } from './db/connection';
import { connectSurveyDB } from './db/survey-connection';
import { runSurveyMigrations } from './db/runSurveyMigrations';
import { connectRedis } from './utils/redis';
import { config } from './config';
import { recordFatal, recordHighMemory, snapshotMetrics, initMonitorDb } from './utils/monitor';
import { setCompletenessMode, type CompletenessMode } from './utils/completeness';
import { checkDbSchema } from './utils/schemaCheck';
import { GlobalSettings } from './db/models/index';

// ── Startup ───────────────────────────────────────────────────────────────────
// ── Process-level safety net ──────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err);
  recordFatal('uncaughtException', err);
  // Give the alert a moment to dispatch before the process exits
  setTimeout(() => process.exit(1), 3000);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason);
  recordFatal('unhandledRejection', reason);
});

// Memory watchdog — alert when heap exceeds 85 % of Node's --max-old-space-size
const MEM_LIMIT_MB = Math.round((process.env['NODE_OPTIONS'] ?? '')
  .match(/--max-old-space-size=(\d+)/)?.[1]
  ? parseInt((process.env['NODE_OPTIONS'] ?? '').match(/--max-old-space-size=(\d+)/)![1]!, 10)
  : 1536);

setInterval(() => {
  const heapMb = Math.round(process.memoryUsage().heapUsed / 1_048_576);
  if (heapMb > MEM_LIMIT_MB * 0.85) recordHighMemory(heapMb, MEM_LIMIT_MB);
}, 60_000).unref();

async function start(): Promise<void> {
  try {
    await connectDB();
    await checkDbSchema(sequelize);
    initMonitorDb(sequelize);

    await connectSurveyDB();
    await runSurveyMigrations();

    // Restore persisted global settings into in-process caches
    try {
      const cRow = await GlobalSettings.findOne({ where: { key: 'completeness_mode' } });
      if (cRow) {
        const val = (cRow.toJSON() as unknown as Record<string, unknown>)['value'] as string;
        if (val === 'cv' || val === 'legacy') setCompletenessMode(val as CompletenessMode);
      }
    } catch { /* use default 'legacy' */ }

    await connectRedis();

    app.listen(config.PORT, () => {
      console.log(`Backend running on http://localhost:${config.PORT}`);
    });

    // Metrics snapshot every minute — only on worker 1 (or non-cluster) to
    // avoid N duplicate DB writes when running in cluster mode.
    const isWorker1 = !cluster.isWorker || cluster.worker?.id === 1;
    if (isWorker1) {
      setInterval(() => snapshotMetrics(), 60_000).unref();
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
