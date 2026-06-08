import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JpCandidateProgressAttributes {
  id: string;
  candidateId: string;
  lessonId: string;
  completedAt: Date;
  score: number | null;
  total: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JpCandidateProgressCreationAttributes extends Optional<JpCandidateProgressAttributes, 'id' | 'score' | 'total'> {}

export class JpCandidateProgress
  extends Model<JpCandidateProgressAttributes, JpCandidateProgressCreationAttributes>
  implements JpCandidateProgressAttributes {
  declare id: string;
  declare candidateId: string;
  declare lessonId: string;
  declare completedAt: Date;
  declare score: number | null;
  declare total: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export function initJpCandidateProgress(sequelize: Sequelize): void {
  JpCandidateProgress.init(
    {
      id:          { type: DataTypes.CHAR(36), primaryKey: true },
      candidateId: { type: DataTypes.CHAR(36), allowNull: false },
      lessonId:    { type: DataTypes.CHAR(36), allowNull: false },
      completedAt: { type: DataTypes.DATE,     allowNull: false },
      score:       { type: DataTypes.INTEGER,  allowNull: true },
      total:       { type: DataTypes.INTEGER,  allowNull: true },
    },
    { sequelize, tableName: 'jp_candidate_progress', underscored: false },
  );
}
