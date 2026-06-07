import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface SurveyResponseAttributes {
  id: string;
  surveyId: string;
  respondentToken: string;
  ipHash: string | null;
  submittedAt: Date;
  createdAt?: Date;
}

export interface SurveyResponseCreationAttributes
  extends Optional<SurveyResponseAttributes, 'id' | 'ipHash'> {}

export class SurveyResponse
  extends Model<SurveyResponseAttributes, SurveyResponseCreationAttributes>
  implements SurveyResponseAttributes {
  declare id: string;
  declare surveyId: string;
  declare respondentToken: string;
  declare ipHash: string | null;
  declare submittedAt: Date;
  declare readonly createdAt: Date;
}

export function initSurveyResponse(sequelize: Sequelize): void {
  SurveyResponse.init(
    {
      id:               { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      surveyId:         { type: DataTypes.CHAR(36), allowNull: false },
      respondentToken:  { type: DataTypes.CHAR(36), allowNull: false, unique: true },
      ipHash:           { type: DataTypes.STRING(64), allowNull: true },
      submittedAt:      { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, tableName: 'survey_responses', timestamps: true, updatedAt: false },
  );
}
