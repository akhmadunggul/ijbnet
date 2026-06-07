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

export interface AddressStructuredLike {
  provinsiName:  string;
  kotaName:      string;
  kecamatanName: string;
  kelurahanName: string;
  jalan:         string;
  kodePos:       string;
}

/**
 * Convert a structured Indonesian address to Japanese postal format.
 * Returns a newline-separated string, or empty string when required
 * fields are missing.
 */
export function composeAddressJa(s: AddressStructuredLike): string {
  if (!s.provinsiName || !s.kotaName || !s.kecamatanName || !s.kelurahanName) return '';

  const provinsiJa = PROVINSI_JA[s.provinsiName] ?? `${s.provinsiName}州`;
  const kotaJa     = `${s.kotaName}市`;
  const kecKelJa   = `${s.kecamatanName}区 ${s.kelurahanName}`;

  const lines: string[] = [];
  if (s.kodePos)  lines.push(`〒${s.kodePos}`);
  lines.push(provinsiJa);
  lines.push(kotaJa);
  lines.push(kecKelJa);
  if (s.jalan)    lines.push(s.jalan);

  return lines.join('\n');
}
