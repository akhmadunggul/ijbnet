import { Router } from 'express';
import geoip from 'geoip-lite';
import { redisClient } from '../utils/redis';

const router = Router();

const TOTAL_KEY = 'stats:access:total';
const COUNTRY_KEY = 'stats:access:countries';

// POST /api/stats/hit — one call per login-page load, no auth required
router.post('/hit', async (req, res) => {
  try {
    const raw = req.ip ?? '';
    const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
    const geo = geoip.lookup(ip);
    const country = geo?.country || 'XX';

    await Promise.all([
      redisClient.incr(TOTAL_KEY),
      redisClient.hIncrBy(COUNTRY_KEY, country, 1),
    ]);
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// GET /api/stats/access — public; returns total visits + per-country breakdown
router.get('/access', async (_req, res) => {
  try {
    const [total, countries] = await Promise.all([
      redisClient.get(TOTAL_KEY),
      redisClient.hGetAll(COUNTRY_KEY),
    ]);

    const breakdown = Object.entries(countries ?? {})
      .map(([country, count]) => ({ country, count: parseInt(count, 10) }))
      .sort((a, b) => b.count - a.count);

    res.json({ total: parseInt(total ?? '0', 10), breakdown });
  } catch {
    res.json({ total: 0, breakdown: [] });
  }
});

export default router;
