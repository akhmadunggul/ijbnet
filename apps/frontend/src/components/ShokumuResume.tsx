import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import AuthImage from './AuthImage';
import type { CandidateData, CareerEntry, CertificationEntry } from '../types/candidate';

// ── Font maps (kept in sync with shokumuTemplate.ts on the backend) ───────────
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


// ── Helpers ───────────────────────────────────────────────────────────────────

function fb(ja: string | null | undefined, id: string | null | undefined): string {
  return ((ja ?? '').trim()) || ((id ?? '').trim());
}

function sortCareer(entries: CareerEntry[], layout: string): CareerEntry[] {
  if (layout === 'reverse') return [...entries].reverse();
  if (layout === 'chronological') {
    return [...entries].sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate < b.startDate ? -1 : 1;
    });
  }
  return [...entries];
}

function TextBullets({ text, style }: { text: string; style?: React.CSSProperties }) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return <p style={{ margin: 0, ...style }}>{text}</p>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: '1.2em', ...style }}>
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}

// ── Inline styles (mirroring the HTML template) ───────────────────────────────
const navy = '#1a3050';

const S = {
  doc: {
    width: '860px',
    margin: '0 auto',
    border: '2px solid #000',
    backgroundColor: '#fff',
    padding: '20mm 15mm 15mm 20mm',
    fontSize: '10pt',
    lineHeight: '1.6',
    color: '#111',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8mm',
    borderBottom: `2px solid ${navy}`,
    paddingBottom: '4mm',
  } as React.CSSProperties,

  h1: {
    fontSize: '18pt',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    color: navy,
  } as React.CSSProperties,

  date: { fontSize: '9pt', color: '#555', marginTop: '2mm' } as React.CSSProperties,

  nameBlock: { textAlign: 'right' as const },
  nameLabel: { fontSize: '8pt', color: '#777' } as React.CSSProperties,
  name: { fontSize: '13pt', fontWeight: 'bold', color: navy } as React.CSSProperties,
  code: { fontSize: '7.5pt', color: '#aaa', marginTop: '1mm' } as React.CSSProperties,

  photo: {
    width: '25mm',
    height: '25mm',
    objectFit: 'cover' as const,
    borderRadius: '2mm',
    border: '1px solid #ccc',
  } as React.CSSProperties,

  sectionHeading: {
    fontSize: '11pt',
    fontWeight: 'bold',
    color: navy,
    borderLeft: `4px solid ${navy}`,
    paddingLeft: '4mm',
    marginTop: '6mm',
    marginBottom: '3mm',
  } as React.CSSProperties,

  summaryBox: {
    background: '#f7f9fc',
    border: '1px solid #d0daea',
    borderRadius: '2mm',
    padding: '4mm 5mm',
    fontSize: '9.5pt',
    lineHeight: '1.7',
    color: '#222',
  } as React.CSSProperties,

  entryTitle: {
    fontSize: '10.5pt',
    fontWeight: 'bold',
    color: navy,
    marginBottom: '2mm',
  } as React.CSSProperties,

  overviewTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '9pt',
    marginBottom: '3mm',
  } as React.CSSProperties,

  overviewTh: {
    background: '#eef2f8',
    color: '#333',
    fontWeight: 'bold',
    padding: '2mm 3mm',
    border: '1px solid #c8d4e8',
    whiteSpace: 'nowrap' as const,
    width: '28%',
    textAlign: 'left' as const,
  } as React.CSSProperties,

  overviewTd: {
    padding: '2mm 3mm',
    border: '1px solid #c8d4e8',
  } as React.CSSProperties,

  blockLabel: {
    fontSize: '9pt',
    fontWeight: 'bold',
    color: '#444',
    marginBottom: '1mm',
    borderBottom: '1px dotted #bbb',
    paddingBottom: '0.5mm',
  } as React.CSSProperties,

  blockBody: {
    fontSize: '9pt',
    lineHeight: '1.65',
    paddingLeft: '2mm',
  } as React.CSSProperties,

  certList: {
    listStyle: 'disc',
    paddingLeft: '1.5em',
    fontSize: '9pt',
    lineHeight: '1.8',
    margin: 0,
  } as React.CSSProperties,

  footer: {
    marginTop: '10mm',
    borderTop: '1px solid #ccc',
    paddingTop: '3mm',
    fontSize: '8pt',
    color: '#888',
    display: 'flex',
    justifyContent: 'space-between',
  } as React.CSSProperties,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShokumuResume({ candidate }: { candidate: CandidateData }) {
  const [zoom, setZoom] = useState(1.0);
  const [jaOverride, setJaOverride] = useState<Record<string, string>>({});

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/shokumu-print.css';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const c = candidate ?? ({} as CandidateData);

  // Settings queries
  const { data: translateConfig } = useQuery<{ enabled: boolean }>({
    queryKey: ['translation-config'],
    queryFn: () => api.get('/superadmin/translation-config').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const autoTranslateEnabled = translateConfig?.enabled === true;

  const { data: fontConfig } = useQuery<{ fontKey: string }>({
    queryKey: ['cv-font'],
    queryFn: () => api.get('/superadmin/cv-font').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const fontKey = fontConfig?.fontKey ?? 'ms-mincho';
  const FONT = FONT_MAP[fontKey] ?? FONT_MAP['ms-mincho']!;

  const { data: shokumuConfig } = useQuery<{ layout: string }>({
    queryKey: ['shokumu-config'],
    queryFn: () => api.get('/candidates/me/shokumu').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const layout = shokumuConfig?.layout ?? 'reverse';

  // Inject Google Fonts if needed
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

  // Live auto-translate candidate-level fields that are missing Japanese
  useEffect(() => {
    if (!autoTranslateEnabled) { setJaOverride({}); return; }
    const fields = [
      { jaKey: 'careerSummaryJa', idKey: 'careerSummaryId' },
      { jaKey: 'selfPrJa',        idKey: 'selfPrId'        },
      { jaKey: 'selfIntroJa',     idKey: 'selfIntroId'     },
    ].filter(f => !(c as unknown as Record<string, unknown>)[f.jaKey] &&
                   (c as unknown as Record<string, unknown>)[f.idKey]);
    if (!fields.length) return;
    Promise.all(fields.map(f =>
      api.post<{ translated: string }>('/translate', {
        text: (c as unknown as Record<string, unknown>)[f.idKey], source: 'id', target: 'ja',
      }).then(r => ({ key: f.jaKey, value: r.data.translated })).catch(() => null),
    )).then(results => {
      const updates: Record<string, string> = {};
      results.forEach(r => { if (r) updates[r.key] = r.value; });
      if (Object.keys(updates).length) setJaOverride(updates);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslateEnabled, c.careerSummaryId, c.careerSummaryJa, c.selfPrId, c.selfPrJa, c.selfIntroId, c.selfIntroJa]);

  const getJa = (jaKey: keyof CandidateData, idKey: keyof CandidateData): string =>
    fb(c[jaKey] as string, (autoTranslateEnabled ? jaOverride[jaKey as string] : '') || c[idKey] as string);

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  const careerSummary = getJa('careerSummaryJa', 'careerSummaryId');
  const selfPrText    = getJa('selfPrJa',        'selfPrId');
  const selfIntroText = getJa('selfIntroJa',      'selfIntroId');

  const sortedCareer = useMemo(
    () => sortCareer(c.career ?? [], layout),
    [c.career, layout],
  );

  const certs: CertificationEntry[] = c.certifications ?? [];

  return (
    <>
      {/* Zoom controls — same UI as CandidateCV */}
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

      {/* A4 document */}
      <div className="cv-zoom-wrapper" style={{ zoom: zoom as unknown as number }}>
        <div className="shokumu-doc" style={{ ...S.doc, fontFamily: FONT }}>

          {/* ── Header ── */}
          <div style={S.header}>
            <div>
              <h1 style={S.h1}>職務経歴書</h1>
              <p style={S.date}>作成日：{today}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6mm' }}>
              {c.closeupUrl && (
                <AuthImage
                  src={c.closeupUrl}
                  alt="顔写真"
                  style={S.photo}
                />
              )}
              <div style={S.nameBlock}>
                <p style={S.nameLabel}>氏名</p>
                <p style={S.name}>{c.fullName ?? ''}</p>
                <p style={S.code}>{c.candidateCode ?? ''}</p>
              </div>
            </div>
          </div>

          {/* ── Section 1: 経歴要約 ── */}
          {careerSummary && (
            <>
              <h2 style={S.sectionHeading}>経歴要約</h2>
              <div style={S.summaryBox}>{careerSummary}</div>
            </>
          )}

          {/* ── Section 2: 職務経歴 ── */}
          {sortedCareer.length > 0 && (
            <>
              <h2 style={S.sectionHeading}>職務経歴</h2>
              {sortedCareer.map((entry, idx) => {
                const duties       = fb(entry.dutiesJa,       entry.dutiesId);
                const achievements = fb(entry.achievementsJa, entry.achievementsId);

                type OverviewRow = [string, string];
                const overviewRows: OverviewRow[] = [];
                if (entry.companyName)                    overviewRows.push(['会社名',   entry.companyName]);
                if (entry.companyType)                    overviewRows.push(['会社形態', entry.companyType]);
                if (entry.employeeCount != null)          overviewRows.push(['従業員数', `${entry.employeeCount}名`]);
                if (entry.annualSales)                    overviewRows.push(['年商',     entry.annualSales]);
                if (entry.capitalAmount)                  overviewRows.push(['資本金',   entry.capitalAmount]);
                if (entry.division)                       overviewRows.push(['部署',     entry.division]);
                if (entry.period)                         overviewRows.push(['在籍期間', entry.period]);

                return (
                  <div key={entry.id ?? idx} style={{ marginTop: idx === 0 ? '4mm' : '6mm' }}>
                    <h3 style={S.entryTitle}>
                      {entry.companyName ?? `経歴 ${idx + 1}`}
                      {entry.period && (
                        <span style={{ fontSize: '9pt', fontWeight: 'normal', color: '#555' }}>
                          　{entry.period}
                        </span>
                      )}
                    </h3>

                    {overviewRows.length > 0 && (
                      <table style={S.overviewTable}>
                        <tbody>
                          {overviewRows.map(([label, val]) => (
                            <tr key={label}>
                              <th style={S.overviewTh}>{label}</th>
                              <td style={S.overviewTd}>{val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {duties && (
                      <div style={{ marginTop: '2mm' }}>
                        <p style={S.blockLabel}>業務内容</p>
                        <div style={S.blockBody}><TextBullets text={duties} /></div>
                      </div>
                    )}

                    {achievements && (
                      <div style={{ marginTop: '2mm' }}>
                        <p style={S.blockLabel}>実績・成果</p>
                        <div style={S.blockBody}><TextBullets text={achievements} /></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ── Section 3: 活かせるスキル・知識 ── */}
          {selfPrText && (
            <>
              <h2 style={S.sectionHeading}>活かせるスキル・知識</h2>
              <div style={S.blockBody}><TextBullets text={selfPrText} /></div>
            </>
          )}

          {/* ── Section 4: 資格・免許 ── */}
          <h2 style={S.sectionHeading}>資格・免許</h2>
          <ul style={S.certList}>
            {certs.length > 0 ? certs.map((cert, i) => (
              <li key={i}>
                {cert.certName}
                {cert.issuedDate ? `　${cert.issuedDate}` : ''}
                {cert.issuedBy ? ` (${cert.issuedBy})` : ''}
              </li>
            )) : <li>なし</li>}
          </ul>

          {/* ── Section 5: 自己PR ── */}
          {selfIntroText && (
            <>
              <h2 style={S.sectionHeading}>自己PR</h2>
              <div style={S.summaryBox}>{selfIntroText}</div>
            </>
          )}

          {/* ── Footer ── */}
          <div style={S.footer}>
            <span>IJBNet — 職務経歴書</span>
            <span>{today}</span>
          </div>

        </div>
      </div>
    </>
  );
}
