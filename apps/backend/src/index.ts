import './config'; // Load env vars first
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB } from './db/connection';
import { connectRedis } from './utils/redis';
import './db/models/index'; // Initialize all models and associations
import passport from './config/passport';
import apiRouter from './routes/index';
import { errorHandler, notFound } from './middleware/errorHandler';
import { config } from './config';

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
    // Skip rate limiting for loopback — allows server-side load testing via localhost:3001
    skip: (req) => {
      const ip = req.ip ?? '';
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    },
  }),
);


// ── Middleware ────────────────────────────────────────────────────────────────
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
async function start(): Promise<void> {
  try {
    await connectDB();
    await connectRedis();

    app.listen(config.PORT, () => {
      console.log(`Backend running on http://localhost:${config.PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
