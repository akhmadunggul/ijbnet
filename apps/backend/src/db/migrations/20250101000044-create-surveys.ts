import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('surveys', {
    id:            { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
    slug:          { type: DataTypes.STRING(100), allowNull: false, unique: true },
    titleId:       { type: DataTypes.STRING(300), allowNull: false },
    titleJa:       { type: DataTypes.STRING(300), allowNull: false },
    descriptionId: { type: DataTypes.TEXT, allowNull: true },
    descriptionJa: { type: DataTypes.TEXT, allowNull: true },
    status:        {
      type: DataTypes.ENUM('draft', 'active', 'closed'),
      allowNull: false,
      defaultValue: 'draft',
    },
    publishedAt:   { type: DataTypes.DATE, allowNull: true },
    closedAt:      { type: DataTypes.DATE, allowNull: true },
    isFeatured:    { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    createdAt:     { type: DataTypes.DATE, allowNull: false },
    updatedAt:     { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('surveys');
}
