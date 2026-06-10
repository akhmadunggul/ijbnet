import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('interview_proposals', 'meetingLink', {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('interview_proposals', 'meetingLink');
}
