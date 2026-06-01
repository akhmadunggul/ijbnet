import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('candidate_careers', 'productId', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'productJa', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'jobTitleId', {
    type: DataTypes.STRING(255),
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'jobTitleJa', {
    type: DataTypes.STRING(255),
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'memberRoleId', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'memberRoleJa', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('candidate_careers', 'memberRoleJa');
  await queryInterface.removeColumn('candidate_careers', 'memberRoleId');
  await queryInterface.removeColumn('candidate_careers', 'jobTitleJa');
  await queryInterface.removeColumn('candidate_careers', 'jobTitleId');
  await queryInterface.removeColumn('candidate_careers', 'productJa');
  await queryInterface.removeColumn('candidate_careers', 'productId');
}
