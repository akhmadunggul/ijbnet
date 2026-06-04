import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('candidate_gakken_resumes', {
    id:                      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    candidateId:             { type: DataTypes.UUID, allowNull: false, unique: true },
    careerSummary:           { type: DataTypes.TEXT, allowNull: true },
    careerSummaryJa:         { type: DataTypes.TEXT, allowNull: true },
    currentCompanyName:      { type: DataTypes.STRING(255), allowNull: true },
    currentBusinessActivity: { type: DataTypes.TEXT, allowNull: true },
    currentCapital:          { type: DataTypes.STRING(100), allowNull: true },
    currentRevenue:          { type: DataTypes.STRING(100), allowNull: true },
    currentEmployeeCount:    { type: DataTypes.INTEGER, allowNull: true },
    skills:                  { type: DataTypes.TEXT, allowNull: true },
    skillsJa:                { type: DataTypes.TEXT, allowNull: true },
    selfPr:                  { type: DataTypes.TEXT, allowNull: true },
    selfPrJa:                { type: DataTypes.TEXT, allowNull: true },
    createdAt:               { type: DataTypes.DATE, allowNull: false },
    updatedAt:               { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('candidate_gakken_resumes');
}
