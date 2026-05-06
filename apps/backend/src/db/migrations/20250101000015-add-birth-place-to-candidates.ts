import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('candidates', 'birthPlace', {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('candidates', 'birthPlace');
}
