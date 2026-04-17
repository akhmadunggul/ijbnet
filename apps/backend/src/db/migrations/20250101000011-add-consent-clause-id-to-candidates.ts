import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('candidates', 'consentClauseId', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'consent_clauses', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('candidates', 'consentClauseId');
  },
};
