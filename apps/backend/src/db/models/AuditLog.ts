import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface AuditLogAttributes {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  targetCandidateId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt?: Date;
}

export interface AuditLogCreationAttributes
  extends Optional<
    AuditLogAttributes,
    'id' | 'userId' | 'entityType' | 'entityId' | 'targetCandidateId' | 'payload' | 'ipAddress' | 'userAgent'
  > {}

export class AuditLog
  extends Model<AuditLogAttributes, AuditLogCreationAttributes>
  implements AuditLogAttributes {
  declare id: string;
  declare userId: string | null;
  declare action: string;
  declare entityType: string | null;
  declare entityId: string | null;
  declare targetCandidateId: string | null;
  declare payload: Record<string, unknown> | null;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare readonly createdAt: Date;
}

export function initAuditLog(sequelize: Sequelize): void {
  AuditLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      action: { type: DataTypes.STRING(100), allowNull: false },
      entityType: { type: DataTypes.STRING(50), allowNull: true },
      entityId: { type: DataTypes.UUID, allowNull: true },
      targetCandidateId: { type: DataTypes.UUID, allowNull: true },
      payload: { type: DataTypes.JSON, allowNull: true },
      ipAddress: { type: DataTypes.STRING(50), allowNull: true },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      tableName: 'audit_logs',
      timestamps: true,
      updatedAt: false,
      indexes: [
        { fields: ['targetCandidateId', 'createdAt'] },
        { fields: ['userId', 'createdAt'] },
        { fields: ['action', 'createdAt'] },
      ],
    },
  );
}
