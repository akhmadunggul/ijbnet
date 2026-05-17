import path from 'path';
import fs from 'fs';

// Load .env from monorepo root when not in production
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.join(__dirname, '../../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '3001'), 10),
  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),

  DB_HOST: optional('DB_HOST', 'localhost'),
  DB_PORT: parseInt(optional('DB_PORT', '3306'), 10),
  DB_NAME: optional('DB_NAME', 'ijbnet_db'),
  DB_USER: optional('DB_USER', 'ijbnet'),
  DB_PASS: optional('DB_PASS', 'changeme'),

  JWT_SECRET: optional('JWT_SECRET', 'changeme-min-32-chars-random-string'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '15m'),
  JWT_REFRESH_SECRET: optional('JWT_REFRESH_SECRET', 'changeme-min-32-chars-different-string'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '7d'),

  SESSION_SECRET: optional('SESSION_SECRET', 'changeme-min-32-chars-random-string'),

  GOOGLE_CLIENT_ID: optional('GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET', ''),
  GOOGLE_CALLBACK_URL: optional('GOOGLE_CALLBACK_URL', 'http://localhost:3001/api/auth/google/callback'),

  ENCRYPTION_KEY: optional('ENCRYPTION_KEY', '0'.repeat(64)),

  UPLOADS_DIR: optional('UPLOADS_DIR', path.join(__dirname, '../../uploads')),

  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),

  SMTP_HOST: optional('SMTP_HOST', ''),
  SMTP_PORT: parseInt(optional('SMTP_PORT', '587'), 10),
  SMTP_USER: optional('SMTP_USER', ''),
  SMTP_PASS: optional('SMTP_PASS', ''),
  EMAIL_FROM: optional('EMAIL_FROM', 'noreply@ijbnet.org'),
} as const;

export type Config = typeof config;

// Validate encryption key length at startup
const keyHex = config.ENCRYPTION_KEY;
if (keyHex.length !== 64) {
  throw new Error(`ENCRYPTION_KEY must be 64 hex chars (32 bytes). Got ${keyHex.length}.`);
}

function requireInProd(key: keyof typeof config): void {
  if (config.NODE_ENV === 'production' && !config[key]) {
    throw new Error(`${key} is required in production`);
  }
}
requireInProd('JWT_SECRET');
requireInProd('JWT_REFRESH_SECRET');
requireInProd('DB_PASS');
requireInProd('SESSION_SECRET');
