import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateWeeklyTestAttributes {
  id: string;
  candidateId: string;
  courseName: string | null;
  weekNumber: number | null;
  score: number | null;
  testDate: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateWeeklyTestCreationAttributes
  extends Optional<
    CandidateWeeklyTestAttributes,
    'id' | 'courseName' | 'weekNumber' | 'score' | 'testDate'
  > {}

export class CandidateWeeklyTest
  extends Model<CandidateWeeklyTestAttributes, CandidateWeeklyTestCreationAttributes>
  implements CandidateWeeklyTestAttributes {
  declare id: string;
  declare candidateId: string;
  declare courseName: string | null;
  declare weekNumber: number | null;
  declare score: number | null;
  declare testDate: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidateWeeklyTest(sequelize: Sequelize): void {
  CandidateWeeklyTest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      courseName: { type: DataTypes.STRING(100), allowNull: true },
      weekNumber: { type: DataTypes.INTEGER, allowNull: true },
      score: { type: DataTypes.INTEGER, allowNull: true },
      testDate: { type: DataTypes.DATEONLY, allowNull: true },
    },
    { sequelize, tableName: 'candidate_weekly_tests', timestamps: true },
  );
}
