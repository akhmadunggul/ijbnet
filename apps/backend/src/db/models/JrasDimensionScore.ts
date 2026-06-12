import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { JrasDimensionKey } from '@ijbnet/shared';

export interface JrasDimensionScoreAttributes {
  id: string;
  candidateId: string;
  dimensionKey: JrasDimensionKey;
  score: number;
  instrumentVersion: number | null;
  computedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasDimensionScoreCreationAttributes
  extends Optional<JrasDimensionScoreAttributes, 'id' | 'instrumentVersion'> {}

export class JrasDimensionScore
  extends Model<JrasDimensionScoreAttributes, JrasDimensionScoreCreationAttributes>
  implements JrasDimensionScoreAttributes {
  declare id: string;
  declare candidateId: string;
  declare dimensionKey: JrasDimensionKey;
  declare score: number;
  declare instrumentVersion: number | null;
  declare computedAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasDimensionScore(sequelize: Sequelize): void {
  JrasDimensionScore.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      dimensionKey: {
        type: DataTypes.ENUM('language', 'culture', 'legal', 'psych', 'finance', 'motivation', 'observation'),
        allowNull: false,
      },
      score: { type: DataTypes.FLOAT, allowNull: false },
      instrumentVersion: { type: DataTypes.INTEGER, allowNull: true },
      computedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, tableName: 'jras_dimension_scores' },
  );
}
