import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { CandidateData } from '../../types/candidate';

interface ShokumuSettings {
  enabled: boolean;
  layout: string;
  mergeCv: boolean;
  eligible: boolean;
}

interface ShokumuTabProps {
  candidate: CandidateData;
  isLocked: boolean;
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500';
const textareaCls = `${inputCls} resize-y`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function ShokumuTab({ candidate, isLocked }: ShokumuTabProps) {
  const { t } = useTranslation();

  const { data: settings } = useQuery<ShokumuSettings>({
    queryKey: ['shokumu-config'],
    queryFn: () => api.get('/candidates/me/shokumu').then((r) => r.data),
    staleTime: 60_000,
  });

  // Local state for career summary
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
  };

  // Local state for career entry shokumu fields
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
      };
    }
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  function updateCareerField(id: string, field: string, value: string) {
    setCareerFields((prev) => ({
      ...prev,
      [id]: { ...prev[id]!, [field]: value },
    }));
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

  async function handleDownloadPdf(url: string, filename: string) {
    try {
      const resp = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([resp.data as BlobPart], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      // fail silently — browser will show network error
    }
  }

  async function handlePreview(url: string) {
    setPreviewLoading(true);
    try {
      const resp = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([resp.data as BlobPart], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      setPreviewUrl(href);
    } catch {
      // fail silently
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{t('shokumu.title')}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{t('shokumu.careerSummaryHint')}</p>
      </div>

      {/* Section A: 経歴要約 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">{t('shokumu.careerSummaryLabel')}</h3>
        <Field label="Indonesia">
          <textarea
            value={careerSummaryId}
            onChange={(e) => setCareerSummaryId(e.target.value)}
            rows={4}
            maxLength={400}
            disabled={isLocked}
            className={textareaCls}
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">{careerSummaryId.length}/400</p>
        </Field>
        <Field label={`日本語 (${t('shokumu.careerSummaryLabel')})`}>
          <textarea
            value={careerSummaryJa}
            onChange={(e) => setCareerSummaryJa(e.target.value)}
            rows={3}
            maxLength={250}
            disabled={isLocked}
            className={textareaCls}
            placeholder="自動翻訳または手動入力"
          />
          <p className="text-xs text-gray-400 mt-0.5">{t('shokumu.autoTranslateNote', { defaultValue: 'Japanese version will be auto-translated if left blank.' })}</p>
        </Field>
      </div>

      {/* Section B: 職務詳細 per career entry */}
      {(candidate.career ?? []).length > 0 && (
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">{t('shokumu.jobDetailTitle')}</h3>
          {(candidate.career ?? []).map((entry) => {
            if (!entry.id) return null;
            const fields = careerFields[entry.id] ?? {
              companyType: '', employeeCount: '', annualSales: '',
              capitalAmount: '', dutiesId: '', dutiesJa: '',
              achievementsId: '', achievementsJa: '',
            };
            return (
              <div key={entry.id} className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-navy-800">{entry.companyName ?? '—'}</span>
                  {entry.period && <span className="text-xs text-gray-400">{entry.period}</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={t('shokumu.companyType')}>
                    <input
                      type="text"
                      value={fields.companyType}
                      onChange={(e) => updateCareerField(entry.id!, 'companyType', e.target.value)}
                      disabled={isLocked}
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t('shokumu.employeeCount')}>
                    <input
                      type="number"
                      min={0}
                      value={fields.employeeCount}
                      onChange={(e) => updateCareerField(entry.id!, 'employeeCount', e.target.value)}
                      disabled={isLocked}
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t('shokumu.annualSales')}>
                    <input
                      type="text"
                      value={fields.annualSales}
                      onChange={(e) => updateCareerField(entry.id!, 'annualSales', e.target.value)}
                      disabled={isLocked}
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t('shokumu.capitalAmount')}>
                    <input
                      type="text"
                      value={fields.capitalAmount}
                      onChange={(e) => updateCareerField(entry.id!, 'capitalAmount', e.target.value)}
                      disabled={isLocked}
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label={t('shokumu.duties')}>
                  <textarea
                    value={fields.dutiesId}
                    onChange={(e) => updateCareerField(entry.id!, 'dutiesId', e.target.value)}
                    rows={3}
                    disabled={isLocked}
                    className={textareaCls}
                  />
                </Field>

                <Field label={t('shokumu.achievements')}>
                  <textarea
                    value={fields.achievementsId}
                    onChange={(e) => updateCareerField(entry.id!, 'achievementsId', e.target.value)}
                    rows={3}
                    disabled={isLocked}
                    className={textareaCls}
                  />
                </Field>

                <p className="text-xs text-gray-400">{t('shokumu.autoTranslateNote', { defaultValue: 'Japanese version will be auto-translated if left blank.' })}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Save button */}
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

      {/* PDF preview + download buttons */}
      {settings?.eligible && (
        <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-3">
          {settings.mergeCv ? (
            <>
              <button
                onClick={() => { void handlePreview('/candidates/me/merged-pdf'); }}
                disabled={previewLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-navy-700 text-navy-700 text-sm rounded-lg hover:bg-navy-50 transition disabled:opacity-50"
              >
                {previewLoading ? '…' : t('shokumu.previewBtn')}
              </button>
              <button
                onClick={() => { void handleDownloadPdf('/candidates/me/merged-pdf', `${candidate.candidateCode}-resume.pdf`); }}
                className="flex items-center gap-2 px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition"
              >
                {t('shokumu.downloadMerged')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { void handlePreview('/candidates/me/shokumu-pdf'); }}
                disabled={previewLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-navy-700 text-navy-700 text-sm rounded-lg hover:bg-navy-50 transition disabled:opacity-50"
              >
                {previewLoading ? '…' : t('shokumu.previewBtn')}
              </button>
              <button
                onClick={() => { void handleDownloadPdf('/candidates/me/shokumu-pdf', `${candidate.candidateCode}-shokumu.pdf`); }}
                className="flex items-center gap-2 px-4 py-2 bg-navy-700 text-white text-sm rounded-lg hover:bg-navy-900 transition"
              >
                {t('shokumu.downloadShokumu')}
              </button>
            </>
          )}
        </div>
      )}

      {/* PDF preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={closePreview}>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-white text-sm font-medium">{t('shokumu.previewTitle')}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = previewUrl;
                  a.download = `${candidate.candidateCode}-shokumu.pdf`;
                  a.click();
                }}
                className="text-xs px-3 py-1.5 bg-navy-700 text-white rounded-lg hover:bg-navy-900 transition"
              >
                {t('shokumu.downloadShokumu')}
              </button>
              <button onClick={closePreview} className="text-gray-300 hover:text-white text-lg leading-none px-2">✕</button>
            </div>
          </div>
          <iframe
            src={previewUrl}
            className="flex-1 w-full border-0"
            title={t('shokumu.previewTitle')}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
