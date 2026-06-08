/**
 * Programmatic migration runner for the survey database.
 * Called once at app startup. Idempotent — skips tables/rows that already exist.
 * Questions are re-seeded whenever the count doesn't match EXPECTED_Q_COUNT.
 */

import { DataTypes, QueryInterface } from 'sequelize';
import { surveySequelize } from './survey-connection';

const SURVEY_ID       = 'a0000000-0000-4000-a000-000000000001';
const EXPECTED_Q_COUNT = 23;

const SURVEY_TITLE_JA  = '愛知経協会員企業様へのアンケート調査';
const SURVEY_TITLE_ID  = 'Survei untuk Perusahaan Anggota Aichi Keizai Kyokai';
const SURVEY_DESC_JA   =
  '貴社におかれましては、ますますご清栄のこととお慶び申し上げます。IJBNet（Indonesia Japan Business Network）代表のスヨト・ライスと申します。\n\n' +
  'この度、愛知県経営者協会様、IPC、学研、そしてIJBNetの共同プロジェクトとして、「インドネシアからの優秀な製造人材の募集・教育・派遣プログラム」を推進する運びとなりました。\n\n' +
  '本プログラムの最大の特徴は、インドネシア現地の大手日系自動車関連製造企業で数年間の就労経験を持ち、日本の製造業の基本（5Sや安全第一など）をすでに習得している若手人材を、愛知県の製造業の皆様へご提案できる点にあります。\n\n' +
  '会員企業の皆様が現場で抱えられている課題や、外国人材に対するご要望を正確に把握し、最適なご提案を行うため、アンケート調査を実施させていただきます。ご多忙の折誠に恐縮ですが、ご協力のほど何卒よろしくお願い申し上げます。';
const SURVEY_DESC_ID   =
  'Kami dari IJBNet (Indonesia Japan Business Network), yang diwakili oleh Suyoto Rais, menjalankan program perekrutan, pendidikan, dan penempatan tenaga manufaktur unggulan dari Indonesia bersama Aichi Keizai Kyokai, IPC, dan Gakken.\n\n' +
  'Program ini menawarkan tenaga kerja muda berpengalaman dari perusahaan manufaktur otomotif Jepang terkemuka di Indonesia yang telah memahami prinsip manufaktur Jepang (5S, K3, dll.).\n\n' +
  'Survei ini dilaksanakan untuk memahami tantangan dan kebutuhan perusahaan anggota terkait tenaga kerja asing. Kami sangat mengharapkan partisipasi Anda.';

// ── Question seed data ────────────────────────────────────────────────────────

type QSeed = {
  id: string;
  sortOrder: number;
  groupLabelJa: string | null;
  groupLabelId: string | null;
  type: string;
  questionJa: string;
  questionId: string;
  required: number;
  options: string | null;
};

