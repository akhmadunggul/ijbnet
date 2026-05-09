import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type TimelineEventType =
  | 'registered'
  | 'consent_given'
  | 'profile_submitted'
  | 'profile_under_review'
  | 'profile_approved'
  | 'profile_rejected'
  | 'batch_allocated'
  | 'recruiter_selected'
  | 'interview_proposed'
  | 'interview_date_confirmed'
  | 'interview_scheduled'
  | 'manager_confirmed'
  | 'interview_passed'
  | 'interview_failed'
  | 'recruiter_accepted'
  | 'provisional_acceptance';

export interface CandidateTimelineAttributes {
  id: string;
  candidateId: string;
  event: TimelineEventType;
  actorId: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
  durationHours: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateTimelineCreationAttributes
  extends Optional<CandidateTimelineAttributes, 'id' | 'actorId' | 'actorRole' | 'metadata' | 'durationHours'> {}

export class CandidateTimeline
  extends Model<CandidateTimelineAttributes, CandidateTimelineCreationAttributes>
  implements CandidateTimelineAttributes {
  declare id: string;
  declare candidateId: string;
  declare event: TimelineEventType;
  declare actorId: string | null;
  declare actorRole: string | null;
  declare metadata: Record<string, unknown> | null;
  declare occurredAt: Date;
  declare durationHours: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidateTimeline(sequelize: Sequelize): void {
  CandidateTimeline.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      event: {
        type: DataTypes.ENUM(
          'registered',
          'consent_given',
          'profile_submitted',
          'profile_under_review',
          'profile_approved',
          'profile_rejected',
          'batch_allocated',
          'recruiter_selected',
          'interview_proposed',
          'interview_date_confirmed',
          'interview_scheduled',
          'manager_confirmed',
          'interview_passed',
          'interview_failed',
          'recruiter_accepted',
          'provisional_acceptance',
        ),
        allowNull: false,
      },
      actorId: { type: DataTypes.UUID, allowNull: true },
      actorRole: { type: DataTypes.STRING(50), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      occurredAt: { type: DataTypes.DATE, allowNull: false },
      durationHours: { type: DataTypes.DECIMAL(10, 4), allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      tableName: 'candidate_timeline_events',
      timestamps: true,
    },
  );
}
