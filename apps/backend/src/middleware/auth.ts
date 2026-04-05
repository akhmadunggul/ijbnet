import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { isTokenBlacklisted } from '../utils/redis';
import { User } from '../db/models/index';
import type { UserRole } from '@ijbnet/shared';

// AuthRequest is kept for backwards compat but Express.Request is now augmented
export type AuthRequest = Request;

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token has been revoked.' });
      return;
    }

    const payload = verifyAccessToken(token);

    // Session invalidation: check if user was deactivated after token was issued
    if (payload.iat) {
      const user = await User.findByPk(payload.sub, { attributes: ['isActive', 'deactivatedAt', 'mfaSecret'] });
      if (!user || !user.isActive) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Account is inactive.' });
        return;
      }
      if (user.deactivatedAt && user.deactivatedAt > new Date(payload.iat * 1000)) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Session invalidated.' });
        return;
      }
      // MFA enforcement for super_admin
      if (payload.role === 'super_admin' && user.mfaSecret && !payload.mfaVerified) {
        res.status(403).json({ error: 'MFA_REQUIRED' });
        return;
      }
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token.' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions.' });
      return;
    }
    next();
  };
}
