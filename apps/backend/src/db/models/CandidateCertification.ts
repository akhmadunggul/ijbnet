import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateCertificationAttributes {
  id: string;
  candidateId: string;
  certName: string;
  certLevel: string | null;
  issuedDate: string | null;
  issuedBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateCertificationCreationAttributes
  extends Optional<
    CandidateCertificationAttributes,
    'id' | 'certLevel' | 'issuedDate' | 'issuedBy'
  > {}

export class CandidateCertification
  extends Model<CandidateCertificationAttributes, CandidateCertificationCreationAttributes>
  implements CandidateCertificationAttributes {
  declare id: string;
  declare candidateId: string;
  declare certName: string;
  declare certLevel: string | null;
  declare issuedDate: string | null;
  declare issuedBy: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidateCertification(sequelize: Sequelize): void {
  CandidateCertification.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      certName: { type: DataTypes.STRING(255), allowNull: false },
      certLevel: { type: DataTypes.STRING(100), allowNull: true },
      issuedDate: { type: DataTypes.DATEONLY, allowNull: true },
      issuedBy: { type: DataTypes.STRING(255), allowNull: true },
    },
    { sequelize, tableName: 'candidate_certifications', timestamps: true },
  );
}
