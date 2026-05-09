import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('recruitment_requests', {
      id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      requestCode:    { type: DataTypes.STRING(50), allowNull: false, unique: true },
      companyId:      { type: DataTypes.UUID, allowNull: false },
      requestedBy:    { type: DataTypes.UUID, allowNull: false },
      kubun:          { type: DataTypes.ENUM('SSW1', 'SSW2', 'Trainee'), allowNull: false },
      sswSectorId:    { type: DataTypes.STRING(120), allowNull: false },
      sswSectorJa:    { type: DataTypes.STRING(120), allowNull: false },
      sswFieldId:     { type: DataTypes.STRING(120), allowNull: false },
      sswFieldJa:     { type: DataTypes.STRING(120), allowNull: false },
      requestedCount: { type: DataTypes.INTEGER, allowNull: false },
      allocatedCount: { type: DataTypes.INTEGER, allowNull: true },
      status:         {
        type: DataTypes.ENUM('pending', 'confirmed', 'rejected', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      batchId:        { type: DataTypes.UUID, allowNull: true },
      notes:          { type: DataTypes.TEXT, allowNull: true },
      managerNotes:   { type: DataTypes.TEXT, allowNull: true },
      confirmedAt:    { type: DataTypes.DATE, allowNull: true },
      createdAt:      { type: DataTypes.DATE, allowNull: false },
      updatedAt:      { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('recruitment_requests', ['companyId']);
    await queryInterface.addIndex('recruitment_requests', ['status']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('recruitment_requests');
  },
};
