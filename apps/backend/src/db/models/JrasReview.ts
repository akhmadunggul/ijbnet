import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { JrasReviewVerdict } from '@ijbnet/shared';

export interface JrasReviewItemNote {
  itemId: string;
  verdict: 'ok' | 'needs_change';
  comment?: string;
}

export interface JrasReviewAttributes {
  id: string;
  instrumentId: string;
  instrumentVersion: number;
  reviewerUserId: string;
  verdict: JrasReviewVerdict;
  note: string | null;
  itemNotesJson: JrasReviewItemNote[] | null;
  submittedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasReviewCreationAttributes
  extends Optional<JrasReviewAttributes, 'id' | 'note' | 'itemNotesJson'> {}

export class JrasReview
  extends Model<JrasReviewAttributes, JrasReviewCreationAttributes>
  implements JrasReviewAttributes {
  declare id: string;
  declare instrumentId: string;
  declare instrumentVersion: number;
  declare reviewerUserId: string;
  declare verdict: JrasReviewVerdict;
  declare note: string | null;
  declare itemNotesJson: JrasReviewItemNote[] | null;
  declare submittedAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasReview(sequelize: Sequelize): void {
  JrasReview.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      instrumentId: { type: DataTypes.UUID, allowNull: false },
      instrumentVersion: { type: DataTypes.INTEGER, allowNull: false },
      reviewerUserId: { type: DataTypes.UUID, allowNull: false },
      verdict: { type: DataTypes.ENUM('approve', 'request_changes'), allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      itemNotesJson: { type: DataTypes.JSON, allowNull: true },
      submittedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, tableName: 'jras_reviews' },
  );
}
