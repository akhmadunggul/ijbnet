import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JrasAnswerAttributes {
  id: string;
  attemptId: string;
  itemId: string;
  valueJson: unknown | null;
  valueEncrypted: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasAnswerCreationAttributes
  extends Optional<JrasAnswerAttributes, 'id' | 'valueJson' | 'valueEncrypted'> {}

export class JrasAnswer
  extends Model<JrasAnswerAttributes, JrasAnswerCreationAttributes>
  implements JrasAnswerAttributes {
  declare id: string;
  declare attemptId: string;
  declare itemId: string;
  declare valueJson: unknown | null;
  declare valueEncrypted: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasAnswer(sequelize: Sequelize): void {
  JrasAnswer.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      attemptId: { type: DataTypes.UUID, allowNull: false },
      itemId: { type: DataTypes.UUID, allowNull: false },
      valueJson: { type: DataTypes.JSON, allowNull: true },
      valueEncrypted: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'jras_answers' },
  );
}
