import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface NotificationAttributes {
  id: string;
  userId: string;
  type: string | null;
  title: string | null;
  body: string | null;
  isRead: boolean;
  referenceType: string | null;
  referenceId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationCreationAttributes
  extends Optional<
    NotificationAttributes,
    'id' | 'type' | 'title' | 'body' | 'isRead' | 'referenceType' | 'referenceId'
  > {}

export class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes {
  declare id: string;
  declare userId: string;
  declare type: string | null;
  declare title: string | null;
  declare body: string | null;
  declare isRead: boolean;
  declare referenceType: string | null;
  declare referenceId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initNotification(sequelize: Sequelize): void {
  Notification.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING(50), allowNull: true },
      title: { type: DataTypes.STRING(255), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: true },
      isRead: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      referenceType: { type: DataTypes.STRING(50), allowNull: true },
      referenceId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: 'notifications', timestamps: true },
  );
}
