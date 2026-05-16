import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('global_settings', {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key:       { type: DataTypes.STRING(100), allowNull: false, unique: true },
      value:     { type: DataTypes.JSON, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    // Seed default: all candidate profile tabs active
    const defaultTabConfig = {
      tab1: true,
      tab2: true,
      tab3: true,
      tab4: true,
      tab5: true,
      tab6: true,
      tab7: true,
      tab8: true,
      tab9: true,
    };

    await queryInterface.bulkInsert('global_settings', [
      {
        id:        require('crypto').randomUUID(),
        key:       'candidate_tab_config',
        value:     JSON.stringify(defaultTabConfig),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('global_settings');
  },
};
