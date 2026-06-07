import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('survey_responses', {
    id:               { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
    surveyId:         {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: 'surveys', key: 'id' },
      onDelete: 'CASCADE',
    },
    respondentToken:  { type: DataTypes.CHAR(36), allowNull: false, unique: true },
    ipHash:           { type: DataTypes.STRING(64), allowNull: true },
    submittedAt:      { type: DataTypes.DATE, allowNull: false },
    createdAt:        { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('survey_responses');
}
