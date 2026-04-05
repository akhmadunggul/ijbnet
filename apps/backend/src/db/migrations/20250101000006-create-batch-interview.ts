import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    // weekly_tests
    await queryInterface.createTable('candidate_weekly_tests', {
      id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
      courseName:  { type: DataTypes.STRING(100), allowNull: true },
      weekNumber:  { type: DataTypes.INTEGER,     allowNull: true },
      score:       { type: DataTypes.INTEGER,     allowNull: true },
      testDate:    { type: DataTypes.DATE,         allowNull: true },
      createdAt:   { type: DataTypes.DATE,         allowNull: false },
      updatedAt:   { type: DataTypes.DATE,         allowNull: false },
    });

    // batches
    await queryInterface.createTable('batches', {
      id:                     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      batchCode:              { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name:                   { type: DataTypes.STRING(255), allowNull: true },
      companyId:              { type: DataTypes.UUID, allowNull: true, references: { model: 'companies', key: 'id' }, onDelete: 'SET NULL' },
      quotaTotal:             { type: DataTypes.INTEGER, allowNull: true },
      interviewCandidateLimit:{ type: DataTypes.INTEGER, allowNull: true },
      sswFieldFilter:         { type: DataTypes.STRING(100), allowNull: true },
      status:                 { type: DataTypes.ENUM('draft','active','selection','approved','closed'), defaultValue: 'draft', allowNull: false },
      expiryDate:             { type: DataTypes.DATE, allowNull: true },
      createdBy:              { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      createdAt:              { type: DataTypes.DATE, allowNull: false },
      updatedAt:              { type: DataTypes.DATE, allowNull: false },
    });

    // batch_candidates
    await queryInterface.createTable('batch_candidates', {
      id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      batchId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'batches',     key: 'id' }, onDelete: 'CASCADE' },
      candidateId:  { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates',  key: 'id' }, onDelete: 'CASCADE' },
      allocatedBy:  { type: DataTypes.UUID, allowNull: true,  references: { model: 'users',       key: 'id' }, onDelete: 'SET NULL' },
      allocatedAt:  { type: DataTypes.DATE, allowNull: true },
      isSelected:   { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      selectedAt:   { type: DataTypes.DATE, allowNull: true },
      isConfirmed:  { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      confirmedAt:  { type: DataTypes.DATE, allowNull: true },
      createdAt:    { type: DataTypes.DATE, allowNull: false },
      updatedAt:    { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('batch_candidates', {
      fields: ['batchId', 'candidateId'],
      type: 'unique',
      name: 'uq_batch_candidate',
    });
    await queryInterface.addIndex('batch_candidates', ['batchId'],     { name: 'idx_bc_batch' });
    await queryInterface.addIndex('batch_candidates', ['candidateId'], { name: 'idx_bc_candidate' });
    await queryInterface.addIndex('batch_candidates', ['isSelected', 'isConfirmed'], { name: 'idx_bc_selected' });

    // interview_proposals
    await queryInterface.createTable('interview_proposals', {
      id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      batchCandidateId: { type: DataTypes.UUID, allowNull: false, references: { model: 'batch_candidates', key: 'id' }, onDelete: 'CASCADE' },
      proposedBy:       { type: DataTypes.UUID, allowNull: true,  references: { model: 'users',            key: 'id' }, onDelete: 'SET NULL' },
      proposedDates:    { type: DataTypes.JSON, allowNull: true },
      finalDate:        { type: DataTypes.DATE, allowNull: true },
      status:           { type: DataTypes.ENUM('proposed','scheduled','completed','cancelled'), defaultValue: 'proposed', allowNull: false },
      createdAt:        { type: DataTypes.DATE, allowNull: false },
      updatedAt:        { type: DataTypes.DATE, allowNull: false },
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('interview_proposals');
    await queryInterface.dropTable('batch_candidates');
    await queryInterface.dropTable('batches');
    await queryInterface.dropTable('candidate_weekly_tests');
  },
};
