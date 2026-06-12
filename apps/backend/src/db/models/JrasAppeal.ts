import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type JrasAppealStatus = 'submitted' | 'admin_review' | 'committee_review' | 'closed';
export type JrasAppealDecision = 'rejected' | 'retake_granted' | 'score_overridden';

export interface JrasAppealAttributes {
  id: string;
  candidateId: string;
  instrumentId: string;
  attemptId: string;
  reason: string;
  status: JrasAppealStatus;
  adminNote: string | null;
  adminNoteBy: string | null;
  adminNoteAt: Date | null;
  decision: JrasAppealDecision | null;
  decidedBy: string | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasAppealCreationAttributes
  extends Optional<
    JrasAppealAttributes,
    'id' | 'status' | 'adminNote' | 'adminNoteBy' | 'adminNoteAt'
    | 'decision' | 'decidedBy' | 'decisionNote' | 'decidedAt'
  > {}

export class JrasAppeal
  extends Model<JrasAppealAttributes, JrasAppealCreationAttributes>
  implements JrasAppealAttributes {
  declare id: string;
  declare candidateId: string;
  declare instrumentId: string;
  declare attemptId: string;
  declare reason: string;
  declare status: JrasAppealStatus;
  declare adminNote: string | null;
  declare adminNoteBy: string | null;
  declare adminNoteAt: Date | null;
  declare decision: JrasAppealDecision | null;
  declare decidedBy: string | null;
  declare decisionNote: string | null;
  declare decidedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasAppeal(sequelize: Sequelize): void {
  JrasAppeal.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      instrumentId: { type: DataTypes.UUID, allowNull: false },
      attemptId: { type: DataTypes.UUID, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM('submitted', 'admin_review', 'committee_review', 'closed'),
        allowNull: false,
        defaultValue: 'submitted',
      },
      adminNote: { type: DataTypes.TEXT, allowNull: true },
      adminNoteBy: { type: DataTypes.UUID, allowNull: true },
      adminNoteAt: { type: DataTypes.DATE, allowNull: true },
      decision: { type: DataTypes.ENUM('rejected', 'retake_granted', 'score_overridden'), allowNull: true },
      decidedBy: { type: DataTypes.UUID, allowNull: true },
      decisionNote: { type: DataTypes.TEXT, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'jras_appeals' },
  );
}
