import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateCareerAttributes {
  id: string;
  candidateId: string;
  companyName: string | null;
  division: string | null;
  divisionJa: string | null;
  skillGroup: string | null;
  skillGroupJa: string | null;
  period: string | null;
  startDate: string | null;
  sortOrder: number;
  companyType: string | null;
  employeeCount: number | null;
  annualSales: string | null;
  capitalAmount: string | null;
  dutiesId: string | null;
  dutiesJa: string | null;
  achievementsId: string | null;
  achievementsJa: string | null;
  productId: string | null;
  productJa: string | null;
  jobTitleId: string | null;
  jobTitleJa: string | null;
  memberRoleId: string | null;
  memberRoleJa: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateCareerCreationAttributes
  extends Optional<
    CandidateCareerAttributes,
    | 'id'
    | 'companyName'
    | 'division'
    | 'divisionJa'
    | 'skillGroup'
    | 'skillGroupJa'
    | 'period'
    | 'startDate'
    | 'sortOrder'
    | 'companyType'
    | 'employeeCount'
    | 'annualSales'
    | 'capitalAmount'
    | 'dutiesId'
    | 'dutiesJa'
    | 'achievementsId'
    | 'achievementsJa'
    | 'productId'
    | 'productJa'
    | 'jobTitleId'
    | 'jobTitleJa'
    | 'memberRoleId'
    | 'memberRoleJa'
  > {}

export class CandidateCareer
  extends Model<CandidateCareerAttributes, CandidateCareerCreationAttributes>
  implements CandidateCareerAttributes {
  declare id: string;
  declare candidateId: string;
  declare companyName: string | null;
  declare division: string | null;
  declare divisionJa: string | null;
  declare skillGroup: string | null;
  declare skillGroupJa: string | null;
  declare period: string | null;
  declare startDate: string | null;
  declare sortOrder: number;
  declare companyType: string | null;
  declare employeeCount: number | null;
  declare annualSales: string | null;
  declare capitalAmount: string | null;
  declare dutiesId: string | null;
  declare dutiesJa: string | null;
  declare achievementsId: string | null;
  declare achievementsJa: string | null;
  declare productId: string | null;
  declare productJa: string | null;
  declare jobTitleId: string | null;
  declare jobTitleJa: string | null;
  declare memberRoleId: string | null;
  declare memberRoleJa: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidateCareer(sequelize: Sequelize): void {
  CandidateCareer.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      companyName: { type: DataTypes.STRING(255), allowNull: true },
      division: { type: DataTypes.STRING(100), allowNull: true },
      divisionJa: { type: DataTypes.STRING(200), allowNull: true },
      skillGroup: { type: DataTypes.STRING(100), allowNull: true },
      skillGroupJa: { type: DataTypes.STRING(200), allowNull: true },
      period: { type: DataTypes.STRING(50), allowNull: true },
      startDate: { type: DataTypes.DATEONLY, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
      companyType: { type: DataTypes.STRING(100), allowNull: true },
      employeeCount: { type: DataTypes.INTEGER, allowNull: true },
      annualSales: { type: DataTypes.STRING(100), allowNull: true },
      capitalAmount: { type: DataTypes.STRING(100), allowNull: true },
      dutiesId: { type: DataTypes.TEXT, allowNull: true },
      dutiesJa: { type: DataTypes.TEXT, allowNull: true },
      achievementsId: { type: DataTypes.TEXT, allowNull: true },
      achievementsJa: { type: DataTypes.TEXT, allowNull: true },
      productId:      { type: DataTypes.TEXT,          allowNull: true },
      productJa:      { type: DataTypes.TEXT,          allowNull: true },
      jobTitleId:     { type: DataTypes.STRING(255),   allowNull: true },
      jobTitleJa:     { type: DataTypes.STRING(255),   allowNull: true },
      memberRoleId:   { type: DataTypes.TEXT,          allowNull: true },
      memberRoleJa:   { type: DataTypes.TEXT,          allowNull: true },
    },
    { sequelize, tableName: 'candidate_careers', timestamps: true },
  );
}
