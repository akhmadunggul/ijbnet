import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('survey_answers', {
    id:            { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
    responseId:    {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'survey_responses', key: 'id' },
      onDelete: 'CASCADE',
    },
    questionId:    {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'survey_questions', key: 'id' },
      onDelete: 'CASCADE',
    },
    answerText:    { type: DataTypes.TEXT, allowNull: true },
    answerOptions: { type: DataTypes.JSON, allowNull: true },
    createdAt:     { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('survey_answers');
}
