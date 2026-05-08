import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface SswSectorFieldAttributes {
  id: string;
  kubun: 'SSW1' | 'SSW2' | 'Trainee';
  sectorId: string;
  sectorJa: string;
  fieldId: string;
  fieldJa: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SswSectorFieldCreationAttributes
  extends Optional<SswSectorFieldAttributes, 'id' | 'sortOrder' | 'isActive'> {}

export class SswSectorField
  extends Model<SswSectorFieldAttributes, SswSectorFieldCreationAttributes>
  implements SswSectorFieldAttributes {
  declare id: string;
  declare kubun: 'SSW1' | 'SSW2' | 'Trainee';
  declare sectorId: string;
  declare sectorJa: string;
  declare fieldId: string;
  declare fieldJa: string;
  declare sortOrder: number;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initSswSectorField(sequelize: Sequelize): void {
  SswSectorField.init(
    {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      kubun:     { type: DataTypes.ENUM('SSW1', 'SSW2', 'Trainee'), allowNull: false },
      sectorId:  { type: DataTypes.STRING(120), allowNull: false },
      sectorJa:  { type: DataTypes.STRING(120), allowNull: false },
      fieldId:   { type: DataTypes.STRING(120), allowNull: false },
      fieldJa:   { type: DataTypes.STRING(120), allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, tableName: 'ssw_sector_fields', timestamps: true },
  );
}
