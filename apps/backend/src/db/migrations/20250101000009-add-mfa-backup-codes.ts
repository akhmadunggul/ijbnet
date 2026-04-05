import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('user_mfa_backup_codes', {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId:    { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      codeHash:  { type: DataTypes.STRING(255), allowNull: false },
      usedAt:    { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('user_mfa_backup_codes', ['userId'], { name: 'idx_mfa_backup_user' });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('user_mfa_backup_codes');
  },
};
