import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JrasAttemptAttributes {
  id: string;
  candidateId: string;
  instrumentId: string;
  instrumentVersion: number;
  wave: string | null;
  startedAt: Date;
  completedAt: Date | null;
  observerUserId: string | null;
  confidence: 'low' | 'medium' | 'high' | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasAttemptCreationAttributes
  extends Optional<JrasAttemptAttributes, 'id' | 'wave' | 'completedAt' | 'observerUserId' | 'confidence'> {}

export class JrasAttempt
  extends Model<JrasAttemptAttributes, JrasAttemptCreationAttributes>
  implements JrasAttemptAttributes {
  declare id: string;
  declare candidateId: string;
  declare instrumentId: string;
  declare instrumentVersion: number;
  declare wave: string | null;
  declare startedAt: Date;
  declare completedAt: Date | null;
  declare observerUserId: string | null;
  declare confidence: 'low' | 'medium' | 'high' | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasAttempt(sequelize: Sequelize): void {
  JrasAttempt.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      instrumentId: { type: DataTypes.UUID, allowNull: false },
      instrumentVersion: { type: DataTypes.INTEGER, allowNull: false },
      wave: { type: DataTypes.STRING(50), allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: false },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      observerUserId: { type: DataTypes.UUID, allowNull: true },
      confidence: { type: DataTypes.ENUM('low', 'medium', 'high'), allowNull: true },
    },
    { sequelize, tableName: 'jras_attempts' },
  );
}
