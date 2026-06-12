import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface JrasInterventionAttributes {
  id: string;
  flagId: string;
  candidateId: string;
  assignedToUserId: string | null;
  actionType: string;
  note: string | null;
  dueDate: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  outcome: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface JrasInterventionCreationAttributes
  extends Optional<JrasInterventionAttributes, 'id' | 'assignedToUserId' | 'note' | 'dueDate' | 'status' | 'outcome'> {}

export class JrasIntervention
  extends Model<JrasInterventionAttributes, JrasInterventionCreationAttributes>
  implements JrasInterventionAttributes {
  declare id: string;
  declare flagId: string;
  declare candidateId: string;
  declare assignedToUserId: string | null;
  declare actionType: string;
  declare note: string | null;
  declare dueDate: string | null;
  declare status: 'open' | 'in_progress' | 'resolved';
  declare outcome: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initJrasIntervention(sequelize: Sequelize): void {
  JrasIntervention.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      flagId: { type: DataTypes.UUID, allowNull: false },
      candidateId: { type: DataTypes.UUID, allowNull: false },
      assignedToUserId: { type: DataTypes.UUID, allowNull: true },
      actionType: { type: DataTypes.STRING(50), allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      dueDate: { type: DataTypes.DATEONLY, allowNull: true },
      status: { type: DataTypes.ENUM('open', 'in_progress', 'resolved'), allowNull: false, defaultValue: 'open' },
      outcome: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, tableName: 'jras_interventions' },
  );
}
