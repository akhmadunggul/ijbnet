import React from 'react';

export interface CandidateCVProps {
  candidate: any;
  showSensitiveData?: boolean;
  lang?: 'id' | 'ja';
}

// ── Exported helpers (used by CandidateCVPage) ────────────────────────────────

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
  return '—';
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function v(x: unknown): string {
  if (x === null || x === undefined || x === '') return '—';
  return String(x);
}

function padRows<T>(arr: T[] | null | undefined, min: number): (T | null)[] {
  const out: (T | null)[] = [...(arr ?? [])];
  while (out.length < min) out.push(null);
  return out;
}

function Chk({ checked }: { checked: boolean }) {
  return <span style={{ fontSize: '10px' }}>{checked ? '☑' : '☐'}</span>;
}

// ── Shared style tokens ───────────────────────────────────────────────────────

const FONT = "'Noto Sans JP', 'Noto Sans', 'Hiragino Kaku Gothic Pro', Arial, sans-serif";

const PRINT_CSS = `
  @media print {
    body { margin: 0 !important; padding: 0 !important; }
    .no-print { display: none !important; }
    .cv-wrapper { border: none !important; }
  }
  @page { size: A4 portrait; margin: 0; }
`;

// label cell (left side of each row)
const LBL: React.CSSProperties = {
  background: '#f0f0f0',
  padding: '3px 5px',
  fontSize: '7.5px',
  color: '#333',
  borderRight: '0.5px solid #ccc',
};

// smaller label (for long bilingual labels that don't fit at 7.5px)
const LBL_XS: React.CSSProperties = { ...LBL, fontSize: '6.8px' };

// value cell (right side of each row)
const VAL: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: '9.5px',
};

const ROW_BORDER: React.CSSProperties = { borderBottom: '0.5px solid #ccc' };

