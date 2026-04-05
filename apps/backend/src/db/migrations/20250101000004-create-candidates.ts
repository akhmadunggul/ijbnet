import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('candidates', {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      candidateCode: { type: DataTypes.STRING(20),  allowNull: false, unique: true },
      userId:        { type: DataTypes.UUID,         allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      lpkId:         { type: DataTypes.UUID,         allowNull: true, references: { model: 'lpks',  key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      profileStatus: {
        type: DataTypes.ENUM('incomplete', 'submitted', 'under_review', 'approved', 'confirmed', 'rejected'),
        defaultValue: 'incomplete',
        allowNull: false,
      },
      isLocked:      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },

      // Privacy / Consent
      consentGiven:  { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      consentGivenAt:{ type: DataTypes.DATE,    allowNull: true },

      // Personal
      fullName:      { type: DataTypes.STRING(255), allowNull: false },
      gender:        { type: DataTypes.ENUM('M', 'F'), allowNull: true },
      dateOfBirth:   { type: DataTypes.DATE,           allowNull: true },
      heightCm:      { type: DataTypes.DECIMAL(5, 2),  allowNull: true },
      weightKg:      { type: DataTypes.DECIMAL(5, 2),  allowNull: true },
      nikEncrypted:  { type: DataTypes.TEXT,            allowNull: true },
      email:         { type: DataTypes.STRING(255),     allowNull: true },
      phone:         { type: DataTypes.STRING(30),      allowNull: true },
      address:       { type: DataTypes.TEXT,            allowNull: true },

      // Education
      eduLevel: {
        type: DataTypes.ENUM('SD','SMP','SMA','SMK','D1','D2','D3','D4','S1','S2','S3'),
        allowNull: true,
      },
      eduLabel:      { type: DataTypes.STRING(100), allowNull: true },
      eduMajor:      { type: DataTypes.STRING(100), allowNull: true },

      // SSW
      jobCategory:   { type: DataTypes.STRING(50),  allowNull: true },
      sswKubun:      { type: DataTypes.ENUM('SSW1', 'SSW2'), allowNull: true },
      sswSectorJa:   { type: DataTypes.STRING(100), allowNull: true },
      sswFieldJa:    { type: DataTypes.STRING(100), allowNull: true },
      sswSectorId:   { type: DataTypes.STRING(100), allowNull: true },
      sswFieldId:    { type: DataTypes.STRING(100), allowNull: true },
      jpStudyDuration:{ type: DataTypes.STRING(50), allowNull: true },

      // Marital
      maritalStatus: { type: DataTypes.ENUM('single','married','divorced','widowed'), allowNull: true },
      spouseInfo:    { type: DataTypes.STRING(100), allowNull: true },
      childrenCount: { type: DataTypes.INTEGER,     defaultValue: 0 },
      accompany:     { type: DataTypes.ENUM('none','yes'), defaultValue: 'none' },

      // Work plan
      workplanDuration:   { type: DataTypes.STRING(50), allowNull: true },
      workplanGoal:       { type: DataTypes.TEXT,        allowNull: true },
      workplanAfter:      { type: DataTypes.TEXT,        allowNull: true },
      workplanExpectation:{ type: DataTypes.TEXT,        allowNull: true },
      workplanUpdated:    { type: DataTypes.DATE,        allowNull: true },

      // Media — VPS WebP storage
      closeupUrl:    { type: DataTypes.TEXT, allowNull: true },
      fullbodyUrl:   { type: DataTypes.TEXT, allowNull: true },

      // Interview
      interviewStatus: {
        type: DataTypes.ENUM('scheduled','pass','fail','on_hold','cancelled'),
        allowNull: true,
      },

      // Bank
      bankName:             { type: DataTypes.STRING(100), allowNull: true },
      bankAccountEncrypted: { type: DataTypes.TEXT,        allowNull: true },

      // Internal
      internalNotes: { type: DataTypes.TEXT, allowNull: true },

      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex('candidates', ['profileStatus'], { name: 'idx_candidates_status' });
    await queryInterface.addIndex('candidates', ['lpkId'],         { name: 'idx_candidates_lpk' });
    await queryInterface.addIndex('candidates', ['sswKubun', 'sswFieldId'], { name: 'idx_candidates_ssw' });
    await queryInterface.addIndex('candidates', ['gender'],        { name: 'idx_candidates_gender' });
    await queryInterface.addIndex('candidates', ['candidateCode'], { unique: true, name: 'idx_candidates_code' });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('candidates');
  },
};
