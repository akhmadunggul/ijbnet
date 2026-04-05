import { DataTypes, Model, Sequelize } from 'sequelize';

export interface CandidateToolAttributes {
  candidateId: string;
  toolId: string;
}

export class CandidateTool
  extends Model<CandidateToolAttributes, CandidateToolAttributes>
  implements CandidateToolAttributes {
  declare candidateId: string;
  declare toolId: string;
}

export function initCandidateTool(sequelize: Sequelize): void {
  CandidateTool.init(
    {
      candidateId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      toolId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { sequelize, tableName: 'candidate_tools', timestamps: false },
  );
}
