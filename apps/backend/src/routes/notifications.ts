import { Router as ExpressRouter, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { isUUID } from 'validator';
import { authenticate } from '../middleware/auth';
import { Notification } from '../db/models/index';

const router = ExpressRouter();

router.use(authenticate);

// GET /api/notifications?limit=20&unread=true
router.get('/', async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '20', 10), 100);
  const unreadOnly = req.query['unread'] === 'true';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: req.user!.sub };
  if (unreadOnly) where['isRead'] = false;

  const notifications = await Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
  });

  const unreadCount = await Notification.count({ where: { userId: req.user!.sub, isRead: false } });

  res.json({ notifications: notifications.map((n) => n.toJSON()), unreadCount });
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
  const count = await Notification.count({ where: { userId: req.user!.sub, isRead: false } });
  res.json({ count });
});

// PATCH /api/notifications/read-all  (must be before /:id/read)
router.patch('/read-all', async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
  await Notification.update(
    { isRead: true },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { where: { userId: req.user!.sub, isRead: false } as any },
  );
  res.json({ message: 'All notifications marked as read.' });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
  const { id } = req.params as { id: string };
  if (!isUUID(id)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid notification id.' });
    return;
  }

  const notification = await Notification.findOne({ where: { id, userId: req.user!.sub } });
  if (!notification) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  await notification.update({ isRead: true });
  res.json({ notification: notification.toJSON() });
});

export default router;
