import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    // japanese_tests
    await queryInterface.createTable('candidate_japanese_tests', {
      id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
      testName:    { type: DataTypes.STRING(50),  allowNull: true },
      score:       { type: DataTypes.INTEGER,     allowNull: true },
      pass:        { type: DataTypes.BOOLEAN,     allowNull: true },
      testDate:    { type: DataTypes.DATE,         allowNull: true },
      createdAt:   { type: DataTypes.DATE,         allowNull: false },
    });

    // intro_videos
    await queryInterface.createTable('candidate_intro_videos', {
      id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
      label:       { type: DataTypes.STRING(100), allowNull: true },
      youtubeUrl:  { type: DataTypes.TEXT,         allowNull: true },
      youtubeId:   { type: DataTypes.STRING(50),   allowNull: true },
      videoDate:   { type: DataTypes.STRING(50),   allowNull: true },
      uploadedBy:  { type: DataTypes.UUID,          allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      sortOrder:   { type: DataTypes.INTEGER,       defaultValue: 0 },
      createdAt:   { type: DataTypes.DATE,          allowNull: false },
    });

    // career
    await queryInterface.createTable('candidate_careers', {
      id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId: { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
      companyName: { type: DataTypes.STRING(255), allowNull: true },
      division:    { type: DataTypes.STRING(100), allowNull: true },
      skillGroup:  { type: DataTypes.STRING(100), allowNull: true },
      period:      { type: DataTypes.STRING(50),  allowNull: true },
      sortOrder:   { type: DataTypes.INTEGER,      defaultValue: 0 },
      createdAt:   { type: DataTypes.DATE,         allowNull: false },
      updatedAt:   { type: DataTypes.DATE,         allowNull: false },
    });

    // tools_dictionary
    await queryInterface.createTable('tools_dictionaries', {
      id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      nameId:   { type: DataTypes.STRING(100), allowNull: false },
      nameJa:   { type: DataTypes.STRING(100), allowNull: true },
      category: { type: DataTypes.STRING(50),  allowNull: true },
      isActive: { type: DataTypes.BOOLEAN,     defaultValue: true, allowNull: false },
      createdAt:{ type: DataTypes.DATE,        allowNull: false },
      updatedAt:{ type: DataTypes.DATE,        allowNull: false },
    });

    // candidate_tools (join — no timestamps)
    await queryInterface.createTable('candidate_tools', {
      candidateId: { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates',       key: 'id' }, onDelete: 'CASCADE' },
      toolId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'tools_dictionaries', key: 'id' }, onDelete: 'CASCADE' },
    });
    await queryInterface.addConstraint('candidate_tools', {
      fields: ['candidateId', 'toolId'],
      type: 'primary key',
      name: 'pk_candidate_tools',
    });

    // body_check
    await queryInterface.createTable('candidate_body_checks', {
      id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateId:     { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
      verifiedHeight:  { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      verifiedWeight:  { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      carrySeconds:    { type: DataTypes.INTEGER,        allowNull: true },
      visionEncrypted: { type: DataTypes.TEXT,           allowNull: true },
      tattooEncrypted: { type: DataTypes.TEXT,           allowNull: true },
      overallResult:   { type: DataTypes.ENUM('pass','hold','fail'), allowNull: true },
      checkedDate:     { type: DataTypes.DATE,           allowNull: true },
      checkedBy:       { type: DataTypes.UUID,           allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      createdAt:       { type: DataTypes.DATE,           allowNull: false },
      updatedAt:       { type: DataTypes.DATE,           allowNull: false },
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('candidate_body_checks');
    await queryInterface.dropTable('candidate_tools');
    await queryInterface.dropTable('tools_dictionaries');
    await queryInterface.dropTable('candidate_careers');
    await queryInterface.dropTable('candidate_intro_videos');
    await queryInterface.dropTable('candidate_japanese_tests');
  },
};
