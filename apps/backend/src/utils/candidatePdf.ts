import fs from 'fs';

const ID_MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04',
  mei: '05', juni: '06', juli: '07', agustus: '08',
  september: '09', oktober: '10', november: '11', desember: '12',
};

function parsePeriodStart(period: unknown): string {
  if (!period || typeof period !== 'string') return '';
  const start = period.split(/\s*[–—-]\s*/)[0].trim();
  const m = start.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (!m) return '';
  const month = ID_MONTHS[m[1].toLowerCase()];
  return month ? `${m[2]}-${month}-01` : '';
}

function careerSortKey(entry: Record<string, unknown>): string {
  return (entry['startDate'] as string | null) || parsePeriodStart(entry['period']);
}

export function resolveChromePath(): string | null {
  if (process.env['CHROME_PATH']) return process.env['CHROME_PATH'];
  const paths =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          `${process.env['LOCALAPPDATA'] ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
        ]
      : [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
        ];
  return paths.find((p) => fs.existsSync(p)) ?? null;
}

export function buildCandidatePdfHtml(
  cj: Record<string, unknown>,
  nik: string | null,
): string {
  const user      = cj['user']             as Record<string, string>   | null;
  const lpk       = cj['lpk']              as Record<string, string>   | null;
  const bodyCheck = cj['bodyCheck']        as Record<string, unknown>  | null;
  const rawCareer = (cj['career']          as Record<string, unknown>[] | null) ?? [];
  const career    = [...rawCareer].sort((a, b) => {
    const aKey = careerSortKey(a);
    const bKey = careerSortKey(b);
    if (!aKey && !bKey) return 0;
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
  const tests     = (cj['tests']           as Record<string, unknown>[] | null) ?? [];
  const certs     = (cj['certifications']  as Record<string, unknown>[] | null) ?? [];

  const rawEduHist = (cj['educationHistory'] as Record<string, unknown>[] | null) ?? [];
  const eduHist = [...rawEduHist].sort((a, b) => {
    const aDate = (a['startDate'] as string | null) ?? '';
    const bDate = (b['startDate'] as string | null) ?? '';
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
  });

  const he = (v: unknown): string =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

  const row = (label: string, value: unknown) =>
    `<tr><td class="lbl">${label}</td><td>${he(value)}</td></tr>`;

  const candidateCode  = he(cj['candidateCode']);
  const profileStatus  = he(cj['profileStatus'] ?? 'incomplete');
  const gender         = cj['gender'] === 'M' ? 'Laki-laki' : cj['gender'] === 'F' ? 'Perempuan' : null;
  const today          = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  const selfH = cj['selfReportedHeight'] as number | null;
  const selfW = cj['selfReportedWeight'] as number | null;

  const careerRows = career.length
    ? career.map((c) => `<tr>
        <td>${he(c['companyName'])}</td>
        <td>${he(c['division'])}</td>
        <td>${he(c['period'])}</td>
        <td>${he(c['skillGroup'])}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty">—</td></tr>`;

  const testRows = tests.length
    ? tests.map((t) => `<tr>
        <td>${he(t['testName'])}</td>
        <td>${he(t['testDate'])}</td>
        <td>${he(t['score'])}</td>
        <td>${t['pass'] ? '合格 ✓' : '—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty">—</td></tr>`;

  const certRows = certs.length
    ? certs.map((c) => `<tr>
        <td>${he(c['certName'])}</td>
        <td>${he(c['issuedBy'])}</td>
        <td>${he(c['issuedDate'])}</td>
        <td>${he(c['certLevel'])}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty">—</td></tr>`;

  const eduHistRows = eduHist.length
    ? eduHist.map((e) => `<tr>
        <td>${he(e['schoolName'])}</td>
        <td>${he(e['major'])}</td>
        <td>${he(e['startDate'])} – ${he(e['endDate'])}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" class="empty">—</td></tr>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { font-family: 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
  body { color: #1a1a1a; padding: 36px 40px; font-size: 12px; line-height: 1.5; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1E3A5F; padding-bottom: 16px; margin-bottom: 20px; }
  .header-left h1 { font-size: 20px; color: #1E3A5F; font-weight: 700; }
  .header-left p { font-size: 12px; color: #555; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-right .code { font-size: 14px; font-weight: 700; color: #1E3A5F; }
  .header-right .date { font-size: 11px; color: #888; margin-top: 2px; }
  .status-badge { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; background: #1E3A5F; color: #fff; text-transform: uppercase; letter-spacing: .5px; }

  .section-title { font-size: 11px; font-weight: 700; color: #fff; background: #1E3A5F; padding: 5px 10px; margin: 18px 0 0; text-transform: uppercase; letter-spacing: .6px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
  th { background: #f0f4fa; color: #1E3A5F; font-weight: 600; font-size: 11px; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #f8f9fb; }
  .lbl { width: 40%; color: #555; font-weight: 500; }
  .empty { color: #bbb; font-style: italic; text-align: center; padding: 10px; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .two-col table { margin-bottom: 0; }

  .footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #aaa; text-align: center; }
  .privacy { font-size: 10px; color: #999; text-align: center; margin-top: 4px; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>IJBNet — Data Portofolio Kandidat</h1>
    <p>${he(user?.['name'] ?? 'Kandidat')}</p>
  </div>
  <div class="header-right">
    <div class="code">${candidateCode}</div>
    <div class="date">${today}</div>
    <span class="status-badge">${profileStatus}</span>
  </div>
</div>

<div class="section-title">Data Pribadi</div>
<div class="two-col">
  <table>
    ${row('Nama Lengkap', user?.['name'])}
    ${row('Email', user?.['email'])}
    ${row('Telepon', cj['phone'])}
    ${row('NIK', nik ?? '(terenkripsi)')}
    ${row('Jenis Kelamin', gender)}
    ${row('Tanggal Lahir', cj['dateOfBirth'])}
    ${row('Tempat Lahir', cj['birthPlace'])}
    ${row('Status Perkawinan', cj['maritalStatus'])}
  </table>
  <table>
    ${row('Agama', cj['religion'])}
    ${row('Golongan Darah', cj['bloodType'])}
    ${row('Tinggi Badan (Mandiri)', selfH != null ? selfH + ' cm' : null)}
    ${row('Berat Badan (Mandiri)', selfW != null ? selfW + ' kg' : null)}
    ${row('Alamat', cj['address'])}
    ${row('LPK', lpk?.['name'])}
    ${row('Punya Paspor', cj['hasPassport'] ? 'Ya' : 'Tidak')}
    ${row('Pernah ke Jepang', cj['hasVisitedJapan'] ? 'Ya' : 'Tidak')}
  </table>
</div>

<div class="section-title">Minat Program</div>
<table>
  ${row('Tipe Program', cj['sswKubun'])}
  ${row('Bidang (ID)', cj['sswSectorId'])}
  ${row('Bidang (JA)', cj['sswSectorJa'])}
  ${row('Jenis Pekerjaan (ID)', cj['sswFieldId'])}
  ${row('Jenis Pekerjaan (JA)', cj['sswFieldJa'])}
  ${row('Lama Belajar Bahasa Jepang', cj['jpStudyDuration'])}
</table>

<div class="section-title">Pendidikan Terakhir</div>
<table>
  ${row('Jenjang', cj['eduLevel'])}
  ${row('Nama Sekolah / Institusi', cj['eduLabel'])}
  ${row('Jurusan', cj['eduMajor'])}
</table>

${eduHist.length ? `
<div class="section-title">Riwayat Pendidikan</div>
<table>
  <tr><th>Institusi</th><th>Jurusan</th><th>Periode</th></tr>
  ${eduHistRows}
</table>` : ''}

<div class="section-title">Riwayat Karier</div>
<table>
  <tr><th>Perusahaan</th><th>Divisi</th><th>Periode</th><th>Keahlian</th></tr>
  ${careerRows}
</table>

<div class="section-title">Kemampuan Bahasa Jepang</div>
<table>
  <tr><th>Jenis Tes</th><th>Tanggal</th><th>Nilai</th><th>Hasil</th></tr>
  ${testRows}
</table>

<div class="section-title">Sertifikasi</div>
<table>
  <tr><th>Nama Sertifikat</th><th>Penerbit</th><th>Tanggal Terbit</th><th>Level</th></tr>
  ${certRows}
</table>

${cj['selfIntroId'] || cj['selfIntroJa'] ? `
<div class="section-title">Keahlian</div>
<div class="two-col">
  <table>${row('Indonesia', cj['selfIntroId'])}</table>
  <table>${row('日本語', (cj['selfIntroJa'] as string | null) || (cj['selfIntroId'] as string | null))}</table>
</div>` : ''}

${cj['motivationId'] || cj['motivationJa'] ? `
<div class="section-title">Motivasi</div>
<div class="two-col">
  <table>${row('Indonesia', cj['motivationId'])}</table>
  <table>${row('日本語', (cj['motivationJa'] as string | null) || (cj['motivationId'] as string | null))}</table>
</div>` : ''}

${cj['selfPrId'] || cj['selfPrJa'] ? `
<div class="section-title">Promosi Diri</div>
<div class="two-col">
  <table>${row('Indonesia', cj['selfPrId'])}</table>
  <table>${row('日本語', (cj['selfPrJa'] as string | null) || (cj['selfPrId'] as string | null))}</table>
</div>` : ''}

${bodyCheck ? `
<div class="section-title">Pemeriksaan Fisik (Terverifikasi Admin)</div>
<div class="two-col">
  <table>
    ${row('Tinggi Terverifikasi', bodyCheck['verifiedHeight'] != null ? bodyCheck['verifiedHeight'] + ' cm' : null)}
    ${row('Berat Terverifikasi', bodyCheck['verifiedWeight'] != null ? bodyCheck['verifiedWeight'] + ' kg' : null)}
    ${row('Golongan Darah', bodyCheck['bloodType'])}
    ${row('Tekanan Darah', bodyCheck['bloodPressure'])}
  </table>
  <table>
    ${row('Penglihatan Kiri', bodyCheck['visionLeft'])}
    ${row('Penglihatan Kanan', bodyCheck['visionRight'])}
    ${row('Buta Warna', bodyCheck['colorBlind'] ? 'Ya' : 'Tidak')}
    ${row('Catatan', bodyCheck['notes'])}
  </table>
</div>` : ''}

<div class="footer">Dicetak oleh IJBNet &bull; ${new Date().toISOString()}</div>
<div class="privacy">Dokumen ini bersifat rahasia. Hanya diperuntukkan bagi keperluan penempatan SSW sesuai UU PDP.</div>

</body>
</html>`;
}
