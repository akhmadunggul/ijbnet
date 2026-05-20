import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('candidate_careers', 'startDate', {
    type: DataTypes.DATEONLY,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('candidate_careers', 'startDate');
}
