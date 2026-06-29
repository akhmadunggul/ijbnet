/**
 * Backend mirror of CandidateCVv2.tsx — rirekisho-style education and career
 * sections (2 rows per entry: 入学/卒業 and 入社/退社).
 */

// ── IJBNet logo (shared with v1) ──────────────────────────────────────────────
import { IJBNET_LOGO } from './cvLogoBase64';
import { composeAddressJa } from './addressJa';

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

function toDateStr(raw: unknown): string {
  if (!raw) return '';
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const mo = String(raw.getMonth() + 1).padStart(2, '0');
    const d  = String(raw.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return String(raw).slice(0, 10);
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

function formatMonthJa(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const [y, m] = dateStr.slice(0, 7).split('-').map(Number);
  if (!y || !m) return '';
  return `${y}年${m}月`;
}

function formatDateJa(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y) return dateStr;
  if (d) return `${y}年${m}月${d}日`;
  if (m) return `${y}年${m}月`;
  return `${y}年`;
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

export function buildCandidateCvHtmlV2(
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
    cj['gender'] === 'M' ? '男性' :
    cj['gender'] === 'F' ? '女性' : '';

  const maritalMap: Record<string, string> = {
    single: '未婚', married: '既婚', divorced: '離婚', widowed: '死別',
  };

  const religionMap: Record<string, string> = {
    Islam: 'イスラム教', Kristen: 'キリスト教（プロテスタント）', Katolik: 'キリスト教（カトリック）',
    Budha: '仏教', Hindu: 'ヒンドゥー教', Lainnya: 'その他',
  };

  const dobStr = cj['dateOfBirth'] ? formatDobJa(cj['dateOfBirth']) : '';
  const birthDisplay = he([v(cj['birthPlace']), dobStr].filter(Boolean).join('  '));

  const addressRaw = cj['address'];
  const addressStructured = cj['addressStructured'] as import('./addressJa').AddressStructuredLike | null | undefined;
  const addressJa = addressStructured ? composeAddressJa(addressStructured) : '';
  const addressDisplay = (addressRaw as any)?.masked === true ? '🔒' : he(addressJa || v(addressRaw));

  const heightDisplay = (cj['selfReportedHeight'] ?? cj['heightCm']) != null
    ? `${cj['selfReportedHeight'] ?? cj['heightCm']} cm` : '';
  const weightDisplay = (cj['selfReportedWeight'] ?? cj['weightKg']) != null
    ? `${cj['selfReportedWeight'] ?? cj['weightKg']} kg` : '';

  const jpLevelDisplay = latestTest
    ? he(`${v(latestTest['testName'])}${latestTest['score'] != null ? ` / ${latestTest['score']}` : ''}`)
    : '';

  const japanDisplay =
    cj['hasVisitedJapan'] === true  ? '有' :
    cj['hasVisitedJapan'] === false ? '無' : '';
  const passportDisplay =
    cj['hasPassport'] === true  ? '有' :
    cj['hasPassport'] === false ? '無' : '';

  const todayStr = new Date().toISOString().slice(0, 10);
  const clampPast = (d: string) => (d && d <= todayStr ? d : '');
  const normalizeEduEnd = (raw: unknown): string | null => {
    const d = raw ? toDateStr(raw) : null;
    return d && d <= todayStr ? d : null;
  };

  // Combined certs + tests — sorted ascending by date; entries without date go last
  const combinedCerts: { issuedDate: string; name: string; info: string }[] = [
    ...certs.map((c) => ({
      issuedDate: clampPast(c['issuedDate'] ? String(c['issuedDate']).slice(0, 10) : ''),
      name: v(c['certName']),
      info: [c['certLevel'], c['issuedBy']].filter(Boolean).join(' / '),
    })),
    ...tests.map((t) => ({
      issuedDate: clampPast(t['testDate'] ? String(t['testDate']).slice(0, 10) : ''),
      name: v(t['testName']),
      info: [t['score'] != null ? String(t['score']) : null, t['pass'] ? '合格 ✓' : null].filter(Boolean).join(' '),
    })),
  ].sort((a, b) => {
    if (!a.issuedDate && !b.issuedDate) return 0;
    if (!a.issuedDate) return 1;
    if (!b.issuedDate) return -1;
    return a.issuedDate.localeCompare(b.issuedDate);
  });

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

  const TD  = 'border:1px solid #000;padding:3px 4px;vertical-align:top;font-size:13px;';
  const ST  = `${TD}background:#f2f2f2;font-weight:bold;`;

  const photoSrc = settings.photoBase64 ?? null;
  const photoHtml = photoSrc
    ? `<img src="${photoSrc}" alt="foto" style="width:120px;height:150px;object-fit:cover;display:block;">`
    : `<div style="height:150px;line-height:150px;color:#999;text-align:center;">Foto</div>`;

  const photoBoxStyle = layout === 'layout2'
    ? 'width:120px;border:1px solid #000;text-align:center;float:right;flex-shrink:0;height:150px;overflow:hidden;'
    : 'width:120px;border:1px solid #000;text-align:center;float:right;flex-shrink:0;';

  // ── Education status (Japanese only) ─────────────────────────────────────────
  const eduStatusMap: Record<string, string> = {
    'Lulus':         '卒業',
    'Drop Out':      '中退',
    'Masih Belajar': '在学中',
  };

  // ── Rirekisho-style education rows (2 rows per entry) ────────────────────────
  const eduRowsHtml = eduRows.flatMap((row) => {
    if (!row) return [
      `<tr class="cv-row-sm"><td style="${TD}width:25%;height:22px;"></td><td style="${TD}"></td></tr>`,
      `<tr class="cv-row-sm"><td style="${TD}width:25%;height:22px;"></td><td style="${TD}"></td></tr>`,
    ];
    const school = he(v(row['schoolName']));
    const statusLabel = row['status']
      ? he(eduStatusMap[String(row['status'])] ?? v(row['status']))
      : '卒業';
    const startMo       = he(formatMonthJa(toDateStr(row['startDate'])));
    const effectiveEnd  = normalizeEduEnd(row['endDate']);
    const endMo         = effectiveEnd ? he(formatMonthJa(effectiveEnd)) : (school ? '現在' : '');
    return [
      `<tr class="cv-row-sm"><td style="${TD}width:25%;height:22px;">${startMo}</td><td style="${TD}">${school}${school ? '　入学' : ''}</td></tr>`,
      `<tr class="cv-row-sm"><td style="${TD}width:25%;height:22px;">${endMo}</td><td style="${TD}">${school}${school ? `　${statusLabel}` : ''}</td></tr>`,
    ];
  }).join('');

  // ── Rirekisho-style career rows (2 rows per entry) ────────────────────────────
  const careerRowsHtml = careerRows.flatMap((row) => {
    if (!row) return [
      `<tr class="cv-row-sm"><td style="${TD}width:25%;height:22px;"></td><td style="${TD}"></td></tr>`,
      `<tr class="cv-row-sm"><td style="${TD}width:25%;height:22px;"></td><td style="${TD}"></td></tr>`,
    ];
    const company   = he(v(row['companyName']));
    const rawStart  = row['startDate'] ? toDateStr(row['startDate']) : parsePeriodStart(row['period'] as string | null);
    const rawEnd    = row['endDate'] ? toDateStr(row['endDate']) : null;
    const startMo   = he(formatMonthJa(rawStart));
    const isCurrent = !rawEnd;
    const endMo     = isCurrent ? (company ? '現在' : '') : he(formatMonthJa(rawEnd));
    const endStatus = isCurrent ? '　在職中' : '　退社';
    return [
      `<tr class="cv-row-sm"><td style="${TD}width:25%;height:22px;">${startMo}</td><td style="${TD}">${company}${company ? '　入社' : ''}</td></tr>`,
      `<tr class="cv-row-sm"><td style="${TD}width:25%;height:22px;">${endMo}</td><td style="${TD}">${company}${company ? endStatus : ''}</td></tr>`,
    ];
  }).join('');

  // ── Cert rows ─────────────────────────────────────────────────────────────────
  const certRowsHtml = certRows.map((row) =>
    row
      ? `<tr><td style="${TD}height:25px;">${he(formatDateJa(row.issuedDate))}</td><td style="${TD}">${he(row.name)}</td><td style="${TD}">${he(row.info)}</td></tr>`
      : `<tr class="cv-row-sm"><td style="${TD}height:25px;"></td><td style="${TD}"></td><td style="${TD}"></td></tr>`,
  ).join('');

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
    候補者データ
  </div>

  <!-- Photo + basic info -->
  <div style="margin-bottom:4px;">
    <div style="${photoBoxStyle}">
      ${photoHtml}
    </div>
    <table style="width:calc(100% - 140px);float:left;margin-bottom:0;">
      <tbody>
        <tr>
          <td style="${TD}width:20%;">氏名</td>
          <td style="${TD}" colspan="3">
            <div>${he(v(cj['fullName']))}</div>
            ${v(cj['nameKatakana']) ? `<div style="font-size:11px;color:#444;margin-top:2px;">${he(v(cj['nameKatakana']))}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="${TD}width:20%;">出身地・生年月日</td>
          <td style="${TD}width:30%;">${birthDisplay}</td>
          <td style="${TD}width:20%;">性別</td>
          <td style="${TD}">${he(genderLabel)}</td>
        </tr>
        <tr>
          <td style="${TD}">年齢</td>
          <td style="${TD}">${age !== null ? `${age}歳` : ''}</td>
          <td style="${TD}">宗教</td>
          <td style="${TD}">${he(cj['religion'] ? (religionMap[String(cj['religion'])] ?? v(cj['religion'])) : '')}</td>
        </tr>
        <tr>
          <td style="${TD}">血液型</td>
          <td style="${TD}">${he(v(cj['bloodType']))}</td>
          <td style="${TD}">婚姻歴</td>
          <td style="${TD}">${he(cj['maritalStatus'] ? (maritalMap[String(cj['maritalStatus'])] ?? v(cj['maritalStatus'])) : '')}</td>
        </tr>
        <tr>
          <td style="${TD}">身長</td>
          <td style="${TD}">${he(heightDisplay)}</td>
          <td style="${TD}">体重</td>
          <td style="${TD}">${he(weightDisplay)}</td>
        </tr>
        <tr>
          <td style="${TD}">日本語レベル</td>
          <td style="${TD}">${jpLevelDisplay}</td>
          <td style="${TD}">LPK名</td>
          <td style="${TD}">${he(v((cj['lpk'] as Record<string, unknown>)?.['name']))}</td>
        </tr>
      </tbody>
    </table>
    <div style="clear:both;"></div>
  </div>

  <!-- Japan / Passport / Address -->
  <table>
    <tbody>
      <tr>
        <td style="${TD}width:25%;">日本滞在経験</td>
        <td style="${TD}width:25%;">${he(japanDisplay)}</td>
        <td style="${TD}width:25%;">パスポート／ビザ</td>
        <td style="${TD}width:25%;">${he(passportDisplay)}</td>
      </tr>
      <tr>
        <td style="${TD}">現住所</td>
        <td style="${TD}" colspan="3">${addressDisplay}</td>
      </tr>
    </tbody>
  </table>

  <!-- Pendidikan (rirekisho style) -->
  <table>
    <tbody>
      <tr><td style="${ST}" colspan="2">学歴</td></tr>
      ${eduRowsHtml}
    </tbody>
  </table>

  <!-- Pengalaman Kerja (rirekisho style) -->
  <table>
    <tbody>
      <tr><td style="${ST}" colspan="2">職歴</td></tr>
      ${careerRowsHtml}
    </tbody>
  </table>

  <!-- Sertifikasi -->
  <table>
    <tbody>
      <tr><td style="${ST}" colspan="3">資格・公的認定</td></tr>
      <tr style="text-align:center;">
        <td style="${TD}width:25%;">発行日</td>
        <td style="${TD}width:40%;">名称</td>
        <td style="${TD}width:35%;">詳細・備考</td>
      </tr>
      ${certRowsHtml}
    </tbody>
  </table>

  <!-- Skill -->
  <table>
    <tbody>
      <tr><td style="${ST}">技能</td></tr>
      <tr class="cv-row-md">
        <td style="${TD}height:40px;white-space:pre-wrap;">${he(trunc(getJa(cj, 'selfPrJa', 'selfPrId'), 300))}</td>
      </tr>
    </tbody>
  </table>

  <!-- Promosi Diri -->
  <table style="margin-bottom:0;">
    <tbody>
      <tr>
        <td style="${ST}">自己PR</td>
      </tr>
      <tr class="cv-row-lg">
        <td style="${TD}height:60px;white-space:pre-wrap;">${he(trunc(getJa(cj, 'selfIntroJa', 'selfIntroId'), 400))}</td>
      </tr>
    </tbody>
  </table>

  <!-- IJBNet logo (bottom-right) -->
  <div style="text-align:right;padding-top:4px;">
    <img src="${IJBNET_LOGO}" alt="IJBNet" style="width:80px;height:auto;display:inline-block;">
  </div>

</div>
</body>
</html>`;
}
