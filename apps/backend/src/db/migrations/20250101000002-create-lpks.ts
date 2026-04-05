import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('lpks', {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name:          { type: DataTypes.STRING(255), allowNull: false },
      city:          { type: DataTypes.STRING(100), allowNull: true },
      province:      { type: DataTypes.STRING(100), allowNull: true },
      contactPerson: { type: DataTypes.STRING(255), allowNull: true },
      email:         { type: DataTypes.STRING(255), allowNull: true },
      phone:         { type: DataTypes.STRING(50),  allowNull: true },
      assignedAdmin: { type: DataTypes.UUID,         allowNull: true },
      isActive:      { type: DataTypes.BOOLEAN,      defaultValue: true, allowNull: false },
      createdAt:     { type: DataTypes.DATE,          allowNull: false },
      updatedAt:     { type: DataTypes.DATE,          allowNull: false },
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('lpks');
  },
};
