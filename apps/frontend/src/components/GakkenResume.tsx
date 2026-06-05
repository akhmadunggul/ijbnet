import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CandidateData, CertificationEntry, GakkenResume, GakkenCompanyEntry } from '../types/candidate';

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

const TD: React.CSSProperties = { border: '1px solid #333', padding: '2mm 3mm', verticalAlign: 'top', fontSize: '8.5pt' };
const TH: React.CSSProperties = { ...TD, background: '#f0f0f0', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' };

function fb(ja: string | null | undefined, id: string | null | undefined): string {
  return ((ja ?? '').trim()) || ((id ?? '').trim());
}

function TextBullets({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return <span>{text}</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: '1.4em', listStyleType: 'disc' }}>
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontWeight: 'bold', fontSize: '10pt',
      borderBottom: '2px solid #111',
      marginTop: '6mm', marginBottom: '2mm',
      paddingBottom: '1mm', letterSpacing: '0.06em',
    }}>
      {label}
    </div>
  );
}

interface GakkenResumeResponse {
  resume: GakkenResume | null;
  companies: GakkenCompanyEntry[];
}

export default function GakkenResume({ candidate, gakkenEndpoint }: { candidate: CandidateData; gakkenEndpoint?: string }) {
  const [zoom, setZoom] = useState(1.0);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/gakken-print.css';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const { data: fontConfig } = useQuery<{ fontKey: string }>({
    queryKey: ['cv-font'],
    queryFn: () => api.get('/superadmin/cv-font').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const fontKey = fontConfig?.fontKey ?? 'ms-mincho';
  const FONT = FONT_MAP[fontKey] ?? FONT_MAP['ms-mincho']!;

  useEffect(() => {
    const gf = GOOGLE_FONT_MAP[fontKey];
    if (!gf) return;
    const id = `gfont-${fontKey}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id; link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${gf}&display=swap`;
    document.head.appendChild(link);
  }, [fontKey]);

  const endpoint = gakkenEndpoint ?? '/candidates/me/gakken-resume';
  const { data: gakkenData } = useQuery<GakkenResumeResponse>({
    queryKey: ['gakken-resume', endpoint],
    queryFn: () => api.get(endpoint).then(r => r.data),
    staleTime: 30_000,
  });

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const certs = (candidate.certifications ?? []) as CertificationEntry[];

  const gr = gakkenData?.resume ?? null;
  const companies = gakkenData?.companies ?? [];

  const careerSummary = fb(gr?.careerSummaryJa, gr?.careerSummary);
  const skillsText    = fb(gr?.skillsJa,        gr?.skills);
  const selfPrText    = fb(gr?.selfPrJa,         gr?.selfPr);

  return (
    <>
      {/* Zoom controls */}
      <div className="print:hidden flex items-center gap-2 justify-end mb-3">
        <button
          onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))}
          disabled={zoom <= 0.5}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-base font-bold transition"
        >−</button>
        <span className="text-xs text-gray-500 w-12 text-center select-none">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(z => Math.min(2.0, parseFloat((z + 0.1).toFixed(1))))}
          disabled={zoom >= 2.0}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-base font-bold transition"
        >+</button>
      </div>

      <div className="cv-zoom-wrapper" style={{ zoom: zoom as unknown as number }}>
        <div style={{
          width: '860px', margin: '0 auto',
          border: '2px solid #000', backgroundColor: '#fff',
          padding: '15mm 15mm 10mm 20mm',
          fontSize: '9pt', lineHeight: '1.6', color: '#111',
          boxSizing: 'border-box', fontFamily: FONT,
        }}>

          {/* ── Title ── */}
          <div style={{ textAlign: 'center', fontSize: '16pt', fontWeight: 'bold', letterSpacing: '0.5em', marginBottom: '3mm' }}>
            職　務　経　歴　書
          </div>

          {/* ── Date + Name (right-aligned) ── */}
          <div style={{ textAlign: 'right', fontSize: '9pt', marginBottom: '1mm' }}>{today}現在</div>
          <div style={{ textAlign: 'right', fontSize: '10pt', marginBottom: '5mm', borderBottom: '1px solid #333', paddingBottom: '3mm' }}>
            氏名　{candidate.fullName ?? ''}
            {candidate.candidateCode && (
              <span style={{ fontSize: '7.5pt', color: '#888', marginLeft: '4mm' }}>{candidate.candidateCode}</span>
            )}
          </div>

          {/* ── 職務要約 ── */}
          {careerSummary && (
            <>
              <SectionHeader label="職務要約" />
              <div style={{ border: '1px solid #333', padding: '3mm 4mm', minHeight: '15mm', whiteSpace: 'pre-wrap' }}>
                {careerSummary}
              </div>
            </>
          )}

          {/* ── 現在経歴 ── */}
          {gr?.currentCompanyName && (
            <>
              <SectionHeader label="現在経歴" />
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2mm' }}>
                <tbody>
                  <tr>
                    <td style={{ ...TH, width: '22%' }}>会社名</td>
                    <td style={{ ...TD, width: '78%' }} colSpan={3}>{gr.currentCompanyName ?? ''}</td>
                  </tr>
                  <tr>
                    <td style={TH}>企業の事業内容</td>
                    <td style={TD} colSpan={3}>{gr.currentBusinessActivity ?? ''}</td>
                  </tr>
                  <tr>
                    <td style={TH}>資本金</td>
                    <td style={TD}>{gr.currentCapital ? `${gr.currentCapital}万円` : ''}</td>
                    <td style={TH}>売上高</td>
                    <td style={TD}>{gr.currentRevenue ? `${gr.currentRevenue}万円` : ''}</td>
                  </tr>
                  <tr>
                    <td style={TH}>従業員数</td>
                    <td style={TD} colSpan={3}>{gr.currentEmployeeCount != null ? `${gr.currentEmployeeCount}名` : ''}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* ── 職務経歴 ── */}
          <SectionHeader label="職務経歴" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: '18%' }}>期　間</th>
                <th style={{ ...TH, width: '20%' }}>担当製品</th>
                <th style={{ ...TH, width: '47%' }}>担当業務</th>
                <th style={{ ...TH, width: '15%' }}>メンバー・役割</th>
              </tr>
            </thead>
            <tbody>
              {companies.length > 0 ? companies.map((entry, idx) => {
                const product    = fb(entry.productJa,    entry.productId);
                const duties     = fb(entry.dutiesJa,     entry.dutiesId);
                const memberRole = fb(entry.memberRoleJa, entry.memberRoleId);
                return (
                  <tr key={idx}>
                    <td style={TD}>{entry.period ?? ''}</td>
                    <td style={TD}>{product    ? <TextBullets text={product}    /> : ''}</td>
                    <td style={TD}>{duties     ? <TextBullets text={duties}     /> : ''}</td>
                    <td style={TD}>{memberRole ? <TextBullets text={memberRole} /> : ''}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: '#aaa' }}>なし</td></tr>
              )}
            </tbody>
          </table>

          {/* ── 経験・知識・技術 ── */}
          {skillsText && (
            <>
              <SectionHeader label="経験・知識・技術" />
              <div style={{ border: '1px solid #333', padding: '3mm 4mm', minHeight: '15mm' }}>
                <TextBullets text={skillsText} />
              </div>
            </>
          )}

          {/* ── 資格 ── */}
          <SectionHeader label="資　格" />
          <div style={{ border: '1px solid #333', padding: '3mm 4mm', minHeight: '10mm' }}>
            {certs.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.4em', listStyleType: 'disc' }}>
                {certs.map((cert, i) => (
                  <li key={i}>
                    {cert.certName}
                    {cert.issuedDate ? `　${cert.issuedDate}` : ''}
                    {cert.issuedBy ? ` (${cert.issuedBy})` : ''}
                  </li>
                ))}
              </ul>
            ) : <span style={{ color: '#aaa' }}>なし</span>}
          </div>

          {/* ── 自己ＰＲ ── */}
          {selfPrText && (
            <>
              <SectionHeader label="自己ＰＲ" />
              <div style={{ border: '1px solid #333', padding: '3mm 4mm', minHeight: '22mm', whiteSpace: 'pre-wrap' }}>
                {selfPrText}
              </div>
            </>
          )}

          {/* ── 以上 ── */}
          <div style={{ textAlign: 'right', marginTop: '6mm', fontSize: '9pt' }}>以上</div>

        </div>
      </div>
    </>
  );
}
