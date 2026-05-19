import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

const router = Router();

router.post('/', authenticate, wrap(async (req, res) => {
  const { text, source = 'id', target = 'ja' } = req.body as {
    text: unknown;
    source?: string;
    target?: string;
  };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'INVALID_INPUT' });
    return;
  }

  if (text.length > 2000) {
    res.status(400).json({ error: 'TEXT_TOO_LONG' });
    return;
  }

  const libreUrl = process.env['LIBRETRANSLATE_URL'] ?? 'http://libretranslate:5000';

  const response = await fetch(`${libreUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text.trim(), source, target, format: 'text' }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    res.status(502).json({ error: 'TRANSLATION_FAILED' });
    return;
  }

  const data = await response.json() as { translatedText: string };
  res.json({ translated: data.translatedText });
}));

export default router;
