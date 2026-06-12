import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JrasRiskRuleAttributes {
  id: string;
  ruleKey: string;
  severity: 'yellow' | 'red';
  configJson: Record<string, unknown>;
  enabled: boolean;
  descriptionId: string | null;
  descriptionJa: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasRiskRuleCreationAttributes
  extends Optional<JrasRiskRuleAttributes, 'id' | 'enabled' | 'descriptionId' | 'descriptionJa'> {}

export class JrasRiskRule
  extends Model<JrasRiskRuleAttributes, JrasRiskRuleCreationAttributes>
  implements JrasRiskRuleAttributes {
  declare id: string;
  declare ruleKey: string;
  declare severity: 'yellow' | 'red';
  declare configJson: Record<string, unknown>;
  declare enabled: boolean;
  declare descriptionId: string | null;
  declare descriptionJa: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasRiskRule(sequelize: Sequelize): void {
  JrasRiskRule.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ruleKey: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      severity: { type: DataTypes.ENUM('yellow', 'red'), allowNull: false },
      configJson: { type: DataTypes.JSON, allowNull: false },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      descriptionId: { type: DataTypes.STRING(255), allowNull: true },
      descriptionJa: { type: DataTypes.STRING(255), allowNull: true },
    },
    { sequelize, tableName: 'jras_risk_rules' },
  );
}
