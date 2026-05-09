import { QueryInterface } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

interface Row {
  kubun: 'Trainee';
  sectorId: string;
  sectorJa: string;
  fieldId: string;
  fieldJa: string;
  sortOrder: number;
}

const TRAINEE_ROWS: Row[] = [
  // ── 1. Pertanian & Peternakan / 農業・畜産 ─────────────────────────
  { kubun: 'Trainee', sectorId: 'Pertanian & Peternakan', sectorJa: '農業・畜産',      fieldId: 'Budidaya Tanaman (Padi, Hortikultura, Jamur)', fieldJa: '農作物栽培（稲作・野菜・果物・キノコ）', sortOrder: 1001 },
  { kubun: 'Trainee', sectorId: 'Pertanian & Peternakan', sectorJa: '農業・畜産',      fieldId: 'Peternakan (Sapi, Babi, Ayam)',               fieldJa: '畜産（牛・豚・鶏の飼育・搾乳・食肉加工）', sortOrder: 1002 },

  // ── 2. Perikanan / 漁業・水産 ─────────────────────────────────────
  { kubun: 'Trainee', sectorId: 'Perikanan',              sectorJa: '漁業・水産',      fieldId: 'Budidaya & Penangkapan (Tiram, Rumput Laut)', fieldJa: '養殖・漁業（牡蠣・海藻・遠洋漁業）',     sortOrder: 2001 },
  { kubun: 'Trainee', sectorId: 'Perikanan',              sectorJa: '漁業・水産',      fieldId: 'Pengolahan Hasil Laut',                       fieldJa: '水産加工（洗浄・冷凍・梱包）',            sortOrder: 2002 },

  // ── 3. Konstruksi / 建設 ─────────────────────────────────────────
  { kubun: 'Trainee', sectorId: 'Konstruksi',             sectorJa: '建設',            fieldId: 'Bekisting (Formwork)',                        fieldJa: '型枠施工',                               sortOrder: 3001 },
  { kubun: 'Trainee', sectorId: 'Konstruksi',             sectorJa: '建設',            fieldId: 'Pembesian (Rebar)',                           fieldJa: '鉄筋施工',                               sortOrder: 3002 },
  { kubun: 'Trainee', sectorId: 'Konstruksi',             sectorJa: '建設',            fieldId: 'Pemasangan Keramik',                          fieldJa: 'タイル張り',                             sortOrder: 3003 },
  { kubun: 'Trainee', sectorId: 'Konstruksi',             sectorJa: '建設',            fieldId: 'Perpipaan',                                   fieldJa: '配管',                                   sortOrder: 3004 },
  { kubun: 'Trainee', sectorId: 'Konstruksi',             sectorJa: '建設',            fieldId: 'Pengelasan',                                  fieldJa: '溶接',                                   sortOrder: 3005 },
  { kubun: 'Trainee', sectorId: 'Konstruksi',             sectorJa: '建設',            fieldId: 'Operasional Alat Berat',                      fieldJa: '建設機械操作',                           sortOrder: 3006 },
  { kubun: 'Trainee', sectorId: 'Konstruksi',             sectorJa: '建設',            fieldId: 'Finishing Interior',                          fieldJa: '内装仕上げ',                             sortOrder: 3007 },

  // ── 4. Pengolahan Makanan & Minuman / 食品・飲料製造 ──────────────
  { kubun: 'Trainee', sectorId: 'Pengolahan Makanan & Minuman', sectorJa: '食品・飲料製造', fieldId: 'Pabrik Roti & Kue',                      fieldJa: 'パン・菓子製造',                         sortOrder: 4001 },
  { kubun: 'Trainee', sectorId: 'Pengolahan Makanan & Minuman', sectorJa: '食品・飲料製造', fieldId: 'Makanan Siap Saji (Bento)',               fieldJa: '弁当・惣菜製造',                         sortOrder: 4002 },
  { kubun: 'Trainee', sectorId: 'Pengolahan Makanan & Minuman', sectorJa: '食品・飲料製造', fieldId: 'Makanan Beku',                           fieldJa: '冷凍食品製造',                           sortOrder: 4003 },
  { kubun: 'Trainee', sectorId: 'Pengolahan Makanan & Minuman', sectorJa: '食品・飲料製造', fieldId: 'Ham & Sosis',                            fieldJa: 'ハム・ソーセージ製造',                   sortOrder: 4004 },
  { kubun: 'Trainee', sectorId: 'Pengolahan Makanan & Minuman', sectorJa: '食品・飲料製造', fieldId: 'Pengolahan Cumi, Ikan & Hasil Laut',     fieldJa: '水産加工（イカ・魚介類）',               sortOrder: 4005 },

  // ── 5. Tekstil & Pakaian / 繊維・衣類 ────────────────────────────
  { kubun: 'Trainee', sectorId: 'Tekstil & Pakaian',      sectorJa: '繊維・衣類',      fieldId: 'Menjahit Pakaian',                            fieldJa: '縫製',                                   sortOrder: 5001 },
  { kubun: 'Trainee', sectorId: 'Tekstil & Pakaian',      sectorJa: '繊維・衣類',      fieldId: 'Merajut',                                     fieldJa: '編み物',                                 sortOrder: 5002 },
  { kubun: 'Trainee', sectorId: 'Tekstil & Pakaian',      sectorJa: '繊維・衣類',      fieldId: 'Menenun',                                     fieldJa: '織物',                                   sortOrder: 5003 },
  { kubun: 'Trainee', sectorId: 'Tekstil & Pakaian',      sectorJa: '繊維・衣類',      fieldId: 'Tas, Sepatu & Produk Kulit',                  fieldJa: '袋物・靴・革製品',                       sortOrder: 5004 },

  // ── 6. Permesinan & Manufaktur / 機械・製造 ───────────────────────
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Pengelasan',                                  fieldJa: '溶接',                                   sortOrder: 6001 },
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Bubut (Lathe)',                               fieldJa: '旋盤加工',                               sortOrder: 6002 },
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Press Logam',                                 fieldJa: '金属プレス',                             sortOrder: 6003 },
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Cetak Logam (Die Cast)',                      fieldJa: 'ダイカスト・金属鋳造',                   sortOrder: 6004 },
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Perakitan Elektronik',                        fieldJa: '電気・電子部品組立',                     sortOrder: 6005 },
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Perakitan Plastik',                           fieldJa: 'プラスチック成形・組立',                 sortOrder: 6006 },
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Perakitan Mesin',                             fieldJa: '機械組立',                               sortOrder: 6007 },
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Pengecatan Logam',                            fieldJa: '工業塗装',                               sortOrder: 6008 },
  { kubun: 'Trainee', sectorId: 'Permesinan & Manufaktur', sectorJa: '機械・製造',     fieldId: 'Pengepakan Industri',                         fieldJa: '工業用梱包',                             sortOrder: 6009 },

  // ── 7. Jasa & Lainnya / サービス・その他 ─────────────────────────
  { kubun: 'Trainee', sectorId: 'Jasa & Lainnya',         sectorJa: 'サービス・その他', fieldId: 'Housekeeping (Hotel)',                       fieldJa: 'ハウスキーピング',                       sortOrder: 7001 },
  { kubun: 'Trainee', sectorId: 'Jasa & Lainnya',         sectorJa: 'サービス・その他', fieldId: 'Front Office',                               fieldJa: 'フロントオフィス',                       sortOrder: 7002 },
  { kubun: 'Trainee', sectorId: 'Jasa & Lainnya',         sectorJa: 'サービス・その他', fieldId: 'Food & Beverage',                            fieldJa: '飲食サービス',                           sortOrder: 7003 },
  { kubun: 'Trainee', sectorId: 'Jasa & Lainnya',         sectorJa: 'サービス・その他', fieldId: 'Caregiver (Asisten Lansia)',                 fieldJa: '介護補助・高齢者介護',                   sortOrder: 7004 },
  { kubun: 'Trainee', sectorId: 'Jasa & Lainnya',         sectorJa: 'サービス・その他', fieldId: 'Cleaning Service (Gedung & Fasilitas)',      fieldJa: '清掃業務',                               sortOrder: 7005 },
  { kubun: 'Trainee', sectorId: 'Jasa & Lainnya',         sectorJa: 'サービス・その他', fieldId: 'IT & Teknisi',                               fieldJa: 'IT・設備メンテナンス',                   sortOrder: 7006 },
  { kubun: 'Trainee', sectorId: 'Jasa & Lainnya',         sectorJa: 'サービス・その他', fieldId: 'Operator Produksi Umum',                     fieldJa: '製造オペレーター',                       sortOrder: 7007 },
];

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    const now = new Date();
    const rows = TRAINEE_ROWS.map((r) => ({
      id: uuidv4(),
      ...r,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }));
    await queryInterface.bulkInsert('ssw_sector_fields', rows);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.bulkDelete('ssw_sector_fields', { kubun: 'Trainee' } as never);
  },
};
