import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JrasCommitteeMemberAttributes {
  id: string;
  userId: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasCommitteeMemberCreationAttributes
  extends Optional<JrasCommitteeMemberAttributes, 'id' | 'active'> {}

export class JrasCommitteeMember
  extends Model<JrasCommitteeMemberAttributes, JrasCommitteeMemberCreationAttributes>
  implements JrasCommitteeMemberAttributes {
  declare id: string;
  declare userId: string;
  declare active: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasCommitteeMember(sequelize: Sequelize): void {
  JrasCommitteeMember.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, tableName: 'jras_committee_members' },
  );
}
