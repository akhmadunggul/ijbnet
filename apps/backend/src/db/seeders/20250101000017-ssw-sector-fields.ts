import { QueryInterface } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

interface Row {
  kubun: 'SSW1' | 'SSW2';
  sectorId: string;
  sectorJa: string;
  fieldId: string;
  fieldJa: string;
  sortOrder: number;
}

const SSW_DATA: Row[] = [
  // ── SSW1 : 1. 介護 ─────────────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Perawatan',         sectorJa: '介護',                  fieldId: 'Perawatan Lansia',                  fieldJa: '介護',                      sortOrder: 100 },

  // ── SSW1 : 2. ビルクリーニング ─────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Kebersihan Gedung',  sectorJa: 'ビルクリーニング',        fieldId: 'Kebersihan Bangunan',               fieldJa: 'ビルクリーニング',            sortOrder: 200 },

  // ── SSW1 : 3. 製造業 ───────────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Pemesinan',                         fieldJa: '機械加工',                   sortOrder: 301 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Pengecoran Logam',                  fieldJa: '鋳造',                       sortOrder: 302 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Penempaan',                         fieldJa: '鍛造',                       sortOrder: 303 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Die Cast',                          fieldJa: 'ダイカスト',                  sortOrder: 304 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Press Logam',                       fieldJa: '金属プレス加工',              sortOrder: 305 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Pengerjaan Besi',                   fieldJa: '鉄工',                       sortOrder: 306 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Pengecatan Industri',               fieldJa: '工業塗装',                   sortOrder: 307 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Perakitan Mesin Listrik',           fieldJa: '電気機器組立て',              sortOrder: 308 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Perakitan Elektronik',              fieldJa: '電子機器組立て',              sortOrder: 309 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Manufaktur Komponen Elektronik',    fieldJa: '電気・電子部品附属品製造',    sortOrder: 310 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Manufaktur PCB',                    fieldJa: 'プリント配線板製造',          sortOrder: 311 },
  { kubun: 'SSW1', sectorId: 'Manufaktur',          sectorJa: '製造業',                fieldId: 'Pembentukan Plastik',               fieldJa: 'プラスチック成形',            sortOrder: 312 },

  // ── SSW1 : 4. 建設 ─────────────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Pengelasan',                        fieldJa: '溶接',                       sortOrder: 401 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Pembesian',                         fieldJa: '鉄筋施工',                   sortOrder: 402 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Bekisting',                         fieldJa: '型枠施工',                   sortOrder: 403 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Plesteran',                         fieldJa: '左官',                       sortOrder: 404 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Pompa Beton',                       fieldJa: 'コンクリート圧送',            sortOrder: 405 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Operasi Mesin Konstruksi',          fieldJa: '建設機械施工',               sortOrder: 406 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Pekerjaan Tanah',                   fieldJa: '土工',                       sortOrder: 407 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Pemasangan Atap',                   fieldJa: '屋根ふき',                   sortOrder: 408 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Instalasi Telekomunikasi',          fieldJa: '電気通信',                   sortOrder: 409 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Finishing Interior',               fieldJa: '内装仕上げ・表装',            sortOrder: 410 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Perancah',                          fieldJa: 'とび',                       sortOrder: 411 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Tukang Kayu Bangunan',              fieldJa: '建築大工',                   sortOrder: 412 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Instalasi Pipa',                    fieldJa: '配管',                       sortOrder: 413 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Lembaran Logam Bangunan',           fieldJa: '建築板金',                   sortOrder: 414 },
  { kubun: 'SSW1', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Bangunan (Umum)',                   fieldJa: '建築',                       sortOrder: 415 },

  // ── SSW1 : 5. 造船・舶用工業 ───────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Pengelasan Kapal',                  fieldJa: '溶接',                       sortOrder: 501 },
  { kubun: 'SSW1', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Pengecatan Kapal',                  fieldJa: '塗装',                       sortOrder: 502 },
  { kubun: 'SSW1', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Pengerjaan Besi Kapal',             fieldJa: '鉄工',                       sortOrder: 503 },
  { kubun: 'SSW1', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Finishing Kapal',                   fieldJa: '仕上げ',                     sortOrder: 504 },
  { kubun: 'SSW1', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Pemesinan Kapal',                   fieldJa: '機械加工',                   sortOrder: 505 },
  { kubun: 'SSW1', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Perakitan Mesin Kapal',             fieldJa: '電気機器組立て',              sortOrder: 506 },

  // ── SSW1 : 6. 自動車整備 ───────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Perawatan Otomotif',  sectorJa: '自動車整備',             fieldId: 'Perawatan Kendaraan',               fieldJa: '自動車整備',                 sortOrder: 600 },

  // ── SSW1 : 7. 航空 ─────────────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Penerbangan',          sectorJa: '航空',                  fieldId: 'Ground Handling',                   fieldJa: '空港グランドハンドリング',    sortOrder: 701 },
  { kubun: 'SSW1', sectorId: 'Penerbangan',          sectorJa: '航空',                  fieldId: 'Perawatan Pesawat',                 fieldJa: '航空機整備',                 sortOrder: 702 },

  // ── SSW1 : 8. 宿泊 ─────────────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Akomodasi',           sectorJa: '宿泊業',                fieldId: 'Front Desk',                        fieldJa: 'フロント',                   sortOrder: 801 },
  { kubun: 'SSW1', sectorId: 'Akomodasi',           sectorJa: '宿泊業',                fieldId: 'Perencanaan & Promosi',             fieldJa: '企画・広報',                 sortOrder: 802 },
  { kubun: 'SSW1', sectorId: 'Akomodasi',           sectorJa: '宿泊業',                fieldId: 'Pelayanan Tamu',                    fieldJa: '接客',                       sortOrder: 803 },
  { kubun: 'SSW1', sectorId: 'Akomodasi',           sectorJa: '宿泊業',                fieldId: 'Pelayanan Restoran Hotel',          fieldJa: 'レストランサービス',          sortOrder: 804 },

  // ── SSW1 : 9. 農業 ─────────────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Pertanian',           sectorJa: '農業',                  fieldId: 'Pertanian Tanaman',                 fieldJa: '耕種農業',                   sortOrder: 901 },
  { kubun: 'SSW1', sectorId: 'Pertanian',           sectorJa: '農業',                  fieldId: 'Peternakan',                        fieldJa: '畜産農業',                   sortOrder: 902 },

  // ── SSW1 : 10. 漁業 ────────────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Perikanan',           sectorJa: '漁業・養殖業',           fieldId: 'Penangkapan Ikan',                  fieldJa: '漁業',                       sortOrder: 1001 },
  { kubun: 'SSW1', sectorId: 'Perikanan',           sectorJa: '漁業・養殖業',           fieldId: 'Budidaya Ikan',                     fieldJa: '養殖業',                     sortOrder: 1002 },

  // ── SSW1 : 11. 飲食料品製造業 ──────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Makanan dan Minuman', sectorJa: '飲食料品製造業',         fieldId: 'Pengolahan Makanan dan Minuman',    fieldJa: '飲食料品製造業全般',          sortOrder: 1100 },

  // ── SSW1 : 12. 外食業 ──────────────────────────────────────────────────────
  { kubun: 'SSW1', sectorId: 'Industri Makanan Jadi', sectorJa: '外食業',              fieldId: 'Usaha Makanan Jadi',                fieldJa: '外食業全般',                 sortOrder: 1200 },

  // ── SSW2 : 建設 ────────────────────────────────────────────────────────────
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Pengelasan (SSW2)',                  fieldJa: '溶接',                       sortOrder: 2401 },
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Pembesian (SSW2)',                   fieldJa: '鉄筋施工',                   sortOrder: 2402 },
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Bekisting (SSW2)',                   fieldJa: '型枠施工',                   sortOrder: 2403 },
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Plesteran (SSW2)',                   fieldJa: '左官',                       sortOrder: 2404 },
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Tukang Kayu Bangunan (SSW2)',        fieldJa: '建築大工',                   sortOrder: 2405 },
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Instalasi Pipa (SSW2)',              fieldJa: '配管',                       sortOrder: 2406 },
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Finishing Interior (SSW2)',          fieldJa: '内装仕上げ・表装',            sortOrder: 2407 },
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Perancah (SSW2)',                    fieldJa: 'とび',                       sortOrder: 2408 },
  { kubun: 'SSW2', sectorId: 'Konstruksi',          sectorJa: '建設業',                fieldId: 'Pekerjaan Tanah (SSW2)',             fieldJa: '土工',                       sortOrder: 2409 },

  // ── SSW2 : 造船・舶用工業 ───────────────────────────────────────────────────
  { kubun: 'SSW2', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Pengelasan Kapal (SSW2)',            fieldJa: '溶接',                       sortOrder: 2501 },
  { kubun: 'SSW2', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Pengecatan Kapal (SSW2)',            fieldJa: '塗装',                       sortOrder: 2502 },
  { kubun: 'SSW2', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Pengerjaan Besi Kapal (SSW2)',       fieldJa: '鉄工',                       sortOrder: 2503 },
  { kubun: 'SSW2', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Finishing Kapal (SSW2)',             fieldJa: '仕上げ',                     sortOrder: 2504 },
  { kubun: 'SSW2', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Pemesinan Kapal (SSW2)',             fieldJa: '機械加工',                   sortOrder: 2505 },
  { kubun: 'SSW2', sectorId: 'Perkapalan',          sectorJa: '造船・舶用工業',         fieldId: 'Perakitan Mesin Kapal (SSW2)',       fieldJa: '電気機器組立て',              sortOrder: 2506 },
];

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) as cnt FROM ssw_sector_fields`,
    );
    if ((existing as { cnt: number }[])[0]!.cnt > 0) {
      console.log('SSW sector fields already seeded — skipping.');
      return;
    }
    await queryInterface.bulkInsert(
      'ssw_sector_fields',
      SSW_DATA.map((row) => ({ id: uuidv4(), ...row, isActive: true, createdAt: now, updatedAt: now })),
    );
    console.log(`✓ ${SSW_DATA.length} SSW sector/field rows inserted.`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.bulkDelete('ssw_sector_fields', {});
  },
};
