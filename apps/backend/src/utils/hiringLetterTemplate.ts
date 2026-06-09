/**
 * Generates HTML for 内定通知書 (job offer) or 不採用通知書 (rejection) letters.
 * Returns full A4 HTML ready for Puppeteer rendering.
 */

function toReiwa(year: number): string {
  if (year < 2019) return `${year}年`;
  return `令和${year - 2018}年`;
}

function jaDate(d: Date): string {
  return `${toReiwa(d.getFullYear())}${d.getMonth() + 1}月${d.getDate()}日`;
}

export function buildHiringLetterHtml(opts: {
  decision: 'accepted' | 'rejected';
  candidateName: string;
  companyName: string;
  companyNameJa: string | null;
  date?: Date;
}): string {
  const { decision, candidateName, companyName, companyNameJa, date = new Date() } = opts;

  const displayCompany = companyNameJa || companyName;
  const dateStr = jaDate(date);

  const isAccepted = decision === 'accepted';
  const titleJa = isAccepted ? '内　定　通　知　書' : '不　採　用　通　知　書';
  const subtitleId = isAccepted ? 'Surat Penerimaan' : 'Surat Penolakan';

  const bodyJa = isAccepted
    ? `このたびは、弊社の採用試験にご応募いただきまして誠にありがとうございました。<br><br>
厳正なる選考の結果、貴殿を弊社の特定技能人材として内定いたしましたことを、ここにお知らせいたします。<br><br>
詳細な条件等につきましては、追ってご連絡いたします。<br>
今後ともよろしくお願い申し上げます。`
    : `このたびは、弊社の採用試験にご応募いただきまして誠にありがとうございました。<br><br>
厳正なる選考の結果、誠に残念ながら今回は採用を見送ることとなりましたことをお知らせいたします。<br><br>
ご健勝とご活躍をお祈り申し上げます。`;

  const bodyId = isAccepted
    ? `Terima kasih telah mengikuti proses seleksi di perusahaan kami.<br><br>
Setelah melalui proses seleksi yang ketat, dengan ini kami memberitahukan bahwa Anda diterima sebagai tenaga kerja berketerampilan khusus di perusahaan kami.<br><br>
Detail lebih lanjut akan disampaikan kemudian.`
    : `Terima kasih telah mengikuti proses seleksi di perusahaan kami.<br><br>
Setelah melalui proses seleksi yang ketat, dengan berat hati kami memberitahukan bahwa Anda tidak dapat kami terima pada kesempatan ini.<br><br>
Kami mendoakan yang terbaik untuk karir Anda ke depannya.`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Serif JP', 'MS Mincho', serif;
    font-size: 12pt;
    color: #111;
    background: #fff;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 25mm 25mm 20mm 25mm;
    position: relative;
  }
  .date-line {
    text-align: right;
    margin-bottom: 32pt;
    font-size: 11pt;
  }
  .recipient {
    font-size: 13pt;
    margin-bottom: 32pt;
    padding-left: 4pt;
  }
  .recipient .ruby {
    font-size: 8pt;
    color: #555;
    display: block;
  }
  .title-block {
    text-align: center;
    margin-bottom: 36pt;
  }
  .title-ja {
    font-size: 20pt;
    font-weight: 600;
    letter-spacing: 4pt;
    display: block;
    margin-bottom: 4pt;
  }
  .title-id {
    font-size: 10pt;
    color: #555;
    display: block;
    letter-spacing: 1pt;
  }
  .divider {
    border: none;
    border-top: 1px solid #333;
    margin: 0 auto 36pt auto;
    width: 60%;
  }
  .body-ja {
    line-height: 2;
    font-size: 11pt;
    margin-bottom: 24pt;
    text-align: justify;
  }
  .body-id {
    line-height: 1.8;
    font-size: 9pt;
    color: #444;
    border-left: 3px solid #ccc;
    padding-left: 10pt;
    margin-bottom: 48pt;
    text-align: justify;
  }
  .signature-block {
    text-align: right;
    margin-top: 48pt;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 16pt;
  }
  .company-name {
    font-size: 12pt;
    font-weight: 600;
    text-align: right;
  }
  .company-name .sub {
    font-size: 9pt;
    font-weight: normal;
    color: #555;
    display: block;
  }
  .inkan {
    width: 52pt;
    height: 52pt;
    border: 2px dashed #777;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 7pt;
    color: #777;
    text-align: center;
    padding: 4pt;
    line-height: 1.3;
    flex-shrink: 0;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; }
    .page { margin: 0; padding: 15mm 20mm 15mm 20mm; }
  }
</style>
</head>
<body>
<div class="page">
  <p class="date-line">${dateStr}</p>

  <p class="recipient">
    <span class="ruby">（候補者）</span>
    ${candidateName} 殿
  </p>

  <div class="title-block">
    <span class="title-ja">${titleJa}</span>
    <span class="title-id">${subtitleId}</span>
  </div>
  <hr class="divider">

  <div class="body-ja">${bodyJa}</div>
  <div class="body-id">${bodyId}</div>

  <div class="signature-block">
    <div class="company-name">
      <span class="sub">${companyName !== displayCompany ? companyName : ''}</span>
      ${displayCompany}
    </div>
    <div class="inkan">代表<br>印</div>
  </div>
</div>
</body>
</html>`;
}
