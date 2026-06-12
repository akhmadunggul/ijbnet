import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { JrasDimensionKey, JrasInstrumentType, JrasInstrumentStatus } from '@ijbnet/shared';

export interface JrasInstrumentAttributes {
  id: string;
  dimensionKey: JrasDimensionKey;
  type: JrasInstrumentType;
  version: number;
  status: JrasInstrumentStatus;
  titleId: string;
  titleJa: string;
  descriptionId: string | null;
  descriptionJa: string | null;
  createdBy: string | null;
  sentToReviewAt: Date | null;
  activatedAt: Date | null;
  retiredAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasInstrumentCreationAttributes
  extends Optional<
    JrasInstrumentAttributes,
    'id' | 'version' | 'status' | 'descriptionId' | 'descriptionJa' | 'createdBy'
    | 'sentToReviewAt' | 'activatedAt' | 'retiredAt'
  > {}

export class JrasInstrument
  extends Model<JrasInstrumentAttributes, JrasInstrumentCreationAttributes>
  implements JrasInstrumentAttributes {
  declare id: string;
  declare dimensionKey: JrasDimensionKey;
  declare type: JrasInstrumentType;
  declare version: number;
  declare status: JrasInstrumentStatus;
  declare titleId: string;
  declare titleJa: string;
  declare descriptionId: string | null;
  declare descriptionJa: string | null;
  declare createdBy: string | null;
  declare sentToReviewAt: Date | null;
  declare activatedAt: Date | null;
  declare retiredAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasInstrument(sequelize: Sequelize): void {
  JrasInstrument.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      dimensionKey: {
        type: DataTypes.ENUM('language', 'culture', 'legal', 'psych', 'finance', 'motivation', 'observation'),
        allowNull: false,
      },
      type: { type: DataTypes.ENUM('sjt', 'likert', 'quiz', 'observation'), allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      status: {
        type: DataTypes.ENUM('draft', 'in_review', 'approved', 'active', 'retired'),
        allowNull: false,
        defaultValue: 'draft',
      },
      titleId: { type: DataTypes.STRING(200), allowNull: false },
      titleJa: { type: DataTypes.STRING(200), allowNull: false },
      descriptionId: { type: DataTypes.TEXT, allowNull: true },
      descriptionJa: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      sentToReviewAt: { type: DataTypes.DATE, allowNull: true },
      activatedAt: { type: DataTypes.DATE, allowNull: true },
      retiredAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: 'jras_instruments' },
  );
}
