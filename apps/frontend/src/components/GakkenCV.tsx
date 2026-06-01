import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import AuthImage from './AuthImage';
import type { CandidateData, CertificationEntry } from '../types/candidate';

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

const PRINT_CSS = `
  @media print {
    body { margin: 0 !important; padding: 0 !important; }
    .no-print { display: none !important; }
    aside, header { display: none !important; }
    main { padding: 0 !important; overflow: visible !important; }
    .cv-zoom-wrapper { zoom: 1 !important; }
  }
  @page { size: A4; margin: 10mm 15mm 10mm 15mm; }
`;

const navy = '#2c3e6b';

const TD: React.CSSProperties = { border: '1px solid #888', padding: '2mm 3mm', verticalAlign: 'top' };
const TH: React.CSSProperties = { ...TD, background: '#f0f3f8', fontWeight: 'bold', textAlign: 'left', whiteSpace: 'nowrap' };
const SEC: React.CSSProperties = {
  background: navy, color: '#fff', fontWeight: 'bold',
  padding: '2mm 4mm', marginTop: '4mm', fontSize: '9pt', letterSpacing: '0.05em',
};
const TABLE: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };

function fb(ja: string | null | undefined, id: string | null | undefined): string {
  return ((ja ?? '').trim()) || ((id ?? '').trim());
}

