import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface InterviewProposalAttributes {
  id: string;
  batchCandidateId: string;
  proposedBy: string | null;
  proposedDates: string[] | null;
  candidatePreferredDate: string | null;
  finalDate: Date | null;
  status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
  recruiterDecision: 'accepted' | 'rejected' | null;
  recruiterDecisionAt: Date | null;
  decisionDeadline: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InterviewProposalCreationAttributes
  extends Optional<
    InterviewProposalAttributes,
    | 'id'
    | 'proposedBy'
    | 'proposedDates'
    | 'candidatePreferredDate'
    | 'finalDate'
    | 'status'
    | 'recruiterDecision'
    | 'recruiterDecisionAt'
    | 'decisionDeadline'
  > {}

export class InterviewProposal
  extends Model<InterviewProposalAttributes, InterviewProposalCreationAttributes>
  implements InterviewProposalAttributes {
  declare id: string;
  declare batchCandidateId: string;
  declare proposedBy: string | null;
  declare proposedDates: string[] | null;
  declare candidatePreferredDate: string | null;
  declare finalDate: Date | null;
  declare status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
  declare recruiterDecision: 'accepted' | 'rejected' | null;
  declare recruiterDecisionAt: Date | null;
  declare decisionDeadline: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initInterviewProposal(sequelize: Sequelize): void {
  InterviewProposal.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      batchCandidateId: { type: DataTypes.UUID, allowNull: false },
      proposedBy: { type: DataTypes.UUID, allowNull: true },
      proposedDates: { type: DataTypes.JSON, allowNull: true },
      candidatePreferredDate: { type: DataTypes.DATEONLY, allowNull: true },
      finalDate: { type: DataTypes.DATEONLY, allowNull: true },
      status: {
        type: DataTypes.ENUM('proposed', 'scheduled', 'completed', 'cancelled'),
        defaultValue: 'proposed',
        allowNull: false,
      },
      recruiterDecision: {
        type: DataTypes.ENUM('accepted', 'rejected'),
        allowNull: true,
        defaultValue: null,
      },
      recruiterDecisionAt: { type: DataTypes.DATE, allowNull: true },
      decisionDeadline: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'interview_proposals', timestamps: true },
  );
}
