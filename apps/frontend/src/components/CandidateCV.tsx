import React from 'react';

export interface CandidateCVProps {
  candidate: any;
  showSensitiveData?: boolean;
  lang?: 'id' | 'ja';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function formatPeriod(start?: string | null, end?: string | null): string {
  const s = start ? start.slice(0, 7) : null;
  const e = end ? end.slice(0, 7) : null;
  if (s && e) return `${s} – ${e}`;
  if (s) return `${s} –`;
  if (e) return `– ${e}`;
  return '—';
}

function v(x: unknown): string {
  if (x === null || x === undefined || x === '') return '—';
  return String(x);
}

function Chk({ checked }: { checked: boolean | null | undefined }) {
  return <span style={{ fontSize: '1.1em', lineHeight: 1 }}>{checked ? '☑' : '☐'}</span>;
}

function padRows<T>(arr: T[] | null | undefined, min: number): (T | null)[] {
  const out: (T | null)[] = [...(arr ?? [])];
  while (out.length < min) out.push(null);
  return out;
}

// ── Labels ────────────────────────────────────────────────────────────────────

const LABELS = {
  id: {
    title: 'Curriculum Vitae',
    code: 'Kode Kandidat',
    s1: '1. Data Pribadi',
    s2: '2. Kontak',
    s3: '3. Informasi SSW',
    s4: '4. Riwayat Pendidikan',
    s5: '5. Riwayat Pekerjaan',
    s6: '6. Kemampuan Bahasa Jepang',
    s7: '7. Sertifikasi & Lisensi',
    s8: '8. PR & Motivasi',
    s9: '9. Rencana Kerja & Keluarga',
    fullName: 'Nama Lengkap',
    katakana: 'Nama (Katakana)',
    gender: 'Jenis Kelamin',
    dob: 'Tanggal Lahir',
    age: 'Umur',
    blood: 'Golongan Darah',
    religion: 'Agama',
    height: 'Tinggi (cm)',
    weight: 'Berat (kg)',
    selfHeight: 'Tinggi Mandiri',
    selfWeight: 'Berat Mandiri',
    passport: 'Paspor',
    visitedJapan: 'Pernah ke Jepang',
    hobbies: 'Hobi',
    nik: 'NIK',
    email: 'Email',
    phone: 'Telepon',
    address: 'Alamat',
    kubun: 'Tipe SSW',
    sectorId: 'Bidang (ID)',
    fieldId: 'Pekerjaan (ID)',
    sectorJa: 'Bidang (JA)',
    fieldJa: 'Pekerjaan (JA)',
    jobCat: 'Kategori Pekerjaan',
    jpStudy: 'Durasi Belajar Jepang',
    highestEdu: 'Pendidikan Terakhir',
    school: 'Sekolah / Kampus',
    major: 'Jurusan',
    period: 'Periode',
    company: 'Perusahaan',
    division: 'Divisi',
    skillGroup: 'Kelompok Keahlian',
    testName: 'Nama Tes',
    score: 'Nilai',
    pass: 'Lulus',
    testDate: 'Tanggal',
    certName: 'Nama Sertifikat',
    certLevel: 'Level',
    issuedDate: 'Tanggal Terbit',
    issuedBy: 'Diterbitkan oleh',
    selfPr: 'Keahlian / 得意',
    motivation: 'Motivasi / 志望理由',
    applyReason: 'Alasan Melamar / 応募の動機',
    selfIntro: 'Promosi Diri / 自己PR',
    colId: 'Bahasa Indonesia',
    colJa: '日本語',
    duration: 'Durasi Rencana',
    goal: 'Tujuan',
    after: 'Rencana Setelah Kembali',
    expectation: 'Harapan',
    marital: 'Status Pernikahan',
    spouse: 'Info Pasangan',
    children: 'Jumlah Anak',
    accompany: 'Membawa Keluarga',
    gM: 'Laki-laki',
    gF: 'Perempuan',
    yes: 'Ya',
    no: 'Tidak',
    masked: '🔒 Dilindungi',
  },
  ja: {
    title: '履歴書',
    code: '候補者コード',
    s1: '1. 個人情報',
    s2: '2. 連絡先',
    s3: '3. SSW情報',
    s4: '4. 学歴',
    s5: '5. 職歴',
    s6: '6. 日本語能力',
    s7: '7. 資格・認定',
    s8: '8. PRと志望動機',
    s9: '9. 就労計画・家族情報',
    fullName: '氏名',
    katakana: '氏名（カタカナ）',
    gender: '性別',
    dob: '生年月日',
    age: '年齢',
    blood: '血液型',
    religion: '宗教',
    height: '身長（cm）',
    weight: '体重（kg）',
    selfHeight: '自己申告身長',
    selfWeight: '自己申告体重',
    passport: 'パスポート',
    visitedJapan: '日本渡航経験',
    hobbies: '趣味',
    nik: 'NIK（身分証番号）',
    email: 'メールアドレス',
    phone: '電話番号',
    address: '住所',
    kubun: 'SSW区分',
    sectorId: '分野（インドネシア語）',
    fieldId: '職種（インドネシア語）',
    sectorJa: '分野（日本語）',
    fieldJa: '職種（日本語）',
    jobCat: '職種カテゴリ',
    jpStudy: '日本語学習期間',
    highestEdu: '最終学歴',
    school: '学校名',
    major: '専攻',
    period: '期間',
    company: '会社名',
    division: '部署',
    skillGroup: 'スキルグループ',
    testName: 'テスト名',
    score: 'スコア',
    pass: '合否',
    testDate: '受験日',
    certName: '資格名',
    certLevel: 'レベル',
    issuedDate: '取得日',
    issuedBy: '発行機関',
    selfPr: '得意なこと',
    motivation: '志望理由',
    applyReason: '応募の動機',
    selfIntro: '自己PR',
    colId: 'インドネシア語',
    colJa: '日本語',
    duration: '就労計画期間',
    goal: '目標',
    after: '帰国後の計画',
    expectation: '期待すること',
    marital: '婚姻状況',
    spouse: '配偶者情報',
    children: '子どもの人数',
    accompany: '家族帯同',
    gM: '男性',
    gF: '女性',
    yes: 'あり',
    no: 'なし',
    masked: '🔒 保護中',
  },
};

// ── Shared style tokens ───────────────────────────────────────────────────────

const FONT = "'Noto Sans JP', 'Noto Sans', 'Hiragino Kaku Gothic Pro', Arial, sans-serif";

const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: FONT,
    fontSize: '11px',
    lineHeight: 1.5,
    color: '#1a1a1a',
    background: '#fff',
    padding: '24px',
    maxWidth: '794px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  sectionHeader: {
    background: '#1e3a5f',
    color: '#fff',
    fontWeight: 700,
    fontSize: '12px',
    padding: '4px 10px',
    marginTop: '16px',
    marginBottom: '0',
    letterSpacing: '0.03em',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    background: '#f0f4f8',
    border: '1px solid #c8d4e0',
    padding: '4px 8px',
    fontWeight: 600,
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
    width: '1%',
    color: '#1e3a5f',
  },
  td: {
    border: '1px solid #c8d4e0',
    padding: '4px 8px',
    verticalAlign: 'top' as const,
  },
  tdEmpty: {
    border: '1px solid #c8d4e0',
    padding: '4px 8px',
    height: '20px',
    color: '#bbb',
  },
  label: {
    background: '#f0f4f8',
    border: '1px solid #c8d4e0',
    padding: '4px 8px',
    fontWeight: 600,
    color: '#1e3a5f',
    whiteSpace: 'nowrap' as const,
    width: '1%',
  },
  value: {
    border: '1px solid #c8d4e0',
    padding: '4px 8px',
    verticalAlign: 'top' as const,
  },
  textBlock: {
    border: '1px solid #c8d4e0',
    padding: '6px 8px',
    minHeight: '60px',
    whiteSpace: 'pre-wrap' as const,
    verticalAlign: 'top' as const,
  },
  photoBox: {
    width: '90px',
    height: '110px',
    border: '1px solid #c8d4e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f7f9fb',
    flexShrink: 0,
    overflow: 'hidden',
  },
};

