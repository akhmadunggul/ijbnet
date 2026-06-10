import { useEffect } from 'react';

export interface HiringLetterData {
  decision: 'accepted' | 'rejected';
  candidateName: string;
  companyName: string;
  companyNameJa: string | null;
  date: string;
}

function toReiwa(year: number): string {
  if (year < 2019) return `${year}年`;
  return `令和${year - 2018}年`;
}

function jaDate(iso: string): string {
  const d = new Date(iso);
  return `${toReiwa(d.getFullYear())}${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function HiringLetter({ data, zoom = 100 }: { data: HiringLetterData; zoom?: number }) {
  const { decision, candidateName, companyName, companyNameJa, date } = data;
  const displayCompany = companyNameJa || companyName;
  const isAccepted = decision === 'accepted';

  const titleJa = isAccepted ? '内　定　通　知　書' : '不　採　用　通　知　書';
  const subtitleId = isAccepted ? 'Surat Penerimaan' : 'Surat Penolakan';

  const bodyJa = isAccepted
    ? 'このたびは、弊社の採用試験にご応募いただきまして誠にありがとうございました。\n\n厳正なる選考の結果、貴殿を弊社の特定技能人材として内定いたしましたことを、ここにお知らせいたします。\n\n詳細な条件等につきましては、追ってご連絡いたします。\n今後ともよろしくお願い申し上げます。'
    : 'このたびは、弊社の採用試験にご応募いただきまして誠にありがとうございました。\n\n厳正なる選考の結果、誠に残念ながら今回は採用を見送ることとなりましたことをお知らせいたします。\n\nご健勝とご活躍をお祈り申し上げます。';

  const bodyId = isAccepted
    ? 'Terima kasih telah mengikuti proses seleksi di perusahaan kami.\n\nSetelah melalui proses seleksi yang ketat, dengan ini kami memberitahukan bahwa Anda diterima sebagai tenaga kerja berketerampilan khusus di perusahaan kami.\n\nDetail lebih lanjut akan disampaikan kemudian.'
    : 'Terima kasih telah mengikuti proses seleksi di perusahaan kami.\n\nSetelah melalui proses seleksi yang ketat, dengan berat hati kami memberitahukan bahwa Anda tidak dapat kami terima pada kesempatan ini.\n\nKami mendoakan yang terbaik untuk karir Anda ke depannya.';

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  return (
    <div
      style={{
        transformOrigin: 'top center',
        transform: `scale(${zoom / 100})`,
        marginBottom: zoom < 100 ? `${(zoom - 100) * 2.97}mm` : undefined,
      }}
    >
      <div
        style={{
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          padding: '25mm 25mm 20mm 25mm',
          background: '#fff',
          border: '2px solid #000',
          boxSizing: 'border-box',
          fontFamily: "'Noto Serif JP', 'MS Mincho', serif",
          fontSize: '12pt',
          color: '#111',
        }}
      >
        {/* Date */}
        <p style={{ textAlign: 'right', marginBottom: '32pt', fontSize: '11pt' }}>
          {jaDate(date)}
        </p>

        {/* Recipient */}
        <div style={{ fontSize: '13pt', marginBottom: '32pt', paddingLeft: '4pt' }}>
          <span style={{ fontSize: '8pt', color: '#555', display: 'block' }}>（候補者）</span>
          {candidateName} 殿
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '36pt' }}>
          <span style={{ fontSize: '20pt', fontWeight: 600, letterSpacing: '4pt', display: 'block', marginBottom: '4pt' }}>
            {titleJa}
          </span>
          <span style={{ fontSize: '10pt', color: '#555', display: 'block', letterSpacing: '1pt' }}>
            {subtitleId}
          </span>
        </div>

        {/* Divider */}
        <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '0 auto 36pt auto', width: '60%' }} />

        {/* Japanese body */}
        <div style={{ lineHeight: 2, fontSize: '11pt', marginBottom: '24pt', textAlign: 'justify', whiteSpace: 'pre-line' }}>
          {bodyJa}
        </div>

        {/* Indonesian body */}
        <div style={{
          lineHeight: 1.8, fontSize: '9pt', color: '#444',
          borderLeft: '3px solid #ccc', paddingLeft: '10pt',
          marginBottom: '48pt', textAlign: 'justify', whiteSpace: 'pre-line',
        }}>
          {bodyId}
        </div>

        {/* Signature */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16pt', marginTop: '48pt' }}>
          <div style={{ textAlign: 'right' }}>
            {companyName !== displayCompany && (
              <span style={{ fontSize: '9pt', color: '#555', display: 'block' }}>{companyName}</span>
            )}
            <span style={{ fontSize: '12pt', fontWeight: 600 }}>{displayCompany}</span>
          </div>
          <div style={{
            width: '52pt', height: '52pt', border: '2px dashed #777', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '7pt', color: '#777', textAlign: 'center',
            padding: '4pt', lineHeight: 1.3, flexShrink: 0,
          }}>
            代表<br />印
          </div>
        </div>
      </div>
    </div>
  );
}
