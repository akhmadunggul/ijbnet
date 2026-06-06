import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface AbAssignmentAttributes {
  id: string;
  experimentId: string;
  userId: string;
  variantKey: string;
  assignedAt?: Date;
}

export interface AbAssignmentCreationAttributes
  extends Optional<AbAssignmentAttributes, 'id' | 'assignedAt'> {}

export class AbAssignment
  extends Model<AbAssignmentAttributes, AbAssignmentCreationAttributes>
  implements AbAssignmentAttributes {
  declare id: string;
  declare experimentId: string;
  declare userId: string;
  declare variantKey: string;
  declare assignedAt: Date;
}

export function initAbAssignment(sequelize: Sequelize): void {
  AbAssignment.init(
    {
      id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      experimentId: { type: DataTypes.UUID, allowNull: false },
      userId:       { type: DataTypes.UUID, allowNull: false },
      variantKey:   { type: DataTypes.STRING(50), allowNull: false },
      assignedAt:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, tableName: 'ab_assignments', timestamps: false },
  );
}
