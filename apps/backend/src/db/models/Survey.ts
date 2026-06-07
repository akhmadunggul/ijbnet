import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type SurveyStatus = 'draft' | 'active' | 'closed';

export interface SurveyAttributes {
  id: string;
  slug: string;
  titleId: string;
  titleJa: string;
  descriptionId: string | null;
  descriptionJa: string | null;
  status: SurveyStatus;
  publishedAt: Date | null;
  closedAt: Date | null;
  isFeatured: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SurveyCreationAttributes
  extends Optional<SurveyAttributes, 'id' | 'descriptionId' | 'descriptionJa' | 'publishedAt' | 'closedAt'> {}

export class Survey
  extends Model<SurveyAttributes, SurveyCreationAttributes>
  implements SurveyAttributes {
  declare id: string;
  declare slug: string;
  declare titleId: string;
  declare titleJa: string;
  declare descriptionId: string | null;
  declare descriptionJa: string | null;
  declare status: SurveyStatus;
  declare publishedAt: Date | null;
  declare closedAt: Date | null;
  declare isFeatured: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initSurvey(sequelize: Sequelize): void {
  Survey.init(
    {
      id:            { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      slug:          { type: DataTypes.STRING(100), allowNull: false, unique: true },
      titleId:       { type: DataTypes.STRING(300), allowNull: false },
      titleJa:       { type: DataTypes.STRING(300), allowNull: false },
      descriptionId: { type: DataTypes.TEXT, allowNull: true },
      descriptionJa: { type: DataTypes.TEXT, allowNull: true },
      status:        {
        type: DataTypes.ENUM('draft', 'active', 'closed'),
        allowNull: false,
        defaultValue: 'draft',
      },
      publishedAt:   { type: DataTypes.DATE, allowNull: true },
      closedAt:      { type: DataTypes.DATE, allowNull: true },
      isFeatured:    { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    },
    { sequelize, tableName: 'surveys', timestamps: true },
  );
}