// ── Print styles injected into document ──────────────────────────────────────

const PRINT_CSS = `
  @media print {
    body { margin: 0; }
    .cv-no-print { display: none !important; }
    .cv-root { padding: 0; box-shadow: none; }
    .cv-page { padding: 8mm; max-width: 100%; box-shadow: none; }
    .cv-section { page-break-inside: avoid; }
  }
  @page { size: A4 portrait; margin: 8mm; }
`;

// ── Row helpers ───────────────────────────────────────────────────────────────

function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={S.label}>{label}</td>
      <td style={S.value}>{value}</td>
    </tr>
  );
}

function KVRow2({ pairs }: { pairs: [string, React.ReactNode][] }) {
  return (
    <tr>
      {pairs.map(([label, value], i) => (
        <React.Fragment key={i}>
          <td style={S.label}>{label}</td>
          <td style={S.value}>{value}</td>
        </React.Fragment>
      ))}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CandidateCV({
  candidate,
  showSensitiveData = false,
  lang = 'id',
}: CandidateCVProps) {
  const L = LABELS[lang] ?? LABELS.id;
  const c = candidate ?? {};

  const age = c.dateOfBirth ? calculateAge(c.dateOfBirth) : null;
  const genderLabel = c.gender === 'M' ? L.gM : c.gender === 'F' ? L.gF : '—';

  const career: any[]        = padRows(c.career, 3);
  const eduHistory: any[]    = padRows(c.educationHistory, 3);
  const tests: any[]         = padRows(c.tests, 3);
  const certs: any[]         = padRows(c.certifications, 3);

  return (
    <div className="cv-root" style={S.page}>
      {/* Inject print CSS */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a5f', letterSpacing: '0.05em', marginBottom: '4px' }}>
            {L.title}
          </div>
          <div style={{ fontSize: '11px', color: '#555' }}>
            {L.code}: <strong>{v(c.candidateCode)}</strong>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '6px', color: '#1a1a1a' }}>
            {v(c.fullName)}
          </div>
          {c.nameKatakana && (
            <div style={{ fontSize: '12px', color: '#444', marginTop: '2px' }}>{c.nameKatakana}</div>
          )}
        </div>
        {/* Closeup photo */}
        <div style={S.photoBox}>
          {c.closeupUrl
            ? <img src={c.closeupUrl} alt="photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '28px', color: '#ccc' }}>👤</span>
          }
        </div>
        {/* Full-body photo */}
        <div style={{ ...S.photoBox, width: '60px', height: '110px' }}>
          {c.fullbodyUrl
            ? <img src={c.fullbodyUrl} alt="fullbody" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '22px', color: '#ccc' }}>🧍</span>
          }
        </div>
      </div>

      {/* ── Section 1: Personal Data ─────────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s1}</div>
        <table style={S.table}>
          <tbody>
            <KVRow2 pairs={[
              [L.fullName, v(c.fullName)],
              [L.katakana, v(c.nameKatakana)],
            ]} />
            <KVRow2 pairs={[
              [L.gender, genderLabel],
              [L.dob, c.dateOfBirth ? `${v(c.dateOfBirth).slice(0,10)} (${age !== null ? age + (lang === 'ja' ? '歳' : ' thn') : '—'})` : '—'],
            ]} />
            <KVRow2 pairs={[
              [L.blood, v(c.bloodType)],
              [L.religion, v(c.religion)],
            ]} />
            <KVRow2 pairs={[
              [L.height, v(c.heightCm)],
              [L.weight, v(c.weightKg)],
            ]} />
            <KVRow2 pairs={[
              [L.selfHeight, v(c.selfReportedHeight)],
              [L.selfWeight, v(c.selfReportedWeight)],
            ]} />
            <tr>
              <td style={S.label}>{L.passport}</td>
              <td style={S.value}><Chk checked={c.hasPassport} /> {c.hasPassport ? L.yes : L.no}</td>
              <td style={S.label}>{L.visitedJapan}</td>
              <td style={S.value}><Chk checked={c.hasVisitedJapan} /> {c.hasVisitedJapan ? L.yes : L.no}</td>
            </tr>
            <KVRow label={L.hobbies} value={v(c.hobbies)} />
          </tbody>
        </table>
      </div>

      {/* ── Section 2: Contact ───────────────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s2}</div>
        <table style={S.table}>
          <tbody>
            {showSensitiveData && (
              <KVRow label={L.nik} value={v(c.nik)} />
            )}
            <KVRow
              label={L.email}
              value={
                showSensitiveData
                  ? v(c.email)
                  : c.email?.masked
                    ? <span style={{ color: '#888', fontStyle: 'italic' }}>{L.masked}</span>
                    : v(c.email)
              }
            />
            <KVRow
              label={L.phone}
              value={
                showSensitiveData
                  ? v(c.phone)
                  : c.phone?.masked
                    ? <span style={{ color: '#888', fontStyle: 'italic' }}>{L.masked}</span>
                    : v(c.phone)
              }
            />
            <KVRow
              label={L.address}
              value={
                showSensitiveData
                  ? v(c.address)
                  : c.address?.masked
                    ? <span style={{ color: '#888', fontStyle: 'italic' }}>{L.masked}</span>
                    : v(c.address)
              }
            />
          </tbody>
        </table>
      </div>

      {/* ── Section 3: SSW Info ──────────────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s3}</div>
        <table style={S.table}>
          <tbody>
            <KVRow2 pairs={[
              [L.kubun, v(c.sswKubun)],
              [L.jobCat, v(c.jobCategory)],
            ]} />
            <KVRow2 pairs={[
              [L.sectorId, v(c.sswSectorId)],
              [L.fieldId, v(c.sswFieldId)],
            ]} />
            <KVRow2 pairs={[
              [L.sectorJa, v(c.sswSectorJa)],
              [L.fieldJa, v(c.sswFieldJa)],
            ]} />
            <KVRow label={L.jpStudy} value={v(c.jpStudyDuration)} />
          </tbody>
        </table>
      </div>

      {/* ── Section 4: Education ─────────────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s4}</div>
        <table style={S.table}>
          <tbody>
            <KVRow2 pairs={[
              [L.highestEdu, v(c.eduLevel)],
              [L.school, v(c.eduLabel)],
            ]} />
            <KVRow label={L.major} value={v(c.eduMajor)} />
          </tbody>
        </table>
        {/* Education history table */}
        <table style={{ ...S.table, marginTop: '4px' }}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '40%' }}>{L.school}</th>
              <th style={{ ...S.th, width: '30%' }}>{L.major}</th>
              <th style={{ ...S.th, width: '30%' }}>{L.period}</th>
            </tr>
          </thead>
          <tbody>
            {eduHistory.map((row, i) => row ? (
              <tr key={row.id ?? i}>
                <td style={S.td}>{v(row.schoolName)}</td>
                <td style={S.td}>{v(row.major)}</td>
                <td style={S.td}>{formatPeriod(row.startDate, row.endDate)}</td>
              </tr>
            ) : (
              <tr key={`edu-empty-${i}`}>
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 5: Career ────────────────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s5}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '30%' }}>{L.company}</th>
              <th style={{ ...S.th, width: '25%' }}>{L.division}</th>
              <th style={{ ...S.th, width: '25%' }}>{L.skillGroup}</th>
              <th style={{ ...S.th, width: '20%' }}>{L.period}</th>
            </tr>
          </thead>
          <tbody>
            {career.map((row, i) => row ? (
              <tr key={row.id ?? i}>
                <td style={S.td}>{v(row.companyName)}</td>
                <td style={S.td}>{v(row.division)}</td>
                <td style={S.td}>{v(row.skillGroup)}</td>
                <td style={S.td}>{v(row.period)}</td>
              </tr>
            ) : (
              <tr key={`career-empty-${i}`}>
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 6: Japanese Language ─────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s6}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '40%' }}>{L.testName}</th>
              <th style={{ ...S.th, width: '20%' }}>{L.score}</th>
              <th style={{ ...S.th, width: '20%' }}>{L.pass}</th>
              <th style={{ ...S.th, width: '20%' }}>{L.testDate}</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((row, i) => row ? (
              <tr key={row.id ?? i}>
                <td style={S.td}>{v(row.testName)}</td>
                <td style={S.td}>{v(row.score)}</td>
                <td style={S.td}><Chk checked={row.pass} /> {row.pass ? L.yes : L.no}</td>
                <td style={S.td}>{row.testDate ? v(row.testDate).slice(0, 10) : '—'}</td>
              </tr>
            ) : (
              <tr key={`test-empty-${i}`}>
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 7: Certifications ────────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s7}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '35%' }}>{L.certName}</th>
              <th style={{ ...S.th, width: '20%' }}>{L.certLevel}</th>
              <th style={{ ...S.th, width: '20%' }}>{L.issuedDate}</th>
              <th style={{ ...S.th, width: '25%' }}>{L.issuedBy}</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((row, i) => row ? (
              <tr key={row.id ?? i}>
                <td style={S.td}>{v(row.certName)}</td>
                <td style={S.td}>{v(row.certLevel)}</td>
                <td style={S.td}>{row.issuedDate ? v(row.issuedDate).slice(0, 10) : '—'}</td>
                <td style={S.td}>{v(row.issuedBy)}</td>
              </tr>
            ) : (
              <tr key={`cert-empty-${i}`}>
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
                <td style={S.tdEmpty} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 8: PR & Motivation ───────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s8}</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '16%' }} />
              <th style={{ ...S.th, width: '42%' }}>{L.colId}</th>
              <th style={{ ...S.th, width: '42%' }}>{L.colJa}</th>
            </tr>
          </thead>
          <tbody>
            {([
              [L.selfPr,     c.selfPrId,      c.selfPrJa],
              [L.motivation, c.motivationId,  c.motivationJa],
              [L.applyReason,c.applyReasonId, c.applyReasonJa],
              [L.selfIntro,  c.selfIntroId,   c.selfIntroJa],
            ] as [string, unknown, unknown][]).map(([label, idText, jaText]) => (
              <tr key={label}>
                <td style={{ ...S.label, verticalAlign: 'top' }}>{label}</td>
                <td style={S.textBlock}>{v(idText)}</td>
                <td style={{ ...S.textBlock, fontFamily: "'Noto Sans JP', sans-serif" }}>{v(jaText)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 9: Work Plan & Family ────────────────────────────────── */}
      <div className="cv-section">
        <div style={S.sectionHeader}>{L.s9}</div>
        <table style={S.table}>
          <tbody>
            <KVRow label={L.duration} value={v(c.workplanDuration)} />
            <tr>
              <td style={{ ...S.label, verticalAlign: 'top' }}>{L.goal}</td>
              <td style={{ ...S.value, whiteSpace: 'pre-wrap', minHeight: '40px' }}>{v(c.workplanGoal)}</td>
            </tr>
            <tr>
              <td style={{ ...S.label, verticalAlign: 'top' }}>{L.after}</td>
              <td style={{ ...S.value, whiteSpace: 'pre-wrap', minHeight: '40px' }}>{v(c.workplanAfter)}</td>
            </tr>
            <tr>
              <td style={{ ...S.label, verticalAlign: 'top' }}>{L.expectation}</td>
              <td style={{ ...S.value, whiteSpace: 'pre-wrap', minHeight: '40px' }}>{v(c.workplanExpectation)}</td>
            </tr>
            <KVRow2 pairs={[
              [L.marital, v(c.maritalStatus)],
              [L.spouse, v(c.spouseInfo)],
            ]} />
            <KVRow2 pairs={[
              [L.children, v(c.childrenCount)],
              [L.accompany, c.accompany === 'yes' ? L.yes : L.no],
            ]} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
