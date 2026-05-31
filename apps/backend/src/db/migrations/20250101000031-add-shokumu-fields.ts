import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add shokumu fields to candidate_careers
  await queryInterface.addColumn('candidate_careers', 'companyType', {
    type: DataTypes.STRING(100),
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'employeeCount', {
    type: DataTypes.INTEGER,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'annualSales', {
    type: DataTypes.STRING(100),
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'capitalAmount', {
    type: DataTypes.STRING(100),
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'dutiesId', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'dutiesJa', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'achievementsId', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidate_careers', 'achievementsJa', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  // Add shokumu summary fields to candidates
  await queryInterface.addColumn('candidates', 'careerSummaryId', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);

  await queryInterface.addColumn('candidates', 'careerSummaryJa', {
    type: DataTypes.TEXT,
    allowNull: true,
  } as Parameters<typeof queryInterface.addColumn>[2]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('candidates', 'careerSummaryJa');
  await queryInterface.removeColumn('candidates', 'careerSummaryId');
  await queryInterface.removeColumn('candidate_careers', 'achievementsJa');
  await queryInterface.removeColumn('candidate_careers', 'achievementsId');
  await queryInterface.removeColumn('candidate_careers', 'dutiesJa');
  await queryInterface.removeColumn('candidate_careers', 'dutiesId');
  await queryInterface.removeColumn('candidate_careers', 'capitalAmount');
  await queryInterface.removeColumn('candidate_careers', 'annualSales');
  await queryInterface.removeColumn('candidate_careers', 'employeeCount');
  await queryInterface.removeColumn('candidate_careers', 'companyType');
}
