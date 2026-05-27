import { createClient } from 'redis';
import { config } from '../config';

export const redisClient = createClient({ url: config.REDIS_URL });

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  console.log('Redis connected.');
}

/** Blacklist an access token until its natural expiry */
export async function blacklistToken(token: string, ttlSec: number): Promise<void> {
  if (ttlSec <= 0) return;
  await redisClient.set(`bl:${token}`, '1', { EX: ttlSec });
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const val = await redisClient.get(`bl:${token}`);
  return val !== null;
}

// ── Generic cache helpers ──────────────────────────────────────────────────────

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await redisClient.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  try {
    await redisClient.set(key, value, { EX: ttlSec });
  } catch {
    // Redis unavailable — degrade gracefully
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await redisClient.del(keys);
  } catch {
    // ignore
  }
}

/**
 * Audit log debounce. Returns true (skip write) if this userId+target+action
 * was already logged within ttlSec seconds. Uses SET NX so the first caller
 * within the window writes the log; subsequent callers are suppressed.
 */
export async function auditDebounced(
  userId: string,
  targetCandidateId: string | null,
  action: string,
  ttlSec = 30,
): Promise<boolean> {
  const key = `al:${userId}:${targetCandidateId ?? '_'}:${action}`;
  try {
    const result = await redisClient.set(key, '1', { NX: true, EX: ttlSec });
    return result === null; // null → key already existed → debounced
  } catch {
    return false; // Redis down → don't suppress the write
  }
}
