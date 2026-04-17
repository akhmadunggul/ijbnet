import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('consent_clauses', {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      version:       { type: DataTypes.STRING(20), allowNull: false, unique: true },
      content:       { type: DataTypes.TEXT, allowNull: false },
      contentJa:     { type: DataTypes.TEXT, allowNull: true },
      isActive:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      publishedAt:   { type: DataTypes.DATE, allowNull: true },
      publishedBy:   { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      supersededAt:  { type: DataTypes.DATE, allowNull: true },
      supersededBy:  { type: DataTypes.UUID, allowNull: true },
      sourceType:    { type: DataTypes.ENUM('manual', 'pdf'), allowNull: false, defaultValue: 'manual' },
      sourcePdfName: { type: DataTypes.STRING(255), allowNull: true },
      createdBy:     { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      createdAt:     { type: DataTypes.DATE, allowNull: false },
      updatedAt:     { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('consent_clauses', ['isActive'],    { name: 'idx_consent_clauses_active' });
    await queryInterface.addIndex('consent_clauses', ['version'],     { name: 'idx_consent_clauses_version' });
    await queryInterface.addIndex('consent_clauses', ['publishedAt'], { name: 'idx_consent_clauses_published_at' });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('consent_clauses');
  },
};
