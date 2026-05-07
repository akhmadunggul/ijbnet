import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('ssw_sector_fields', {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      kubun:     { type: DataTypes.ENUM('SSW1', 'SSW2'), allowNull: false },
      sectorId:  { type: DataTypes.STRING(120), allowNull: false },
      sectorJa:  { type: DataTypes.STRING(120), allowNull: false },
      fieldId:   { type: DataTypes.STRING(120), allowNull: false },
      fieldJa:   { type: DataTypes.STRING(120), allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ssw_sector_fields', ['kubun', 'sectorId', 'sortOrder']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('ssw_sector_fields');
  },
};
