import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JpLessonAttributes {
  id: string;
  topicId: string;
  sortOrder: number;
  titleJa: string;
  titleId: string;
  type: 'vocabulary' | 'quiz';
  createdAt?: Date;
  updatedAt?: Date;
}

interface JpLessonCreationAttributes extends Optional<JpLessonAttributes, 'id'> {}

export class JpLesson extends Model<JpLessonAttributes, JpLessonCreationAttributes> implements JpLessonAttributes {
  declare id: string;
  declare topicId: string;
  declare sortOrder: number;
  declare titleJa: string;
  declare titleId: string;
  declare type: 'vocabulary' | 'quiz';
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initJpLesson(sequelize: Sequelize): void {
  JpLesson.init(
    {
      id:        { type: DataTypes.CHAR(36),    primaryKey: true },
      topicId:   { type: DataTypes.CHAR(36),    allowNull: false },
      sortOrder: { type: DataTypes.INTEGER,     allowNull: false, defaultValue: 0 },
      titleJa:   { type: DataTypes.STRING(200), allowNull: false },
      titleId:   { type: DataTypes.STRING(200), allowNull: false },
      type:      { type: DataTypes.ENUM('vocabulary', 'quiz'), allowNull: false },
    },
    { sequelize, tableName: 'jp_lessons', underscored: false },
  );
}
