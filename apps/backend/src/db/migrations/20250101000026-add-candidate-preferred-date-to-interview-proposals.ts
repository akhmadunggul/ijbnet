import { QueryInterface, DataTypes } from 'sequelize';

export async function up({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.addColumn('interview_proposals', 'candidatePreferredDate', {
    type: DataTypes.DATEONLY,
    allowNull: true,
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }): Promise<void> {
  await queryInterface.removeColumn('interview_proposals', 'candidatePreferredDate');
}
