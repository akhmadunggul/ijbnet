import './config'; // load env vars before anything else
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import './db/models/index';
import './db/survey-models/index';
import passport from './config/passport';
import apiRouter from './routes/index';
import { errorHandler, notFound } from './middleware/errorHandler';
import { config } from './config';
import { record429, recordHttpRequest } from './utils/monitor';
import { httpRequestsTotal, httpRequestDuration, errors5xxTotal, normalizeRoute } from './utils/metrics';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:              ["'self'"],
      scriptSrc:               ["'self'"],
      styleSrc:                ["'self'"],
      imgSrc:                  ["'self'", "data:"],
      connectSrc:              ["'self'"],
      fontSrc:                 ["'self'"],
      objectSrc:               ["'none'"],
      frameSrc:                ["'none'"],
      frameAncestors:          ["'none'"],
      baseUri:                 ["'self'"],
      formAction:              ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
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
}));

app.use((_req, res, next) => {
  const start = Date.now();
  const route = normalizeRoute(_req.url);
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const labels = { method: _req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationMs / 1000);
    if (res.statusCode >= 500) errors5xxTotal.inc();
    recordHttpRequest(durationMs, res.statusCode);
  });
  next();
});
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
