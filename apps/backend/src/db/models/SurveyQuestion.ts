import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type QuestionType = 'text' | 'textarea' | 'single' | 'multiple' | 'rating';

export interface QuestionOption {
  value: string;
  labelId: string;
  labelJa: string;
}

export interface SurveyQuestionAttributes {
  id: string;
  surveyId: string;
  sortOrder: number;
  type: QuestionType;
  questionId: string;
  questionJa: string;
  required: number;
  options: QuestionOption[] | null;
  groupLabelJa: string | null;
  groupLabelId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SurveyQuestionCreationAttributes
  extends Optional<SurveyQuestionAttributes, 'id' | 'options' | 'groupLabelJa' | 'groupLabelId'> {}

export class SurveyQuestion
  extends Model<SurveyQuestionAttributes, SurveyQuestionCreationAttributes>
  implements SurveyQuestionAttributes {
  declare id: string;
  declare surveyId: string;
  declare sortOrder: number;
  declare type: QuestionType;
  declare questionId: string;
  declare questionJa: string;
  declare required: number;
  declare options: QuestionOption[] | null;
  declare groupLabelJa: string | null;
  declare groupLabelId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initSurveyQuestion(sequelize: Sequelize): void {
  SurveyQuestion.init(
    {
      id:           { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      surveyId:     { type: DataTypes.CHAR(36), allowNull: false },
      sortOrder:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      type:         {
        type: DataTypes.ENUM('text', 'textarea', 'single', 'multiple', 'rating'),
        allowNull: false,
      },
      questionId:   { type: DataTypes.TEXT, allowNull: false },
      questionJa:   { type: DataTypes.TEXT, allowNull: false },
      required:     { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
      options:      { type: DataTypes.JSON, allowNull: true },
      groupLabelJa: { type: DataTypes.TEXT, allowNull: true },
      groupLabelId: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'survey_questions', timestamps: true },
  );
}
