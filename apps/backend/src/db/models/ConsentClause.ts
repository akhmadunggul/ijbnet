import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface ConsentClauseAttributes {
  id: string;
  version: string;
  content: string;
  contentJa: string | null;
  isActive: boolean;
  publishedAt: Date | null;
  publishedBy: string | null;
  supersededAt: Date | null;
  supersededBy: string | null;
  sourceType: 'manual' | 'pdf';
  sourcePdfName: string | null;
  createdBy: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConsentClauseCreationAttributes
  extends Optional<
    ConsentClauseAttributes,
    | 'id'
    | 'contentJa'
    | 'isActive'
    | 'publishedAt'
    | 'publishedBy'
    | 'supersededAt'
    | 'supersededBy'
    | 'sourceType'
    | 'sourcePdfName'
    | 'createdBy'
  > {}

export class ConsentClause
  extends Model<ConsentClauseAttributes, ConsentClauseCreationAttributes>
  implements ConsentClauseAttributes {
  declare id: string;
  declare version: string;
  declare content: string;
  declare contentJa: string | null;
  declare isActive: boolean;
  declare publishedAt: Date | null;
  declare publishedBy: string | null;
  declare supersededAt: Date | null;
  declare supersededBy: string | null;
  declare sourceType: 'manual' | 'pdf';
  declare sourcePdfName: string | null;
  declare createdBy: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initConsentClause(sequelize: Sequelize): void {
  ConsentClause.init(
    {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      version:       { type: DataTypes.STRING(20), allowNull: false, unique: true },
      content:       { type: DataTypes.TEXT, allowNull: false },
      contentJa:     { type: DataTypes.TEXT, allowNull: true },
      isActive:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      publishedAt:   { type: DataTypes.DATE, allowNull: true },
      publishedBy:   { type: DataTypes.UUID, allowNull: true },
      supersededAt:  { type: DataTypes.DATE, allowNull: true },
      supersededBy:  { type: DataTypes.UUID, allowNull: true },
      sourceType:    { type: DataTypes.ENUM('manual', 'pdf'), allowNull: false, defaultValue: 'manual' },
      sourcePdfName: { type: DataTypes.STRING(255), allowNull: true },
      createdBy:     { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: 'consent_clauses', timestamps: true },
  );
}
