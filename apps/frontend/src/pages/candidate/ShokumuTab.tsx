import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { CandidateData, GakkenResume, GakkenCompanyEntry } from '../../types/candidate';

interface ShokumuSettings {
  enabled: boolean;
  layout: string;
  mergeCv: boolean;
  eligible: boolean;
  template: string;
}

interface ShokumuTabProps {
  candidate: CandidateData;
  isLocked: boolean;
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500';
const textareaCls = `${inputCls} resize-y`;
const numericCls = `${inputCls}`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Gakken Resume Form ─────────────────────────────────────────────────────────
interface GakkenResumeResponse {
  resume: GakkenResume | null;
  companies: GakkenCompanyEntry[];
}

const EMPTY_COMPANY: GakkenCompanyEntry = {
  period: '', productId: '', productJa: '', dutiesId: '', dutiesJa: '',
  memberRoleId: '', memberRoleJa: '', sortOrder: 0,
};

function GakkenForm({ isLocked }: { isLocked: boolean }) {
  const { t } = useTranslation();

  const { data: initial, isLoading } = useQuery<GakkenResumeResponse>({
    queryKey: ['gakken-resume'],
    queryFn: () => api.get('/candidates/me/gakken-resume').then(r => r.data),
    staleTime: 30_000,
  });

  const { data: translateConfig } = useQuery<{ enabled: boolean }>({
    queryKey: ['translation-config'],
    queryFn: () => api.get('/superadmin/translation-config').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const autoTranslate = translateConfig?.enabled === true;

  const [resume, setResume] = useState<GakkenResume>(() => ({
    careerSummary: null, careerSummaryJa: null,
    currentCompanyName: null, currentBusinessActivity: null,
    currentCapital: null, currentRevenue: null, currentEmployeeCount: null,
    skills: null, skillsJa: null, selfPr: null, selfPrJa: null,
  }));

  const [companies, setCompanies] = useState<GakkenCompanyEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Populate state once data arrives
  if (initial && !loaded) {
    setResume(initial.resume ?? {
      careerSummary: null, careerSummaryJa: null,
      currentCompanyName: null, currentBusinessActivity: null,
      currentCapital: null, currentRevenue: null, currentEmployeeCount: null,
      skills: null, skillsJa: null, selfPr: null, selfPrJa: null,
    });
    setCompanies(initial.companies.length > 0 ? initial.companies : [{ ...EMPTY_COMPANY }]);
    setLoaded(true);
  }

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function setR(field: keyof GakkenResume, value: string | number | null) {
    setResume(prev => ({ ...prev, [field]: value }));
  }

  function setC(idx: number, field: keyof GakkenCompanyEntry, value: string | number | null) {
    setCompanies(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function addCompany() {
    setCompanies(prev => [...prev, { ...EMPTY_COMPANY, sortOrder: prev.length }]);
  }

  function removeCompany(idx: number) {
    setCompanies(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, sortOrder: i })));
  }

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(false);
    try {
      await api.patch('/candidates/me/gakken-resume', {
        careerSummary:           resume.careerSummary           || null,
        careerSummaryJa:         resume.careerSummaryJa         || null,
        currentCompanyName:      resume.currentCompanyName      || null,
        currentBusinessActivity: resume.currentBusinessActivity || null,
        currentCapital:          resume.currentCapital          || null,
        currentRevenue:          resume.currentRevenue          || null,
        currentEmployeeCount:    resume.currentEmployeeCount    ?? null,
        skills:                  resume.skills                  || null,
        skillsJa:                resume.skillsJa                || null,
        selfPr:                  resume.selfPr                  || null,
        selfPrJa:                resume.selfPrJa                || null,
        companies: companies.map((c, i) => ({
          period:       c.period       || null,
          productId:    c.productId    || null,
          productJa:    c.productJa    || null,
          dutiesId:     c.dutiesId     || null,
          dutiesJa:     c.dutiesJa     || null,
          memberRoleId: c.memberRoleId || null,
          memberRoleJa: c.memberRoleJa || null,
          sortOrder:    i,
        })),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading && !loaded) {
    return <div className="text-sm text-gray-400 py-4">Loading...</div>;
  }

  const jaDisabled = isLocked || autoTranslate;
  const autoNote = autoTranslate
    ? 'Akan diterjemahkan otomatis saat menyimpan.'
    : t('shokumu.autoTranslateNote', { defaultValue: 'Japanese version will be auto-translated if left blank.' });
  const jaCls = `${textareaCls} ${autoTranslate ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`;

  return (
    <div className="space-y-8">

      {/* 1. Ringkasan Pengalaman Kerja (職務要約) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">
          Ringkasan Pengalaman Kerja　<span className="text-gray-400 font-normal">職務要約</span>
        </h3>
        <Field label="Bahasa Indonesia">
          <textarea
            value={resume.careerSummary ?? ''}
            onChange={e => setR('careerSummary', e.target.value)}
            rows={4}
            maxLength={2000}
            disabled={isLocked}
            className={textareaCls}
          />
        </Field>
        <Field label="日本語">
          <textarea
            value={resume.careerSummaryJa ?? ''}
            onChange={e => setR('careerSummaryJa', e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={jaDisabled}
            className={jaCls}
            placeholder={autoTranslate ? '' : '自動翻訳または手動入力'}
          />
          <p className="text-xs text-gray-400 mt-0.5">{autoNote}</p>
        </Field>
      </div>

      {/* 2. Posisi Sekarang (現在経歴) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">
          Posisi Sekarang　<span className="text-gray-400 font-normal">現在経歴</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nama Perusahaan　会社名">
            <input
              type="text"
              value={resume.currentCompanyName ?? ''}
              onChange={e => setR('currentCompanyName', e.target.value)}
              disabled={isLocked}
              className={inputCls}
            />
          </Field>
          <Field label="Jumlah Pegawai　従業員数">
            <input
              type="number"
              min={0}
              value={resume.currentEmployeeCount ?? ''}
              onChange={e => setR('currentEmployeeCount', e.target.value === '' ? null : parseInt(e.target.value, 10))}
              disabled={isLocked}
              className={numericCls}
            />
          </Field>
          <Field label="Modal　資本金 (万円)">
            <input
              type="text"
              inputMode="numeric"
              value={resume.currentCapital ?? ''}
              onChange={e => setR('currentCapital', e.target.value.replace(/[^\d.,]/g, ''))}
              disabled={isLocked}
              className={inputCls}
              placeholder="e.g. 1000"
            />
          </Field>
          <Field label="Omzet　売上高 (万円)">
            <input
              type="text"
              inputMode="numeric"
              value={resume.currentRevenue ?? ''}
              onChange={e => setR('currentRevenue', e.target.value.replace(/[^\d.,]/g, ''))}
              disabled={isLocked}
              className={inputCls}
              placeholder="e.g. 5000"
            />
          </Field>
        </div>
        <Field label="Kegiatan Usaha　事業内容">
          <textarea
            value={resume.currentBusinessActivity ?? ''}
            onChange={e => setR('currentBusinessActivity', e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={isLocked}
            className={textareaCls}
          />
        </Field>
      </div>

      {/* 3. Variable company entries (職務経歴) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">
          Riwayat Perusahaan　<span className="text-gray-400 font-normal">職務経歴</span>
        </h3>
        {companies.map((company, idx) => (
          <div key={idx} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Perusahaan #{idx + 1}</p>
              {companies.length > 1 && !isLocked && (
                <button
                  type="button"
                  onClick={() => removeCompany(idx)}
                  className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded hover:bg-red-50"
                >✕ Hapus</button>
              )}
            </div>
            <Field label="Periode　期間 (yyyy/mm – yyyy/mm)">
              <input
                type="text"
                value={company.period ?? ''}
                onChange={e => setC(idx, 'period', e.target.value)}
                disabled={isLocked}
                className={inputCls}
                placeholder="e.g. 2020/04 – 2023/03"
              />
            </Field>
            <Field label="Produk Yang Menjadi Tanggung Jawab　担当製品">
              <textarea
                value={company.productId ?? ''}
                onChange={e => setC(idx, 'productId', e.target.value)}
                rows={2}
                disabled={isLocked}
                className={textareaCls}
              />
            </Field>
            <Field label="担当製品 (日本語)">
              <textarea
                value={company.productJa ?? ''}
                onChange={e => setC(idx, 'productJa', e.target.value)}
                rows={2}
                disabled={jaDisabled}
                className={jaCls}
                placeholder={autoTranslate ? '' : autoNote}
              />
            </Field>
            <Field label="Uraian Tugas　担当業務">
              <textarea
                value={company.dutiesId ?? ''}
                onChange={e => setC(idx, 'dutiesId', e.target.value)}
                rows={3}
                disabled={isLocked}
                className={textareaCls}
              />
            </Field>
            <Field label="担当業務 (日本語)">
              <textarea
                value={company.dutiesJa ?? ''}
                onChange={e => setC(idx, 'dutiesJa', e.target.value)}
                rows={3}
                disabled={jaDisabled}
                className={jaCls}
                placeholder={autoTranslate ? '' : autoNote}
              />
            </Field>
            <Field label="Anggota / Peran　メンバー・役割">
              <textarea
                value={company.memberRoleId ?? ''}
                onChange={e => setC(idx, 'memberRoleId', e.target.value)}
                rows={2}
                disabled={isLocked}
                className={textareaCls}
              />
            </Field>
            <Field label="メンバー・役割 (日本語)">
              <textarea
                value={company.memberRoleJa ?? ''}
                onChange={e => setC(idx, 'memberRoleJa', e.target.value)}
                rows={2}
                disabled={jaDisabled}
                className={jaCls}
                placeholder={autoTranslate ? '' : autoNote}
              />
            </Field>
          </div>
        ))}
        {!isLocked && (
          <button
            type="button"
            onClick={addCompany}
            className="text-sm text-navy-600 hover:underline"
          >
            + Tambah Perusahaan
          </button>
        )}
      </div>

      {/* 4. Pengalaman, Pengetahuan dan Ketrampilan (経験・知識・技術) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">
          Pengalaman, Pengetahuan dan Ketrampilan　<span className="text-gray-400 font-normal">経験・知識・技術</span>
        </h3>
        <Field label="Bahasa Indonesia">
          <textarea
            value={resume.skills ?? ''}
            onChange={e => setR('skills', e.target.value)}
            rows={4}
            maxLength={3000}
            disabled={isLocked}
            className={textareaCls}
          />
        </Field>
        <Field label="日本語">
          <textarea
            value={resume.skillsJa ?? ''}
            onChange={e => setR('skillsJa', e.target.value)}
            rows={3}
            maxLength={3000}
            disabled={jaDisabled}
            className={jaCls}
            placeholder={autoTranslate ? '' : '自動翻訳または手動入力'}
          />
          <p className="text-xs text-gray-400 mt-0.5">{autoNote}</p>
        </Field>
      </div>

      {/* 5. Sertifikasi — managed in tab Sertifikasi, shown here as note */}
      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
        <span className="font-medium text-gray-500">Sertifikasi 資格</span> — dikelola di tab <span className="font-medium">Sertifikasi</span> pada profil kandidat.
      </div>

      {/* 6. Promosi (自己PR) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">
          Promosi Diri　<span className="text-gray-400 font-normal">自己ＰＲ</span>
        </h3>
        <Field label="Bahasa Indonesia">
          <textarea
            value={resume.selfPr ?? ''}
            onChange={e => setR('selfPr', e.target.value)}
            rows={4}
            maxLength={3000}
            disabled={isLocked}
            className={textareaCls}
          />
        </Field>
        <Field label="日本語">
          <textarea
            value={resume.selfPrJa ?? ''}
            onChange={e => setR('selfPrJa', e.target.value)}
            rows={3}
            maxLength={3000}
            disabled={jaDisabled}
            className={jaCls}
            placeholder={autoTranslate ? '' : '自動翻訳または手動入力'}
          />
          <p className="text-xs text-gray-400 mt-0.5">{autoNote}</p>
        </Field>
      </div>

      {/* Save */}
      {!isLocked && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className="px-5 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-50"
          >
            {saving ? '…' : t('shokumu.saveBtn')}
          </button>
          {saveSuccess && <span className="text-sm text-green-600">✓ {t('shokumu.saved')}</span>}
          {saveError   && <span className="text-sm text-red-500">{t('toastError', { defaultValue: 'Error saving.' })}</span>}
        </div>
      )}
    </div>
  );
}

// ── Generic Shokumu Form ───────────────────────────────────────────────────────
function GenericForm({ candidate, isLocked }: { candidate: CandidateData; isLocked: boolean }) {
  const { t } = useTranslation();

  const [careerSummaryId, setCareerSummaryId] = useState(candidate.careerSummaryId ?? '');
  const [careerSummaryJa, setCareerSummaryJa] = useState(candidate.careerSummaryJa ?? '');

  type CareerFieldEntry = {
    companyType: string;
    employeeCount: string;
    annualSales: string;
    capitalAmount: string;
    dutiesId: string;
    dutiesJa: string;
    achievementsId: string;
    achievementsJa: string;
    productId: string;
    productJa: string;
    jobTitleId: string;
    jobTitleJa: string;
    memberRoleId: string;
    memberRoleJa: string;
  };

  const [careerFields, setCareerFields] = useState<Record<string, CareerFieldEntry>>(() => {
    const init: Record<string, CareerFieldEntry> = {};
    for (const entry of candidate.career ?? []) {
      if (!entry.id) continue;
      init[entry.id] = {
        companyType:    entry.companyType    ?? '',
        employeeCount:  entry.employeeCount != null ? String(entry.employeeCount) : '',
        annualSales:    entry.annualSales    ?? '',
        capitalAmount:  entry.capitalAmount  ?? '',
        dutiesId:       entry.dutiesId       ?? '',
        dutiesJa:       entry.dutiesJa       ?? '',
        achievementsId: entry.achievementsId ?? '',
        achievementsJa: entry.achievementsJa ?? '',
        productId:      entry.productId      ?? '',
        productJa:      entry.productJa      ?? '',
        jobTitleId:     entry.jobTitleId     ?? '',
        jobTitleJa:     entry.jobTitleJa     ?? '',
        memberRoleId:   entry.memberRoleId   ?? '',
        memberRoleJa:   entry.memberRoleJa   ?? '',
      };
    }
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function updateCareerField(id: string, field: string, value: string) {
    setCareerFields(prev => ({ ...prev, [id]: { ...prev[id]!, [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(false);
    try {
      const careerPayload = Object.entries(careerFields).map(([id, fields]) => ({
        id,
        companyType:    fields.companyType    || null,
        employeeCount:  fields.employeeCount !== '' ? parseInt(fields.employeeCount, 10) : null,
        annualSales:    fields.annualSales    || null,
        capitalAmount:  fields.capitalAmount  || null,
        dutiesId:       fields.dutiesId       || null,
        dutiesJa:       fields.dutiesJa       || null,
        achievementsId: fields.achievementsId || null,
        achievementsJa: fields.achievementsJa || null,
        productId:      fields.productId      || null,
        productJa:      fields.productJa      || null,
        jobTitleId:     fields.jobTitleId     || null,
        jobTitleJa:     fields.jobTitleJa     || null,
        memberRoleId:   fields.memberRoleId   || null,
        memberRoleJa:   fields.memberRoleJa   || null,
      }));

      await api.patch('/candidates/me/shokumu', {
        careerSummaryId: careerSummaryId || null,
        careerSummaryJa: careerSummaryJa || null,
        career: careerPayload,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">{t('shokumu.careerSummaryLabel')}</h3>
        <Field label="Indonesia">
          <textarea
            value={careerSummaryId}
            onChange={e => setCareerSummaryId(e.target.value)}
            rows={4}
            maxLength={400}
            disabled={isLocked}
            className={textareaCls}
          />
        </Field>
        <Field label={`日本語 (${t('shokumu.careerSummaryLabel')})`}>
          <textarea
            value={careerSummaryJa}
            onChange={e => setCareerSummaryJa(e.target.value)}
            rows={3}
            maxLength={250}
            disabled={isLocked}
            className={textareaCls}
            placeholder="自動翻訳または手動入力"
          />
        </Field>
      </div>

      {(candidate.career ?? []).length > 0 && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">{t('shokumu.jobDetailTitle')}</h3>
          {(candidate.career ?? []).map(entry => {
            if (!entry.id) return null;
            const fields = careerFields[entry.id] ?? {
              companyType: '', employeeCount: '', annualSales: '',
              capitalAmount: '', dutiesId: '', dutiesJa: '',
              achievementsId: '', achievementsJa: '',
              productId: '', productJa: '', jobTitleId: '', jobTitleJa: '',
              memberRoleId: '', memberRoleJa: '',
            };
            return (
              <div key={entry.id} className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-navy-800">{entry.companyName ?? '—'}</span>
                  {entry.period && <span className="text-xs text-gray-400">{entry.period}</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={t('shokumu.companyType')}>
                    <input type="text" value={fields.companyType} onChange={e => updateCareerField(entry.id!, 'companyType', e.target.value)} disabled={isLocked} className={inputCls} />
                  </Field>
                  <Field label={t('shokumu.employeeCount')}>
                    <input type="number" min={0} value={fields.employeeCount} onChange={e => updateCareerField(entry.id!, 'employeeCount', e.target.value)} disabled={isLocked} className={inputCls} />
                  </Field>
                  <Field label={t('shokumu.annualSales')}>
                    <input type="text" value={fields.annualSales} onChange={e => updateCareerField(entry.id!, 'annualSales', e.target.value)} disabled={isLocked} className={inputCls} />
                  </Field>
                  <Field label={t('shokumu.capitalAmount')}>
                    <input type="text" value={fields.capitalAmount} onChange={e => updateCareerField(entry.id!, 'capitalAmount', e.target.value)} disabled={isLocked} className={inputCls} />
                  </Field>
                </div>
                <Field label={t('shokumu.duties')}>
                  <textarea value={fields.dutiesId} onChange={e => updateCareerField(entry.id!, 'dutiesId', e.target.value)} rows={3} disabled={isLocked} className={textareaCls} />
                </Field>
                <Field label={t('shokumu.achievements')}>
                  <textarea value={fields.achievementsId} onChange={e => updateCareerField(entry.id!, 'achievementsId', e.target.value)} rows={3} disabled={isLocked} className={textareaCls} />
                </Field>
                <p className="text-xs text-gray-400">{t('shokumu.autoTranslateNote', { defaultValue: 'Japanese will be auto-translated if left blank.' })}</p>
              </div>
            );
          })}
        </div>
      )}

      {!isLocked && (
        <div className="flex items-center gap-4">
          <button onClick={() => { void handleSave(); }} disabled={saving}
            className="px-5 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition disabled:opacity-50">
            {saving ? '…' : t('shokumu.saveBtn')}
          </button>
          {saveSuccess && <span className="text-sm text-green-600">✓ {t('shokumu.saved')}</span>}
          {saveError   && <span className="text-sm text-red-500">{t('toastError', { defaultValue: 'Error saving.' })}</span>}
        </div>
      )}
    </div>
  );
}

// ── Main ShokumuTab ────────────────────────────────────────────────────────────
export default function ShokumuTab({ candidate, isLocked }: ShokumuTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: settings } = useQuery<ShokumuSettings>({
    queryKey: ['shokumu-config'],
    queryFn: () => api.get('/candidates/me/shokumu').then(r => r.data),
    staleTime: 60_000,
  });

  const isGakken = settings?.template === 'gakken';

  async function handleDownloadPdf(url: string, filename: string) {
    try {
      const resp = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([resp.data as BlobPart], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = filename; a.click();
      URL.revokeObjectURL(href);
    } catch { /* browser shows network error */ }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('shokumu.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('shokumu.careerSummaryHint')}</p>
        </div>
        {settings?.template && (
          <span className={`text-xs px-2 py-1 rounded-full border font-medium ${isGakken ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {isGakken ? t('shokumu.templateGakken') : t('shokumu.templateGeneric')}
          </span>
        )}
      </div>

      {isGakken
        ? <GakkenForm isLocked={isLocked} />
        : <GenericForm candidate={candidate} isLocked={isLocked} />
      }

      {/* Preview + download buttons */}
      {settings?.eligible && (
        <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/portal/shokumu')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-navy-700 text-navy-700 text-sm rounded-lg hover:bg-navy-50 transition"
          >
            {t('shokumu.previewBtn')}
          </button>
          {settings.mergeCv ? (
            <button
              onClick={() => { void handleDownloadPdf('/candidates/me/merged-pdf', `${candidate.candidateCode}-resume.pdf`); }}
              className="flex items-center gap-2 px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition"
            >
              {t('shokumu.downloadMerged')}
            </button>
          ) : (
            <button
              onClick={() => { void handleDownloadPdf('/candidates/me/shokumu-pdf', `${candidate.candidateCode}-shokumu.pdf`); }}
              className="flex items-center gap-2 px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition"
            >
              {t('shokumu.downloadShokumu')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
