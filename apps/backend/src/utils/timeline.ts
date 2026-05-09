import { v4 as uuidv4 } from 'uuid';
import { CandidateTimeline, TimelineEventType } from '../db/models/CandidateTimeline';

export async function recordTimelineEvent(
  candidateId: string,
  event: TimelineEventType,
  actorId?: string | null,
  actorRole?: string | null,
  metadata?: Record<string, unknown> | null,
  occurredAt?: Date,
): Promise<void> {
  const now = occurredAt ?? new Date();

  // Stamp durationHours on the previous event for this candidate
  const prev = await CandidateTimeline.findOne({
    where: { candidateId },
    order: [['occurredAt', 'DESC']],
  });
  if (prev) {
    const durationHours = (now.getTime() - new Date(prev.occurredAt).getTime()) / 3_600_000;
    await prev.update({ durationHours: parseFloat(durationHours.toFixed(4)) });
  }

  await CandidateTimeline.create({
    id: uuidv4(),
    candidateId,
    event,
    actorId: actorId ?? null,
    actorRole: actorRole ?? null,
    metadata: metadata ?? null,
    occurredAt: now,
    durationHours: null,
  });
}

/** Hours elapsed since a given date */
export function currentAgeHours(occurredAt: Date): number {
  return parseFloat(
    ((Date.now() - new Date(occurredAt).getTime()) / 3_600_000).toFixed(4),
  );
}
