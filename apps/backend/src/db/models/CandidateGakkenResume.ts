import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateGakkenResumeAttributes {
  id: string;
  candidateId: string;
  careerSummary: string | null;
  careerSummaryJa: string | null;
  currentCompanyName: string | null;
  currentBusinessActivity: string | null;
  currentCapital: string | null;
  currentRevenue: string | null;
  currentEmployeeCount: number | null;
  skills: string | null;
  skillsJa: string | null;
  selfPr: string | null;
  selfPrJa: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateGakkenResumeCreationAttributes
  extends Optional<
    CandidateGakkenResumeAttributes,
    | 'id'
    | 'careerSummary' | 'careerSummaryJa'
    | 'currentCompanyName' | 'currentBusinessActivity'
    | 'currentCapital' | 'currentRevenue' | 'currentEmployeeCount'
    | 'skills' | 'skillsJa'
    | 'selfPr' | 'selfPrJa'
  > {}

export class CandidateGakkenResume
  extends Model<CandidateGakkenResumeAttributes, CandidateGakkenResumeCreationAttributes>
  implements CandidateGakkenResumeAttributes {
  declare id: string;
  declare candidateId: string;
  declare careerSummary: string | null;
  declare careerSummaryJa: string | null;
  declare currentCompanyName: string | null;
  declare currentBusinessActivity: string | null;
  declare currentCapital: string | null;
  declare currentRevenue: string | null;
  declare currentEmployeeCount: number | null;
  declare skills: string | null;
  declare skillsJa: string | null;
  declare selfPr: string | null;
  declare selfPrJa: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidateGakkenResume(sequelize: Sequelize): void {
  CandidateGakkenResume.init(
    {
      id:                      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId:             { type: DataTypes.UUID, allowNull: false, unique: true },
      careerSummary:           { type: DataTypes.TEXT, allowNull: true },
      careerSummaryJa:         { type: DataTypes.TEXT, allowNull: true },
      currentCompanyName:      { type: DataTypes.STRING(255), allowNull: true },
      currentBusinessActivity: { type: DataTypes.TEXT, allowNull: true },
      currentCapital:          { type: DataTypes.STRING(100), allowNull: true },
      currentRevenue:          { type: DataTypes.STRING(100), allowNull: true },
      currentEmployeeCount:    { type: DataTypes.INTEGER, allowNull: true },
      skills:                  { type: DataTypes.TEXT, allowNull: true },
      skillsJa:                { type: DataTypes.TEXT, allowNull: true },
      selfPr:                  { type: DataTypes.TEXT, allowNull: true },
      selfPrJa:                { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'candidate_gakken_resumes', timestamps: true },
  );
}
