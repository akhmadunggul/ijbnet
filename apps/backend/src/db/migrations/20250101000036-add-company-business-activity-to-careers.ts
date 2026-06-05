import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('candidate_careers', 'companyBusinessActivity', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('candidate_careers', 'companyBusinessActivity');
}
