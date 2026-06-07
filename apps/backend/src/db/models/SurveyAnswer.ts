import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface SurveyAnswerAttributes {
  id: string;
  responseId: string;
  questionId: string;
  answerText: string | null;
  answerOptions: string[] | null;
  createdAt?: Date;
}

export interface SurveyAnswerCreationAttributes
  extends Optional<SurveyAnswerAttributes, 'id' | 'answerText' | 'answerOptions'> {}

export class SurveyAnswer
  extends Model<SurveyAnswerAttributes, SurveyAnswerCreationAttributes>
  implements SurveyAnswerAttributes {
  declare id: string;
  declare responseId: string;
  declare questionId: string;
  declare answerText: string | null;
  declare answerOptions: string[] | null;
  declare readonly createdAt: Date;
}

export function initSurveyAnswer(sequelize: Sequelize): void {
  SurveyAnswer.init(
    {
      id:            { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      responseId:    { type: DataTypes.CHAR(36), allowNull: false },
      questionId:    { type: DataTypes.CHAR(36), allowNull: false },
      answerText:    { type: DataTypes.TEXT, allowNull: true },
      answerOptions: { type: DataTypes.JSON, allowNull: true },
    },
    { sequelize, tableName: 'survey_answers', timestamps: true, updatedAt: false },
  );
}
