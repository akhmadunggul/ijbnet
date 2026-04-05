import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface LpkAttributes {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  assignedAdmin: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LpkCreationAttributes
  extends Optional<
    LpkAttributes,
    'id' | 'city' | 'province' | 'contactPerson' | 'email' | 'phone' | 'assignedAdmin' | 'isActive'
  > {}

export class Lpk extends Model<LpkAttributes, LpkCreationAttributes> implements LpkAttributes {
  declare id: string;
  declare name: string;
  declare city: string | null;
  declare province: string | null;
  declare contactPerson: string | null;
  declare email: string | null;
  declare phone: string | null;
  declare assignedAdmin: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initLpk(sequelize: Sequelize): void {
  Lpk.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      city: { type: DataTypes.STRING(100), allowNull: true },
      province: { type: DataTypes.STRING(100), allowNull: true },
      contactPerson: { type: DataTypes.STRING(255), allowNull: true },
      email: { type: DataTypes.STRING(255), allowNull: true },
      phone: { type: DataTypes.STRING(50), allowNull: true },
      assignedAdmin: { type: DataTypes.UUID, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
    },
    { sequelize, tableName: 'lpks', timestamps: true },
  );
}
