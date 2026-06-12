import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { JrasItemType, JrasItemOption, JrasItemScoring } from '@ijbnet/shared';

export interface JrasItemAttributes {
  id: string;
  instrumentId: string;
  orderNo: number;
  type: JrasItemType;
  promptId: string;
  promptJa: string;
  optionsJson: JrasItemOption[];
  scoringJson: JrasItemScoring;
  criticalFlag: boolean;
  sensitive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasItemCreationAttributes
  extends Optional<JrasItemAttributes, 'id' | 'orderNo' | 'criticalFlag' | 'sensitive'> {}

export class JrasItem
  extends Model<JrasItemAttributes, JrasItemCreationAttributes>
  implements JrasItemAttributes {
  declare id: string;
  declare instrumentId: string;
  declare orderNo: number;
  declare type: JrasItemType;
  declare promptId: string;
  declare promptJa: string;
  declare optionsJson: JrasItemOption[];
  declare scoringJson: JrasItemScoring;
  declare criticalFlag: boolean;
  declare sensitive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasItem(sequelize: Sequelize): void {
  JrasItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      instrumentId: { type: DataTypes.UUID, allowNull: false },
      orderNo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      type: { type: DataTypes.ENUM('sjt', 'likert', 'quiz'), allowNull: false },
      promptId: { type: DataTypes.TEXT, allowNull: false },
      promptJa: { type: DataTypes.TEXT, allowNull: false },
      optionsJson: { type: DataTypes.JSON, allowNull: false },
      scoringJson: { type: DataTypes.JSON, allowNull: false },
      criticalFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sensitive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { sequelize, tableName: 'jras_items' },
  );
}
