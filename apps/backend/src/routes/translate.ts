import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { translateId2Ja } from '../utils/translate';

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

const router = Router();

router.post('/', authenticate, wrap(async (req, res) => {
  const { text } = req.body as { text: unknown };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ error: 'INVALID_INPUT' });
    return;
  }

  if (text.length > 2000) {
    res.status(400).json({ error: 'TEXT_TOO_LONG' });
    return;
  }

  if (!process.env['DEEPSEEK_API_KEY']) {
    res.status(503).json({ error: 'TRANSLATION_UNAVAILABLE' });
    return;
  }

  const translated = await translateId2Ja(text);
  if (!translated) {
    res.status(502).json({ error: 'TRANSLATION_FAILED' });
    return;
  }

  res.json({ translated });
}));

export default router;
