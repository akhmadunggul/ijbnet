const PROVINSI_JA: Record<string, string> = {
  'Aceh (NAD)':              'アチェ州',
  'Sumatera Utara':          '北スマトラ州',
  'Sumatera Barat':          '西スマトラ州',
  'Riau':                    'リアウ州',
  'Jambi':                   'ジャンビ州',
  'Sumatera Selatan':        '南スマトラ州',
  'Bengkulu':                'ブンクル州',
  'Lampung':                 'ランプン州',
  'Kepulauan Bangka Belitung': 'バンカブリトゥン諸島州',
  'Bangka Belitung':         'バンカブリトゥン州',
  'Kepulauan Riau':          'リアウ諸島州',
  'DKI Jakarta':             'DKIジャカルタ州',
  'Jawa Barat':              '西ジャワ州',
  'Jawa Tengah':             '中ジャワ州',
  'DI Yogyakarta':           'ジョグジャカルタ特別州',
  'Jawa Timur':              '東ジャワ州',
  'Banten':                  'バンテン州',
  'Bali':                    'バリ州',
  'Nusa Tenggara Barat':     '西ヌサトゥンガラ州',
  'Nusa Tenggara Timur':     '東ヌサトゥンガラ州',
  'Kalimantan Barat':        '西カリマンタン州',
  'Kalimantan Tengah':       '中カリマンタン州',
  'Kalimantan Selatan':      '南カリマンタン州',
  'Kalimantan Timur':        '東カリマンタン州',
  'Kalimantan Utara':        '北カリマンタン州',
  'Sulawesi Utara':          '北スラウェシ州',
  'Sulawesi Tengah':         '中スラウェシ州',
  'Sulawesi Selatan':        '南スラウェシ州',
  'Sulawesi Tenggara':       '東南スラウェシ州',
  'Gorontalo':               'ゴロンタロ州',
  'Sulawesi Barat':          '西スラウェシ州',
  'Maluku':                  'マルク州',
  'Maluku Utara':            '北マルク州',
  'Papua Barat':             '西パプア州',
  'Papua Barat Daya':        '南西パプア州',
  'Papua':                   'パプア州',
  'Papua Selatan':           '南パプア州',
  'Papua Tengah':            '中パプア州',
  'Papua Pegunungan':        'パプア山岳州',
};

// Fallback: resolve province from BPS numeric ID when provinsiName is empty
const PROVINSI_ID_JA: Record<string, string> = {
  '11': 'アチェ州',
  '12': '北スマトラ州',
  '13': '西スマトラ州',
  '14': 'リアウ州',
  '15': 'ジャンビ州',
  '16': '南スマトラ州',
  '17': 'ブンクル州',
  '18': 'ランプン州',
  '19': 'バンカブリトゥン諸島州',
  '21': 'リアウ諸島州',
  '31': 'DKIジャカルタ州',
  '32': '西ジャワ州',
  '33': '中ジャワ州',
  '34': 'ジョグジャカルタ特別州',
  '35': '東ジャワ州',
  '36': 'バンテン州',
  '51': 'バリ州',
  '52': '西ヌサトゥンガラ州',
  '53': '東ヌサトゥンガラ州',
  '61': '西カリマンタン州',
  '62': '中カリマンタン州',
  '63': '南カリマンタン州',
  '64': '東カリマンタン州',
  '65': '北カリマンタン州',
  '71': '北スラウェシ州',
  '72': '中スラウェシ州',
  '73': '南スラウェシ州',
  '74': '東南スラウェシ州',
  '75': 'ゴロンタロ州',
  '76': '西スラウェシ州',
  '81': 'マルク州',
  '82': '北マルク州',
  '91': '西パプア州',
  '92': 'パプア州',
  '93': '南パプア州',
  '94': '中パプア州',
  '95': 'パプア山岳州',
  '96': '南西パプア州',
};

export interface AddressStructuredLike {
  provinsiId?:   string;
  provinsiName:  string;
  kotaName:      string;
  kecamatanName: string;
  kelurahanName: string;
  jalan:         string;
  kodePos:       string;
}

/**
 * Convert a structured Indonesian address to Japanese postal format (single line, uppercase):
 *   〒{kodePos} {provinsiJa} {kotaName}市 {kecamatanName}区 {kelurahanName} {jalan}
 *
 * Province resolved by name first, then by BPS ID as fallback.
 * RT/RW omitted (not used in Japanese addressing).
 * Returns empty string when kota/kecamatan/kelurahan are missing.
 */
export function composeAddressJa(s: AddressStructuredLike): string {
  if (!s.kotaName || !s.kecamatanName || !s.kelurahanName) return '';

  const provinsiJa = s.provinsiName
    ? (PROVINSI_JA[s.provinsiName] ?? `${s.provinsiName}州`)
    : (s.provinsiId ? (PROVINSI_ID_JA[s.provinsiId] ?? '') : '');

  const parts: string[] = [];
  if (s.kodePos)  parts.push(`〒${s.kodePos}`);
  if (provinsiJa) parts.push(provinsiJa);
  parts.push(`${s.kotaName}市`);
  parts.push(`${s.kecamatanName}区 ${s.kelurahanName}`);
  if (s.jalan)    parts.push(s.jalan);

  return parts.join(' ').toUpperCase();
}
