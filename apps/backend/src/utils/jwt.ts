import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { config } from '../config';

export interface JwtPayload {
  sub: string;   // user id
  role: string;
  email: string;
  mfaVerified?: boolean;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, jti: randomBytes(16).toString('hex') }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  // jti ensures uniqueness even when two tokens are issued within the same second,
  // preventing the blacklist key collision that would occur with identical iat values.
  return jwt.sign({ ...payload, jti: randomBytes(16).toString('hex') }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as JwtPayload;
}

export function decodeToken(token: string): JwtPayload | null {
  return jwt.decode(token) as JwtPayload | null;
}

/** Returns seconds until token expiry (may be negative if already expired) */
export function ttlSeconds(payload: JwtPayload): number {
  if (!payload.exp) return 0;
  return payload.exp - Math.floor(Date.now() / 1000);
}
