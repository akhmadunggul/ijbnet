import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface BatchCandidateAttributes {
  id: string;
  batchId: string;
  candidateId: string;
  allocatedBy: string | null;
  allocatedAt: Date | null;
  isSelected: boolean;
  selectedAt: Date | null;
  isConfirmed: boolean;
  confirmedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BatchCandidateCreationAttributes
  extends Optional<
    BatchCandidateAttributes,
    | 'id'
    | 'allocatedBy'
    | 'allocatedAt'
    | 'isSelected'
    | 'selectedAt'
    | 'isConfirmed'
    | 'confirmedAt'
  > {}

export class BatchCandidate
  extends Model<BatchCandidateAttributes, BatchCandidateCreationAttributes>
  implements BatchCandidateAttributes {
  declare id: string;
  declare batchId: string;
  declare candidateId: string;
  declare allocatedBy: string | null;
  declare allocatedAt: Date | null;
  declare isSelected: boolean;
  declare selectedAt: Date | null;
  declare isConfirmed: boolean;
  declare confirmedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initBatchCandidate(sequelize: Sequelize): void {
  BatchCandidate.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      batchId: { type: DataTypes.UUID, allowNull: false },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      allocatedBy: { type: DataTypes.UUID, allowNull: true },
      allocatedAt: { type: DataTypes.DATE, allowNull: true },
      isSelected: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      selectedAt: { type: DataTypes.DATE, allowNull: true },
      isConfirmed: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      confirmedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      tableName: 'batch_candidates',
      timestamps: true,
      indexes: [{ unique: true, fields: ['batchId', 'candidateId'] }],
    },
  );
}
