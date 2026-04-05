import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface UserMfaBackupCodeAttributes {
  id: string;
  userId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt?: Date;
}

export interface UserMfaBackupCodeCreationAttributes
  extends Optional<UserMfaBackupCodeAttributes, 'id' | 'usedAt'> {}

export class UserMfaBackupCode
  extends Model<UserMfaBackupCodeAttributes, UserMfaBackupCodeCreationAttributes>
  implements UserMfaBackupCodeAttributes {
  declare id: string;
  declare userId: string;
  declare codeHash: string;
  declare usedAt: Date | null;
  declare readonly createdAt: Date;
}

export function initUserMfaBackupCode(sequelize: Sequelize): void {
  UserMfaBackupCode.init(
    {
      id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId:   { type: DataTypes.UUID, allowNull: false },
      codeHash: { type: DataTypes.STRING(255), allowNull: false },
      usedAt:   { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'user_mfa_backup_codes', timestamps: true, updatedAt: false },
  );
}
