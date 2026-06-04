import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('candidate_careers', 'divisionJa', {
    type: DataTypes.STRING(200),
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'skillGroupJa', {
    type: DataTypes.STRING(200),
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('candidate_careers', 'skillGroupJa');
  await queryInterface.removeColumn('candidate_careers', 'divisionJa');
}
