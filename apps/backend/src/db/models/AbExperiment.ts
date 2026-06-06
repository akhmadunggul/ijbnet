import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface AbVariant {
  key: string;
  name: string;
  weight: number;
}

export interface AbTargeting {
  scope: 'all' | 'role' | 'lpk' | 'percentage';
  roles?: string[];
  /** Hash-based LPK pool: eligible LPK IDs for FNV-1a bucketing */
  lpkIds?: string[];
  /** Explicit per-LPK variant assignment: { [lpkId]: variantKey } — takes precedence over lpkIds */
  lpkVariants?: Record<string, string>;
  percentage?: number;
}

export type AbExperimentStatus = 'draft' | 'active' | 'paused' | 'concluded';

export interface AbExperimentAttributes {
  id: string;
  name: string;
  description: string | null;
  hypothesis: string | null;
  status: AbExperimentStatus;
  variants: AbVariant[];
  targeting: AbTargeting;
  metric: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AbExperimentCreationAttributes
  extends Optional<AbExperimentAttributes, 'id' | 'description' | 'hypothesis' | 'status' | 'metric' | 'startDate' | 'endDate'> {}

export class AbExperiment
  extends Model<AbExperimentAttributes, AbExperimentCreationAttributes>
  implements AbExperimentAttributes {
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare hypothesis: string | null;
  declare status: AbExperimentStatus;
  declare variants: AbVariant[];
  declare targeting: AbTargeting;
  declare metric: string | null;
  declare startDate: string | null;
  declare endDate: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initAbExperiment(sequelize: Sequelize): void {
  AbExperiment.init(
    {
      id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name:        { type: DataTypes.STRING(100), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      hypothesis:  { type: DataTypes.TEXT, allowNull: true },
      status:      { type: DataTypes.ENUM('draft', 'active', 'paused', 'concluded'), defaultValue: 'draft', allowNull: false },
      variants:    { type: DataTypes.JSON, allowNull: false },
      targeting:   { type: DataTypes.JSON, allowNull: false },
      metric:      { type: DataTypes.STRING(100), allowNull: true },
      startDate:   { type: DataTypes.DATEONLY, allowNull: true },
      endDate:     { type: DataTypes.DATEONLY, allowNull: true },
    },
    { sequelize, tableName: 'ab_experiments', timestamps: true },
  );
}
