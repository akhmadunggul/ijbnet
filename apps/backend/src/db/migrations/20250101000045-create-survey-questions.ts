import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('survey_questions', {
    id:         { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
    surveyId:   {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'surveys', key: 'id' },
      onDelete: 'CASCADE',
    },
    sortOrder:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    type:       {
      type: DataTypes.ENUM('text', 'textarea', 'single', 'multiple', 'rating'),
      allowNull: false,
    },
    questionId: { type: DataTypes.TEXT, allowNull: false },
    questionJa: { type: DataTypes.TEXT, allowNull: false },
    required:   { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    options:    { type: DataTypes.JSON, allowNull: true },
    createdAt:  { type: DataTypes.DATE, allowNull: false },
    updatedAt:  { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('survey_questions');
}
