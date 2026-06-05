import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import AuthImage from './AuthImage';
import ijbnetLogo from '../assets/IJBNet_LOGO.png';

export interface CandidateCVProps {
  candidate: any;
  showSensitiveData?: boolean;
  lang?: 'id' | 'ja';
}

// ── Career sort helpers ───────────────────────────────────────────────────────

const ID_MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04',
  mei: '05', juni: '06', juli: '07', agustus: '08',
  september: '09', oktober: '10', november: '11', desember: '12',
};

function parsePeriodStart(period: string | null | undefined): string {
  if (!period) return '';
  const start = period.split(/\s*[–—-]\s*/)[0].trim();
  const m = start.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (!m) return '';
  const month = ID_MONTHS[m[1].toLowerCase()];
  return month ? `${m[2]}-${month}-01` : '';
}

function careerSortKey(entry: { startDate?: string | null; period?: string | null }): string {
  return entry.startDate || parsePeriodStart(entry.period);
}

// ── Exported helpers ──────────────────────────────────────────────────────────

export function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function formatPeriod(start?: string | null, end?: string | null): string {
  const fmt = (d: string) => d.slice(0, 7).replace('-', '/');
  const s = start ? fmt(start) : null;
  const e = end ? fmt(end) : null;
  if (s && e) return `${s} ー ${e}`;
  if (s) return `${s} ー 現在`;
  if (e) return `ー ${e}`;
  return '';
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function v(x: unknown): string {
  if (x === null || x === undefined || x === '') return '';
  return String(x);
}

function formatDobJa(dateStr: string): string {
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return dateStr.slice(0, 10);
  return `${y}年${m}月${d}日`;
}

function formatPeriodJa(start?: string | null, end?: string | null): string {
  const fmt = (d: string) => {
    const [y, m] = d.slice(0, 7).split('-').map(Number);
    return `${y}年${m}月`;
  };
  const s = start ? fmt(start) : null;
  const e = end ? fmt(end) : null;
  if (s && e) return `${s} ー ${e}`;
  if (s) return `${s} ー 現在`;
  if (e) return `ー ${e}`;
  return '';
}

function formatDateJa(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y) return dateStr;
  if (d) return `${y}年${m}月${d}日`;
  if (m) return `${y}年${m}月`;
  return `${y}年`;
}

function trunc(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

function padRows<T>(arr: T[] | null | undefined, min: number): (T | null)[] {
  const out: (T | null)[] = [...(arr ?? [])];
  while (out.length < min) out.push(null);
  return out;
}

// ── Styles ────────────────────────────────────────────────────────────────────

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


const S = {
  container: {
    width: '800px',
    margin: '0 auto',
    border: '2px solid #000',
    padding: '20px',
    fontSize: '12px',
    color: '#000',
    boxSizing: 'border-box' as const,
    textTransform: 'uppercase',
  } satisfies React.CSSProperties,

  headerTitle: {
    textAlign: 'center' as const,
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '20px',
    textDecoration: 'underline',
  } satisfies React.CSSProperties,

  photoBox: {
    width: '120px',
    border: '1px solid #000',
    textAlign: 'center' as const,
    float: 'right' as const,
    flexShrink: 0,
  } satisfies React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: '15px',
  } satisfies React.CSSProperties,

  td: {
    border: '1px solid #000',
    padding: '8px',
    verticalAlign: 'top' as const,
  } satisfies React.CSSProperties,

  sectionTitle: {
    backgroundColor: '#f2f2f2',
    fontWeight: 'bold' as const,
    textAlign: 'left' as const,
    border: '1px solid #000',
    padding: '8px',
    verticalAlign: 'top' as const,
  } satisfies React.CSSProperties,
};

// ── Main component ────────────────────────────────────────────────────────────

