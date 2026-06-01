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

const SECTION_HEADER = (label: string) =>
  `<div style="font-weight:bold;font-size:10pt;border-bottom:2px solid #111;margin-top:6mm;margin-bottom:2mm;padding-bottom:1mm;letter-spacing:0.06em;">${label}</div>`;

const TD = 'border:1px solid #333;padding:2mm 3mm;vertical-align:top;font-size:8.5pt;';
const TH = `${TD}background:#f0f0f0;font-weight:bold;text-align:center;white-space:nowrap;`;

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

  // ── 職務経歴 rows ─────────────────────────────────────────────────────────────
  const careerRows = rawCareer.map(entry => {
    const institution = he(entry['companyName'] ?? '');
    const product     = fallback(entry['productJa'],     entry['productId']);
    const jobTitle    = fallback(entry['jobTitleJa'],    entry['jobTitleId']);
    const duties      = fallback(entry['dutiesJa'],      entry['dutiesId']);
    const memberRole  = fallback(entry['memberRoleJa'],  entry['memberRoleId']);

    return `
      <tr>
        <td style="${TD}">${institution}</td>
        <td style="${TD}">${product ? nlToBullets(product) : ''}</td>
        <td style="${TD}">${he(jobTitle)}</td>
        <td style="${TD}">${duties ? nlToBullets(duties) : ''}</td>
        <td style="${TD}">${memberRole ? nlToBullets(memberRole) : ''}</td>
      </tr>`;
  }).join('') || `<tr><td colspan="5" style="${TD}text-align:center;color:#aaa;">なし</td></tr>`;

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

  <!-- ── Title ── -->
  <div style="text-align:center;font-size:16pt;font-weight:bold;letter-spacing:0.5em;margin-bottom:3mm;">
    職　務　経　歴　書
  </div>

  <!-- ── Date + Name (right-aligned) ── -->
  <div style="text-align:right;font-size:9pt;margin-bottom:1mm;">${today}現在</div>
  <div style="text-align:right;font-size:10pt;margin-bottom:5mm;border-bottom:1px solid #333;padding-bottom:3mm;">
    氏名　${fullName}
    ${candidateCode ? `<span style="font-size:7.5pt;color:#888;margin-left:4mm;">${candidateCode}</span>` : ''}
  </div>

  <!-- ── 職務要約 ── -->
  ${careerSummary ? `
  ${SECTION_HEADER('職務要約')}
  <div style="border:1px solid #333;padding:3mm 4mm;min-height:15mm;white-space:pre-wrap;">${he(careerSummary)}</div>
  ` : ''}

  <!-- ── 職務経歴 ── -->
  ${SECTION_HEADER('職務経歴')}
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="${TH}width:18%;">機　関</th>
        <th style="${TH}width:18%;">担当製品</th>
        <th style="${TH}width:15%;">業務タイトル</th>
        <th style="${TH}width:35%;">担当業務</th>
        <th style="${TH}width:14%;">メンバー・役割</th>
      </tr>
    </thead>
    <tbody>
      ${careerRows}
    </tbody>
  </table>

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
