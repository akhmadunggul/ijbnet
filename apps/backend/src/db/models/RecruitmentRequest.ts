import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type RecruitmentRequestStatus = 'pending' | 'confirmed' | 'rejected' | 'closed';

export interface RecruitmentRequestAttributes {
  id: string;
  requestCode: string;
  companyId: string;
  requestedBy: string;
  kubun: 'SSW1' | 'SSW2' | 'Trainee';
  sswSectorId: string;
  sswSectorJa: string;
  sswFieldId: string;
  sswFieldJa: string;
  requestedCount: number;
  allocatedCount: number | null;
  status: RecruitmentRequestStatus;
  batchId: string | null;
  notes: string | null;
  managerNotes: string | null;
  confirmedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RecruitmentRequestCreationAttributes
  extends Optional<RecruitmentRequestAttributes,
    'id' | 'allocatedCount' | 'status' | 'batchId' | 'notes' | 'managerNotes' | 'confirmedAt'> {}

export class RecruitmentRequest
  extends Model<RecruitmentRequestAttributes, RecruitmentRequestCreationAttributes>
  implements RecruitmentRequestAttributes {
  declare id: string;
  declare requestCode: string;
  declare companyId: string;
  declare requestedBy: string;
  declare kubun: 'SSW1' | 'SSW2' | 'Trainee';
  declare sswSectorId: string;
  declare sswSectorJa: string;
  declare sswFieldId: string;
  declare sswFieldJa: string;
  declare requestedCount: number;
  declare allocatedCount: number | null;
  declare status: RecruitmentRequestStatus;
  declare batchId: string | null;
  declare notes: string | null;
  declare managerNotes: string | null;
  declare confirmedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initRecruitmentRequest(sequelize: Sequelize): void {
  RecruitmentRequest.init(
    {
      id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      requestCode:    { type: DataTypes.STRING(50), allowNull: false, unique: true },
      companyId:      { type: DataTypes.UUID, allowNull: false },
      requestedBy:    { type: DataTypes.UUID, allowNull: false },
      kubun:          { type: DataTypes.ENUM('SSW1', 'SSW2', 'Trainee'), allowNull: false },
      sswSectorId:    { type: DataTypes.STRING(120), allowNull: false },
      sswSectorJa:    { type: DataTypes.STRING(120), allowNull: false },
      sswFieldId:     { type: DataTypes.STRING(120), allowNull: false },
      sswFieldJa:     { type: DataTypes.STRING(120), allowNull: false },
      requestedCount: { type: DataTypes.INTEGER, allowNull: false },
      allocatedCount: { type: DataTypes.INTEGER, allowNull: true },
      status:         {
        type: DataTypes.ENUM('pending', 'confirmed', 'rejected', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      batchId:        { type: DataTypes.UUID, allowNull: true },
      notes:          { type: DataTypes.TEXT, allowNull: true },
      managerNotes:   { type: DataTypes.TEXT, allowNull: true },
      confirmedAt:    { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'recruitment_requests', timestamps: true },
  );
}
