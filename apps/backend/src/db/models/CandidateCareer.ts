import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateCareerAttributes {
  id: string;
  candidateId: string;
  companyName: string | null;
  division: string | null;
  skillGroup: string | null;
  period: string | null;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateCareerCreationAttributes
  extends Optional<
    CandidateCareerAttributes,
    'id' | 'companyName' | 'division' | 'skillGroup' | 'period' | 'sortOrder'
  > {}

export class CandidateCareer
  extends Model<CandidateCareerAttributes, CandidateCareerCreationAttributes>
  implements CandidateCareerAttributes {
  declare id: string;
  declare candidateId: string;
  declare companyName: string | null;
  declare division: string | null;
  declare skillGroup: string | null;
  declare period: string | null;
  declare sortOrder: number;
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
      skillGroup: { type: DataTypes.STRING(100), allowNull: true },
      period: { type: DataTypes.STRING(50), allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    },
    { sequelize, tableName: 'candidate_careers', timestamps: true },
  );
}
