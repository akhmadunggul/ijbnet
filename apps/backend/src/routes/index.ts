import { Router } from 'express';
import authRouter from './auth';
import uploadsRouter from './uploads';
import candidatesRouter from './candidates';
import notificationsRouter from './notifications';
import adminRouter from './admin';
import recruiterRouter from './recruiter';
import managerRouter from './manager';
import superadminRouter from './superadmin';
import exportRouter from './export';

const router = Router();

router.use('/auth', authRouter);
router.use('/uploads', uploadsRouter);
router.use('/candidates', candidatesRouter);
router.use('/notifications', notificationsRouter);
router.use('/admin', adminRouter);
router.use('/recruiter', recruiterRouter);
router.use('/manager', managerRouter);
router.use('/superadmin', superadminRouter);
router.use('/export', exportRouter);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

export default router;
