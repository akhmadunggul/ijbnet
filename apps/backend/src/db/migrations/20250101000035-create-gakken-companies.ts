import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('candidate_gakken_companies', {
    id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    candidateId:  { type: DataTypes.UUID, allowNull: false },
    period:       { type: DataTypes.STRING(50), allowNull: true },
    productId:    { type: DataTypes.TEXT, allowNull: true },
    productJa:    { type: DataTypes.TEXT, allowNull: true },
    dutiesId:     { type: DataTypes.TEXT, allowNull: true },
    dutiesJa:     { type: DataTypes.TEXT, allowNull: true },
    memberRoleId: { type: DataTypes.TEXT, allowNull: true },
    memberRoleJa: { type: DataTypes.TEXT, allowNull: true },
    sortOrder:    { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    createdAt:    { type: DataTypes.DATE, allowNull: false },
    updatedAt:    { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('candidate_gakken_companies', ['candidateId']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('candidate_gakken_companies');
}
