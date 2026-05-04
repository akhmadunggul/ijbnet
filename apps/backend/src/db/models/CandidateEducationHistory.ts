import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateEducationHistoryAttributes {
  id: string;
  candidateId: string;
  schoolName: string;
  major: string | null;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateEducationHistoryCreationAttributes
  extends Optional<
    CandidateEducationHistoryAttributes,
    'id' | 'major' | 'startDate' | 'endDate' | 'sortOrder'
  > {}

export class CandidateEducationHistory
  extends Model<CandidateEducationHistoryAttributes, CandidateEducationHistoryCreationAttributes>
  implements CandidateEducationHistoryAttributes {
  declare id: string;
  declare candidateId: string;
  declare schoolName: string;
  declare major: string | null;
  declare startDate: string | null;
  declare endDate: string | null;
  declare sortOrder: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidateEducationHistory(sequelize: Sequelize): void {
  CandidateEducationHistory.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      schoolName: { type: DataTypes.STRING(255), allowNull: false },
      major: { type: DataTypes.STRING(255), allowNull: true },
      startDate: { type: DataTypes.DATEONLY, allowNull: true },
      endDate: { type: DataTypes.DATEONLY, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, tableName: 'candidate_education_history', timestamps: true },
  );
}
