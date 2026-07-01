import { Router } from 'express';
import geoip from 'geoip-lite';
import { redisClient } from '../utils/redis';

const router = Router();

const TOTAL_KEY = 'stats:access:total';
const COUNTRY_KEY = 'stats:access:countries';

function resolveClientIp(req: import('express').Request): string {
  // X-Forwarded-For set by Caddy contains the real client IP as the leftmost entry.
  // Prefer it over req.ip which may resolve to a Docker bridge address (172.x.x.x)
  // when multiple internal hops are in play despite trust proxy: 1.
  const xff = req.headers['x-forwarded-for'];
  const raw = (typeof xff === 'string' ? xff.split(',')[0] : req.ip ?? '').trim();
  return raw.replace(/^::ffff:/, '');
}

// POST /api/stats/hit — one call per login-page load, no auth required
router.post('/hit', async (req, res) => {
  try {
    const ip = resolveClientIp(req);
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
