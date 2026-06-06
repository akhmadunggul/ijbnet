/**
 * Backend mirror of CandidateCV.tsx — produces the same styled A4 HTML
 * (bilingual labels, IJBNet logo, candidate photo) for server-side PDF rendering.
 */

// ── IJBNet logo embedded as base64 ────────────────────────────────────────────
const LOGO_B64 =
  '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';

const IJBNET_LOGO = `data:image/png;base64,${LOGO_B64}`;

const FONT_MAP: Record<string, string> = {
  'ms-mincho':     '"MS Mincho", serif',
  'yu-mincho':     '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS PMincho", serif',
  'yu-gothic':     '"Hiragino Sans", "Yu Gothic", "Meiryo", "MS PGothic", sans-serif',
  'noto-serif-jp': '"Noto Serif JP", serif',
  'noto-sans-jp':  '"Noto Sans JP", sans-serif',
};

const GOOGLE_FONT_MAP: Record<string, string> = {
  'noto-serif-jp': 'Noto+Serif+JP:wght@400;700',
  'noto-sans-jp':  'Noto+Sans+JP:wght@400;700',
};

function he(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function v(x: unknown): string {
  if (x === null || x === undefined || x === '') return '';
  return String(x);
}

function trunc(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

function getJa(cj: Record<string, unknown>, jaKey: string, idKey: string): string {
  return v(cj[jaKey]) || v(cj[idKey]);
}

/** Normalise Sequelize DATEONLY — handles both string "YYYY-MM-DD" and Date objects. */
function toDateStr(raw: unknown): string {
  if (!raw) return '';
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const mo = String(raw.getMonth() + 1).padStart(2, '0');
    const d  = String(raw.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return String(raw).slice(0, 10); // covers "YYYY-MM-DD" and "YYYY-MM-DD HH:MM:SS"
}

function calculateAge(raw: unknown): number {
  const dateStr = toDateStr(raw);
  const dob = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function formatDobJa(raw: unknown): string {
  const dateStr = toDateStr(raw);
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || isNaN(y) || !m || !d) return dateStr;
  return `${y}年${m}月${d}日`;
}

function formatPeriod(start?: string | null, end?: string | null): string {
  const fmt = (d: string) => d.slice(0, 7).replace('-', '/');
  const s = start ? fmt(start) : null;
  const e = end ? fmt(end) : null;
  if (s && e) return `${s} ー ${e}`;
  if (s) return `${s} ー 現在`;
  if (e) return `ー ${e}`;
  return '';
}

function formatPeriodJa(start?: string | null, end?: string | null): string {
  const fmt = (d: string) => {
    const [y, m] = d.slice(0, 7).split('-').map(Number);
    return `${y}年${m}月`;
  };
  const s = start ? fmt(start) : null;
  const e = end ? fmt(end) : null;
  if (s && e) return `${s} ー ${e}`;
  if (s) return `${s} ー 現在`;
  if (e) return `ー ${e}`;
  return '';
}

const ID_MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04',
  mei: '05', juni: '06', juli: '07', agustus: '08',
  september: '09', oktober: '10', november: '11', desember: '12',
};

function parsePeriodStart(period: string | null | undefined): string {
  if (!period) return '';
  const start = period.split(/\s*[–—-]\s*/)[0].trim();
  const m = start.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (!m) return '';
  const month = ID_MONTHS[m[1].toLowerCase()];
  return month ? `${m[2]}-${month}-01` : '';
}

function padRows<T>(arr: T[], min: number): (T | null)[] {
  const out: (T | null)[] = [...arr];
  while (out.length < min) out.push(null);
  return out;
}

export function buildCandidateCvHtml(
  cj: Record<string, unknown>,
  settings: { font: string; layout: string; photoBase64?: string | null },
): string {
  const fontFamily = FONT_MAP[settings.font] ?? FONT_MAP['ms-mincho']!;
  const layout = settings.layout ?? 'layout1';
  const googleFontKey = GOOGLE_FONT_MAP[settings.font];
  const googleFontLink = googleFontKey
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${googleFontKey}&display=swap">`
    : '';

  const tests    = (cj['tests']            as Record<string, unknown>[] | null) ?? [];
  const career   = (cj['career']           as Record<string, unknown>[] | null) ?? [];
  const certs    = (cj['certifications']   as Record<string, unknown>[] | null) ?? [];
  const eduHist  = (cj['educationHistory'] as Record<string, unknown>[] | null) ?? [];

  const latestTest = tests.length > 0 ? tests[tests.length - 1] : null;
  const age = cj['dateOfBirth'] ? calculateAge(cj['dateOfBirth']) : null;

  const genderLabel =
    cj['gender'] === 'M' ? 'Laki-laki / 男' :
    cj['gender'] === 'F' ? 'Perempuan / 女' : '';

  const maritalMap: Record<string, string> = {
    single: 'Belum Menikah / 未婚', married: 'Menikah / 既婚',
    divorced: 'Cerai / 離婚', widowed: 'Janda / Duda',
  };

  const religionMap: Record<string, string> = {
    Islam: 'イスラム教', Kristen: 'キリスト教（プロテスタント）', Katolik: 'キリスト教（カトリック）',
    Budha: '仏教', Hindu: 'ヒンドゥー教', Lainnya: 'その他',
  };

  const dobStr = cj['dateOfBirth'] ? formatDobJa(cj['dateOfBirth']) : '';
  const birthDisplay = he([v(cj['birthPlace']), dobStr].filter(Boolean).join('  '));

  const addressRaw = cj['address'];
  const addressDisplay = (addressRaw as any)?.masked === true ? '🔒' : he(v(addressRaw));

  const heightDisplay = (cj['selfReportedHeight'] ?? cj['heightCm']) != null
    ? `${cj['selfReportedHeight'] ?? cj['heightCm']} cm` : '';
  const weightDisplay = (cj['selfReportedWeight'] ?? cj['weightKg']) != null
    ? `${cj['selfReportedWeight'] ?? cj['weightKg']} kg` : '';

  const jpLevelDisplay = latestTest
    ? he(`${v(latestTest['testName'])}${latestTest['score'] != null ? ` / ${latestTest['score']}` : ''}`)
    : '';

  const japanDisplay =
    cj['hasVisitedJapan'] === true  ? 'Ada（有）' :
    cj['hasVisitedJapan'] === false ? 'Belum（無）' : '';
  const passportDisplay =
    cj['hasPassport'] === true  ? 'Ada（有）' :
    cj['hasPassport'] === false ? 'Tidak（無）' : '';

  // Combined certs + tests
  const combinedCerts: { issuedDate: string; name: string; info: string }[] = [
    ...certs.map((c) => ({
      issuedDate: c['issuedDate'] ? String(c['issuedDate']).slice(0, 10) : '',
      name: v(c['certName']),
      info: [c['certLevel'], c['issuedBy']].filter(Boolean).join(' / '),
    })),
    ...tests.map((t) => ({
      issuedDate: t['testDate'] ? String(t['testDate']).slice(0, 10) : '',
      name: v(t['testName']),
      info: [t['score'] != null ? String(t['score']) : null, t['pass'] ? '合格 ✓' : null].filter(Boolean).join(' '),
    })),
  ];

  const sortedEdu = [...eduHist].sort((a, b) => {
    if (!a['startDate'] && !b['startDate']) return 0;
    if (!a['startDate']) return 1;
    if (!b['startDate']) return -1;
    return String(a['startDate']) < String(b['startDate']) ? -1 : 1;
  });
  const eduRows = padRows(sortedEdu, 2);

  const sortedCareer = [...career].sort((a, b) => {
    const aKey = String(a['startDate'] ?? '') || parsePeriodStart(a['period'] as string | null);
    const bKey = String(b['startDate'] ?? '') || parsePeriodStart(b['period'] as string | null);
    if (!aKey && !bKey) return 0;
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey < bKey ? -1 : 1;
  });
  const careerRows = padRows(sortedCareer, 2);
  const certRows = padRows(combinedCerts, 1);

  // ── Inline styles — match candidate-cv-print.css values ─────────────────────
  const TD  = 'border:1px solid #000;padding:3px 4px;vertical-align:top;font-size:13px;';
  const ST  = `${TD}background:#f2f2f2;font-weight:bold;`;

  // ── Photo block ───────────────────────────────────────────────────────────────
  const photoSrc = settings.photoBase64 ?? null;
  const photoHtml = photoSrc
    ? `<img src="${photoSrc}" alt="foto" style="width:120px;height:150px;object-fit:cover;display:block;">`
    : `<div style="height:150px;line-height:150px;color:#999;text-align:center;">Foto</div>`;

  const logoInPhotoBox = layout === 'layout1'
    ? `<div style="border-top:1px solid #000;padding:5px 14px;"><img src="${IJBNET_LOGO}" alt="IJBNet" style="width:100%;height:auto;display:block;"></div>`
    : '';

  const photoBoxStyle = layout === 'layout2'
    ? 'width:120px;border:1px solid #000;text-align:center;float:right;flex-shrink:0;height:150px;overflow:hidden;'
    : 'width:120px;border:1px solid #000;text-align:center;float:right;flex-shrink:0;';

  // ── Education rows ────────────────────────────────────────────────────────────
  const eduStatusMap: Record<string, string> = {
    'Lulus':         'Lulus ・ 卒業',
    'Drop Out':      'Drop Out ・ 中退',
    'Masih Belajar': 'Masih Belajar ・ 在学中',
  };
  const eduRowsHtml = eduRows.map((row) => {
    if (!row) return `<tr class="cv-row-sm"><td style="${TD}height:25px;"></td><td style="${TD}"></td><td style="${TD}"></td></tr>`;
    const statusHtml = row['status']
      ? `<span style="font-size:10px;color:#555;flex-shrink:0;margin-left:6px;">${he(eduStatusMap[String(row['status'])] ?? v(row['status']))}</span>`
      : '';
    const schoolCell = `<div style="display:flex;justify-content:space-between;align-items:center;"><span>${he(v(row['schoolName']))}</span>${statusHtml}</div>`;
    return `<tr class="cv-row-sm"><td style="${TD}height:25px;">${he(formatPeriodJa(toDateStr(row['startDate']), toDateStr(row['endDate'])))}</td><td style="${TD}">${schoolCell}</td><td style="${TD}">${he(v(row['major']))}</td></tr>`;
  }).join('');

  // ── Career rows ───────────────────────────────────────────────────────────────
  const careerRowsHtml = careerRows.map((row) => {
    if (!row) return `<tr class="cv-row-md"><td style="${TD}height:40px;"></td><td style="${TD}"></td><td style="${TD}"></td></tr>`;
    const period = row['startDate']
      ? formatPeriodJa(toDateStr(row['startDate']), toDateStr(row['endDate']))
      : v(row['period']);
    return `<tr class="cv-row-md"><td style="${TD}height:40px;">${he(period)}</td><td style="${TD}">${he(v(row['companyName']))}</td><td style="${TD}">${he(v(row['companyBusinessActivityJa'] as unknown) || v(row['companyBusinessActivity'] as unknown))}</td></tr>`;
  }).join('');

  // ── Cert rows ─────────────────────────────────────────────────────────────────
  const certRowsHtml = certRows.map((row) =>
    row
      ? `<tr><td style="${TD}height:25px;">${he(row.issuedDate)}</td><td style="${TD}">${he(row.name)}</td><td style="${TD}">${he(row.info)}</td></tr>`
      : `<tr class="cv-row-sm"><td style="${TD}height:25px;"></td><td style="${TD}"></td><td style="${TD}"></td></tr>`,
  ).join('');

  // ── Promosi Diri with optional logo2 ─────────────────────────────────────────
  const promosiExtra = layout === 'layout2'
    ? `<td style="${TD}width:100px;text-align:center;vertical-align:middle;padding:6px 10px;" rowspan="2"><img src="${IJBNET_LOGO}" alt="IJBNet" style="width:100%;height:auto;display:block;"></td>`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  ${googleFontLink}
  <style>
    @page { size: A4 portrait; margin: 5mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${fontFamily}; font-size: 13px; color: #000; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    td, th { padding: 3px 4px; font-size: 13px; }
    .cv-row-sm { height: 18px; }
    .cv-row-md { height: 24px; }
    .cv-row-lg { height: 32px; }
  </style>
</head>
<body>
<div style="width:100%;border:1px solid #000;padding:6px 10px;font-size:13px;color:#000;box-sizing:border-box;text-transform:uppercase;">

  <!-- Title -->
  <div style="text-align:center;font-size:18px;font-weight:bold;margin-bottom:20px;text-decoration:underline;">
    候補者データ ・ DATA KANDIDAT
  </div>

  <!-- Photo + basic info -->
  <div style="overflow:hidden;margin-bottom:4px;">
    <div style="${photoBoxStyle}">
      ${photoHtml}
      ${logoInPhotoBox}
    </div>
    <table style="width:calc(100% - 140px);float:left;margin-bottom:0;">
      <tbody>
        <tr>
          <td style="${TD}width:20%;">Nama ・ 氏名</td>
          <td style="${TD}" colspan="3">
            <div>${he(v(cj['fullName']))}</div>
            ${v(cj['nameKatakana']) ? `<div style="font-size:11px;color:#444;margin-top:2px;">${he(v(cj['nameKatakana']))}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="${TD}width:20%;">Tempat, Tgl Lahir ・ 出身地 生年月日</td>
          <td style="${TD}width:30%;">${birthDisplay}</td>
          <td style="${TD}width:20%;">Jenis Kelamin ・ 性別</td>
          <td style="${TD}">${he(genderLabel)}</td>
        </tr>
        <tr>
          <td style="${TD}">Usia ・ 年齢</td>
          <td style="${TD}">${age !== null ? `${age}歳` : ''}</td>
          <td style="${TD}">Agama ・ 宗教</td>
          <td style="${TD}">${he(cj['religion'] ? (religionMap[String(cj['religion'])] ?? v(cj['religion'])) : '')}</td>
        </tr>
        <tr>
          <td style="${TD}">Gol. Darah ・ 血液型</td>
          <td style="${TD}">${he(v(cj['bloodType']))}</td>
          <td style="${TD}">Status Nikah ・ 結婚歴</td>
          <td style="${TD}">${he(cj['maritalStatus'] ? (maritalMap[String(cj['maritalStatus'])] ?? v(cj['maritalStatus'])) : '')}</td>
        </tr>
        <tr>
          <td style="${TD}">Tinggi ・ 身長</td>
          <td style="${TD}">${he(heightDisplay)}</td>
          <td style="${TD}">Berat ・ 体重</td>
          <td style="${TD}">${he(weightDisplay)}</td>
        </tr>
        <tr>
          <td style="${TD}">Level JP ・ 日本語レベル</td>
          <td style="${TD}" colspan="3">${jpLevelDisplay}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Japan / Passport / Address -->
  <table>
    <tbody>
      <tr>
        <td style="${TD}width:25%;">Pernah ke Jepang ・ 日本滞在経験</td>
        <td style="${TD}width:25%;">${he(japanDisplay)}</td>
        <td style="${TD}width:25%;">Paspor / Visa ・ パスポート／ビザ</td>
        <td style="${TD}width:25%;">${he(passportDisplay)}</td>
      </tr>
      <tr>
        <td style="${TD}">Alamat ・ 現住所</td>
        <td style="${TD}" colspan="3">${addressDisplay}</td>
      </tr>
    </tbody>
  </table>

  <!-- Pendidikan -->
  <table>
    <tbody>
      <tr><td style="${ST}" colspan="3">Pendidikan ・ 学歴</td></tr>
      <tr style="text-align:center;">
        <td style="${TD}width:25%;">Periode ・ 期間</td>
        <td style="${TD}width:40%;">Nama Sekolah ・ 学校名</td>
        <td style="${TD}width:35%;">Jurusan ・ 専攻</td>
      </tr>
      ${eduRowsHtml}
    </tbody>
  </table>

  <!-- Pengalaman Kerja -->
  <table>
    <tbody>
      <tr><td style="${ST}" colspan="3">Pengalaman Kerja ・ 職歴</td></tr>
      <tr style="text-align:center;">
        <td style="${TD}width:25%;">Periode ・ 期間</td>
        <td style="${TD}width:40%;">Nama Perusahaan ・ 会社名</td>
        <td style="${TD}width:35%;">Keg. Usaha ・ 事業内容</td>
      </tr>
      ${careerRowsHtml}
    </tbody>
  </table>

  <!-- Sertifikasi -->
  <table>
    <tbody>
      <tr><td style="${ST}" colspan="3">Sertifikasi ・ 資格・公的認定</td></tr>
      <tr style="text-align:center;">
        <td style="${TD}width:25%;">Tgl Penerbitan ・ 発行日</td>
        <td style="${TD}width:40%;">Nama Sertifikat ・ 名称</td>
        <td style="${TD}width:35%;">Level, Keterangan ・ レベルや詳細</td>
      </tr>
      ${certRowsHtml}
    </tbody>
  </table>

  <!-- Skill -->
  <table>
    <tbody>
      <tr>
        <td style="${ST}">Skill ・ 技能 <span style="font-weight:normal;font-size:11px;">(Keahlian yang berhubungan dengan bidang yang dilamar)</span></td>
      </tr>
      <tr class="cv-row-md">
        <td style="${TD}height:60px;white-space:pre-wrap;">${he(trunc(getJa(cj, 'selfPrJa', 'selfPrId'), 300))}</td>
      </tr>
    </tbody>
  </table>

  <!-- Promosi Diri -->
  <table style="margin-bottom:0;">
    <tbody>
      <tr>
        <td style="${ST}">Promosi Diri ・ 自己PR</td>
        ${promosiExtra}
      </tr>
      <tr class="cv-row-lg">
        <td style="${TD}height:100px;white-space:pre-wrap;">${he(trunc(getJa(cj, 'selfIntroJa', 'selfIntroId'), 400))}</td>
      </tr>
    </tbody>
  </table>

</div>
</body>
</html>`;
}

export { buildCandidateCvHtml as buildCandidateCvHtmlV1 };
