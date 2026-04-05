import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface ToolsDictionaryAttributes {
  id: string;
  nameId: string;
  nameJa: string | null;
  category: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ToolsDictionaryCreationAttributes
  extends Optional<ToolsDictionaryAttributes, 'id' | 'nameJa' | 'category' | 'isActive'> {}

export class ToolsDictionary
  extends Model<ToolsDictionaryAttributes, ToolsDictionaryCreationAttributes>
  implements ToolsDictionaryAttributes {
  declare id: string;
  declare nameId: string;
  declare nameJa: string | null;
  declare category: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initToolsDictionary(sequelize: Sequelize): void {
  ToolsDictionary.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      nameId: { type: DataTypes.STRING(100), allowNull: false },
      nameJa: { type: DataTypes.STRING(100), allowNull: true },
      category: { type: DataTypes.STRING(50), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
    },
    { sequelize, tableName: 'tools_dictionaries', timestamps: true },
  );
}
