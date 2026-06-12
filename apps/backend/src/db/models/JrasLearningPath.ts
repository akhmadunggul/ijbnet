import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { JrasDimensionKey } from '@ijbnet/shared';

export interface JrasLearningPathAttributes {
  id: string;
  candidateId: string;
  dimensionKey: JrasDimensionKey;
  lessonId: string;
  orderNo: number;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasLearningPathCreationAttributes
  extends Optional<JrasLearningPathAttributes, 'id' | 'orderNo' | 'status'> {}

export class JrasLearningPath
  extends Model<JrasLearningPathAttributes, JrasLearningPathCreationAttributes>
  implements JrasLearningPathAttributes {
  declare id: string;
  declare candidateId: string;
  declare dimensionKey: JrasDimensionKey;
  declare lessonId: string;
  declare orderNo: number;
  declare status: 'pending' | 'in_progress' | 'completed';
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasLearningPath(sequelize: Sequelize): void {
  JrasLearningPath.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      dimensionKey: {
        type: DataTypes.ENUM('language', 'culture', 'legal', 'psych', 'finance', 'motivation', 'observation'),
        allowNull: false,
      },
      lessonId: { type: DataTypes.UUID, allowNull: false },
      orderNo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.ENUM('pending', 'in_progress', 'completed'), allowNull: false, defaultValue: 'pending' },
    },
    { sequelize, tableName: 'jras_learning_paths' },
  );
}
