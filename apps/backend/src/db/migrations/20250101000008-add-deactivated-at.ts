import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('users', 'deactivatedAt', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('users', 'deactivatedAt');
  },
};
