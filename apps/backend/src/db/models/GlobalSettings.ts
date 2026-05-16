import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface GlobalSettingsAttributes {
  id: string;
  key: string;
  value: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GlobalSettingsCreationAttributes
  extends Optional<GlobalSettingsAttributes, 'id'> {}

export class GlobalSettings
  extends Model<GlobalSettingsAttributes, GlobalSettingsCreationAttributes>
  implements GlobalSettingsAttributes {
  declare id: string;
  declare key: string;
  declare value: unknown;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initGlobalSettings(sequelize: Sequelize): void {
  GlobalSettings.init(
    {
      id:    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key:   { type: DataTypes.STRING(100), allowNull: false, unique: true },
      value: { type: DataTypes.JSON, allowNull: false },
    },
    { sequelize, tableName: 'global_settings', timestamps: true },
  );
}
