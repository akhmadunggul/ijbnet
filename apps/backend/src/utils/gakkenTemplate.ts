/** Build A4-ready 職務経歴書 HTML — Gakken table-based form format */

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
  return `<ul style="margin:0;padding-left:1.2em;">${lines.map(l => `<li>${he(l)}</li>`).join('')}</ul>`;
}

function fmtPeriod(entry: Record<string, unknown>): string {
  const period = entry['period'] as string | null;
  if (period) return he(period);
  const start = entry['startDate'] as string | null;
  if (!start) return '—';
  return he(start.slice(0, 7).replace('-', '.'));
}

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
  const fullName     = he(candidate['fullName'] ?? '');
  const candidateCode = he(candidate['candidateCode'] ?? '');

  const rawCareer = (candidate['career'] as Record<string, unknown>[] | null) ?? [];
  const educationHistory = (candidate['educationHistory'] as Record<string, unknown>[] | null) ?? [];
  const certifications   = (candidate['certifications']  as Record<string, unknown>[] | null) ?? [];

  const selfPrText    = fallback(candidate['selfPrJa'],    candidate['selfPrId']);
  const selfIntroText = fallback(candidate['selfIntroJa'], candidate['selfIntroId']);

  const closeupUrl = (candidate['closeupUrl'] as string | null) ?? null;
  const photoCell = settings.includePhoto && closeupUrl
    ? `<img src="${he(closeupUrl)}" alt="顔写真" style="width:22mm;height:28mm;object-fit:cover;border:1px solid #ccc;" />`
    : '<div style="width:22mm;height:28mm;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:7pt;">写真</div>';

  // ── 職歴 rows ───────────────────────────────────────────────────────────────
  const careerRows = rawCareer.length
    ? rawCareer.map(entry => {
        const duties       = fallback(entry['dutiesJa'],       entry['dutiesId']);
        const achievements = fallback(entry['achievementsJa'], entry['achievementsId']);

        const companyCell = [
          entry['companyName'] ? `<strong>${he(entry['companyName'])}</strong>` : '',
          entry['division']    ? he(entry['division']) : '',
          [
            entry['companyType']    ? `${he(entry['companyType'])}` : '',
            entry['employeeCount'] != null ? `${he(entry['employeeCount'])}名` : '',
            entry['annualSales']   ? `年商 ${he(entry['annualSales'])}` : '',
          ].filter(Boolean).join('・'),
        ].filter(Boolean).join('<br/>');

        const dutiesCell = [
          duties       ? `<div style="margin-bottom:2mm;">${nlToBullets(duties)}</div>` : '',
          achievements ? `<div style="color:#444;font-size:8pt;">[実績] ${nlToBullets(achievements)}</div>` : '',
        ].filter(Boolean).join('') || '—';

        return `
          <tr>
            <td style="width:20%;vertical-align:top;white-space:nowrap;">${fmtPeriod(entry)}</td>
            <td style="width:32%;vertical-align:top;">${companyCell}</td>
            <td style="vertical-align:top;">${dutiesCell}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#aaa;padding:4mm;">なし</td></tr>`;

  // ── 学歴 rows ───────────────────────────────────────────────────────────────
  const eduRows = educationHistory.length
    ? educationHistory.map(e => {
        const start = (e['startDate'] as string | null)?.slice(0, 7).replace('-', '.') ?? '';
        const end   = (e['endDate']   as string | null)?.slice(0, 7).replace('-', '.') ?? '在学中';
        const period = start ? `${start} – ${end}` : end;
        return `
          <tr>
            <td style="width:20%;white-space:nowrap;">${he(period)}</td>
            <td style="width:50%;">${he(e['schoolName'] ?? '')}</td>
            <td>${he(e['major'] ?? '')}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#aaa;padding:4mm;">なし</td></tr>`;

  // ── 資格 ─────────────────────────────────────────────────────────────────────
  const certContent = certifications.length
    ? certifications.map(c => {
        const name   = he(c['certName'] ?? '');
        const date   = c['issuedDate'] ? he(c['issuedDate']) : '';
        const issuer = c['issuedBy']   ? ` (${he(c['issuedBy'])})` : '';
        return `<li>${name}${date ? `　${date}` : ''}${issuer}</li>`;
      }).join('')
    : '<li style="color:#aaa;">なし</li>';

  const secHeader = (label: string) =>
    `<div style="background:#2c3e6b;color:#fff;font-weight:bold;padding:2mm 4mm;margin-top:4mm;font-size:9pt;letter-spacing:0.05em;">${label}</div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  ${googleFontLink}
  <title>職務経歴書 — ${fullName}</title>
  <style>
    @page { size: A4; margin: 10mm 15mm 10mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${fontFamily}; font-size: 9pt; line-height: 1.55; color: #111; max-width: 900px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #888; padding: 2mm 3mm; vertical-align: top; }
    th { background: #f0f3f8; font-weight: bold; text-align: left; white-space: nowrap; }
    ul { padding-left: 1.2em; margin: 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>

  <!-- ── Document header ── -->
  <table style="margin-bottom:4mm;border:2px solid #2c3e6b;">
    <tr>
      <td style="font-size:17pt;font-weight:bold;text-align:center;color:#2c3e6b;padding:4mm;border:none;width:45%;">
        職務経歴書
      </td>
      <td style="padding:3mm 4mm;border:none;">
        <div style="font-size:8pt;color:#666;">作成日：${today}</div>
        <div style="font-size:12pt;font-weight:bold;margin-top:1mm;">${fullName}</div>
        <div style="font-size:7.5pt;color:#aaa;margin-top:0.5mm;">${candidateCode}</div>
      </td>
      <td style="width:26mm;text-align:center;vertical-align:middle;padding:2mm;border:none;">
        ${photoCell}
      </td>
    </tr>
  </table>

  <!-- ── 職歴 ── -->
  ${secHeader('職　歴')}
  <table>
    <tr>
      <th style="width:20%;">在籍期間</th>
      <th style="width:32%;">会社名・部署</th>
      <th>業務内容・実績</th>
    </tr>
    ${careerRows}
  </table>

  <!-- ── 学歴 ── -->
  ${secHeader('学　歴')}
  <table>
    <tr>
      <th style="width:20%;">期間</th>
      <th style="width:50%;">学校名</th>
      <th>専攻</th>
    </tr>
    ${eduRows}
  </table>

  <!-- ── 資格 ── -->
  ${secHeader('保有資格・免許')}
  <table>
    <tr>
      <td><ul style="list-style:disc;">${certContent}</ul></td>
    </tr>
  </table>

  <!-- ── スキル ── -->
  ${selfPrText ? `
  ${secHeader('活かせるスキル・知識')}
  <table><tr><td style="min-height:18mm;white-space:pre-wrap;">${nlToBullets(selfPrText)}</td></tr></table>` : ''}

  <!-- ── 自己PR ── -->
  ${selfIntroText ? `
  ${secHeader('自己PR')}
  <table><tr><td style="min-height:22mm;white-space:pre-wrap;">${he(selfIntroText)}</td></tr></table>` : ''}

  <div style="margin-top:8mm;border-top:1px solid #ccc;padding-top:2mm;font-size:7.5pt;color:#999;display:flex;justify-content:space-between;">
    <span>IJBNet — 職務経歴書（Gakken形式）</span>
    <span>${today}</span>
  </div>

</body>
</html>`;
}
