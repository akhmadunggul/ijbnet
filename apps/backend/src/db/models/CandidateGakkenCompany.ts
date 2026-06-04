import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateGakkenCompanyAttributes {
  id: string;
  candidateId: string;
  period: string | null;
  productId: string | null;
  productJa: string | null;
  dutiesId: string | null;
  dutiesJa: string | null;
  memberRoleId: string | null;
  memberRoleJa: string | null;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateGakkenCompanyCreationAttributes
  extends Optional<
    CandidateGakkenCompanyAttributes,
    | 'id' | 'sortOrder'
    | 'period'
    | 'productId' | 'productJa'
    | 'dutiesId' | 'dutiesJa'
    | 'memberRoleId' | 'memberRoleJa'
  > {}

export class CandidateGakkenCompany
  extends Model<CandidateGakkenCompanyAttributes, CandidateGakkenCompanyCreationAttributes>
  implements CandidateGakkenCompanyAttributes {
  declare id: string;
  declare candidateId: string;
  declare period: string | null;
  declare productId: string | null;
  declare productJa: string | null;
  declare dutiesId: string | null;
  declare dutiesJa: string | null;
  declare memberRoleId: string | null;
  declare memberRoleJa: string | null;
  declare sortOrder: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidateGakkenCompany(sequelize: Sequelize): void {
  CandidateGakkenCompany.init(
    {
      id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId:  { type: DataTypes.UUID, allowNull: false },
      period:       { type: DataTypes.STRING(50), allowNull: true },
      productId:    { type: DataTypes.TEXT, allowNull: true },
      productJa:    { type: DataTypes.TEXT, allowNull: true },
      dutiesId:     { type: DataTypes.TEXT, allowNull: true },
      dutiesJa:     { type: DataTypes.TEXT, allowNull: true },
      memberRoleId: { type: DataTypes.TEXT, allowNull: true },
      memberRoleJa: { type: DataTypes.TEXT, allowNull: true },
      sortOrder:    { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    },
    { sequelize, tableName: 'candidate_gakken_companies', timestamps: true },
  );
}
