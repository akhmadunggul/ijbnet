import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JrasRiskFlagAttributes {
  id: string;
  candidateId: string;
  ruleKey: string;
  severity: 'yellow' | 'red';
  status: 'open' | 'in_progress' | 'resolved';
  detailJson: Record<string, unknown> | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasRiskFlagCreationAttributes
  extends Optional<JrasRiskFlagAttributes, 'id' | 'status' | 'detailJson' | 'resolvedBy' | 'resolvedAt'> {}

export class JrasRiskFlag
  extends Model<JrasRiskFlagAttributes, JrasRiskFlagCreationAttributes>
  implements JrasRiskFlagAttributes {
  declare id: string;
  declare candidateId: string;
  declare ruleKey: string;
  declare severity: 'yellow' | 'red';
  declare status: 'open' | 'in_progress' | 'resolved';
  declare detailJson: Record<string, unknown> | null;
  declare resolvedBy: string | null;
  declare resolvedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasRiskFlag(sequelize: Sequelize): void {
  JrasRiskFlag.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      ruleKey: { type: DataTypes.STRING(50), allowNull: false },
      severity: { type: DataTypes.ENUM('yellow', 'red'), allowNull: false },
      status: { type: DataTypes.ENUM('open', 'in_progress', 'resolved'), allowNull: false, defaultValue: 'open' },
      detailJson: { type: DataTypes.JSON, allowNull: true },
      resolvedBy: { type: DataTypes.UUID, allowNull: true },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'jras_risk_flags' },
  );
}
