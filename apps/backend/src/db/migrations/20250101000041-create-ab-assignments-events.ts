import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('ab_assignments', {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    experimentId: {
      type: DataTypes.UUID, allowNull: false,
      references: { model: 'ab_experiments', key: 'id' },
      onDelete: 'CASCADE',
    },
    userId:      { type: DataTypes.UUID, allowNull: false },
    variantKey:  { type: DataTypes.STRING(50), allowNull: false },
    assignedAt:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('ab_assignments', ['experimentId', 'userId'], { unique: true, name: 'ab_assignments_exp_user_unique' });
  await queryInterface.addIndex('ab_assignments', ['userId'], { name: 'ab_assignments_user_idx' });

  await queryInterface.createTable('ab_events', {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    experimentId: {
      type: DataTypes.UUID, allowNull: false,
      references: { model: 'ab_experiments', key: 'id' },
      onDelete: 'CASCADE',
    },
    userId:     { type: DataTypes.UUID, allowNull: false },
    variantKey: { type: DataTypes.STRING(50), allowNull: false },
    event:      { type: DataTypes.STRING(100), allowNull: false },
    metadata:   { type: DataTypes.JSON, allowNull: true },
    createdAt:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('ab_events', ['experimentId', 'userId'], { name: 'ab_events_exp_user_idx' });
  await queryInterface.addIndex('ab_events', ['experimentId', 'event'], { name: 'ab_events_exp_event_idx' });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('ab_events');
  await queryInterface.dropTable('ab_assignments');
}
