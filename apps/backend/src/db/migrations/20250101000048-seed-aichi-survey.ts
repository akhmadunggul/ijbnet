import { QueryInterface } from 'sequelize';

const SURVEY_ID = 'a0000000-0000-4000-a000-000000000001';

const questions = [
  {
    id: 'a0000000-0000-4001-a000-000000000001',
    sortOrder: 1,
    type: 'single',
    questionId: 'Pilih jenis industri perusahaan Anda',
    questionJa: '貴社の業種をお選びください',
    required: 1,
    options: JSON.stringify([
      { value: 'manufacturing', labelId: 'Manufaktur', labelJa: '製造業' },
      { value: 'food_service', labelId: 'Restoran/Kuliner', labelJa: '飲食業' },
      { value: 'accommodation', labelId: 'Perhotelan/Penginapan', labelJa: '宿泊業' },
      { value: 'agriculture', labelId: 'Pertanian & Perikanan', labelJa: '農業・漁業' },
      { value: 'care', labelId: 'Perawatan/Kesehatan', labelJa: '介護・福祉' },
      { value: 'construction', labelId: 'Konstruksi', labelJa: '建設業' },
      { value: 'other', labelId: 'Lainnya', labelJa: 'その他' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000002',
    sortOrder: 2,
    type: 'single',
    questionId: 'Jumlah karyawan perusahaan',
    questionJa: '従業員数をお選びください',
    required: 1,
    options: JSON.stringify([
      { value: 's1_9', labelId: '1–9 orang', labelJa: '1〜9名' },
      { value: 's10_49', labelId: '10–49 orang', labelJa: '10〜49名' },
      { value: 's50_99', labelId: '50–99 orang', labelJa: '50〜99名' },
      { value: 's100_299', labelId: '100–299 orang', labelJa: '100〜299名' },
      { value: 's300plus', labelId: '300 orang atau lebih', labelJa: '300名以上' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000003',
    sortOrder: 3,
    type: 'single',
    questionId: 'Apakah perusahaan Anda pernah mempekerjakan tenaga kerja asing (SSW)?',
    questionJa: 'これまでに特定技能外国人を採用したことがありますか？',
    required: 1,
    options: JSON.stringify([
      { value: 'yes', labelId: 'Ya, pernah mempekerjakan', labelJa: 'はい、採用実績があります' },
      { value: 'considering', labelId: 'Belum, sedang mempertimbangkan', labelJa: 'いいえ、今後採用を検討中です' },
      { value: 'no', labelId: 'Belum ada rencana', labelJa: 'いいえ、採用予定はありません' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000004',
    sortOrder: 4,
    type: 'single',
    questionId: 'Seberapa besar minat Anda terhadap tenaga kerja asal Indonesia?',
    questionJa: 'インドネシア人材への関心度をお教えください',
    required: 1,
    options: JSON.stringify([
      { value: 'very', labelId: 'Sangat tertarik', labelJa: '非常に関心がある' },
      { value: 'interested', labelId: 'Tertarik', labelJa: '関心がある' },
      { value: 'little', labelId: 'Kurang tertarik', labelJa: 'あまり関心がない' },
      { value: 'not', labelId: 'Tidak tertarik', labelJa: '関心がない' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000005',
    sortOrder: 5,
    type: 'multiple',
    questionId: 'Bidang SSW yang ingin diisi (boleh pilih lebih dari satu)',
    questionJa: '採用希望の特定技能分野をお選びください（複数可）',
    required: 1,
    options: JSON.stringify([
      { value: 'care', labelId: 'Perawatan', labelJa: '介護' },
      { value: 'building', labelId: 'Kebersihan Gedung', labelJa: 'ビルクリーニング' },
      { value: 'manufacturing', labelId: 'Manufaktur Mesin Industri', labelJa: '素形材・産業機械製造業' },
      { value: 'electronics', labelId: 'Elektronik', labelJa: '電気・電子情報関連産業' },
      { value: 'construction', labelId: 'Konstruksi', labelJa: '建設' },
      { value: 'shipbuilding', labelId: 'Perkapalan', labelJa: '造船・舶用工業' },
      { value: 'auto', labelId: 'Perawatan Otomotif', labelJa: '自動車整備' },
      { value: 'accommodation', labelId: 'Perhotelan', labelJa: '宿泊' },
      { value: 'agriculture', labelId: 'Pertanian', labelJa: '農業' },
      { value: 'fishery', labelId: 'Perikanan', labelJa: '漁業' },
      { value: 'food_mfg', labelId: 'Pengolahan Makanan', labelJa: '飲食料品製造業' },
      { value: 'restaurant', labelId: 'Restoran', labelJa: '外食業' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000006',
    sortOrder: 6,
    type: 'single',
    questionId: 'Kapan rencana perekrutan?',
    questionJa: '採用希望時期はいつ頃ですか？',
    required: 1,
    options: JSON.stringify([
      { value: 'within_3m', labelId: 'Dalam 3 bulan', labelJa: '3ヶ月以内' },
      { value: 'within_6m', labelId: 'Dalam 6 bulan', labelJa: '6ヶ月以内' },
      { value: 'within_1y', labelId: 'Dalam 1 tahun', labelJa: '1年以内' },
      { value: 'over_1y', labelId: 'Lebih dari 1 tahun', labelJa: '1年以上先' },
      { value: 'undecided', labelId: 'Belum ditentukan', labelJa: '未定' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000007',
    sortOrder: 7,
    type: 'single',
    questionId: 'Berapa orang yang ingin direkrut?',
    questionJa: '採用希望人数をお選びください',
    required: 1,
    options: JSON.stringify([
      { value: 'n1', labelId: '1 orang', labelJa: '1名' },
      { value: 'n2_3', labelId: '2–3 orang', labelJa: '2〜3名' },
      { value: 'n4_5', labelId: '4–5 orang', labelJa: '4〜5名' },
      { value: 'n6plus', labelId: '6 orang atau lebih', labelJa: '6名以上' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000008',
    sortOrder: 8,
    type: 'single',
    questionId: 'Level bahasa Jepang yang dibutuhkan',
    questionJa: '必要とする日本語レベルをお選びください',
    required: 1,
    options: JSON.stringify([
      { value: 'n1', labelId: 'N1', labelJa: 'N1' },
      { value: 'n2', labelId: 'N2', labelJa: 'N2' },
      { value: 'n3', labelId: 'N3', labelJa: 'N3' },
      { value: 'n4', labelId: 'N4', labelJa: 'N4' },
      { value: 'n5', labelId: 'N5', labelJa: 'N5' },
      { value: 'any', labelId: 'Tidak ada syarat tertentu', labelJa: '問わない' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000009',
    sortOrder: 9,
    type: 'multiple',
    questionId: 'Apa yang diharapkan dari tenaga kerja Indonesia? (boleh pilih lebih dari satu)',
    questionJa: 'インドネシア人材に期待することをお選びください（複数可）',
    required: 1,
    options: JSON.stringify([
      { value: 'diligent', labelId: 'Rajin dan jujur', labelJa: '勤勉さ・誠実さ' },
      { value: 'japanese', labelId: 'Kemampuan bahasa Jepang', labelJa: '日本語能力' },
      { value: 'skills', labelId: 'Keterampilan teknis', labelJa: '技術・スキル' },
      { value: 'culture', labelId: 'Adaptasi budaya', labelJa: '文化的適応力' },
      { value: 'longterm', labelId: 'Komitmen jangka panjang', labelJa: '長期就労の意欲' },
      { value: 'teamwork', labelId: 'Kerja tim', labelJa: 'チームワーク' },
      { value: 'personality', labelId: 'Kepribadian yang baik & komunikasi', labelJa: '明るい性格・コミュニケーション力' },
    ]),
  },
  {
    id: 'a0000000-0000-4001-a000-000000000010',
    sortOrder: 10,
    type: 'textarea',
    questionId: 'Saran atau masukan untuk layanan IJBNet (opsional)',
    questionJa: 'IJBNetのサービスへのご意見・ご要望をお聞かせください（任意）',
    required: 0,
    options: null,
  },
];

export async function up(queryInterface: QueryInterface): Promise<void> {
  const now = new Date();

  await queryInterface.bulkInsert('surveys', [
    {
      id: SURVEY_ID,
      slug: 'aichi-2026',
      titleId: 'Survei untuk Perusahaan Anggota AICHI KEIKYO',
      titleJa: '愛知経協会員企業様へのアンケート調査',
      descriptionId:
        'Survei mengenai kebutuhan tenaga kerja Specified Skilled Worker (SSW) asal Indonesia. Semua jawaban bersifat anonim.',
      descriptionJa:
        'インドネシア人特定技能外国人材の採用に関するアンケートです。回答は匿名で処理されます。',
      status: 'draft',
      publishedAt: null,
      closedAt: null,
      isFeatured: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await queryInterface.bulkInsert(
    'survey_questions',
    questions.map((q) => ({
      ...q,
      surveyId: SURVEY_ID,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.bulkDelete('survey_questions', { surveyId: SURVEY_ID } as never);
  await queryInterface.bulkDelete('surveys', { id: SURVEY_ID } as never);
}
