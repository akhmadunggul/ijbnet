import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { BatchStatus } from '@ijbnet/shared';

export interface BatchAttributes {
  id: string;
  batchCode: string | null;
  name: string | null;
  companyId: string | null;
  quotaTotal: number | null;
  interviewCandidateLimit: number | null;
  sswFieldFilter: string | null;
  status: BatchStatus;
  expiryDate: Date | null;
  createdBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BatchCreationAttributes
  extends Optional<
    BatchAttributes,
    | 'id'
    | 'batchCode'
    | 'name'
    | 'companyId'
    | 'quotaTotal'
    | 'interviewCandidateLimit'
    | 'sswFieldFilter'
    | 'status'
    | 'expiryDate'
    | 'createdBy'
  > {}

export class Batch extends Model<BatchAttributes, BatchCreationAttributes> implements BatchAttributes {
  declare id: string;
  declare batchCode: string | null;
  declare name: string | null;
  declare companyId: string | null;
  declare quotaTotal: number | null;
  declare interviewCandidateLimit: number | null;
  declare sswFieldFilter: string | null;
  declare status: BatchStatus;
  declare expiryDate: Date | null;
  declare createdBy: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initBatch(sequelize: Sequelize): void {
  Batch.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      batchCode: { type: DataTypes.STRING(50), allowNull: true, unique: true },
      name: { type: DataTypes.STRING(255), allowNull: true },
      companyId: { type: DataTypes.UUID, allowNull: true },
      quotaTotal: { type: DataTypes.INTEGER, allowNull: true },
      interviewCandidateLimit: { type: DataTypes.INTEGER, allowNull: true },
      sswFieldFilter: { type: DataTypes.STRING(100), allowNull: true },
      status: {
        type: DataTypes.ENUM('draft', 'active', 'selection', 'approved', 'closed'),
        defaultValue: 'draft',
        allowNull: false,
      },
      expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: 'batches', timestamps: true },
  );
}
