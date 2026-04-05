import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { isUUID } from 'validator';
import { authenticate } from '../middleware/auth';
import { auditCandidateAccess, validateUuidParam } from '../middleware/rbac';
import { BatchCandidate, Batch, Candidate, User } from '../db/models/index';
import { config } from '../config';

const router = Router();

/**
 * GET /api/uploads/candidates/:candidateId/:filename
 * JWT required. RBAC:
 *  - candidate: own profile only
 *  - recruiter: candidates in their allocated batch (company scoped)
 *  - admin/manager/super_admin: full access (logged)
 */
router.get(
  '/candidates/:candidateId/:filename',
  authenticate,
  validateUuidParam('candidateId'),
  auditCandidateAccess('VIEW_CANDIDATE_PHOTO'),
  async (req: Request, res: Response): Promise<void> => {
    const { candidateId, filename } = req.params as { candidateId: string; filename: string };
    const user = req.user!;

    // Filename safety: only allow closeup.webp or fullbody.webp
    if (!/^(closeup|fullbody)\.webp$/.test(filename)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    // RBAC checks
    if (user.role === 'candidate') {
      const candidate = await Candidate.findOne({ where: { userId: user.sub } });
      if (!candidate || candidate.id !== candidateId) {
        res.status(403).json({ error: 'FORBIDDEN' });
        return;
      }
    } else if (user.role === 'recruiter') {
      // Recruiter may only access candidates within their company's allocated batch
      const recruiterUser = await User.findByPk(user.sub, { attributes: ['companyId'] });
      if (!recruiterUser?.companyId) {
        res.status(403).json({ error: 'FORBIDDEN' });
        return;
      }
      const allocation = await BatchCandidate.findOne({
        where: { candidateId },
        include: [
          {
            model: Batch,
            as: 'batch',
            where: { companyId: recruiterUser.companyId },
            required: true,
          },
        ],
      });
      if (!allocation) {
        res.status(403).json({ error: 'FORBIDDEN' });
        return;
      }
    }
    // admin/manager/super_admin: already audited above, proceed

    const safe = candidateId.replace(/[^a-zA-Z0-9-]/g, '');
    const filePath = path.join(config.UPLOADS_DIR, 'candidates', safe, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath);
  },
);

export default router;
