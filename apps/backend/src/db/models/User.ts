import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { UserRole } from '@ijbnet/shared';

export interface UserAttributes {
  id: string;
  email: string;
  name: string | null;
  googleId: string | null;
  passwordHash: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  mfaSecret: string | null;
  companyId: string | null;
  lpkId: string | null;
  lastLoginAt: Date | null;
  deactivatedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    | 'id'
    | 'name'
    | 'googleId'
    | 'passwordHash'
    | 'avatarUrl'
    | 'isActive'
    | 'mfaSecret'
    | 'companyId'
    | 'lpkId'
    | 'lastLoginAt'
    | 'deactivatedAt'
  > {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare email: string;
  declare name: string | null;
  declare googleId: string | null;
  declare passwordHash: string | null;
  declare role: UserRole;
  declare avatarUrl: string | null;
  declare isActive: boolean;
  declare mfaSecret: string | null;
  declare companyId: string | null;
  declare lpkId: string | null;
  declare lastLoginAt: Date | null;
  declare deactivatedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initUser(sequelize: Sequelize): void {
  User.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(255), allowNull: true },
      googleId: { type: DataTypes.STRING(255), allowNull: true, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: true },
      role: {
        type: DataTypes.ENUM('candidate', 'admin', 'manager', 'recruiter', 'super_admin'),
        allowNull: false,
      },
      avatarUrl: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
      mfaSecret: { type: DataTypes.STRING(255), allowNull: true },
      companyId: { type: DataTypes.UUID, allowNull: true },
      lpkId: { type: DataTypes.UUID, allowNull: true },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      deactivatedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'users', timestamps: true },
  );
}