function TextBullets({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return <span>{text}</span>;
  return <ul style={{ margin: 0, paddingLeft: '1.2em' }}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
}

function fmtPeriod(entry: { period?: string | null; startDate?: string | null }): string {
  if (entry.period) return entry.period;
  if (entry.startDate) return entry.startDate.slice(0, 7).replace('-', '.');
  return '—';
}

export default function GakkenCV({ candidate }: { candidate: CandidateData }) {
  const [zoom, setZoom] = useState(1.0);
  const [jaOverride, setJaOverride] = useState<Record<string, string>>({});

  const c = candidate ?? ({} as CandidateData);

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

  // Live auto-translate missing Japanese fields
  useEffect(() => {
    if (!autoTranslateEnabled) { setJaOverride({}); return; }
    const fields = [
      { jaKey: 'selfPrJa',    idKey: 'selfPrId'    },
      { jaKey: 'selfIntroJa', idKey: 'selfIntroId' },
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
  }, [autoTranslateEnabled, c.selfPrId, c.selfPrJa, c.selfIntroId, c.selfIntroJa]);

  const getJa = (jaKey: keyof CandidateData, idKey: keyof CandidateData): string =>
    fb(c[jaKey] as string, (autoTranslateEnabled ? jaOverride[jaKey as string] : '') || c[idKey] as string);

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  const career  = c.career            ?? [];
  const eduHist = c.educationHistory  ?? [];
  const certs   = (c.certifications   ?? []) as CertificationEntry[];

  const selfPrText    = getJa('selfPrJa',    'selfPrId');
  const selfIntroText = getJa('selfIntroJa', 'selfIntroId');

  return (
    <>
      {/* Zoom controls — identical to CandidateCV */}
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
          padding: '10mm 15mm 10mm 15mm',
          fontSize: '9pt', lineHeight: '1.55', color: '#111',
          boxSizing: 'border-box', fontFamily: FONT,
        }}>
          <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

          {/* ── Document header ── */}
          <table style={{ ...TABLE, marginBottom: '4mm', border: `2px solid ${navy}` }}>
            <tbody>
              <tr>
                <td style={{ fontSize: '17pt', fontWeight: 'bold', textAlign: 'center', color: navy, padding: '4mm', border: 'none', width: '45%' }}>
                  職務経歴書
                </td>
                <td style={{ padding: '3mm 4mm', border: 'none' }}>
                  <div style={{ fontSize: '8pt', color: '#666' }}>作成日：{today}</div>
                  <div style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '1mm' }}>{c.fullName ?? ''}</div>
                  <div style={{ fontSize: '7.5pt', color: '#aaa', marginTop: '0.5mm' }}>{c.candidateCode ?? ''}</div>
                </td>
                <td style={{ width: '28mm', textAlign: 'center', verticalAlign: 'middle', padding: '2mm', border: 'none' }}>
                  {c.closeupUrl ? (
                    <AuthImage
                      src={c.closeupUrl}
                      alt="顔写真"
                      style={{ width: '22mm', height: '28mm', objectFit: 'cover', border: '1px solid #ccc', display: 'block', margin: '0 auto' }}
                    />
                  ) : (
                    <div style={{ width: '22mm', height: '28mm', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '7pt', margin: '0 auto' }}>写真</div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── 職歴 ── */}
          <div style={SEC}>職　歴</div>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={{ ...TH, width: '20%' }}>在籍期間</th>
                <th style={{ ...TH, width: '32%' }}>会社名・部署</th>
                <th style={TH}>業務内容・実績</th>
              </tr>
            </thead>
            <tbody>
              {career.length > 0 ? career.map((entry, idx) => {
                const duties       = fb(entry.dutiesJa,       entry.dutiesId);
                const achievements = fb(entry.achievementsJa, entry.achievementsId);
                const meta = [
                  entry.companyType ?? '',
                  entry.employeeCount != null ? `${entry.employeeCount}名` : '',
                  entry.annualSales ? `年商 ${entry.annualSales}` : '',
                ].filter(Boolean).join('・');

                return (
                  <tr key={entry.id ?? idx}>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>{fmtPeriod(entry)}</td>
                    <td style={TD}>
                      {entry.companyName && <strong>{entry.companyName}</strong>}
                      {entry.division && <><br />{entry.division}</>}
                      {meta && <><br /><span style={{ fontSize: '8pt', color: '#555' }}>{meta}</span></>}
                    </td>
                    <td style={TD}>
                      {duties       && <div style={{ marginBottom: achievements ? '2mm' : 0 }}><TextBullets text={duties} /></div>}
                      {achievements && <div style={{ color: '#444', fontSize: '8pt' }}>[実績] <TextBullets text={achievements} /></div>}
                      {!duties && !achievements && '—'}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={3} style={{ ...TD, textAlign: 'center', color: '#aaa' }}>なし</td></tr>
              )}
            </tbody>
          </table>

          {/* ── 学歴 ── */}
          <div style={SEC}>学　歴</div>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={{ ...TH, width: '20%' }}>期間</th>
                <th style={{ ...TH, width: '50%' }}>学校名</th>
                <th style={TH}>専攻</th>
              </tr>
            </thead>
            <tbody>
              {eduHist.length > 0 ? (eduHist as unknown as Array<{ id?: string; startDate?: string | null; endDate?: string | null; schoolName?: string; major?: string | null }>).map((e, idx) => {
                const start = e.startDate?.slice(0, 7).replace('-', '.') ?? '';
                const end   = e.endDate  ?.slice(0, 7).replace('-', '.') ?? '在学中';
                const period = start ? `${start} – ${end}` : end;
                return (
                  <tr key={e.id ?? idx}>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>{period}</td>
                    <td style={TD}>{e.schoolName ?? ''}</td>
                    <td style={TD}>{e.major ?? ''}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={3} style={{ ...TD, textAlign: 'center', color: '#aaa' }}>なし</td></tr>
              )}
            </tbody>
          </table>

          {/* ── 資格 ── */}
          <div style={SEC}>保有資格・免許</div>
          <table style={TABLE}>
            <tbody>
              <tr>
                <td style={TD}>
                  {certs.length > 0 ? (
                    <ul style={{ listStyle: 'disc', paddingLeft: '1.2em', margin: 0 }}>
                      {certs.map((cert, i) => (
                        <li key={i}>
                          {cert.certName}
                          {cert.issuedDate ? `　${cert.issuedDate}` : ''}
                          {cert.issuedBy ? ` (${cert.issuedBy})` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : <span style={{ color: '#aaa' }}>なし</span>}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── スキル ── */}
          {selfPrText && (
            <>
              <div style={SEC}>活かせるスキル・知識</div>
              <table style={TABLE}>
                <tbody>
                  <tr><td style={{ ...TD, minHeight: '18mm' }}><TextBullets text={selfPrText} /></td></tr>
                </tbody>
              </table>
            </>
          )}

          {/* ── 自己PR ── */}
          {selfIntroText && (
            <>
              <div style={SEC}>自己PR</div>
              <table style={TABLE}>
                <tbody>
                  <tr><td style={{ ...TD, minHeight: '22mm', whiteSpace: 'pre-wrap' }}>{selfIntroText}</td></tr>
                </tbody>
              </table>
            </>
          )}

          {/* ── Footer ── */}
          <div style={{ marginTop: '8mm', borderTop: '1px solid #ccc', paddingTop: '2mm', fontSize: '7.5pt', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
            <span>IJBNet — 職務経歴書（Gakken形式）</span>
            <span>{today}</span>
          </div>

        </div>
      </div>
    </>
  );
}