export default function CandidateCV({
  candidate,
  showSensitiveData = false,
  lang = 'id',
}: CandidateCVProps) {
  void showSensitiveData;

  const [zoom, setZoom] = useState(1.0);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/candidate-cv-print.css';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const c = candidate ?? {};

  const { data: translateConfig } = useQuery<{ enabled: boolean }>({
    queryKey: ['translation-config'],
    queryFn: () => api.get('/superadmin/translation-config').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const autoTranslateEnabled = translateConfig?.enabled === true;

  const { data: layoutConfig } = useQuery<{ layout: string }>({
    queryKey: ['cv-layout'],
    queryFn: () => api.get('/superadmin/cv-layout').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const layout = layoutConfig?.layout ?? 'layout1';

  const { data: fontConfig } = useQuery<{ fontKey: string }>({
    queryKey: ['cv-font'],
    queryFn: () => api.get('/superadmin/cv-font').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const fontKey = fontConfig?.fontKey ?? 'ms-mincho';
  const FONT = FONT_MAP[fontKey] ?? FONT_MAP['ms-mincho'];

  const { data: cvLangConfig } = useQuery<{ mode: string; jaLpkIds: string[] }>({
    queryKey: ['cv-lang-config'],
    queryFn: () => api.get('/superadmin/cv-lang-config').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // Determine if this candidate's LPK is configured for Japanese-only CV.
  // The `lang` prop from the parent can override this (e.g. for PDF generation).
  const lpkId = v(c.lpkId);
  const isJaMode: boolean = lang === 'ja'
    || (cvLangConfig?.mode === 'lpk' && lpkId !== '' && (cvLangConfig.jaLpkIds ?? []).includes(lpkId));

  // Inject Google Fonts link if needed
  useEffect(() => {
    const gf = GOOGLE_FONT_MAP[fontKey];
    if (!gf) return;
    const id = `gfont-${fontKey}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${gf}&display=swap`;
    document.head.appendChild(link);
  }, [fontKey]);

  const [jaOverride, setJaOverride] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!autoTranslateEnabled) {
      setJaOverride({});
      return;
    }

    const fields = [
      { jaKey: 'selfIntroJa',  idKey: 'selfIntroId'  },
      { jaKey: 'motivationJa', idKey: 'motivationId' },
      { jaKey: 'selfPrJa',     idKey: 'selfPrId'     },
      { jaKey: 'hobbiesJa',    idKey: 'hobbies'      },
    ].filter(f => !c[f.jaKey] && c[f.idKey]);

    if (fields.length === 0) return;

    Promise.all(
      fields.map(f =>
        api.post<{ translated: string }>('/translate', { text: c[f.idKey], source: 'id', target: 'ja' })
          .then(r => ({ key: f.jaKey, value: r.data.translated }))
          .catch(() => null)
      )
    ).then(results => {
      const updates: Record<string, string> = {};
      results.forEach(r => { if (r) updates[r.key] = r.value; });
      if (Object.keys(updates).length > 0) setJaOverride(updates);
    });
  }, [autoTranslateEnabled, c.selfIntroId, c.selfIntroJa, c.motivationId, c.motivationJa, c.selfPrId, c.selfPrJa, c.hobbies]); // eslint-disable-line react-hooks/exhaustive-deps

  const getJa = (jaKey: string, idKey: string): string =>
    v(c[jaKey]) || (autoTranslateEnabled ? v(jaOverride[jaKey]) : '') || v(c[idKey]);

  // ── Label helper — returns Japanese-only label in ja mode ─────────────────
  const L = (idLabel: string, jaLabel: string) =>
    isJaMode ? jaLabel : `${idLabel} ・ ${jaLabel}`;

  const age = c.dateOfBirth ? calculateAge(c.dateOfBirth) : null;

  const latestTest =
    Array.isArray(c.tests) && c.tests.length > 0
      ? c.tests[c.tests.length - 1]
      : null;

  const genderLabel = isJaMode
    ? (c.gender === 'M' ? '男性' : c.gender === 'F' ? '女性' : '')
    : (c.gender === 'M' ? 'Laki-laki / 男' : c.gender === 'F' ? 'Perempuan / 女' : '');

  const maritalLabelMap: Record<string, string> = isJaMode
    ? { single: '未婚', married: '既婚', divorced: '離婚', widowed: '死別' }
    : { single: 'Belum Menikah / 未婚', married: 'Menikah / 既婚', divorced: 'Cerai / 離婚', widowed: 'Janda / Duda' };

  const religionLabelMap: Record<string, string> = isJaMode
    ? { Islam: 'イスラム教', Kristen: 'キリスト教（プロテスタント）', Katolik: 'キリスト教（カトリック）', Budha: '仏教', Hindu: 'ヒンドゥー教', Lainnya: 'その他' }
    : { Islam: 'Islam', Kristen: 'Kristen', Katolik: 'Katolik', Budha: 'Budha', Hindu: 'Hindu', Lainnya: 'Lainnya' };

  const addressMasked = (c.address as any)?.masked === true;
  const addressDisplay = addressMasked ? '🔒' : v(c.address);

  const heightDisplay =
    (c.selfReportedHeight ?? c.heightCm) != null
      ? `${c.selfReportedHeight ?? c.heightCm} cm`
      : '';

  const weightDisplay =
    (c.selfReportedWeight ?? c.weightKg) != null
      ? `${c.selfReportedWeight ?? c.weightKg} kg`
      : '';

  const jpLevelDisplay = latestTest
    ? `${v(latestTest.testName)}${latestTest.score != null ? ` / ${latestTest.score}` : ''}`
    : '';

  const japanDisplay = isJaMode
    ? (c.hasVisitedJapan === true ? '有' : c.hasVisitedJapan === false ? '無' : '')
    : (c.hasVisitedJapan === true ? 'Ada（有）' : c.hasVisitedJapan === false ? 'Belum（無）' : '');

  const passportDisplay = isJaMode
    ? (c.hasPassport === true ? '有' : c.hasPassport === false ? '無' : '')
    : (c.hasPassport === true ? 'Ada（有）' : c.hasPassport === false ? 'Tidak（無）' : '');

  const dobStr = c.dateOfBirth ? formatDobJa(c.dateOfBirth) : '';
  const birthDisplay = [v(c.birthPlace), dobStr].filter(Boolean).join('  ');

  const combinedCerts = [
    ...(Array.isArray(c.certifications) ? c.certifications : []).map((cert: any) => ({
      issuedDate: cert.issuedDate ? v(cert.issuedDate).slice(0, 10) : '',
      name: v(cert.certName),
      info: [cert.certLevel, cert.issuedBy].filter(Boolean).join(' / '),
    })),
    ...(Array.isArray(c.tests) ? c.tests : []).map((t: any) => ({
      issuedDate: t.testDate ? v(t.testDate).slice(0, 10) : '',
      name: v(t.testName),
      info: [
        t.score != null ? String(t.score) : null,
        t.pass ? '合格 ✓' : null,
      ].filter(Boolean).join(' '),
    })),
  ];

  const sortedEduHistory = [...(c.educationHistory ?? [])].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0;
  });
  const eduRows    = padRows(sortedEduHistory, 2);
  const sortedCareer = [...(c.career ?? [])].sort((a, b) => {
    const aKey = careerSortKey(a);
    const bKey = careerSortKey(b);
    if (!aKey && !bKey) return 0;
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
  const careerRows = padRows(sortedCareer, 2);
  const certRows   = padRows(combinedCerts, 1);

  const TD = S.td;
  const ST = S.sectionTitle;

  const containerStyle: React.CSSProperties = {
    ...S.container,
    fontFamily: FONT,
    // Japanese CVs don't force-uppercase: proper nouns and dates must render as-is
    textTransform: isJaMode ? 'none' : 'uppercase',
  };

  return (
    <>
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
    <div className="cv-con" style={containerStyle}>

      {/* ── Title ── */}
      <div className="cv-title" style={S.headerTitle}>
        {isJaMode ? '候補者データ' : '候補者データ ・ DATA KANDIDAT'}
      </div>

      {/* ── Photo (float right) + basic info table ── */}
      <div className="cv-info-wrap" style={{ overflow: 'hidden', marginBottom: '15px' }}>
        <div style={layout === 'layout2' ? { ...S.photoBox, height: '150px', overflow: 'hidden' } : S.photoBox}>
          {c.closeupUrl ? (
            <AuthImage
              src={c.closeupUrl}
              alt="foto"
              style={{ width: '120px', height: '150px', objectFit: 'cover', display: 'block' }}
              fallback={<div style={{ height: '150px', lineHeight: '150px', color: '#999' }}>…</div>}
            />
          ) : (
            <div style={{ height: '150px', lineHeight: '150px', color: '#999' }}>Foto</div>
          )}
          {layout === 'layout1' && (
            <div style={{ borderTop: '1px solid #000', padding: '5px 14px' }}>
              <img src={ijbnetLogo} alt="IJBNet" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          )}
        </div>

        <table className="cv-tbl" style={{ ...S.table, width: 'calc(100% - 140px)', float: 'left', marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ ...TD, width: '20%' }}>{L('Nama', '氏名')}</td>
              <td style={TD} colSpan={3}>
                <div>{v(c.fullName)}</div>
                {c.nameKatakana && (
                  <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                    {c.nameKatakana}
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ ...TD, width: '20%' }}>{L('Tempat, Tgl Lahir', '出身地・生年月日')}</td>
              <td style={{ ...TD, width: '30%' }}>{birthDisplay}</td>
              <td style={{ ...TD, width: '20%' }}>{L('Jenis Kelamin', '性別')}</td>
              <td style={TD}>{genderLabel}</td>
            </tr>
            <tr>
              <td style={TD}>{L('Usia', '年齢')}</td>
              <td style={TD}>{age !== null ? `${age}歳` : ''}</td>
              <td style={TD}>{L('Agama', '宗教')}</td>
              <td style={TD}>{c.religion ? (religionLabelMap[c.religion] ?? v(c.religion)) : ''}</td>
            </tr>
            <tr>
              <td style={TD}>{L('Gol. Darah', '血液型')}</td>
              <td style={TD}>{v(c.bloodType)}</td>
              <td style={TD}>{L('Status Nikah', '婚姻歴')}</td>
              <td style={TD}>
                {c.maritalStatus ? (maritalLabelMap[c.maritalStatus] ?? v(c.maritalStatus)) : ''}
              </td>
            </tr>
            <tr>
              <td style={TD}>{L('Tinggi', '身長')}</td>
              <td style={TD}>{heightDisplay}</td>
              <td style={TD}>{L('Berat', '体重')}</td>
              <td style={TD}>{weightDisplay}</td>
            </tr>
            <tr>
              <td style={TD}>{L('Level JP', '日本語レベル')}</td>
              <td style={TD} colSpan={3}>{jpLevelDisplay}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Japan / Passport / Address ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={{ ...TD, width: '25%' }}>{L('Pernah ke Jepang', '日本滞在経験')}</td>
            <td style={{ ...TD, width: '25%' }}>{japanDisplay}</td>
            <td style={{ ...TD, width: '25%' }}>{L('Paspor / Visa', 'パスポート／ビザ')}</td>
            <td style={{ ...TD, width: '25%' }}>{passportDisplay}</td>
          </tr>
          <tr>
            <td style={TD}>{L('Alamat', '現住所')}</td>
            <td style={TD} colSpan={3}>{addressDisplay}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Pendidikan ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={ST} colSpan={3}>{L('Pendidikan', '学歴')}</td>
          </tr>
          <tr style={{ textAlign: 'center' }}>
            <td style={{ ...TD, width: '30%' }}>{L('Periode', '期間')}</td>
            <td style={{ ...TD, width: '40%' }}>{L('Nama Sekolah', '学校名')}</td>
            <td style={{ ...TD, width: '30%' }}>{L('Jurusan', '専攻')}</td>
          </tr>
          {eduRows.map((row, i) =>
            row ? (
              <tr className="cv-row-sm" key={(row as any).id ?? i}>
                <td style={{ ...TD, height: '25px' }}>
                  {isJaMode
                    ? formatPeriodJa((row as any).startDate, (row as any).endDate)
                    : formatPeriod((row as any).startDate, (row as any).endDate)}
                </td>
                <td style={TD}>{v((row as any).schoolName)}</td>
                <td style={TD}>{v((row as any).major)}</td>
              </tr>
            ) : (
              <tr className="cv-row-sm" key={`edu-${i}`}>
                <td style={{ ...TD, height: '25px' }} />
                <td style={TD} />
                <td style={TD} />
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* ── Pengalaman Kerja ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={ST} colSpan={3}>{L('Pengalaman Kerja', '職歴')}</td>
          </tr>
          <tr style={{ textAlign: 'center' }}>
            <td style={{ ...TD, width: '30%' }}>{L('Periode', '期間')}</td>
            <td style={{ ...TD, width: '30%' }}>{L('Nama Perusahaan', '会社名')}</td>
            <td style={{ ...TD, width: '40%' }}>{L('Uraian Pekerjaan', '業務内容')}</td>
          </tr>
          {careerRows.map((row, i) =>
            row ? (
              <React.Fragment key={(row as any).id ?? i}>
                <tr className="cv-row-md">
                  <td style={{ ...TD, height: '40px' }}>
                    {isJaMode
                      ? (formatPeriodJa((row as any).startDate, (row as any).endDate) || v((row as any).period))
                      : v((row as any).period)}
                  </td>
                  <td style={TD}>{v((row as any).companyName)}</td>
                  <td style={TD}>
                    {v((row as any).divisionJa) || v((row as any).skillGroupJa) || v((row as any).division) || v((row as any).skillGroup)}
                  </td>
                </tr>
                {(row as any).companyBusinessActivity && (
                  <tr>
                    <td style={{ ...TD, fontSize: '11px', color: '#555' }}>{L('Keg. Usaha', '事業内容')}</td>
                    <td style={{ ...TD, fontSize: '11px' }} colSpan={2}>{v((row as any).companyBusinessActivity)}</td>
                  </tr>
                )}
              </React.Fragment>
            ) : (
              <tr className="cv-row-md" key={`career-${i}`}>
                <td style={{ ...TD, height: '40px' }} />
                <td style={TD} />
                <td style={TD} />
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* ── Sertifikasi ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={ST} colSpan={3}>{L('Sertifikasi', '資格・公的認定')}</td>
          </tr>
          <tr style={{ textAlign: 'center' }}>
            <td style={{ ...TD, width: '20%' }}>{L('Tgl Penerbitan', '発行日')}</td>
            <td style={{ ...TD, width: '40%' }}>{L('Nama Sertifikat', '名称')}</td>
            <td style={{ ...TD, width: '40%' }}>{L('Level, Keterangan', 'レベルや詳細')}</td>
          </tr>
          {certRows.map((row, i) =>
            row ? (
              <tr key={i}>
                <td style={{ ...TD, height: '25px' }}>
                  {isJaMode ? formatDateJa((row as any).issuedDate) : (row as any).issuedDate}
                </td>
                <td style={TD}>{(row as any).name}</td>
                <td style={TD}>{(row as any).info}</td>
              </tr>
            ) : (
              <tr className="cv-row-sm" key={`cert-${i}`}>
                <td style={{ ...TD, height: '25px' }} />
                <td style={TD} />
                <td style={TD} />
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* ── Skill ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={ST}>
              {isJaMode ? '技能' : (
                <>
                  Skill ・ 技能
                  <span style={{ fontWeight: 'normal', fontSize: '11px' }}>
                    {' '}(Keahlian yang berhubungan dengan bidang yang dilamar)
                  </span>
                </>
              )}
            </td>
          </tr>
          <tr className="cv-row-md">
            <td style={{ ...TD, height: '60px', whiteSpace: 'pre-wrap' }}>
              {trunc(getJa('selfPrJa', 'selfPrId'), 300)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Promosi Diri ── */}
      <table className="cv-tbl" style={{ ...S.table, marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={ST}>{L('Promosi Diri', '自己PR')}</td>
            {layout === 'layout2' && (
              <td style={{ ...TD, width: '100px', border: '1px solid #000', textAlign: 'center', verticalAlign: 'middle', padding: '6px 10px' }} rowSpan={2}>
                <img src={ijbnetLogo} alt="IJBNet" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </td>
            )}
          </tr>
          <tr className="cv-row-lg">
            <td style={{ ...TD, height: '100px', whiteSpace: 'pre-wrap' }}>
              {trunc(getJa('selfIntroJa', 'selfIntroId'), 400)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
      </div>
    </>
  );
}
