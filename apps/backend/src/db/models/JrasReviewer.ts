import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { JrasReviewerType } from '@ijbnet/shared';

export interface JrasReviewerAttributes {
  id: string;
  userId: string;
  reviewerType: JrasReviewerType;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasReviewerCreationAttributes
  extends Optional<JrasReviewerAttributes, 'id' | 'active'> {}

export class JrasReviewer
  extends Model<JrasReviewerAttributes, JrasReviewerCreationAttributes>
  implements JrasReviewerAttributes {
  declare id: string;
  declare userId: string;
  declare reviewerType: JrasReviewerType;
  declare active: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasReviewer(sequelize: Sequelize): void {
  JrasReviewer.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },
      reviewerType: { type: DataTypes.ENUM('ex_ssw', 'jp_hr', 'expert'), allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, tableName: 'jras_reviewers' },
  );
}
