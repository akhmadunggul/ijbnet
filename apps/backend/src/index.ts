import './config'; // Load env vars first
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB, sequelize } from './db/connection';
import { connectRedis } from './utils/redis';
import './db/models/index'; // Initialize all models and associations
import passport from './config/passport';
import apiRouter from './routes/index';
import { errorHandler, notFound } from './middleware/errorHandler';
import { config } from './config';
import { record429, recordFatal, recordHighMemory, snapshotMetrics, recordHttpRequest, initMonitorDb } from './utils/monitor';

const app = express();

// Trust one proxy hop (Caddy) so req.ip resolves to the real client IP
// rather than the Caddy container IP. Required for per-IP rate limiting to work.
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 60 * 1000,      // 1-minute window
    max: 300,                  // 300 req/min per IP (~5 req/s burst)
    standardHeaders: true,
    legacyHeaders: false,
    // Skip for loopback and for authorised load-test runners carrying the
    // bypass key — prevents per-IP rate limiting from blocking K6 VUs that
    // all originate from a single external IP.
    skip: (req) => {
      const ip = req.ip ?? '';
      if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
      const bypassKey = config.LOAD_TEST_BYPASS_KEY;
      return Boolean(bypassKey && req.headers['x-load-test-key'] === bypassKey);
    },
    handler: (_req, res) => {
      record429('429:global');
      res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' });
    },
  }),
);


// ── Middleware ────────────────────────────────────────────────────────────────
// Response-time recorder — fires on every request after rate limiter
app.use((_req, res, next) => {
  const start = Date.now();
  res.on('finish', () => recordHttpRequest(Date.now() - start, res.statusCode));
  next();
});
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

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
    initMonitorDb(sequelize);
    await connectRedis();

    app.listen(config.PORT, () => {
      console.log(`Backend running on http://localhost:${config.PORT}`);
    });

    // Metrics snapshot every minute — populates charts in the monitor dashboard
    setInterval(() => snapshotMetrics(), 60_000).unref();
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
