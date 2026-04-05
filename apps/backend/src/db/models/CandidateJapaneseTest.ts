import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateJapaneseTestAttributes {
  id: string;
  candidateId: string;
  testName: string | null;
  score: number | null;
  pass: boolean | null;
  testDate: Date | null;
  createdAt?: Date;
}

export interface CandidateJapaneseTestCreationAttributes
  extends Optional<
    CandidateJapaneseTestAttributes,
    'id' | 'testName' | 'score' | 'pass' | 'testDate'
  > {}

export class CandidateJapaneseTest
  extends Model<CandidateJapaneseTestAttributes, CandidateJapaneseTestCreationAttributes>
  implements CandidateJapaneseTestAttributes {
  declare id: string;
  declare candidateId: string;
  declare testName: string | null;
  declare score: number | null;
  declare pass: boolean | null;
  declare testDate: Date | null;
  declare readonly createdAt: Date;
}

export function initCandidateJapaneseTest(sequelize: Sequelize): void {
  CandidateJapaneseTest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      testName: { type: DataTypes.STRING(50), allowNull: true },
      score: { type: DataTypes.INTEGER, allowNull: true },
      pass: { type: DataTypes.BOOLEAN, allowNull: true },
      testDate: { type: DataTypes.DATEONLY, allowNull: true },
    },
    { sequelize, tableName: 'candidate_japanese_tests', timestamps: true, updatedAt: false },
  );
}
