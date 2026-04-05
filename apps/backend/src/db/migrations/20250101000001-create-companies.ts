import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('companies', {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name:          { type: DataTypes.STRING(255), allowNull: false },
      nameJa:        { type: DataTypes.STRING(255), allowNull: true },
      contactPerson: { type: DataTypes.STRING(255), allowNull: true },
      email:         { type: DataTypes.STRING(255), allowNull: true },
      phone:         { type: DataTypes.STRING(50),  allowNull: true },
      isActive:      { type: DataTypes.BOOLEAN,     defaultValue: true, allowNull: false },
      createdAt:     { type: DataTypes.DATE,         allowNull: false },
      updatedAt:     { type: DataTypes.DATE,         allowNull: false },
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('companies');
  },
};