const QUESTIONS: QSeed[] = [
  // ── 第1部: 貴社の基本情報 ────────────────────────────────────────────────────
  {
    id: 'a0000000-0000-4001-a000-000000000001',
    sortOrder: 1,
    groupLabelJa: '第1部：貴社の基本情報',
    groupLabelId: 'Bagian 1: Informasi Dasar Perusahaan',
    type: 'text',
    questionJa: '貴社名',
    questionId: 'Nama Perusahaan',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000002',
    sortOrder: 2,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: 'ご住所',
    questionId: 'Alamat Perusahaan',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000003',
    sortOrder: 3,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: 'ご担当者名・部署・役職',
    questionId: 'Nama PIC, Departemen, Jabatan',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000004',
    sortOrder: 4,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: 'ご連絡先（電話番号・メールアドレス）',
    questionId: 'Kontak (Nomor Telepon & Email)',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000005',
    sortOrder: 5,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'textarea',
    questionJa: '事業概要',
    questionId: 'Gambaran Umum Usaha',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000006',
    sortOrder: 6,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: '主要製品名',
    questionId: 'Nama Produk Utama',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000007',
    sortOrder: 7,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: '従業員数（正社員／非正社員／技能実習生）',
    questionId: 'Jumlah Karyawan (tetap / non-tetap / magang)',
    required: 1,
    options: null,
  },
  // ── 第2部: 外国人材の受け入れ状況と課題 ─────────────────────────────────────
  {
    id: 'a0000000-0000-4001-a000-000000000008',
    sortOrder: 8,
    groupLabelJa: '第2部：外国人材の受け入れ状況と課題について',
    groupLabelId: 'Bagian 2: Kondisi Penerimaan Tenaga Kerja Asing & Tantangan',
    type: 'text',
    questionJa: 'これまでの累計受入人数（約　　名）',
    questionId: 'Total penerimaan kumulatif (kira-kira berapa orang)',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000009',
    sortOrder: 9,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: '現在の在籍人数（約　　名）',
    questionId: 'Jumlah TKA yang sedang bertugas saat ini (kira-kira)',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000010',
    sortOrder: 10,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: '今後（1〜2年以内）の受入予定人数（約　　名）',
    questionId: 'Rencana penerimaan dalam 1–2 tahun ke depan (kira-kira berapa orang)',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000011',
    sortOrder: 11,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: '今後の入国希望時期（　　年　　月頃）',
    questionId: 'Waktu kedatangan yang diharapkan (bulan dan tahun)',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000012',
    sortOrder: 12,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'multiple',
    questionJa: '外国人材の受け入れや現場での定着において、現在感じている課題は何ですか？（複数選択可）',
    questionId: 'Apa saja tantangan yang dirasakan dalam penerimaan dan penempatan TKA? (boleh pilih lebih dari satu)',
    required: 1,
    options: JSON.stringify([
      { value: 'japanese_low',     labelJa: '日本語でのコミュニケーション能力が低い',                                     labelId: 'Kemampuan komunikasi bahasa Jepang rendah' },
      { value: 'rules_slow',       labelJa: '日本の製造現場のルール（5S、安全衛生など）の理解・定着が遅い',               labelId: 'Pemahaman aturan manufaktur Jepang (5S, K3) lambat' },
      { value: 'multi_skill',      labelJa: '一つの作業しかできず、多能工（マルチスキル）としての育成が難しい',           labelId: 'Hanya bisa satu tugas, sulit dikembangkan menjadi multi-skill' },
      { value: 'support_burden',   labelJa: '受け入れ後のフォローや生活支援の負担が大きい',                               labelId: 'Beban besar dalam pendampingan dan dukungan kehidupan setelah kedatangan' },
      { value: 'retention',        labelJa: '優秀な人材が定着せず、帰国してしまう',                                       labelId: 'Tenaga ahli tidak bertahan lama dan pulang ke negara asal' },
      { value: 'agent_dissatisfied', labelJa: '現在の監理団体・登録支援機関のサポート体制に不満がある',                   labelId: 'Kurang puas dengan dukungan dari lembaga pengawas/pendukung saat ini' },
      { value: 'other',            labelJa: 'その他',                                                                     labelId: 'Lainnya' },
    ]),
  },
  // ── 第3部: 今回のご提案へのニーズ ───────────────────────────────────────────
  {
    id: 'a0000000-0000-4001-a000-000000000013',
    sortOrder: 13,
    groupLabelJa: '第3部：今回のご提案（日系企業経験者）へのニーズについて',
    groupLabelId: 'Bagian 3: Kebutuhan terhadap Program yang Ditawarkan',
    type: 'multiple',
    questionJa: '貴社で最も興味がある・受け入れたい人材層はどれですか？（複数選択可）',
    questionId: 'Profil kandidat yang paling ingin diterima perusahaan Anda? (boleh pilih lebih dari satu)',
    required: 1,
    options: JSON.stringify([
      { value: 'experienced',    labelJa: '【即戦力候補】大手日系自動車関連製造企業など、優良日系企業の元従業員（平均24歳・製造現場経験あり）', labelId: '【Siap pakai】Eks-karyawan perusahaan manufaktur otomotif Jepang terkemuka (rata-rata 24 tahun, berpengalaman)' },
      { value: 'young_grad',     labelJa: '【若手育成候補】優良な工業系専門高校卒 ＋ 実習経験者（平均20歳）',            labelId: '【Kandidat muda】Lulusan SMK industri unggul + berpengalaman magang (rata-rata 20 tahun)' },
      { value: 'gov_recommended', labelJa: '当プログラムを応援する自治体の推薦人材',                                      labelId: 'Kandidat rekomendasi pemerintah daerah yang mendukung program ini' },
      { value: 'regional',       labelJa: '貴社が指定するインドネシア特定地域出身者',                                     labelId: 'Kandidat dari daerah tertentu di Indonesia yang ditentukan perusahaan Anda' },
      { value: 'communicative',  labelJa: '経歴よりも、とにかく明るくコミュニケーション能力が高い人材',                   labelId: 'Kandidat yang ceria dan komunikatif, lebih dari sekadar pengalaman kerja' },
      { value: 'other',          labelJa: 'その他',                                                                       labelId: 'Lainnya' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000014',
    sortOrder: 14,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'textarea',
    questionJa: '仮に「日系企業経験者」を受け入れる場合、現場でどのようなスキルや業務を期待しますか？\n（例：機械加工のオペレーション、後輩への指導、複数工程を担う多能工、など）',
    questionId: 'Jika menerima "eks-karyawan perusahaan Jepang", skill dan tugas apa yang diharapkan di lapangan?\n(contoh: operasi mesin, pembimbingan junior, multi-proses, dll.)',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000015',
    sortOrder: 15,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'text',
    questionJa: '受け入れる場合に最も適している職種・作業名\n（例：機械金属加工、溶接、プラスチック成形、等）',
    questionId: 'Jenis pekerjaan yang paling sesuai\n(contoh: pengerjaan logam, pengelasan, cetak plastik, dll.)',
    required: 1,
    options: null,
  },
  {
    id: 'a0000000-0000-4001-a000-000000000016',
    sortOrder: 16,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'single',
    questionJa: '想定する在留資格',
    questionId: 'Status residensi yang direncanakan',
    required: 1,
    options: JSON.stringify([
      { value: 'trainee',   labelJa: '技能実習',             labelId: 'Magang Teknis (技能実習)' },
      { value: 'ssw',       labelJa: '特定技能',             labelId: 'Specified Skilled Worker (特定技能)' },
      { value: 'engineer',  labelJa: 'エンジニア等の専門職', labelId: 'Insinyur / Profesi Spesialis' },
      { value: 'undecided', labelJa: '未定',                 labelId: 'Belum ditentukan' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000017',
    sortOrder: 17,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'single',
    questionJa: '技能実習生として受け入れた後、将来的に「特定技能」へ移行し、長く働いてもらうための支援・キャリアアップを検討可能ですか？',
    questionId: 'Apakah Anda mempertimbangkan untuk mendukung transisi dari magang teknis ke Specified Skilled Worker agar bisa bekerja lebih lama?',
    required: 1,
    options: JSON.stringify([
      { value: 'yes',               labelJa: 'はい（可能な範囲で支援できる）',                             labelId: 'Ya (dapat memberikan dukungan sesuai kemampuan)' },
      { value: 'no',                labelJa: 'いいえ（３年で帰国を前提とする）',                           labelId: 'Tidak (diasumsikan pulang setelah 3 tahun)' },
      { value: 'interested_unsure', labelJa: '支援したい気持ちはあるが、制度や運用方法が分からず未検討',   labelId: 'Ingin mendukung tapi belum memahami sistemnya' },
    ]),
  },
  // ── 第4部: サポート体制 ──────────────────────────────────────────────────────
  {
    id: 'a0000000-0000-4001-a000-000000000018',
    sortOrder: 18,
    groupLabelJa: '第4部：サポート体制（監理団体・システム等）について',
    groupLabelId: 'Bagian 4: Sistem Dukungan (Lembaga Pengawas, dll.)',
    type: 'single',
    questionJa: '現在ご契約されている登録支援機関・監理団体はありますか？',
    questionId: 'Apakah Anda saat ini memiliki kontrak dengan lembaga dukungan/pengawas?',
    required: 1,
    options: JSON.stringify([
      { value: 'yes', labelJa: 'ある',                 labelId: 'Ada' },
      { value: 'no',  labelJa: 'ない（これから検討する）', labelId: 'Tidak ada (akan dipertimbangkan)' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000019',
    sortOrder: 19,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'single',
    questionJa: '（前問で「ある」と答えた方へ）良い人材を受け入れるためであれば、現在の団体とは別に、新規の団体を追加・併用することは可能ですか？',
    questionId: '(Untuk yang menjawab "Ada" di pertanyaan sebelumnya) Apakah mungkin menambah atau menggunakan lembaga baru demi mendapatkan kandidat yang lebih baik?',
    required: 0,
    options: JSON.stringify([
      { value: 'possible',     labelJa: '可能',              labelId: 'Mungkin' },
      { value: 'not_possible', labelJa: '不可能',             labelId: 'Tidak mungkin' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000020',
    sortOrder: 20,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'multiple',
    questionJa: '登録支援機関や監理団体を選定する際、最も重視する基準は何ですか？（上位3つまで選択）',
    questionId: 'Kriteria apa yang paling dipertimbangkan saat memilih lembaga dukungan/pengawas? (pilih maks. 3)',
    required: 1,
    options: JSON.stringify([
      { value: 'quality',       labelJa: '紹介される人材の質・スキル',                   labelId: 'Kualitas dan skill kandidat yang direkomendasikan' },
      { value: 'cost',          labelJa: '導入や月々の管理コスト',                         labelId: 'Biaya awal dan pengelolaan bulanan' },
      { value: 'support_speed', labelJa: 'トラブル時の対応スピード・フォローの手厚さ',   labelId: 'Kecepatan respons saat masalah & kelengkapan dukungan' },
      { value: 'less_paperwork', labelJa: '事務手続きの手間がかからないこと',             labelId: 'Kemudahan prosedur administrasi' },
      { value: 'other',         labelJa: 'その他',                                         labelId: 'Lainnya' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000021',
    sortOrder: 21,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'single',
    questionJa: '送り出し国（インドネシア現地）の教育機関や送出し機関の選定はどのように行っていますか？',
    questionId: 'Bagaimana cara Anda menyeleksi lembaga pendidikan dan pengiriman di Indonesia?',
    required: 1,
    options: JSON.stringify([
      { value: 'full_delegate', labelJa: '日本の監理団体・登録支援機関に全て一任している',                       labelId: 'Menyerahkan sepenuhnya kepada lembaga pengawas/pendukung di Jepang' },
      { value: 'own_criteria',  labelJa: '自社で基準を設け、日本の団体に指示して選定させている',                 labelId: 'Menetapkan kriteria sendiri dan menginstruksikan lembaga di Jepang' },
      { value: 'open_to_new',   labelJa: '今回のIJBNetのような、新しい教育・送出しスキームの提案を聞いてみたい', labelId: 'Ingin mendengar proposal skema baru seperti IJBNet' },
      { value: 'other',         labelJa: 'その他',                                                               labelId: 'Lainnya' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000022',
    sortOrder: 22,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'single',
    questionJa: 'IJBNetと学研が共同開発する「人材データベース＆学習モニタリングシステム」の無償利用にご興味はありますか？\n※候補者の経歴・入国前の日本語学習進捗・テスト結果を透明化し、受入企業がオンラインで確認・面接設定できるシステムです。',
    questionId: 'Apakah Anda tertarik menggunakan "Sistem Database Kandidat & Monitoring Pembelajaran" yang dikembangkan bersama IJBNet dan Gakken secara gratis?\n※Sistem yang memungkinkan perusahaan penerima memantau profil, kemajuan belajar bahasa Jepang, dan hasil tes kandidat secara online.',
    required: 1,
    options: JSON.stringify([
      { value: 'very_interested', labelJa: '大いに興味があり、利用してみたい',   labelId: 'Sangat tertarik dan ingin mencoba' },
      { value: 'want_details',    labelJa: '詳細を聞いてから判断したい',           labelId: 'Ingin mendengar detail lebih dulu sebelum memutuskan' },
      { value: 'not_interested',  labelJa: '現在のところ興味はない',               labelId: 'Saat ini tidak tertarik' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000023',
    sortOrder: 23,
    groupLabelJa: null,
    groupLabelId: null,
    type: 'textarea',
    questionJa: 'その他、外国人材の雇用に関するご要望や、本プログラムへのご期待・ご質問等がございましたらご自由にご記入ください。',
    questionId: 'Ada pertanyaan, saran, atau harapan lain terkait rekrutmen TKA atau program ini? Silakan tulis bebas.',
    required: 0,
    options: null,
  },
];

// ── Table creators ────────────────────────────────────────────────────────────

async function createSurveysTable(qi: QueryInterface): Promise<void> {
  await qi.createTable('surveys', {
    id:            { type: DataTypes.CHAR(36),      primaryKey: true, allowNull: false },
    slug:          { type: DataTypes.STRING(100),   allowNull: false, unique: true },
    titleId:       { type: DataTypes.STRING(300),   allowNull: false },
    titleJa:       { type: DataTypes.STRING(300),   allowNull: false },
    descriptionId: { type: DataTypes.TEXT,          allowNull: true },
    descriptionJa: { type: DataTypes.TEXT,          allowNull: true },
    status:        { type: DataTypes.ENUM('draft', 'active', 'closed'), allowNull: false, defaultValue: 'draft' },
    publishedAt:   { type: DataTypes.DATE,          allowNull: true },
    closedAt:      { type: DataTypes.DATE,          allowNull: true },
    isFeatured:    { type: DataTypes.TINYINT,       allowNull: false, defaultValue: 0 },
    createdAt:     { type: DataTypes.DATE,          allowNull: false },
    updatedAt:     { type: DataTypes.DATE,          allowNull: false },
  });
}

async function createSurveyQuestionsTable(qi: QueryInterface): Promise<void> {
  await qi.createTable('survey_questions', {
    id:           { type: DataTypes.CHAR(36),  primaryKey: true, allowNull: false },
    surveyId:     { type: DataTypes.CHAR(36),  allowNull: false, references: { model: 'surveys', key: 'id' }, onDelete: 'CASCADE' },
    sortOrder:    { type: DataTypes.INTEGER,   allowNull: false, defaultValue: 0 },
    type:         { type: DataTypes.ENUM('text', 'textarea', 'single', 'multiple', 'rating'), allowNull: false },
    questionId:   { type: DataTypes.TEXT,      allowNull: false },
    questionJa:   { type: DataTypes.TEXT,      allowNull: false },
    required:     { type: DataTypes.TINYINT,   allowNull: false, defaultValue: 1 },
    options:      { type: DataTypes.JSON,      allowNull: true },
    groupLabelJa: { type: DataTypes.TEXT,      allowNull: true },
    groupLabelId: { type: DataTypes.TEXT,      allowNull: true },
    createdAt:    { type: DataTypes.DATE,      allowNull: false },
    updatedAt:    { type: DataTypes.DATE,      allowNull: false },
  });
}

async function createSurveyResponsesTable(qi: QueryInterface): Promise<void> {
  await qi.createTable('survey_responses', {
    id:              { type: DataTypes.CHAR(36),   primaryKey: true, allowNull: false },
    surveyId:        { type: DataTypes.CHAR(36),   allowNull: false, references: { model: 'surveys', key: 'id' }, onDelete: 'CASCADE' },
    respondentToken: { type: DataTypes.CHAR(36),   allowNull: false, unique: true },
    ipHash:          { type: DataTypes.STRING(64), allowNull: true },
    submittedAt:     { type: DataTypes.DATE,       allowNull: false },
    createdAt:       { type: DataTypes.DATE,       allowNull: false },
  });
}

async function createSurveyAnswersTable(qi: QueryInterface): Promise<void> {
  await qi.createTable('survey_answers', {
    id:            { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
    responseId:    { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'survey_responses', key: 'id' }, onDelete: 'CASCADE' },
    questionId:    { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'survey_questions', key: 'id' }, onDelete: 'CASCADE' },
    answerText:    { type: DataTypes.TEXT,     allowNull: true },
    answerOptions: { type: DataTypes.JSON,     allowNull: true },
    createdAt:     { type: DataTypes.DATE,     allowNull: false },
  });
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runSurveyMigrations(): Promise<void> {
  const qi = surveySequelize.getQueryInterface();
  const tables = (await qi.showAllTables()) as string[];

  if (!tables.includes('surveys')) {
    await createSurveysTable(qi);
    console.log('Survey migration: created surveys table');
  }
  if (!tables.includes('survey_questions')) {
    await createSurveyQuestionsTable(qi);
    console.log('Survey migration: created survey_questions table');
  }
  if (!tables.includes('survey_responses')) {
    await createSurveyResponsesTable(qi);
    console.log('Survey migration: created survey_responses table');
  }
  if (!tables.includes('survey_answers')) {
    await createSurveyAnswersTable(qi);
    console.log('Survey migration: created survey_answers table');
  }

  // Add groupLabel columns if the table existed before they were introduced
  const [colCheck] = await surveySequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'survey_questions' AND COLUMN_NAME = 'groupLabelJa'`,
  );
  if ((colCheck as unknown[]).length === 0) {
    await surveySequelize.query(
      `ALTER TABLE survey_questions ADD COLUMN groupLabelJa TEXT NULL, ADD COLUMN groupLabelId TEXT NULL`,
    );
    console.log('Survey migration: added groupLabel columns to survey_questions');
  }

  // Seed survey row if missing, otherwise update title/description to match docx
  const [surveyRows] = await surveySequelize.query(
    `SELECT id FROM surveys WHERE id = '${SURVEY_ID}' LIMIT 1`,
  );

  if ((surveyRows as unknown[]).length === 0) {
    const now = new Date();
    await qi.bulkInsert('surveys', [{
      id:            SURVEY_ID,
      slug:          'aichi-2026',
      titleId:       SURVEY_TITLE_ID,
      titleJa:       SURVEY_TITLE_JA,
      descriptionId: SURVEY_DESC_ID,
      descriptionJa: SURVEY_DESC_JA,
      status:        'draft',
      publishedAt:   null,
      closedAt:      null,
      isFeatured:    1,
      createdAt:     now,
      updatedAt:     now,
    }]);
    console.log('Survey migration: seeded Aichi 2026 survey');
  } else {
    await surveySequelize.query(
      `UPDATE surveys SET titleId = ?, titleJa = ?, descriptionId = ?, descriptionJa = ?, updatedAt = NOW() WHERE id = ?`,
      { replacements: [SURVEY_TITLE_ID, SURVEY_TITLE_JA, SURVEY_DESC_ID, SURVEY_DESC_JA, SURVEY_ID] },
    );
  }

  // Re-seed questions whenever count doesn't match expected (e.g. after docx update)
  const [qCountRows] = await surveySequelize.query(
    `SELECT COUNT(*) as cnt FROM survey_questions WHERE surveyId = '${SURVEY_ID}'`,
  );
  const currentCount = Number((qCountRows as Record<string, unknown>[])[0]?.['cnt'] ?? 0);

  if (currentCount !== EXPECTED_Q_COUNT) {
    await surveySequelize.query(`DELETE FROM survey_questions WHERE surveyId = '${SURVEY_ID}'`);
    const now = new Date();
    await qi.bulkInsert(
      'survey_questions',
      QUESTIONS.map((q) => ({ ...q, surveyId: SURVEY_ID, createdAt: now, updatedAt: now })),
    );
    console.log(`Survey migration: re-seeded questions (was ${currentCount}, now ${EXPECTED_Q_COUNT})`);
  }
}
