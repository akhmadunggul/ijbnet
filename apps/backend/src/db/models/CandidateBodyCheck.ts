import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CandidateBodyCheckAttributes {
  id: string;
  candidateId: string;
  verifiedHeight: number | null;
  verifiedWeight: number | null;
  carrySeconds: number | null;
  visionEncrypted: string | null;
  tattooEncrypted: string | null;
  overallResult: 'pass' | 'hold' | 'fail' | null;
  checkedDate: Date | null;
  checkedBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CandidateBodyCheckCreationAttributes
  extends Optional<
    CandidateBodyCheckAttributes,
    | 'id'
    | 'verifiedHeight'
    | 'verifiedWeight'
    | 'carrySeconds'
    | 'visionEncrypted'
    | 'tattooEncrypted'
    | 'overallResult'
    | 'checkedDate'
    | 'checkedBy'
  > {}

export class CandidateBodyCheck
  extends Model<CandidateBodyCheckAttributes, CandidateBodyCheckCreationAttributes>
  implements CandidateBodyCheckAttributes {
  declare id: string;
  declare candidateId: string;
  declare verifiedHeight: number | null;
  declare verifiedWeight: number | null;
  declare carrySeconds: number | null;
  declare visionEncrypted: string | null;
  declare tattooEncrypted: string | null;
  declare overallResult: 'pass' | 'hold' | 'fail' | null;
  declare checkedDate: Date | null;
  declare checkedBy: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCandidateBodyCheck(sequelize: Sequelize): void {
  CandidateBodyCheck.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false, unique: true },
      verifiedHeight: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      verifiedWeight: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      carrySeconds: { type: DataTypes.INTEGER, allowNull: true },
      visionEncrypted: { type: DataTypes.TEXT, allowNull: true },
      tattooEncrypted: { type: DataTypes.TEXT, allowNull: true },
      overallResult: { type: DataTypes.ENUM('pass', 'hold', 'fail'), allowNull: true },
      checkedDate: { type: DataTypes.DATEONLY, allowNull: true },
      checkedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: 'candidate_body_checks', timestamps: true },
  );
}
