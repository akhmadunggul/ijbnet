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

const NEW_ROWS: Row[] = [
  // ── SSW1 : 13. 自動車運送業
  { kubun: 'SSW1', sectorId: 'Transportasi Darat',   sectorJa: '自動車運送業',        fieldId: 'Sopir Bus & Truk',                       fieldJa: 'バス・トラック運転',       sortOrder: 1301 },
  { kubun: 'SSW1', sectorId: 'Transportasi Darat',   sectorJa: '自動車運送業',        fieldId: 'Sopir Taksi',                            fieldJa: 'タクシー運転',            sortOrder: 1302 },

  // ── SSW1 : 14. 林業
  { kubun: 'SSW1', sectorId: 'Kehutanan',             sectorJa: '林業',               fieldId: 'Penebangan & Penanaman',                 fieldJa: '伐木・造林',              sortOrder: 1400 },

  // ── SSW1 : 15. 木材産業
  { kubun: 'SSW1', sectorId: 'Industri Kayu',         sectorJa: '木材産業',           fieldId: 'Pengolahan Kayu & Mebel',                fieldJa: '木材・木製品製造',         sortOrder: 1500 },

  // ── SSW1 : 16. 鉄道
  { kubun: 'SSW1', sectorId: 'Perkeretaapian',        sectorJa: '鉄道',               fieldId: 'Perawatan Rel',                          fieldJa: '軌道保全',                sortOrder: 1601 },
  { kubun: 'SSW1', sectorId: 'Perkeretaapian',        sectorJa: '鉄道',               fieldId: 'Masinis & Operasi Kereta',               fieldJa: '列車運転・操縦',           sortOrder: 1602 },
  { kubun: 'SSW1', sectorId: 'Perkeretaapian',        sectorJa: '鉄道',               fieldId: 'Pelayanan Stasiun',                      fieldJa: '駅業務',                  sortOrder: 1603 },

  // ── SSW1 : 17. リネンサプライ業
  { kubun: 'SSW1', sectorId: 'Penyediaan Linen',      sectorJa: 'リネンサプライ業',    fieldId: 'Cuci & Distribusi Linen',                fieldJa: 'リネンサプライ業全般',     sortOrder: 1700 },

  // ── SSW1 : 18. 港湾物流業
  { kubun: 'SSW1', sectorId: 'Logistik Gudang',       sectorJa: '港湾物流業',         fieldId: 'Sortir & Packing Barang',                fieldJa: '倉庫・物流作業全般',       sortOrder: 1800 },

  // ── SSW1 : 19. 廃棄物処理業
  { kubun: 'SSW1', sectorId: 'Pengelolaan Limbah',    sectorJa: '廃棄物処理業',       fieldId: 'Daur Ulang & Pemilahan',                 fieldJa: '廃棄物処理業全般',         sortOrder: 1900 },

  // ── SSW2 : 自動車整備
  { kubun: 'SSW2', sectorId: 'Perawatan Otomotif',   sectorJa: '自動車整備',         fieldId: 'Perawatan Kendaraan (SSW2)',              fieldJa: '自動車整備',              sortOrder: 2600 },

  // ── SSW2 : 航空
  { kubun: 'SSW2', sectorId: 'Penerbangan',           sectorJa: '航空',               fieldId: 'Ground Handling (SSW2)',                 fieldJa: '空港グランドハンドリング', sortOrder: 2701 },
  { kubun: 'SSW2', sectorId: 'Penerbangan',           sectorJa: '航空',               fieldId: 'Perawatan Pesawat (SSW2)',               fieldJa: '航空機整備',              sortOrder: 2702 },

  // ── SSW2 : 農業
  { kubun: 'SSW2', sectorId: 'Pertanian',             sectorJa: '農業',               fieldId: 'Pertanian Tanaman (SSW2)',               fieldJa: '耕種農業',                sortOrder: 2901 },
  { kubun: 'SSW2', sectorId: 'Pertanian',             sectorJa: '農業',               fieldId: 'Peternakan (SSW2)',                      fieldJa: '畜産農業',                sortOrder: 2902 },

  // ── SSW2 : 漁業・養殖業
  { kubun: 'SSW2', sectorId: 'Perikanan',             sectorJa: '漁業・養殖業',        fieldId: 'Penangkapan Ikan (SSW2)',                fieldJa: '漁業',                    sortOrder: 3001 },
  { kubun: 'SSW2', sectorId: 'Perikanan',             sectorJa: '漁業・養殖業',        fieldId: 'Budidaya Ikan (SSW2)',                   fieldJa: '養殖業',                  sortOrder: 3002 },

  // ── SSW2 : 飲食料品製造業
  { kubun: 'SSW2', sectorId: 'Makanan dan Minuman',   sectorJa: '飲食料品製造業',     fieldId: 'Pengolahan Makanan dan Minuman (SSW2)',  fieldJa: '飲食料品製造業全般',       sortOrder: 3100 },

  // ── SSW2 : 外食業
  { kubun: 'SSW2', sectorId: 'Industri Makanan Jadi', sectorJa: '外食業',             fieldId: 'Usaha Makanan Jadi (SSW2)',              fieldJa: '外食業全般',              sortOrder: 3200 },

  // ── SSW2 : 宿泊業
  { kubun: 'SSW2', sectorId: 'Akomodasi',             sectorJa: '宿泊業',             fieldId: 'Front Desk (SSW2)',                      fieldJa: 'フロント',                sortOrder: 3801 },
  { kubun: 'SSW2', sectorId: 'Akomodasi',             sectorJa: '宿泊業',             fieldId: 'Perencanaan & Promosi (SSW2)',           fieldJa: '企画・広報',              sortOrder: 3802 },
  { kubun: 'SSW2', sectorId: 'Akomodasi',             sectorJa: '宿泊業',             fieldId: 'Pelayanan Tamu (SSW2)',                  fieldJa: '接客',                    sortOrder: 3803 },
  { kubun: 'SSW2', sectorId: 'Akomodasi',             sectorJa: '宿泊業',             fieldId: 'Pelayanan Restoran Hotel (SSW2)',        fieldJa: 'レストランサービス',        sortOrder: 3804 },

  // ── SSW2 : 製造業
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Pemesinan (SSW2)',                       fieldJa: '機械加工',                sortOrder: 3301 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Pengecoran Logam (SSW2)',               fieldJa: '鋳造',                    sortOrder: 3302 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Penempaan (SSW2)',                       fieldJa: '鍛造',                    sortOrder: 3303 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Die Cast (SSW2)',                        fieldJa: 'ダイカスト',               sortOrder: 3304 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Press Logam (SSW2)',                     fieldJa: '金属プレス加工',           sortOrder: 3305 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Pengerjaan Besi (SSW2)',                 fieldJa: '鉄工',                    sortOrder: 3306 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Pengecatan Industri (SSW2)',             fieldJa: '工業塗装',                sortOrder: 3307 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Perakitan Mesin Listrik (SSW2)',         fieldJa: '電気機器組立て',           sortOrder: 3308 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Perakitan Elektronik (SSW2)',            fieldJa: '電子機器組立て',           sortOrder: 3309 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Manufaktur Komponen Elektronik (SSW2)', fieldJa: '電気・電子部品附属品製造', sortOrder: 3310 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Manufaktur PCB (SSW2)',                  fieldJa: 'プリント配線板製造',        sortOrder: 3311 },
  { kubun: 'SSW2', sectorId: 'Manufaktur',             sectorJa: '製造業',             fieldId: 'Pembentukan Plastik (SSW2)',             fieldJa: 'プラスチック成形',          sortOrder: 3312 },

  // ── SSW2 : 自動車運送業
  { kubun: 'SSW2', sectorId: 'Transportasi Darat',   sectorJa: '自動車運送業',        fieldId: 'Sopir Bus & Truk (SSW2)',                fieldJa: 'バス・トラック運転',       sortOrder: 3401 },
  { kubun: 'SSW2', sectorId: 'Transportasi Darat',   sectorJa: '自動車運送業',        fieldId: 'Sopir Taksi (SSW2)',                     fieldJa: 'タクシー運転',            sortOrder: 3402 },
];

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT fieldId FROM ssw_sector_fields`,
    );
    const existingFieldIds = new Set((existing as { fieldId: string }[]).map((r) => r.fieldId));
    const toInsert = NEW_ROWS.filter((r) => !existingFieldIds.has(r.fieldId));
    if (toInsert.length === 0) {
      console.log('All new SSW sector fields already exist — skipping.');
      return;
    }
    await queryInterface.bulkInsert(
      'ssw_sector_fields',
      toInsert.map((row) => ({ id: uuidv4(), ...row, isActive: true, createdAt: now, updatedAt: now })),
    );
    console.log(`✓ ${toInsert.length} new SSW sector/field rows inserted.`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const fieldIds = NEW_ROWS.map((r) => r.fieldId);
    await queryInterface.sequelize.query(
      `DELETE FROM ssw_sector_fields WHERE fieldId IN (${fieldIds.map(() => '?').join(',')})`,
      { replacements: fieldIds },
    );
  },
};
