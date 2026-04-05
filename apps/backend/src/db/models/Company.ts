import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CompanyAttributes {
  id: string;
  name: string;
  nameJa: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CompanyCreationAttributes
  extends Optional<CompanyAttributes, 'id' | 'nameJa' | 'contactPerson' | 'email' | 'phone' | 'isActive'> {}

export class Company extends Model<CompanyAttributes, CompanyCreationAttributes>
  implements CompanyAttributes {
  declare id: string;
  declare name: string;
  declare nameJa: string | null;
  declare contactPerson: string | null;
  declare email: string | null;
  declare phone: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initCompany(sequelize: Sequelize): void {
  Company.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      nameJa: { type: DataTypes.STRING(255), allowNull: true },
      contactPerson: { type: DataTypes.STRING(255), allowNull: true },
      email: { type: DataTypes.STRING(255), allowNull: true },
      phone: { type: DataTypes.STRING(50), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
    },
    { sequelize, tableName: 'companies', timestamps: true },
  );
}
