import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('jp_topics', {
    id:            { type: DataTypes.UUID,         primaryKey: true, allowNull: false },
    level:         { type: DataTypes.STRING(10),   allowNull: false, defaultValue: 'A1' },
    sortOrder:     { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0 },
    titleJa:       { type: DataTypes.STRING(200),  allowNull: false },
    titleId:       { type: DataTypes.STRING(200),  allowNull: false },
    descriptionJa: { type: DataTypes.TEXT,         allowNull: true },
    descriptionId: { type: DataTypes.TEXT,         allowNull: true },
    emoji:         { type: DataTypes.STRING(10),   allowNull: true },
    createdAt:     { type: DataTypes.DATE,         allowNull: false },
    updatedAt:     { type: DataTypes.DATE,         allowNull: false },
  });

  await queryInterface.createTable('jp_lessons', {
    id:        { type: DataTypes.UUID,         primaryKey: true, allowNull: false },
    topicId:   { type: DataTypes.UUID,         allowNull: false, references: { model: 'jp_topics', key: 'id' }, onDelete: 'CASCADE' },
    sortOrder: { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0 },
    titleJa:   { type: DataTypes.STRING(200),  allowNull: false },
    titleId:   { type: DataTypes.STRING(200),  allowNull: false },
    type:      { type: DataTypes.ENUM('vocabulary', 'quiz'), allowNull: false },
    createdAt: { type: DataTypes.DATE,         allowNull: false },
    updatedAt: { type: DataTypes.DATE,         allowNull: false },
  });

  await queryInterface.createTable('jp_exercises', {
    id:        { type: DataTypes.UUID,         primaryKey: true, allowNull: false },
    lessonId:  { type: DataTypes.UUID,         allowNull: false, references: { model: 'jp_lessons', key: 'id' }, onDelete: 'CASCADE' },
    sortOrder: { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0 },
    type:      { type: DataTypes.ENUM('card', 'quiz'), allowNull: false },
    dataJson:  { type: DataTypes.JSON,         allowNull: false },
    createdAt: { type: DataTypes.DATE,         allowNull: false },
    updatedAt: { type: DataTypes.DATE,         allowNull: false },
  });

  await queryInterface.createTable('jp_candidate_progress', {
    id:          { type: DataTypes.UUID,      primaryKey: true, allowNull: false },
    candidateId: { type: DataTypes.UUID,      allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
    lessonId:    { type: DataTypes.UUID,      allowNull: false, references: { model: 'jp_lessons', key: 'id' }, onDelete: 'CASCADE' },
    completedAt: { type: DataTypes.DATE,      allowNull: false },
    score:       { type: DataTypes.INTEGER,   allowNull: true },
    total:       { type: DataTypes.INTEGER,   allowNull: true },
    createdAt:   { type: DataTypes.DATE,      allowNull: false },
    updatedAt:   { type: DataTypes.DATE,      allowNull: false },
  });

  await queryInterface.addIndex('jp_candidate_progress', ['candidateId', 'lessonId'], {
    unique: true,
    name: 'jp_candidate_progress_candidate_lesson_unique',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('jp_candidate_progress');
  await queryInterface.dropTable('jp_exercises');
  await queryInterface.dropTable('jp_lessons');
  await queryInterface.dropTable('jp_topics');
}
