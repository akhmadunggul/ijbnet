import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('interview_proposals', 'candidatePreferredDate', {
      type: DataTypes.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('interview_proposals', 'candidatePreferredDate');
  },
};
