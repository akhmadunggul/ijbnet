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
  await CandidateTimeline.create({
    id: uuidv4(),
    candidateId,
    event,
    actorId: actorId ?? null,
    actorRole: actorRole ?? null,
    metadata: metadata ?? null,
    occurredAt: occurredAt ?? new Date(),
  });
}
