import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('interview_proposals', 'meeting_link', {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('interview_proposals', 'meeting_link');
}
