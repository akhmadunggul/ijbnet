import { Notification } from '../db/models/index';
import { User } from '../db/models/User';
import type { UserRole } from '@ijbnet/shared';

export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body: string,
  referenceType?: string,
  referenceId?: string,
): Promise<void> {
  await Notification.create({
    userId,
    type,
    title,
    body,
    referenceType: referenceType ?? null,
    referenceId: referenceId ?? null,
  });
}

export async function notifyByRole(
  role: UserRole,
  type: string,
  title: string,
  body: string,
  referenceType?: string,
  referenceId?: string,
): Promise<void> {
  const users = await User.findAll({ where: { role, isActive: true } });
  await Promise.all(
    users.map((u) =>
      notifyUser(u.id, type, title, body, referenceType, referenceId),
    ),
  );
}
