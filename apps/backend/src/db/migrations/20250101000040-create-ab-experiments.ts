import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('ab_experiments', {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:        { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    hypothesis:  { type: DataTypes.TEXT, allowNull: true },
    status:      { type: DataTypes.ENUM('draft', 'active', 'paused', 'concluded'), defaultValue: 'draft', allowNull: false },
    variants:    { type: DataTypes.JSON, allowNull: false },
    targeting:   { type: DataTypes.JSON, allowNull: false },
    metric:      { type: DataTypes.STRING(100), allowNull: true },
    startDate:   { type: DataTypes.DATEONLY, allowNull: true },
    endDate:     { type: DataTypes.DATEONLY, allowNull: true },
    createdAt:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('ab_experiments');
}
