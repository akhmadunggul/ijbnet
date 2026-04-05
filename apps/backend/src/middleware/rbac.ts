import { Request, Response, NextFunction } from 'express';
import { isUUID } from 'validator';
import { AuditLog } from '../db/models/index';
import type { UserRole } from '@ijbnet/shared';

const PII_ROLES: UserRole[] = ['admin', 'manager', 'recruiter', 'super_admin'];

/**
 * Middleware that logs PII access for admin/manager/recruiter/super_admin.
 * Attach after authenticate() on routes that return candidate PII.
 */
export function auditCandidateAccess(action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    if (!user || !PII_ROLES.includes(user.role as UserRole)) {
      next();
      return;
    }

    const targetCandidateId = req.params['candidateId'] ?? req.params['id'] ?? null;
    const validTarget =
      targetCandidateId && isUUID(targetCandidateId) ? targetCandidateId : null;

    try {
      await AuditLog.create({
        userId: user.sub,
        action,
        entityType: 'candidate',
        entityId: validTarget ?? undefined,
        targetCandidateId: validTarget ?? undefined,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        payload: null,
      });
    } catch (err) {
      // Audit failure must not block the request — log and continue
      console.error('Audit log write failed:', err);
    }

    next();
  };
}

/**
 * Validate that :candidateId / :id param is a valid UUID v4.
 */
export function validateUuidParam(paramName = 'id') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (!value || !isUUID(value)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: `Invalid ${paramName}: must be a valid UUID.` });
      return;
    }
    next();
  };
}
