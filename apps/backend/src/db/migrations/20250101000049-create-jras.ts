import { QueryInterface, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

// JRAS-P1: role reviewer, kolom kategori jp_topics, dan seluruh tabel jras_*.
// FK ke candidates/users/jp_lessons memakai DataTypes.UUID agar collation cocok
// (pelajaran migrasi 000044). addIndex dibungkus catch duplicate agar idempoten.

const DIMENSION_ENUM = DataTypes.ENUM(
  'language', 'culture', 'legal', 'psych', 'finance', 'motivation', 'observation',
);

async function safeAddIndex(
  qi: QueryInterface,
  table: string,
  fields: string[],
  options: { unique?: boolean; name: string },
): Promise<void> {
  await qi.addIndex(table, fields, options).catch((e: Error) => {
    if (!e.message.includes('Duplicate key name')) throw e;
  });
}

export async function up(qi: QueryInterface): Promise<void> {
  // ── 1. Role baru: reviewer ──────────────────────────────────────────────────
  await qi.sequelize.query(
    "ALTER TABLE users MODIFY COLUMN role ENUM('candidate', 'admin', 'manager', 'recruiter', 'super_admin', 'reviewer') NOT NULL;",
  );

  // ── 2. Kategori modul pembelajaran (default language = perilaku lama) ───────
  await qi.addColumn('jp_topics', 'category', {
    type: DataTypes.ENUM('language', 'culture', 'legal', 'finance', 'mental'),
    allowNull: false,
    defaultValue: 'language',
  });

  // ── 3. Instrumen & item bank ────────────────────────────────────────────────
  await qi.createTable('jras_instruments', {
    id:             { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    dimensionKey:   { type: DIMENSION_ENUM, allowNull: false },
    type:           { type: DataTypes.ENUM('sjt', 'likert', 'quiz', 'observation'), allowNull: false },
    version:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    status:         { type: DataTypes.ENUM('draft', 'in_review', 'approved', 'active', 'retired'), allowNull: false, defaultValue: 'draft' },
    titleId:        { type: DataTypes.STRING(200), allowNull: false },
    titleJa:        { type: DataTypes.STRING(200), allowNull: false },
    descriptionId:  { type: DataTypes.TEXT, allowNull: true },
    descriptionJa:  { type: DataTypes.TEXT, allowNull: true },
    createdBy:      { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    sentToReviewAt: { type: DataTypes.DATE, allowNull: true },
    activatedAt:    { type: DataTypes.DATE, allowNull: true },
    retiredAt:      { type: DataTypes.DATE, allowNull: true },
    createdAt:      { type: DataTypes.DATE, allowNull: false },
    updatedAt:      { type: DataTypes.DATE, allowNull: false },
  });

  await qi.createTable('jras_items', {
    id:           { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    instrumentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'jras_instruments', key: 'id' }, onDelete: 'CASCADE' },
    orderNo:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    type:         { type: DataTypes.ENUM('sjt', 'likert', 'quiz'), allowNull: false },
    promptId:     { type: DataTypes.TEXT, allowNull: false },
    promptJa:     { type: DataTypes.TEXT, allowNull: false },
    optionsJson:  { type: DataTypes.JSON, allowNull: false },
    scoringJson:  { type: DataTypes.JSON, allowNull: false },
    criticalFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sensitive:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt:    { type: DataTypes.DATE, allowNull: false },
    updatedAt:    { type: DataTypes.DATE, allowNull: false },
  });

  // ── 4. Reviewer & review ────────────────────────────────────────────────────
  await qi.createTable('jras_reviewers', {
    id:           { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId:       { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    reviewerType: { type: DataTypes.ENUM('ex_ssw', 'jp_hr', 'expert'), allowNull: false },
    active:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt:    { type: DataTypes.DATE, allowNull: false },
    updatedAt:    { type: DataTypes.DATE, allowNull: false },
  });
  await safeAddIndex(qi, 'jras_reviewers', ['userId'], { unique: true, name: 'jras_reviewers_user_unique' });

  await qi.createTable('jras_reviews', {
    id:                { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    instrumentId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'jras_instruments', key: 'id' }, onDelete: 'CASCADE' },
    instrumentVersion: { type: DataTypes.INTEGER, allowNull: false },
    reviewerUserId:    { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    verdict:           { type: DataTypes.ENUM('approve', 'request_changes'), allowNull: false },
    note:              { type: DataTypes.TEXT, allowNull: true },
    itemNotesJson:     { type: DataTypes.JSON, allowNull: true },
    submittedAt:       { type: DataTypes.DATE, allowNull: false },
    createdAt:         { type: DataTypes.DATE, allowNull: false },
    updatedAt:         { type: DataTypes.DATE, allowNull: false },
  });
  await safeAddIndex(qi, 'jras_reviews', ['instrumentId', 'instrumentVersion', 'reviewerUserId'], {
    unique: true,
    name: 'jras_reviews_instrument_version_reviewer_unique',
  });

  // ── 5. Komite banding ───────────────────────────────────────────────────────
  await qi.createTable('jras_committee_members', {
    id:        { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    userId:    { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    active:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await safeAddIndex(qi, 'jras_committee_members', ['userId'], { unique: true, name: 'jras_committee_user_unique' });

  // ── 6. Attempt & jawaban (delivery di P2; tabel disiapkan sekarang) ─────────
  await qi.createTable('jras_attempts', {
    id:                { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    candidateId:       { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
    instrumentId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'jras_instruments', key: 'id' }, onDelete: 'CASCADE' },
    instrumentVersion: { type: DataTypes.INTEGER, allowNull: false },
    wave:              { type: DataTypes.STRING(50), allowNull: true },
    startedAt:         { type: DataTypes.DATE, allowNull: false },
    completedAt:       { type: DataTypes.DATE, allowNull: true },
    // khusus type observation (D7): siapa penilai + keyakinan; multi-observer didukung
    observerUserId:    { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    confidence:        { type: DataTypes.ENUM('low', 'medium', 'high'), allowNull: true },
    createdAt:         { type: DataTypes.DATE, allowNull: false },
    updatedAt:         { type: DataTypes.DATE, allowNull: false },
  });
  await safeAddIndex(qi, 'jras_attempts', ['candidateId', 'instrumentId'], { name: 'jras_attempts_candidate_instrument' });

  await qi.createTable('jras_answers', {
    id:             { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    attemptId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'jras_attempts', key: 'id' }, onDelete: 'CASCADE' },
    itemId:         { type: DataTypes.UUID, allowNull: false, references: { model: 'jras_items', key: 'id' }, onDelete: 'CASCADE' },
    valueJson:      { type: DataTypes.JSON, allowNull: true },
    // jawaban item sensitif (D4/D5): AES-256-GCM, valueJson dibiarkan null
    valueEncrypted: { type: DataTypes.TEXT, allowNull: true },
    createdAt:      { type: DataTypes.DATE, allowNull: false },
    updatedAt:      { type: DataTypes.DATE, allowNull: false },
  });

  // ── 7. Banding (alur komite 4 langkah) ──────────────────────────────────────
  await qi.createTable('jras_appeals', {
    id:           { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    candidateId:  { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
    instrumentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'jras_instruments', key: 'id' }, onDelete: 'CASCADE' },
    attemptId:    { type: DataTypes.UUID, allowNull: false, references: { model: 'jras_attempts', key: 'id' }, onDelete: 'CASCADE' },
    reason:       { type: DataTypes.TEXT, allowNull: false },
    status:       { type: DataTypes.ENUM('submitted', 'admin_review', 'committee_review', 'closed'), allowNull: false, defaultValue: 'submitted' },
    adminNote:    { type: DataTypes.TEXT, allowNull: true },
    adminNoteBy:  { type: DataTypes.UUID, allowNull: true },
    adminNoteAt:  { type: DataTypes.DATE, allowNull: true },
    decision:     { type: DataTypes.ENUM('rejected', 'retake_granted', 'score_overridden'), allowNull: true },
    decidedBy:    { type: DataTypes.UUID, allowNull: true },
    decisionNote: { type: DataTypes.TEXT, allowNull: true },
    decidedAt:    { type: DataTypes.DATE, allowNull: true },
    createdAt:    { type: DataTypes.DATE, allowNull: false },
    updatedAt:    { type: DataTypes.DATE, allowNull: false },
  });

  // ── 8. Skor dimensi ─────────────────────────────────────────────────────────
  await qi.createTable('jras_dimension_scores', {
    id:                { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    candidateId:       { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
    dimensionKey:      { type: DIMENSION_ENUM, allowNull: false },
    score:             { type: DataTypes.FLOAT, allowNull: false },
    instrumentVersion: { type: DataTypes.INTEGER, allowNull: true },
    computedAt:        { type: DataTypes.DATE, allowNull: false },
    createdAt:         { type: DataTypes.DATE, allowNull: false },
    updatedAt:         { type: DataTypes.DATE, allowNull: false },
  });
  await safeAddIndex(qi, 'jras_dimension_scores', ['candidateId', 'dimensionKey'], { name: 'jras_dimension_scores_candidate_dim' });

  // ── 9. Early warning (engine di P3; tabel + rule default disiapkan) ─────────
  await qi.createTable('jras_risk_rules', {
    id:            { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    ruleKey:       { type: DataTypes.STRING(50), allowNull: false, unique: true },
    severity:      { type: DataTypes.ENUM('yellow', 'red'), allowNull: false },
    configJson:    { type: DataTypes.JSON, allowNull: false },
    enabled:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    descriptionId: { type: DataTypes.STRING(255), allowNull: true },
    descriptionJa: { type: DataTypes.STRING(255), allowNull: true },
    createdAt:     { type: DataTypes.DATE, allowNull: false },
    updatedAt:     { type: DataTypes.DATE, allowNull: false },
  });

  await qi.createTable('jras_risk_flags', {
    id:          { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    candidateId: { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
    ruleKey:     { type: DataTypes.STRING(50), allowNull: false },
    severity:    { type: DataTypes.ENUM('yellow', 'red'), allowNull: false },
    status:      { type: DataTypes.ENUM('open', 'in_progress', 'resolved'), allowNull: false, defaultValue: 'open' },
    detailJson:  { type: DataTypes.JSON, allowNull: true },
    resolvedBy:  { type: DataTypes.UUID, allowNull: true },
    resolvedAt:  { type: DataTypes.DATE, allowNull: true },
    createdAt:   { type: DataTypes.DATE, allowNull: false },
    updatedAt:   { type: DataTypes.DATE, allowNull: false },
  });
  await safeAddIndex(qi, 'jras_risk_flags', ['candidateId', 'status'], { name: 'jras_risk_flags_candidate_status' });

  await qi.createTable('jras_interventions', {
    id:               { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    flagId:           { type: DataTypes.UUID, allowNull: false, references: { model: 'jras_risk_flags', key: 'id' }, onDelete: 'CASCADE' },
    candidateId:      { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
    assignedToUserId: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
    actionType:       { type: DataTypes.STRING(50), allowNull: false },
    note:             { type: DataTypes.TEXT, allowNull: true },
    dueDate:          { type: DataTypes.DATEONLY, allowNull: true },
    status:           { type: DataTypes.ENUM('open', 'in_progress', 'resolved'), allowNull: false, defaultValue: 'open' },
    outcome:          { type: DataTypes.TEXT, allowNull: true },
    createdAt:        { type: DataTypes.DATE, allowNull: false },
    updatedAt:        { type: DataTypes.DATE, allowNull: false },
  });

  // ── 10. Jalur pembelajaran personal (P4) ────────────────────────────────────
  await qi.createTable('jras_learning_paths', {
    id:           { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    candidateId:  { type: DataTypes.UUID, allowNull: false, references: { model: 'candidates', key: 'id' }, onDelete: 'CASCADE' },
    dimensionKey: { type: DIMENSION_ENUM, allowNull: false },
    lessonId:     { type: DataTypes.UUID, allowNull: false, references: { model: 'jp_lessons', key: 'id' }, onDelete: 'CASCADE' },
    orderNo:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status:       { type: DataTypes.ENUM('pending', 'in_progress', 'completed'), allowNull: false, defaultValue: 'pending' },
    createdAt:    { type: DataTypes.DATE, allowNull: false },
    updatedAt:    { type: DataTypes.DATE, allowNull: false },
  });
  await safeAddIndex(qi, 'jras_learning_paths', ['candidateId', 'lessonId'], { unique: true, name: 'jras_learning_paths_candidate_lesson_unique' });

  // ── 11. Rule default early warning (engine menyusul di P3) ──────────────────
  const now = new Date();
  await qi.bulkInsert('jras_risk_rules', [
    {
      id: uuidv4(), ruleKey: 'DEBT_RISK', severity: 'red',
      configJson: JSON.stringify({ dimensionKey: 'finance', scoreBelow: 40 }),
      enabled: true,
      descriptionId: 'Skor literasi keuangan rendah atau jawaban kritis item utang',
      descriptionJa: '金融リテラシースコアが低い、または借金に関する重要回答',
      createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), ruleKey: 'PSYCH_ATTENTION', severity: 'red',
      configJson: JSON.stringify({ dimensionKey: 'psych', criticalOnly: true }),
      enabled: true,
      descriptionId: 'Jawaban kritis pada item kesiapan psikologis',
      descriptionJa: '心理的準備項目における重要回答',
      createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), ruleKey: 'DISENGAGED', severity: 'yellow',
      configJson: JSON.stringify({
        inactiveDays: 14,
        excludeDateRanges: [],
        excludeProfileStatuses: ['approved', 'confirmed', 'hired'],
      }),
      enabled: true,
      descriptionId: 'Tidak ada aktivitas pembelajaran lebih dari 14 hari',
      descriptionJa: '14日以上学習活動なし',
      createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), ruleKey: 'DECLINING', severity: 'yellow',
      configJson: JSON.stringify({ consecutiveWeeks: 3 }),
      enabled: true,
      descriptionId: 'Nilai tes mingguan turun 3 minggu berturut-turut',
      descriptionJa: '週次テストの成績が3週連続で低下',
      createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), ruleKey: 'DISCIPLINE', severity: 'yellow',
      configJson: JSON.stringify({ dimensionKey: 'observation', scoreBelow: 50 }),
      enabled: true,
      descriptionId: 'Rating observasi LPK di bawah ambang disiplin',
      descriptionJa: 'LPK観察評価が規律基準を下回る',
      createdAt: now, updatedAt: now,
    },
    {
      id: uuidv4(), ruleKey: 'LOW_COMMITMENT', severity: 'yellow',
      configJson: JSON.stringify({ dimensionKey: 'motivation', scoreBelow: 40 }),
      enabled: true,
      descriptionId: 'Skor motivasi & dukungan sosial rendah',
      descriptionJa: '動機・社会的支援スコアが低い',
      createdAt: now, updatedAt: now,
    },
  ]);
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.dropTable('jras_learning_paths');
  await qi.dropTable('jras_interventions');
  await qi.dropTable('jras_risk_flags');
  await qi.dropTable('jras_risk_rules');
  await qi.dropTable('jras_dimension_scores');
  await qi.dropTable('jras_appeals');
  await qi.dropTable('jras_answers');
  await qi.dropTable('jras_attempts');
  await qi.dropTable('jras_committee_members');
  await qi.dropTable('jras_reviews');
  await qi.dropTable('jras_reviewers');
  await qi.dropTable('jras_items');
  await qi.dropTable('jras_instruments');

  await qi.removeColumn('jp_topics', 'category');

  // Tidak bisa menyusutkan ENUM selama masih ada user reviewer
  await qi.sequelize.query("DELETE FROM users WHERE role = 'reviewer';");
  await qi.sequelize.query(
    "ALTER TABLE users MODIFY COLUMN role ENUM('candidate', 'admin', 'manager', 'recruiter', 'super_admin') NOT NULL;",
  );
}
