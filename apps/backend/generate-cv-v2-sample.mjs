/**
 * Standalone script: generates a v2 rirekisho-style CV PDF with sample data.
 * Run from apps/backend/:  node generate-cv-v2-sample.mjs
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Chrome path detection ────────────────────────────────────────────────────

function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  return paths.find(p => fs.existsSync(p)) ?? null;
}

// ── Logo (read from cvLogoBase64.ts) ─────────────────────────────────────────

function readLogo() {
  const src = fs.readFileSync(path.join(__dirname, 'src/utils/cvLogoBase64.ts'), 'utf8');
  const m = src.match(/`(data:image\/png;base64,[^`]+)`/);
  return m ? m[1] : '';
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

const he = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
const vv = x => (x === null || x === undefined || x === '') ? '' : String(x);
const trunc = (text, max) => text.length <= max ? text : text.slice(0, max).trimEnd() + '…';
const getJa = (cj, jaKey, idKey) => vv(cj[jaKey]) || vv(cj[idKey]);

function formatMonthJa(dateStr) {
  if (!dateStr) return '';
  const [y, m] = dateStr.slice(0,7).split('-').map(Number);
  if (!y || !m) return '';
  return `${y}年${m}月`;
}

function formatDateJa(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.slice(0,10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y) return dateStr;
  if (d) return `${y}年${m}月${d}日`;
  if (m) return `${y}年${m}月`;
  return `${y}年`;
}

function formatDobJa(raw) {
  if (!raw) return '';
  const dateStr = typeof raw === 'object' ? `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,'0')}-${String(raw.getDate()).padStart(2,'0')}` : String(raw).slice(0,10);
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${y}年${m}月${d}日`;
}

function calculateAge(raw) {
  const dateStr = typeof raw === 'object' ? `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,'0')}-01` : String(raw).slice(0,10);
  const dob = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const mn = today.getMonth() - dob.getMonth();
  if (mn < 0 || (mn === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function padRows(arr, min) {
  const out = [...arr];
  while (out.length < min) out.push(null);
  return out;
}

// ── Sample candidate data ────────────────────────────────────────────────────

const candidate = {
  fullName:        'AHMAD FAUZI RAHMAN',
  nameKatakana:    'アフマッド・ファウジ・ラフマン',
  dateOfBirth:     '1998-05-15',
  birthPlace:      'JAKARTA',
  gender:          'M',
  religion:        'Islam',
  bloodType:       'O',
  maritalStatus:   'single',
  selfReportedHeight: 170,
  selfReportedWeight: 65,
  address:         'JL. SUDIRMAN NO. 123, JAKARTA SELATAN, DKI JAKARTA 12190',
  hasVisitedJapan: false,
  hasPassport:     true,
  selfPrId:        'Berpengalaman 7 tahun di bidang manufaktur otomotif. Mahir pengelasan MIG/MAG dan pemeliharaan mesin produksi CNC. Pernah memimpin tim 5 orang dalam proyek peningkatan efisiensi lini produksi.',
  selfPrJa:        '自動車製造分野で7年の経験があります。MIG/MAG溶接およびCNC生産機械のメンテナンスに精通しており、生産ライン効率改善プロジェクトで5名のチームをリードした経験があります。',
  selfIntroId:     'Saya adalah individu yang disiplin dan pekerja keras. Memiliki kemampuan adaptasi tinggi dan siap bekerja dalam lingkungan internasional. Berkomitmen untuk terus belajar dan berkontribusi secara maksimal.',
  selfIntroJa:     '私は規律正しく勤勉な人間です。適応能力が高く、国際的な環境で働く準備ができています。常に学び続け、最大限に貢献することをお約束します。',
  educationHistory: [
    { startDate: '2013-07', endDate: '2016-06', schoolName: 'SMK NEGERI 1 JAKARTA', major: 'TEKNIK MESIN', status: 'Lulus' },
    { startDate: '2016-09', endDate: '2019-07', schoolName: 'POLITEKNIK NEGERI JAKARTA', major: 'TEKNIK MANUFAKTUR', status: 'Lulus' },
  ],
  career: [
    { startDate: '2019-08', endDate: '2022-03', companyName: 'PT ASTRA INTERNATIONAL TBK', division: 'Divisi Produksi', divisionJa: '生産部門' },
    { startDate: '2022-04', endDate: null, companyName: 'PT TOYOTA ASTRA MOTOR', division: 'Quality Control', divisionJa: '品質管理部' },
  ],
  tests: [
    { testName: 'JLPT N3', testDate: '2022-12-04', score: 110, pass: true },
  ],
  certifications: [
    { issuedDate: '2020-05-20', certName: 'K3 UMUM', certLevel: 'Dasar', issuedBy: 'Kemenaker RI' },
    { issuedDate: '2021-03-15', certName: 'WELDING MIG/MAG', certLevel: 'Level 2', issuedBy: 'BNSP' },
  ],
};

// ── Build HTML (v2 rirekisho layout) ─────────────────────────────────────────

function buildHtml(cj, IJBNET_LOGO) {
  const fontFamily = '"MS Mincho", serif';
  const layout = 'layout1';

  const tests   = cj.tests ?? [];
  const career  = cj.career ?? [];
  const certs   = cj.certifications ?? [];
  const eduHist = cj.educationHistory ?? [];

  const latestTest = tests.length > 0 ? tests[tests.length - 1] : null;
  const age = cj.dateOfBirth ? calculateAge(cj.dateOfBirth) : null;

  const genderLabel = cj.gender === 'M' ? '男性' : cj.gender === 'F' ? '女性' : '';
  const maritalMap = { single:'未婚', married:'既婚', divorced:'離婚', widowed:'死別' };
  const religionMap = { Islam:'イスラム教', Kristen:'キリスト教（プロテスタント）', Katolik:'キリスト教（カトリック）', Budha:'仏教', Hindu:'ヒンドゥー教', Lainnya:'その他' };

  const dobStr = cj.dateOfBirth ? formatDobJa(cj.dateOfBirth) : '';
  const birthDisplay = he([vv(cj.birthPlace), dobStr].filter(Boolean).join('  '));
  const heightDisplay = cj.selfReportedHeight != null ? `${cj.selfReportedHeight} cm` : '';
  const weightDisplay = cj.selfReportedWeight != null ? `${cj.selfReportedWeight} kg` : '';
  const jpLevelDisplay = latestTest ? he(`${vv(latestTest.testName)}${latestTest.score != null ? ` / ${latestTest.score}` : ''}`) : '';
  const japanDisplay  = cj.hasVisitedJapan === true ? '有' : cj.hasVisitedJapan === false ? '無' : '';
  const passportDisplay = cj.hasPassport === true ? '有' : cj.hasPassport === false ? '無' : '';

  const combinedCerts = [
    ...certs.map(c => ({ issuedDate: c.issuedDate ? String(c.issuedDate).slice(0,10) : '', name: vv(c.certName), info: [c.certLevel, c.issuedBy].filter(Boolean).join(' / ') })),
    ...tests.map(t => ({ issuedDate: t.testDate ? String(t.testDate).slice(0,10) : '', name: vv(t.testName), info: [t.score != null ? String(t.score) : null, t.pass ? '合格 ✓' : null].filter(Boolean).join(' ') })),
  ];

  const sortedEdu  = [...eduHist].sort((a,b) => (!a.startDate?1:!b.startDate?-1:a.startDate<b.startDate?-1:1));
  const sortedCareer = [...career].sort((a,b) => (!a.startDate?1:!b.startDate?-1:a.startDate<b.startDate?-1:1));
  const eduRows    = padRows(sortedEdu, 2);
  const careerRows = padRows(sortedCareer, 2);
  const certRows   = padRows(combinedCerts, 1);

  const TD = 'border:1px solid #000;padding:3px 4px;vertical-align:top;font-size:13px;';
  const ST = `${TD}background:#f2f2f2;font-weight:bold;`;

  const eduStatusMap = { 'Lulus':'卒業', 'Drop Out':'中退', 'Masih Belajar':'在学中' };

  const eduRowsHtml = eduRows.flatMap(row => {
    if (!row) return [
      `<tr><td style="${TD}width:25%;height:22px;"></td><td style="${TD}"></td></tr>`,
      `<tr><td style="${TD}width:25%;height:22px;"></td><td style="${TD}"></td></tr>`,
    ];
    const school = he(vv(row.schoolName));
    const statusLabel = row.status ? he(eduStatusMap[row.status] ?? vv(row.status)) : '卒業';
    const startMo = he(formatMonthJa(vv(row.startDate)));
    const endMo   = he(formatMonthJa(vv(row.endDate)));
    return [
      `<tr><td style="${TD}width:25%;height:22px;">${startMo}</td><td style="${TD}">${school}${school?'　入学':''}</td></tr>`,
      `<tr><td style="${TD}width:25%;height:22px;">${endMo}</td><td style="${TD}">${school}${school?`　${statusLabel}`:''}</td></tr>`,
    ];
  }).join('');

  const careerRowsHtml = careerRows.flatMap(row => {
    if (!row) return [
      `<tr><td style="${TD}width:25%;height:22px;"></td><td style="${TD}"></td></tr>`,
      `<tr><td style="${TD}width:25%;height:22px;"></td><td style="${TD}"></td></tr>`,
    ];
    const company = he(vv(row.companyName));
    const startMo = he(formatMonthJa(vv(row.startDate)));
    const endMo   = he(formatMonthJa(vv(row.endDate)));
    return [
      `<tr><td style="${TD}width:25%;height:22px;">${startMo}</td><td style="${TD}">${company}${company?'　入社':''}</td></tr>`,
      `<tr><td style="${TD}width:25%;height:22px;">${endMo || '現在'}</td><td style="${TD}">${company}${company?'　在職中':''}</td></tr>`,
    ];
  }).join('');

  const certRowsHtml = certRows.map(row =>
    row
      ? `<tr><td style="${TD}height:25px;">${he(formatDateJa(row.issuedDate))}</td><td style="${TD}">${he(row.name)}</td><td style="${TD}">${he(row.info)}</td></tr>`
      : `<tr><td style="${TD}height:25px;"></td><td style="${TD}"></td><td style="${TD}"></td></tr>`
  ).join('');

  const photoBoxStyle = 'width:120px;border:1px solid #000;text-align:center;float:right;flex-shrink:0;';
  const photoHtml = `<div style="height:150px;line-height:150px;color:#999;text-align:center;font-size:11px;">写真<br>Foto</div>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4 portrait; margin: 5mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${fontFamily}; font-size: 13px; color: #000; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    td, th { padding: 3px 4px; font-size: 13px; }
  </style>
</head>
<body>
<div style="width:100%;border:1px solid #000;padding:6px 10px;font-size:13px;color:#000;box-sizing:border-box;text-transform:uppercase;">

  <div style="text-align:center;font-size:18px;font-weight:bold;margin-bottom:20px;text-decoration:underline;">
    候補者データ
  </div>

  <div style="overflow:hidden;margin-bottom:4px;">
    <div style="${photoBoxStyle}">
      ${photoHtml}
    </div>
    <table style="width:calc(100% - 140px);float:left;margin-bottom:0;">
      <tbody>
        <tr>
          <td style="${TD}width:20%;">氏名</td>
          <td style="${TD}" colspan="3">
            <div>${he(vv(cj.fullName))}</div>
            ${cj.nameKatakana ? `<div style="font-size:11px;color:#444;margin-top:2px;">${he(vv(cj.nameKatakana))}</div>` : ''}
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
          <td style="${TD}">${he(cj.religion ? (religionMap[cj.religion] ?? vv(cj.religion)) : '')}</td>
        </tr>
        <tr>
          <td style="${TD}">血液型</td>
          <td style="${TD}">${he(vv(cj.bloodType))}</td>
          <td style="${TD}">婚姻歴</td>
          <td style="${TD}">${he(cj.maritalStatus ? (maritalMap[cj.maritalStatus] ?? vv(cj.maritalStatus)) : '')}</td>
        </tr>
        <tr>
          <td style="${TD}">身長</td>
          <td style="${TD}">${he(heightDisplay)}</td>
          <td style="${TD}">体重</td>
          <td style="${TD}">${he(weightDisplay)}</td>
        </tr>
        <tr>
          <td style="${TD}">日本語レベル</td>
          <td style="${TD}" colspan="3">${jpLevelDisplay}</td>
        </tr>
      </tbody>
    </table>
  </div>

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
        <td style="${TD}" colspan="3">${he(vv(cj.address))}</td>
      </tr>
    </tbody>
  </table>

  <table>
    <tbody>
      <tr><td style="${ST}" colspan="2">学歴</td></tr>
      ${eduRowsHtml}
    </tbody>
  </table>

  <table>
    <tbody>
      <tr><td style="${ST}" colspan="2">職歴</td></tr>
      ${careerRowsHtml}
    </tbody>
  </table>

  <table>
    <tbody>
      <tr><td style="${ST}" colspan="3">資格・公的認定</td></tr>
      <tr style="text-align:center;">
        <td style="${TD}width:25%;">発行日</td>
        <td style="${TD}width:40%;">名称</td>
        <td style="${TD}width:35%;">レベルや詳細</td>
      </tr>
      ${certRowsHtml}
    </tbody>
  </table>

  <table>
    <tbody>
      <tr>
        <td style="${ST}">技能</td>
      </tr>
      <tr>
        <td style="${TD}height:60px;white-space:pre-wrap;">${he(trunc(getJa(cj,'selfPrJa','selfPrId'), 300))}</td>
      </tr>
    </tbody>
  </table>

  <table style="margin-bottom:0;">
    <tbody>
      <tr>
        <td style="${ST}">自己PR</td>
      </tr>
      <tr>
        <td style="${TD}height:100px;white-space:pre-wrap;">${he(trunc(getJa(cj,'selfIntroJa','selfIntroId'), 400))}</td>
      </tr>
    </tbody>
  </table>

  <div style="text-align:right;padding-top:4px;">
    <img src="${IJBNET_LOGO}" alt="IJBNet" style="width:80px;height:auto;display:inline-block;">
  </div>

</div>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const IJBNET_LOGO = readLogo();

  const html = buildHtml(candidate, IJBNET_LOGO);

  // Save HTML for browser preview
  const htmlPath = path.join(__dirname, 'cv-v2-sample.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`HTML saved: ${htmlPath}`);

  // Try to generate PDF
  const chromePath = resolveChromePath();
  if (!chromePath) {
    console.warn('Chrome not found — HTML saved for browser preview only.');
    return;
  }

  console.log(`Chrome: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    });
    const pdfPath = path.join(__dirname, 'cv-v2-sample.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(pdf));
    console.log(`PDF saved: ${pdfPath}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
