import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('users', {
      id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      email:        { type: DataTypes.STRING(255), allowNull: false, unique: true },
      name:         { type: DataTypes.STRING(255), allowNull: true },
      googleId:     { type: DataTypes.STRING(255), allowNull: true, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: true },
      role:         {
        type: DataTypes.ENUM('candidate', 'admin', 'manager', 'recruiter', 'super_admin'),
        allowNull: false,
      },
      avatarUrl:    { type: DataTypes.TEXT,         allowNull: true },
      isActive:     { type: DataTypes.BOOLEAN,      defaultValue: true, allowNull: false },
      mfaSecret:    { type: DataTypes.STRING(255),  allowNull: true },
      companyId:    {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      lpkId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'lpks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      lastLoginAt:  { type: DataTypes.DATE, allowNull: true },
      createdAt:    { type: DataTypes.DATE, allowNull: false },
      updatedAt:    { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('users', ['email'],    { unique: true, name: 'idx_users_email' });
    await queryInterface.addIndex('users', ['googleId'], { unique: true, name: 'idx_users_google_id', where: { googleId: { [Symbol.for('ne')]: null } } as any });
    await queryInterface.addIndex('users', ['role'],     { name: 'idx_users_role' });
    await queryInterface.addIndex('users', ['companyId'],{ name: 'idx_users_company' });
    await queryInterface.addIndex('users', ['lpkId'],    { name: 'idx_users_lpk' });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('users');
  },
};
