import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface AbEventAttributes {
  id: string;
  experimentId: string;
  userId: string;
  variantKey: string;
  event: string;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
}

export interface AbEventCreationAttributes
  extends Optional<AbEventAttributes, 'id' | 'metadata' | 'createdAt'> {}

export class AbEvent
  extends Model<AbEventAttributes, AbEventCreationAttributes>
  implements AbEventAttributes {
  declare id: string;
  declare experimentId: string;
  declare userId: string;
  declare variantKey: string;
  declare event: string;
  declare metadata: Record<string, unknown> | null;
  declare readonly createdAt: Date;
}

export function initAbEvent(sequelize: Sequelize): void {
  AbEvent.init(
    {
      id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      experimentId: { type: DataTypes.UUID, allowNull: false },
      userId:       { type: DataTypes.UUID, allowNull: false },
      variantKey:   { type: DataTypes.STRING(50), allowNull: false },
      event:        { type: DataTypes.STRING(100), allowNull: false },
      metadata:     { type: DataTypes.JSON, allowNull: true },
    },
    { sequelize, tableName: 'ab_events', timestamps: false, createdAt: 'createdAt' },
  );
}
