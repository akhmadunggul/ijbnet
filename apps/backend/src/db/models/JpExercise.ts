import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface CardData {
  front: { text: string; romaji: string };
  back: { meaning: string; example: string; exampleMeaning: string };
}

export interface QuizData {
  question: string;
  options: { value: string; label: string }[];
  correct: string;
  explanation: string;
}

export interface JpExerciseAttributes {
  id: string;
  lessonId: string;
  sortOrder: number;
  type: 'card' | 'quiz';
  dataJson: CardData | QuizData;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JpExerciseCreationAttributes extends Optional<JpExerciseAttributes, 'id'> {}

export class JpExercise extends Model<JpExerciseAttributes, JpExerciseCreationAttributes> implements JpExerciseAttributes {
  declare id: string;
  declare lessonId: string;
  declare sortOrder: number;
  declare type: 'card' | 'quiz';
  declare dataJson: CardData | QuizData;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initJpExercise(sequelize: Sequelize): void {
  JpExercise.init(
    {
      id:        { type: DataTypes.CHAR(36),  primaryKey: true },
      lessonId:  { type: DataTypes.CHAR(36),  allowNull: false },
      sortOrder: { type: DataTypes.INTEGER,   allowNull: false, defaultValue: 0 },
      type:      { type: DataTypes.ENUM('card', 'quiz'), allowNull: false },
      dataJson:  { type: DataTypes.JSON,      allowNull: false },
    },
    { sequelize, tableName: 'jp_exercises', underscored: false },
  );
}
