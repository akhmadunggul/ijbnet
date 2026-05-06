import React from 'react';

export interface CandidateCVProps {
  candidate: any;
  showSensitiveData?: boolean;
  lang?: 'id' | 'ja';
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

const FONT = '"MS Mincho", serif';

const PRINT_CSS = `
  @media print {
    body { margin: 0 !important; padding: 0 !important; }
    .no-print { display: none !important; }

    .cv-con {
      padding: 6px 10px !important;
      font-size: 12px !important;
      border-width: 1px !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .cv-title {
      font-size: 14px !important;
      margin-bottom: 8px !important;
    }

    .cv-tbl { margin-bottom: 4px !important; }

    .cv-con td, .cv-con th {
      padding: 3px 4px !important;
      font-size: 12px !important;
    }

    .cv-row-sm { height: 18px !important; min-height: 0 !important; }
    .cv-row-md { height: 24px !important; min-height: 0 !important; }
    .cv-row-lg { height: 32px !important; min-height: 0 !important; }

    .cv-info-wrap { margin-bottom: 4px !important; }
  }
  @page { size: A4 portrait; margin: 5mm; }
`;

const S = {
  container: {
    width: '800px',
    margin: '0 auto',
    border: '2px solid #000',
    padding: '20px',
    fontFamily: FONT,
    fontSize: '12px',
    color: '#000',
    boxSizing: 'border-box' as const,
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
    height: '150px',
    border: '1px solid #000',
    textAlign: 'center' as const,
    lineHeight: '150px',
    float: 'right' as const,
    overflow: 'hidden',
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
  void lang;

  const c = candidate ?? {};

  const age = c.dateOfBirth ? calculateAge(c.dateOfBirth) : null;

  const latestTest =
    Array.isArray(c.tests) && c.tests.length > 0
      ? c.tests[c.tests.length - 1]
      : null;

  const genderLabel =
    c.gender === 'M' ? 'Laki-laki / 男' :
    c.gender === 'F' ? 'Perempuan / 女' : '';

  const maritalLabel: Record<string, string> = {
    single:   'Belum Menikah / 未婚',
    married:  'Menikah / 既婚',
    divorced: 'Cerai / 離婚',
    widowed:  'Janda / Duda',
  };

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

  const japanDisplay =
    c.hasVisitedJapan === true  ? 'Ada（有）' :
    c.hasVisitedJapan === false ? 'Belum（無）' : '';

  const passportDisplay =
    c.hasPassport === true  ? 'Ada（有）' :
    c.hasPassport === false ? 'Tidak（無）' : '';

  const dobStr = c.dateOfBirth ? c.dateOfBirth.slice(0, 10) : '';
  const birthDisplay = [v(c.birthPlace), dobStr].filter(Boolean).join(', ');

  // Merge certifications + tests into one list
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

  const eduRows    = padRows(c.educationHistory, 2);
  const careerRows = padRows(c.career, 2);
  const certRows   = padRows(combinedCerts, 1);

  const TD = S.td;
  const ST = S.sectionTitle;

  return (
    <div className="cv-con" style={S.container}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── Title ── */}
      <div className="cv-title" style={S.headerTitle}>候補者データ ・ DATA KANDIDAT</div>

      {/* ── Photo (float right) + basic info table (float left) ── */}
      <div className="cv-info-wrap" style={{ overflow: 'hidden', marginBottom: '15px' }}>
        <div style={S.photoBox}>
          {c.closeupUrl ? (
            <img
              src={c.closeupUrl}
              alt="foto"
              style={{ width: '120px', height: '150px', objectFit: 'cover', display: 'block', lineHeight: 'normal' }}
            />
          ) : (
            'Foto'
          )}
        </div>

        <table className="cv-tbl" style={{ ...S.table, width: 'calc(100% - 140px)', float: 'left', marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ ...TD, width: '20%' }}>Nama<br />氏名</td>
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
              <td style={{ ...TD, width: '20%' }}>
                Tempat, Tanggal Lahir<br />出身地 生年月日
              </td>
              <td style={{ ...TD, width: '30%' }}>{birthDisplay}</td>
              <td style={{ ...TD, width: '20%' }}>Jenis Kelamin<br />性別</td>
              <td style={TD}>{genderLabel}</td>
            </tr>
            <tr>
              <td style={TD}>Usia<br />年齢</td>
              <td style={TD}>{age !== null ? `${age} tahun` : ''}</td>
              <td style={TD}>Agama<br />宗教</td>
              <td style={TD}>{v(c.religion)}</td>
            </tr>
            <tr>
              <td style={TD}>Golongan Darah<br />血液型</td>
              <td style={TD}>{v(c.bloodType)}</td>
              <td style={TD}>Status Pernikahan<br />結婚歴</td>
              <td style={TD}>
                {c.maritalStatus ? (maritalLabel[c.maritalStatus] ?? v(c.maritalStatus)) : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Height / Weight / JP Level ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={{ ...TD, width: '16%' }}>Tinggi Badan<br />身長</td>
            <td style={{ ...TD, width: '17%' }}>{heightDisplay}</td>
            <td style={{ ...TD, width: '16%' }}>Berat Badan<br />体重</td>
            <td style={{ ...TD, width: '17%' }}>{weightDisplay}</td>
            <td style={{ ...TD, width: '16%' }}>日本レベル<br />Level Jepang</td>
            <td style={{ ...TD, width: '18%' }}>{jpLevelDisplay}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Japan / Passport / Address / Hobi ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={{ ...TD, width: '25%' }}>
              Pernah ke Jepang<br />日本滞在経験
            </td>
            <td style={{ ...TD, width: '25%' }}>{japanDisplay}</td>
            <td style={{ ...TD, width: '25%' }}>
              Pernah Memiliki (Paspor/Visa)<br />ビザ・パスポートの有無
            </td>
            <td style={{ ...TD, width: '25%' }}>{passportDisplay}</td>
          </tr>
          <tr>
            <td style={TD}>Alamat Tinggal Saat Ini<br />現住所</td>
            <td style={TD} colSpan={3}>{addressDisplay}</td>
          </tr>
          <tr>
            <td style={TD}>Hobi<br />趣味</td>
            <td style={TD} colSpan={3}>{v(c.hobbies)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Pendidikan ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={ST} colSpan={3}>Pendidikan ・ 学歴</td>
          </tr>
          <tr style={{ textAlign: 'center' }}>
            <td style={{ ...TD, width: '30%' }}>Periode<br />期間</td>
            <td style={{ ...TD, width: '40%' }}>Nama Sekolah<br />学校名</td>
            <td style={{ ...TD, width: '30%' }}>Jurusan<br />専攻</td>
          </tr>
          {eduRows.map((row, i) =>
            row ? (
              <tr className="cv-row-sm" key={(row as any).id ?? i}>
                <td style={{ ...TD, height: '25px' }}>
                  {formatPeriod((row as any).startDate, (row as any).endDate)}
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
            <td style={ST} colSpan={3}>Pengalaman Kerja ・ 職歴</td>
          </tr>
          <tr style={{ textAlign: 'center' }}>
            <td style={{ ...TD, width: '30%' }}>Periode<br />期間</td>
            <td style={{ ...TD, width: '30%' }}>Nama Perusahaan<br />会社名</td>
            <td style={{ ...TD, width: '40%' }}>Uraian Pekerjaan<br />業務内容</td>
          </tr>
          {careerRows.map((row, i) =>
            row ? (
              <tr className="cv-row-md" key={(row as any).id ?? i}>
                <td style={{ ...TD, height: '40px' }}>{v((row as any).period)}</td>
                <td style={TD}>{v((row as any).companyName)}</td>
                <td style={TD}>
                  {v((row as any).division) || v((row as any).skillGroup)}
                </td>
              </tr>
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
            <td style={ST} colSpan={3}>Sertifikasi ・ 資格・公的認定</td>
          </tr>
          <tr style={{ textAlign: 'center' }}>
            <td style={{ ...TD, width: '20%' }}>Tanggal Penerbitan<br />発行日</td>
            <td style={{ ...TD, width: '40%' }}>Nama Sertifikat<br />名称</td>
            <td style={{ ...TD, width: '40%' }}>Level, Keterangan<br />レベルや詳細</td>
          </tr>
          {certRows.map((row, i) =>
            row ? (
              <tr key={i}>
                <td style={{ ...TD, height: '25px' }}>{(row as any).issuedDate}</td>
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
              Skill ・ 技能
              <span style={{ fontWeight: 'normal', fontSize: '11px' }}>
                {' '}(Keahlian yang berhubungan dengan bidang yang dilamar)
              </span>
            </td>
          </tr>
          <tr className="cv-row-md">
            <td style={{ ...TD, height: '40px', whiteSpace: 'pre-wrap' }}>
              {trunc(v(c.selfIntroId), 200)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Motivasi ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={ST}>
              Motivasi ingin bekerja di Jepang<br />
              志望理由
            </td>
          </tr>
          <tr className="cv-row-lg">
            <td style={{ ...TD, height: '50px', whiteSpace: 'pre-wrap' }}>
              {trunc(v(c.motivationId), 300)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Alasan Melamar ── */}
      <table className="cv-tbl" style={S.table}>
        <tbody>
          <tr>
            <td style={ST}>
              Alasan Melamar Pekerjaan Ini<br />
              応募の動機
            </td>
          </tr>
          <tr className="cv-row-lg">
            <td style={{ ...TD, height: '50px', whiteSpace: 'pre-wrap' }}>
              {trunc(v(c.applyReasonId), 300)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Promosi Diri ── */}
      <table className="cv-tbl" style={{ ...S.table, marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={ST}>Promosi Diri<br />自己PR</td>
          </tr>
          <tr className="cv-row-lg">
            <td style={{ ...TD, height: '60px', whiteSpace: 'pre-wrap' }}>
              {trunc(v(c.selfPrId), 300)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
