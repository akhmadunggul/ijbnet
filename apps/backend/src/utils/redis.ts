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
