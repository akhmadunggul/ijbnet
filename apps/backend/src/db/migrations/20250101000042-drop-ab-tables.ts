import type { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('ab_events');
  await queryInterface.dropTable('ab_assignments');
  await queryInterface.dropTable('ab_experiments');
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Recreating the full A/B schema is not supported in rollback.
  // Re-run migrations 000040 and 000041 if you need to restore.
  void queryInterface;
}
