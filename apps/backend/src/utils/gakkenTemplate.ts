/** Build A4-ready 職務経歴書 HTML — Gakken standard form format */

const FONT_MAP: Record<string, string> = {
  'ms-mincho':     '"Noto Serif CJK JP", "MS Mincho", serif',
  'yu-mincho':     '"Noto Serif CJK JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
  'yu-gothic':     '"Noto Sans CJK JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
  'noto-serif-jp': '"Noto Serif CJK JP", "Noto Serif JP", serif',
  'noto-sans-jp':  '"Noto Sans CJK JP", "Noto Sans JP", sans-serif',
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

function fallback(ja: unknown, id: unknown): string {
  const j = String(ja ?? '').trim();
  const i = String(id ?? '').trim();
  return j || i;
}

function nlToBullets(text: string): string {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return `<span>${he(text)}</span>`;
  return `<ul style="margin:0;padding-left:1.4em;list-style-type:disc;">${lines.map(l => `<li>${he(l)}</li>`).join('')}</ul>`;
}

function fmtPeriod(entry: Record<string, unknown>): string {
  const period = entry['period'] as string | null;
  if (period) return he(period);
  const s = (entry['startDate'] as string | null)?.slice(0, 7) ?? '';
  const e = (entry['endDate']   as string | null)?.slice(0, 7) ?? '';
  const start = s ? he(s.replace('-', '年') + '月') : '';
  const end   = e ? he(e.replace('-', '年') + '月') : '現在';
  return start ? `${start} ～ ${end}` : end;
}

const SECTION_HEADER = (label: string) =>
  `<div style="font-weight:bold;font-size:10pt;border-bottom:2px solid #111;margin-top:6mm;margin-bottom:2mm;padding-bottom:1mm;letter-spacing:0.06em;">${label}</div>`;

const TD = 'border:1px solid #333;padding:2mm 3mm;vertical-align:top;';
const TH = `${TD}background:#f0f0f0;font-weight:bold;text-align:left;white-space:nowrap;width:22%;`;

export function buildGakkenHtml(
  candidate: Record<string, unknown>,
  settings: { font: string; includePhoto: boolean },
): string {
  const fontFamily = FONT_MAP[settings.font] ?? FONT_MAP['ms-mincho']!;
  const googleFontKey = GOOGLE_FONT_MAP[settings.font];
  const googleFontLink = googleFontKey
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${googleFontKey}&display=swap">`
    : '';

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const fullName      = he(candidate['fullName'] ?? '');
  const candidateCode = he(candidate['candidateCode'] ?? '');

  const rawCareer      = (candidate['career']         as Record<string, unknown>[] | null) ?? [];
  const certifications = (candidate['certifications'] as Record<string, unknown>[] | null) ?? [];

  const careerSummary = fallback(candidate['careerSummaryJa'], candidate['careerSummaryId']);
  const skillsText    = fallback(candidate['selfPrJa'],         candidate['selfPrId']);
  const selfIntroText = fallback(candidate['selfIntroJa'],      candidate['selfIntroId']);

  // ── 職務経歴 blocks ───────────────────────────────────────────────────────────
  const careerBlocks = rawCareer.map((entry, idx) => {
    const duties       = fallback(entry['dutiesJa'],       entry['dutiesId']);
    const achievements = fallback(entry['achievementsJa'], entry['achievementsId']);

    const companyInfoParts = [
      entry['companyType']   ? `事業内容：${he(entry['companyType'])}` : '',
      entry['capitalAmount'] ? `資本金：${he(entry['capitalAmount'])}` : '',
      entry['annualSales']   ? `売上高：${he(entry['annualSales'])}` : '',
      entry['employeeCount'] != null ? `従業員数：${he(entry['employeeCount'])}名` : '',
    ].filter(Boolean);

    const companyName = entry['companyName'] ? he(entry['companyName']) : `経歴 ${idx + 1}`;
    const periodLabel = entry['period']
      ? ` <span style="font-weight:normal;font-size:8.5pt;margin-left:4mm;color:#444;">${he(entry['period'])}</span>`
      : '';

    const divisionRow = entry['division']
      ? `<tr><th style="${TH}">部　署</th><td style="${TD}">${he(entry['division'])}</td></tr>`
      : '';
    const dutiesRow = duties
      ? `<tr><th style="${TH}">担当業務</th><td style="${TD}">${nlToBullets(duties)}</td></tr>`
      : '';
    const achievementsRow = achievements
      ? `<tr><th style="${TH}">実績・成果</th><td style="${TD}">${nlToBullets(achievements)}</td></tr>`
      : '';

    return `
      <div style="margin-bottom:5mm;">
        <div style="font-weight:bold;font-size:9.5pt;border-left:3px solid #111;padding-left:3mm;margin-bottom:1mm;">
          ${companyName}${periodLabel}
        </div>
        ${companyInfoParts.length ? `<div style="font-size:8pt;color:#555;margin-bottom:2mm;padding-left:3mm;">${companyInfoParts.join('　')}</div>` : ''}
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr><th style="${TH}">期　間</th><td style="${TD}">${fmtPeriod(entry)}</td></tr>
            ${divisionRow}
            ${dutiesRow}
            ${achievementsRow}
          </tbody>
        </table>
      </div>`;
  }).join('');

  // ── 資格 ─────────────────────────────────────────────────────────────────────
  const certItems = certifications.length
    ? certifications.map(c => {
        const name   = he(c['certName'] ?? '');
        const date   = c['issuedDate'] ? `　${he(c['issuedDate'])}` : '';
        const issuer = c['issuedBy']   ? ` (${he(c['issuedBy'])})` : '';
        return `<li>${name}${date}${issuer}</li>`;
      }).join('')
    : '<li style="color:#aaa;">なし</li>';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  ${googleFontLink}
  <title>職務経歴書 — ${fullName}</title>
  <style>
    @page { size: A4; margin: 15mm 15mm 10mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${fontFamily}; font-size: 9pt; line-height: 1.6; color: #111; max-width: 900px; margin: 0 auto; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>

  <!-- ── Title row ── -->
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2mm;">
    <div style="font-size:16pt;font-weight:bold;letter-spacing:0.5em;">職　務　経　歴　書</div>
    <div style="font-size:9pt;">${today}現在</div>
  </div>

  <!-- ── Name row ── -->
  <div style="font-size:10pt;margin-bottom:5mm;border-bottom:1px solid #333;padding-bottom:3mm;">
    氏名　${fullName}
    ${candidateCode ? `<span style="font-size:7.5pt;color:#888;margin-left:4mm;">${candidateCode}</span>` : ''}
  </div>

  <!-- ── 職務要約 ── -->
  ${careerSummary ? `
  ${SECTION_HEADER('職務要約')}
  <div style="border:1px solid #333;padding:3mm 4mm;min-height:18mm;white-space:pre-wrap;">${he(careerSummary)}</div>
  ` : ''}

  <!-- ── 職務経歴 ── -->
  ${rawCareer.length ? `
  ${SECTION_HEADER('職務経歴')}
  ${careerBlocks}
  ` : ''}

  <!-- ── 経験・知識・技術 ── -->
  ${skillsText ? `
  ${SECTION_HEADER('経験・知識・技術')}
  <div style="border:1px solid #333;padding:3mm 4mm;min-height:15mm;">${nlToBullets(skillsText)}</div>
  ` : ''}

  <!-- ── 資格 ── -->
  ${SECTION_HEADER('資　格')}
  <div style="border:1px solid #333;padding:3mm 4mm;min-height:10mm;">
    <ul style="margin:0;padding-left:1.4em;list-style-type:disc;">${certItems}</ul>
  </div>

  <!-- ── 自己ＰＲ ── -->
  ${selfIntroText ? `
  ${SECTION_HEADER('自己ＰＲ')}
  <div style="border:1px solid #333;padding:3mm 4mm;min-height:22mm;white-space:pre-wrap;">${he(selfIntroText)}</div>
  ` : ''}

  <!-- ── 以上 ── -->
  <div style="text-align:right;margin-top:6mm;font-size:9pt;">以上</div>

</body>
</html>`;
}
