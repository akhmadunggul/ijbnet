import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { translateId2JaDetailed, getDeepSeekApiKey } from '../utils/translate';

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

// ── Rate limiters ─────────────────────────────────────────────────────────────

// Per-user: 15 live translation requests per minute.
// Keyed by JWT sub (set by authenticate middleware which runs first).
const perUserLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req.user?.sub ?? req.ip ?? 'anon'),
  handler: (_req, res) => {
    res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many translation requests. Please wait a moment.' });
  },
});

// Global guard: 120 requests per minute across all users.
// Prevents a spike from one user from exhausting the API key for everyone.
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => 'translate:global',
  handler: (_req, res) => {
    res.status(429).json({ error: 'RATE_LIMITED_GLOBAL', message: 'Translation service is busy. Please try again shortly.' });
  },
});

// ── Route ─────────────────────────────────────────────────────────────────────

const router = Router();

router.post('/', authenticate, perUserLimiter, globalLimiter, wrap(async (req, res) => {
  const { text } = req.body as { text: unknown };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'INVALID_INPUT' });
    return;
  }

  if (text.length > 2000) {
    res.status(400).json({ error: 'TEXT_TOO_LONG' });
    return;
  }

  const apiKey = await getDeepSeekApiKey();
  if (!apiKey) {
    res.status(503).json({ error: 'TRANSLATION_UNAVAILABLE' });
    return;
  }

  const result = await translateId2JaDetailed(text, {
    userId: req.user!.sub,
    context: 'cv-live',
    timeoutMs: 20_000,
  });

  if (result.timedOut) {
    res.status(504).json({ error: 'TRANSLATION_TIMEOUT', message: 'Translation request timed out. Please try again.' });
    return;
  }

  if (!result.text) {
    res.status(502).json({ error: 'TRANSLATION_FAILED' });
    return;
  }

  res.json({ translated: result.text, latencyMs: result.latencyMs });
}));

export default router;
