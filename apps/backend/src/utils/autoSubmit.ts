import { v4 as uuidv4 } from 'uuid';
import { Candidate, User, Notification } from '../db/models/index';
import { Op } from 'sequelize';
import { calcCompleteness } from './completeness';
import { candidateIncludes } from './candidateIncludes';
import { recordTimelineEvent } from './timeline';

/**
 * If the candidate is 100% complete, has consent, and is still 'incomplete',
 * auto-submit their profile. Safe to call after any profile save — no-ops
 * when conditions aren't met.
 *
 * Returns true if the candidate was submitted, false otherwise.
 */
export async function autoSubmitIfComplete(
  candidateId: string,
  actorUserId: string,
  actorRole: string,
): Promise<boolean> {
  // Quick pre-check to avoid expensive association fetch when not needed
  const quick = await Candidate.findByPk(candidateId, {
    attributes: ['id', 'profileStatus', 'consentGiven', 'lpkId'],
  });
  if (
    !quick ||
    quick.profileStatus !== 'incomplete' ||
    !quick.consentGiven ||
    !quick.lpkId
  ) {
    return false;
  }

  // Full fetch with all associations needed for completeness
  const candidate = await Candidate.findByPk(candidateId, {
    include: candidateIncludes(),
  });
  if (!candidate) return false;

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const { pct } = calcCompleteness(data);
  if (pct < 100) return false;

  await candidate.update({ profileStatus: 'submitted' });

  // Notify managers + admins for this candidate's LPK
  const recipients = await User.findAll({
    where: {
      isActive: true,
      [Op.or]: [
        { role: 'manager' },
        { role: 'admin', lpkId: candidate.lpkId },
      ],
    },
    attributes: ['id'],
  });
  if (recipients.length > 0) {
    await Notification.bulkCreate(
      recipients.map((u) => ({
        id: uuidv4(),
        userId: u.id,
        type: 'PROFILE_SUBMITTED',
        title: `Profil lengkap: ${candidate.fullName}`,
        body: `Kandidat ${candidate.candidateCode} telah mencapai kelengkapan 100% dan profil otomatis diajukan.`,
        isRead: false,
        referenceType: 'candidate',
        referenceId: candidate.id,
      })),
    );
  }

  await recordTimelineEvent(candidateId, 'profile_submitted', actorUserId, actorRole, {
    auto: true,
  });

  return true;
}
