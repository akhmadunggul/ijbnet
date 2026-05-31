/** Build A4-ready 職務経歴書 HTML */

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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function fallback(ja: unknown, id: unknown): string {
  const j = String(ja ?? '').trim();
  const i = String(id ?? '').trim();
  return j || i;
}

function nlToBullets(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return `<p style="margin:0;">${he(text)}</p>`;
  return `<ul style="margin:0;padding-left:1.2em;">${lines.map((l) => `<li>${he(l)}</li>`).join('')}</ul>`;
}

export function buildShokumuHtml(
  candidate: Record<string, unknown>,
  settings: { layout: string; font: string; includePhoto: boolean },
): string {
  const fontFamily = FONT_MAP[settings.font] ?? FONT_MAP['ms-mincho']!;
  const googleFontKey = GOOGLE_FONT_MAP[settings.font];
  const googleFontLink = googleFontKey
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${googleFontKey}&display=swap">`
    : '';

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const fullName = he(candidate['fullName'] ?? '');
  const candidateCode = he(candidate['candidateCode'] ?? '');

  const careerSummary = fallback(candidate['careerSummaryJa'], candidate['careerSummaryId']);

  // Sort career entries by layout setting
  const rawCareer = (candidate['career'] as Record<string, unknown>[] | null) ?? [];
  let sortedCareer: Record<string, unknown>[];
  if (settings.layout === 'reverse') {
    sortedCareer = [...rawCareer].reverse();
  } else if (settings.layout === 'chronological') {
    sortedCareer = [...rawCareer].sort((a, b) => {
      const aDate = (a['startDate'] as string | null) ?? '';
      const bDate = (b['startDate'] as string | null) ?? '';
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
    });
  } else {
    // 'career' = keep original order
    sortedCareer = [...rawCareer];
  }

  const certifications = (candidate['certifications'] as Record<string, unknown>[] | null) ?? [];

  const selfPrText = fallback(candidate['selfPrJa'], candidate['selfPrId']);
  const selfIntroText = fallback(candidate['selfIntroJa'], candidate['selfIntroId']);

  const closeupUrl = (candidate['closeupUrl'] as string | null) ?? null;

  // Build career section HTML
  const careerHtml = sortedCareer.map((entry, idx) => {
    const duties = fallback(entry['dutiesJa'], entry['dutiesId']);
    const achievements = fallback(entry['achievementsJa'], entry['achievementsId']);

    const overviewRows: string[] = [];
    if (entry['companyName']) overviewRows.push(`<tr><th>会社名</th><td>${he(entry['companyName'])}</td></tr>`);
    if (entry['companyType']) overviewRows.push(`<tr><th>会社形態</th><td>${he(entry['companyType'])}</td></tr>`);
    if (entry['employeeCount'] != null) overviewRows.push(`<tr><th>従業員数</th><td>${he(entry['employeeCount'])}名</td></tr>`);
    if (entry['annualSales']) overviewRows.push(`<tr><th>年商</th><td>${he(entry['annualSales'])}</td></tr>`);
    if (entry['capitalAmount']) overviewRows.push(`<tr><th>資本金</th><td>${he(entry['capitalAmount'])}</td></tr>`);
    if (entry['division']) overviewRows.push(`<tr><th>部署</th><td>${he(entry['division'])}</td></tr>`);
    if (entry['period']) overviewRows.push(`<tr><th>在籍期間</th><td>${he(entry['period'])}</td></tr>`);

    return `
      <div class="career-entry${idx > 0 ? ' mt-entry' : ''}">
        <h3 class="entry-title">${he(entry['companyName'] ?? `経歴 ${idx + 1}`)}${entry['period'] ? `　<span class="entry-period">${he(entry['period'])}</span>` : ''}</h3>
        ${overviewRows.length ? `
        <table class="overview-tbl">
          <tbody>${overviewRows.join('')}</tbody>
        </table>` : ''}
        ${duties ? `<div class="section-block"><p class="block-label">業務内容</p><div class="block-body">${nlToBullets(duties)}</div></div>` : ''}
        ${achievements ? `<div class="section-block"><p class="block-label">実績・成果</p><div class="block-body">${nlToBullets(achievements)}</div></div>` : ''}
      </div>`;
  }).join('');

  // Build certifications HTML
  const certHtml = certifications.length
    ? certifications.map((c) => {
        const name = he(c['certName'] ?? '');
        const date = c['issuedDate'] ? he(c['issuedDate']) : '';
        const issuer = c['issuedBy'] ? ` (${he(c['issuedBy'])})` : '';
        return `<li>${name}${date ? `　${date}` : ''}${issuer}</li>`;
      }).join('')
    : '<li>なし</li>';

  const photoHtml = settings.includePhoto && closeupUrl
    ? `<div class="photo-wrap"><img src="${he(closeupUrl)}" alt="顔写真" class="candidate-photo" /></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${googleFontLink}
  <title>職務経歴書 — ${fullName}</title>
  <style>
    @page { size: A4; margin: 15mm 15mm 15mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${fontFamily};
      font-size: 10pt;
      line-height: 1.6;
      color: #111;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8mm;
      border-bottom: 2px solid #1a3050;
      padding-bottom: 4mm;
    }
    .header-left h1 {
      font-size: 18pt;
      font-weight: bold;
      letter-spacing: 0.1em;
      color: #1a3050;
    }
    .header-left .date {
      font-size: 9pt;
      color: #555;
      margin-top: 2mm;
    }
    .header-right {
      text-align: right;
      display: flex;
      align-items: center;
      gap: 6mm;
    }
    .header-right .name-block {
      text-align: right;
    }
    .header-right .name-label {
      font-size: 8pt;
      color: #777;
    }
    .header-right .name {
      font-size: 13pt;
      font-weight: bold;
      color: #1a3050;
    }
    .candidate-photo {
      width: 25mm;
      height: 25mm;
      object-fit: cover;
      border-radius: 2mm;
      border: 1px solid #ccc;
    }
    h2.section-heading {
      font-size: 11pt;
      font-weight: bold;
      color: #1a3050;
      border-left: 4px solid #1a3050;
      padding-left: 4mm;
      margin-top: 6mm;
      margin-bottom: 3mm;
    }
    .summary-box {
      background: #f7f9fc;
      border: 1px solid #d0daea;
      border-radius: 2mm;
      padding: 4mm 5mm;
      font-size: 9.5pt;
      line-height: 1.7;
      color: #222;
    }
    .career-entry { margin-top: 4mm; }
    .mt-entry { margin-top: 6mm; }
    .entry-title {
      font-size: 10.5pt;
      font-weight: bold;
      color: #1a3050;
      margin-bottom: 2mm;
    }
    .entry-period {
      font-size: 9pt;
      font-weight: normal;
      color: #555;
    }
    table.overview-tbl {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 3mm;
    }
    table.overview-tbl th {
      background: #eef2f8;
      color: #333;
      font-weight: bold;
      padding: 2mm 3mm;
      border: 1px solid #c8d4e8;
      white-space: nowrap;
      width: 28%;
    }
    table.overview-tbl td {
      padding: 2mm 3mm;
      border: 1px solid #c8d4e8;
    }
    .section-block { margin-top: 2mm; }
    .block-label {
      font-size: 9pt;
      font-weight: bold;
      color: #444;
      margin-bottom: 1mm;
      border-bottom: 1px dotted #bbb;
      padding-bottom: 0.5mm;
    }
    .block-body {
      font-size: 9pt;
      line-height: 1.65;
      padding-left: 2mm;
    }
    ul { padding-left: 1.2em; }
    .cert-list { list-style: disc; padding-left: 1.5em; font-size: 9pt; line-height: 1.8; }
    .footer {
      margin-top: 10mm;
      border-top: 1px solid #ccc;
      padding-top: 3mm;
      font-size: 8pt;
      color: #888;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>職務経歴書</h1>
      <p class="date">作成日：${today}</p>
    </div>
    <div class="header-right">
      ${photoHtml}
      <div class="name-block">
        <p class="name-label">氏名</p>
        <p class="name">${fullName}</p>
        <p class="name-label" style="margin-top:1mm;font-size:7.5pt;color:#aaa;">${candidateCode}</p>
      </div>
    </div>
  </div>

  <!-- Section 1: 経歴要約 -->
  ${careerSummary ? `
  <h2 class="section-heading">経歴要約</h2>
  <div class="summary-box">${he(careerSummary)}</div>` : ''}

  <!-- Section 2: 職務経歴 -->
  ${sortedCareer.length ? `
  <h2 class="section-heading">職務経歴</h2>
  ${careerHtml}` : ''}

  <!-- Section 3: 活かせるスキル・知識 -->
  ${selfPrText ? `
  <h2 class="section-heading">活かせるスキル・知識</h2>
  <div class="block-body">${nlToBullets(selfPrText)}</div>` : ''}

  <!-- Section 4: 資格・免許 -->
  <h2 class="section-heading">資格・免許</h2>
  <ul class="cert-list">${certHtml}</ul>

  <!-- Section 5: 自己PR -->
  ${selfIntroText ? `
  <h2 class="section-heading">自己PR</h2>
  <div class="summary-box">${he(selfIntroText)}</div>` : ''}

  <div class="footer">
    <span>IJBNet — 職務経歴書</span>
    <span>${today}</span>
  </div>
</body>
</html>`;
}