// table cells
const TH = (width?: number | string): React.CSSProperties => ({
  border: '0.5px solid #ddd',
  padding: '3px 6px',
  textAlign: 'left',
  fontWeight: 600,
  background: '#f5f5f5',
  fontSize: '8px',
  ...(width != null ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
});

const TD: React.CSSProperties = {
  border: '0.5px solid #ddd',
  padding: '3px 6px',
  fontSize: '9px',
  height: '18px',
};

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      background: '#ddd',
      textAlign: 'center',
      fontWeight: 700,
      padding: '3px 0',
      borderTop: '1px solid #999',
      borderBottom: '1px solid #999',
      fontSize: '9px',
      letterSpacing: '0.02em',
    }}>
      {title}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CandidateCV({
  candidate,
  showSensitiveData = false,
  lang = 'id',
}: CandidateCVProps) {
  void showSensitiveData; // reserved for future caller use
  void lang;

  const c = candidate ?? {};

  const age = c.dateOfBirth ? calculateAge(c.dateOfBirth) : null;
  const latestTest = Array.isArray(c.tests) && c.tests.length > 0
    ? c.tests[c.tests.length - 1]
    : null;

  // Merge certifications + tests into one list for section 7
  const combinedCerts = [
    ...(Array.isArray(c.certifications) ? c.certifications : []).map((cert: any) => ({
      issuedDate: cert.issuedDate,
      name: cert.certName,
      info: [cert.certLevel, cert.issuedBy].filter(Boolean).join(' / '),
    })),
    ...(Array.isArray(c.tests) ? c.tests : []).map((t: any) => ({
      issuedDate: t.testDate,
      name: t.testName,
      info: [
        t.score != null ? String(t.score) : null,
        t.pass ? '合格 ✓' : null,
      ].filter(Boolean).join(' '),
    })),
  ];

  const eduRows    = padRows(c.educationHistory, 4);
  const careerRows = padRows(c.career, 4);
  const certRows   = padRows(combinedCerts, 4);

  // Resolve address: may be a masked object for recruiter view
  const addressStr = typeof c.address === 'string' ? c.address : null;
  const addressMasked = (c.address as any)?.masked === true;
  const cityStr = addressStr ? addressStr.split(',')[0].trim() : '—';

  return (
    <div
      className="cv-wrapper"
      style={{
        width: '794px',
        maxHeight: '1123px',
        border: '1px solid #999',
        fontFamily: FONT,
        fontSize: '9.5px',
        background: '#fff',
        margin: '0 auto',
        boxSizing: 'border-box',
        overflow: 'hidden',
        lineHeight: 1.4,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── TITLE ROW ─────────────────────────────────────────────────────── */}
      <div style={{
        fontSize: '12px',
        fontWeight: 700,
        padding: '6px 10px',
        borderBottom: '1.5px solid #111',
        letterSpacing: '0.04em',
      }}>
        候補者データ・DATA KANDIDAT
      </div>

      {/* ── TOP SECTION: 3-column grid ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', borderBottom: '1px solid #aaa' }}>

        {/* LEFT COLUMN — 6 rows, gridTemplateColumns: 90px 1fr each */}
        <div style={{ borderRight: '1px solid #aaa' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', ...ROW_BORDER }}>
            <div style={LBL}>日本語レベル</div>
            <div style={VAL}>
              {latestTest
                ? `${v(latestTest.testName)}${latestTest.score != null ? ` / ${latestTest.score}` : ''}`
                : '—'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', ...ROW_BORDER }}>
            <div style={LBL}>名前・Nama</div>
            <div style={VAL}>
              <div style={{ fontWeight: 600 }}>{v(c.fullName)}</div>
              {c.nameKatakana && (
                <div style={{ fontSize: '8px', color: '#555' }}>{c.nameKatakana}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', ...ROW_BORDER }}>
            <div style={LBL_XS}>出身地・生年月日 / Tempat, Tanggal Lahir</div>
            <div style={VAL}>
              <div>{addressMasked ? '🔒' : cityStr}</div>
              <div style={{ fontSize: '8.5px', color: '#444' }}>
                {c.dateOfBirth ? c.dateOfBirth.slice(0, 10) : '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', ...ROW_BORDER }}>
            <div style={LBL}>性別・Jenis Kelamin</div>
            <div style={VAL}>
              {c.gender === 'M' ? 'Laki-laki（男）' : c.gender === 'F' ? 'Perempuan（女）' : '—'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', ...ROW_BORDER }}>
            <div style={LBL}>年齢・Usia</div>
            <div style={VAL}>{age !== null ? `${age} tahun` : '—'}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr' }}>
            <div style={LBL}>血液型・Golongan Darah</div>
            <div style={VAL}>{c.bloodType ?? '—'}</div>
          </div>
        </div>

        {/* MIDDLE COLUMN — 6 rows, gridTemplateColumns: 100px 1fr each */}
        <div style={{ borderRight: '1px solid #aaa' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', ...ROW_BORDER }}>
            <div style={LBL}>身長・Tinggi Badan</div>
            <div style={VAL}>
              {(c.selfReportedHeight ?? c.heightCm) != null
                ? `${c.selfReportedHeight ?? c.heightCm} cm`
                : '—'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', ...ROW_BORDER }}>
            <div style={LBL}>体重・Berat Badan</div>
            <div style={VAL}>
              {(c.selfReportedWeight ?? c.weightKg) != null
                ? `${c.selfReportedWeight ?? c.weightKg} kg`
                : '—'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', ...ROW_BORDER }}>
            <div style={LBL_XS}>配偶者 / Status Pernikahan</div>
            <div style={{ ...VAL, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span><Chk checked={c.maritalStatus === 'married'} /> Menikah（既婚）</span>
              <span><Chk checked={c.maritalStatus !== 'married'} /> Belum Menikah（未婚）</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', ...ROW_BORDER }}>
            <div style={LBL}>宗教・Agama</div>
            <div style={{ ...VAL, display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
              {(['Islam', 'Kristen', 'Katolik', 'Budha', 'Hindu'] as const).map((r) => (
                <span key={r}><Chk checked={c.religion === r} /> {r}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', ...ROW_BORDER }}>
            <div style={LBL_XS}>訪日経験 / Pernah ke Jepang</div>
            <div style={{ ...VAL, display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span><Chk checked={!!c.hasVisitedJapan} /> Ada（有）</span>
              <span><Chk checked={!c.hasVisitedJapan} /> Belum（無）</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
            <div style={LBL_XS}>旅券の有無 / Pernah Memiliki Paspor</div>
            <div style={{ ...VAL, display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span><Chk checked={!!c.hasPassport} /> Ada（有）</span>
              <span><Chk checked={!c.hasPassport} /> Tidak（無）</span>
            </div>
          </div>
        </div>

        {/* PHOTO COLUMN — 90px wide */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 4px',
        }}>
          {c.closeupUrl ? (
            <img
              src={c.closeupUrl}
              alt="foto"
              style={{ width: '70px', height: '90px', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '70px',
              height: '90px',
              border: '1px solid #999',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontSize: '7.5px',
              color: '#999',
              lineHeight: 1.5,
            }}>
              写真 / Foto<br />3×4
            </div>
          )}
          <div style={{ fontSize: '8px', color: 'red', textAlign: 'center', marginTop: '4px' }}>
            写真・Foto
          </div>
        </div>
      </div>

      {/* ── ADDRESS + HOBI ROW ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '0.5px solid #ccc' }}>
        <div style={{ padding: '3px 6px', borderRight: '0.5px solid #ccc' }}>
          <div style={{ fontSize: '7.5px', color: '#555', marginBottom: '2px' }}>
            現住所・Alamat Tinggal Saat Ini
          </div>
          <div style={{ borderBottom: '1px dotted #999', paddingBottom: '2px', minHeight: '16px', fontSize: '9px' }}>
            {addressMasked ? '🔒' : v(c.address)}
          </div>
        </div>
        <div style={{ padding: '3px 6px' }}>
          <div style={{ fontSize: '7.5px', color: '#555', marginBottom: '2px' }}>趣味・Hobi</div>
          <div style={{ borderBottom: '1px dotted #999', paddingBottom: '2px', minHeight: '16px', fontSize: '9px' }}>
            {v(c.hobbies)}
          </div>
        </div>
      </div>

      {/* ── 学歴・Pendidikan ──────────────────────────────────────────────── */}
      <SectionHeader title="学歴・Pendidikan" />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH(140)}>期間・Periode</th>
            <th style={TH()}>学校名・Nama Sekolah</th>
            <th style={TH(160)}>専攻・Jurusan</th>
          </tr>
        </thead>
        <tbody>
          {eduRows.map((row, i) =>
            row ? (
              <tr key={(row as any).id ?? i}>
                <td style={TD}>{formatPeriod((row as any).startDate, (row as any).endDate)}</td>
                <td style={TD}>{v((row as any).schoolName)}</td>
                <td style={TD}>{v((row as any).major)}</td>
              </tr>
            ) : (
              <tr key={`edu-${i}`}>
                <td style={TD} /><td style={TD} /><td style={TD} />
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* ── 職歴・Pengalaman Kerja ────────────────────────────────────────── */}
      <SectionHeader title="職歴・Pengalaman Kerja" />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH(140)}>期間・Periode</th>
            <th style={TH()}>会社名・Nama Perusahaan</th>
            <th style={TH()}>職種・Uraian Pekerjaan</th>
          </tr>
        </thead>
        <tbody>
          {careerRows.map((row, i) =>
            row ? (
              <tr key={(row as any).id ?? i}>
                <td style={TD}>{v((row as any).period)}</td>
                <td style={TD}>{v((row as any).companyName)}</td>
                <td style={TD}>
                  {v((row as any).division) !== '—'
                    ? v((row as any).division)
                    : v((row as any).skillGroup)}
                </td>
              </tr>
            ) : (
              <tr key={`career-${i}`}>
                <td style={TD} /><td style={TD} /><td style={TD} />
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* ── 認定・Sertifikasi ─────────────────────────────────────────────── */}
      <SectionHeader title="認定・Sertifikasi" />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH(120)}>発行日・Tanggal Penerbitan</th>
            <th style={TH()}>件名・Nama Sertifikat</th>
            <th style={TH(200)}>レベルや情報</th>
          </tr>
        </thead>
        <tbody>
          {certRows.map((row, i) =>
            row ? (
              <tr key={i}>
                <td style={TD}>
                  {(row as any).issuedDate ? v((row as any).issuedDate).slice(0, 10) : '—'}
                </td>
                <td style={TD}>{v((row as any).name)}</td>
                <td style={TD}>{v((row as any).info)}</td>
              </tr>
            ) : (
              <tr key={`cert-${i}`}>
                <td style={TD} /><td style={TD} /><td style={TD} />
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* ── 得意なこと・自己PR / Keahlian & Motivasi ─────────────────────── */}
      <SectionHeader title="得意なこと・自己PR / Keahlian & Motivasi" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ borderRight: '0.5px solid #ccc', borderBottom: '0.5px solid #ccc' }}>
          <div style={{ ...LBL, display: 'block', borderRight: 'none', borderBottom: '0.5px solid #ccc' }}>
            得意なこと / Keahlian (Bahasa Indonesia)
          </div>
          <div style={{ padding: '3px 6px', minHeight: '30px', fontSize: '9px', whiteSpace: 'pre-wrap' }}>
            {v(c.selfPrId)}
          </div>
        </div>
        <div style={{ borderBottom: '0.5px solid #ccc' }}>
          <div style={{ ...LBL, display: 'block', borderRight: 'none', borderBottom: '0.5px solid #ccc' }}>
            自己PR / Keahlian (日本語)
          </div>
          <div style={{ padding: '3px 6px', minHeight: '30px', fontSize: '9px', whiteSpace: 'pre-wrap' }}>
            {v(c.selfPrJa)}
          </div>
        </div>
        <div style={{ borderRight: '0.5px solid #ccc' }}>
          <div style={{ ...LBL, display: 'block', borderRight: 'none', borderBottom: '0.5px solid #ccc' }}>
            志望動機 / Motivasi (Bahasa Indonesia)
          </div>
          <div style={{ padding: '3px 6px', minHeight: '30px', fontSize: '9px', whiteSpace: 'pre-wrap' }}>
            {v(c.motivationId)}
          </div>
        </div>
        <div>
          <div style={{ ...LBL, display: 'block', borderRight: 'none', borderBottom: '0.5px solid #ccc' }}>
            志望動機 (日本語)
          </div>
          <div style={{ padding: '3px 6px', minHeight: '30px', fontSize: '9px', whiteSpace: 'pre-wrap' }}>
            {v(c.motivationJa)}
          </div>
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '3px 8px',
        fontSize: '7.5px',
        color: '#888',
        borderTop: '0.5px solid #ddd',
        textAlign: 'right',
        letterSpacing: '0.02em',
      }}>
        {v(c.candidateCode)} — IJBNet
      </div>
    </div>
  );
}
