import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JpTopicAttributes {
  id: string;
  level: string;
  sortOrder: number;
  titleJa: string;
  titleId: string;
  descriptionJa: string | null;
  descriptionId: string | null;
  emoji: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JpTopicCreationAttributes extends Optional<JpTopicAttributes, 'id' | 'descriptionJa' | 'descriptionId' | 'emoji'> {}

export class JpTopic extends Model<JpTopicAttributes, JpTopicCreationAttributes> implements JpTopicAttributes {
  declare id: string;
  declare level: string;
  declare sortOrder: number;
  declare titleJa: string;
  declare titleId: string;
  declare descriptionJa: string | null;
  declare descriptionId: string | null;
  declare emoji: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initJpTopic(sequelize: Sequelize): void {
  JpTopic.init(
    {
      id:            { type: DataTypes.CHAR(36),    primaryKey: true },
      level:         { type: DataTypes.STRING(10),  allowNull: false, defaultValue: 'A1' },
      sortOrder:     { type: DataTypes.INTEGER,     allowNull: false, defaultValue: 0 },
      titleJa:       { type: DataTypes.STRING(200), allowNull: false },
      titleId:       { type: DataTypes.STRING(200), allowNull: false },
      descriptionJa: { type: DataTypes.TEXT,        allowNull: true },
      descriptionId: { type: DataTypes.TEXT,        allowNull: true },
      emoji:         { type: DataTypes.STRING(10),  allowNull: true },
    },
    { sequelize, tableName: 'jp_topics', underscored: false },
  );
}
