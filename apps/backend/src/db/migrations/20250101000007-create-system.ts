import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    // notifications
    await queryInterface.createTable('notifications', {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId:        { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      type:          { type: DataTypes.STRING(50),  allowNull: true },
      title:         { type: DataTypes.STRING(255), allowNull: true },
      body:          { type: DataTypes.TEXT,         allowNull: true },
      isRead:        { type: DataTypes.BOOLEAN,      defaultValue: false, allowNull: false },
      referenceType: { type: DataTypes.STRING(50),  allowNull: true },
      referenceId:   { type: DataTypes.UUID,         allowNull: true },
      createdAt:     { type: DataTypes.DATE,         allowNull: false },
      updatedAt:     { type: DataTypes.DATE,         allowNull: false },
    });
    await queryInterface.addIndex('notifications', ['userId', 'isRead'], { name: 'idx_notifications_user_unread' });

    // audit_logs — append only, no updatedAt
    await queryInterface.createTable('audit_logs', {
      id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId:            { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      action:            { type: DataTypes.STRING(100), allowNull: false },
      entityType:        { type: DataTypes.STRING(50),  allowNull: true },
      entityId:          { type: DataTypes.UUID,         allowNull: true },
      targetCandidateId: { type: DataTypes.UUID,         allowNull: true },
      payload:           { type: DataTypes.JSON,         allowNull: true },
      ipAddress:         { type: DataTypes.STRING(50),   allowNull: true },
      userAgent:         { type: DataTypes.TEXT,          allowNull: true },
      createdAt:         { type: DataTypes.DATE,          allowNull: false },
    });
    await queryInterface.addIndex('audit_logs', ['userId',            'createdAt'], { name: 'idx_audit_user' });
    await queryInterface.addIndex('audit_logs', ['action',            'createdAt'], { name: 'idx_audit_action' });
    await queryInterface.addIndex('audit_logs', ['targetCandidateId', 'createdAt'], { name: 'idx_audit_target_candidate' });
    await queryInterface.addIndex('audit_logs', ['entityType', 'entityId'],         { name: 'idx_audit_entity' });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('notifications');
  },
};
