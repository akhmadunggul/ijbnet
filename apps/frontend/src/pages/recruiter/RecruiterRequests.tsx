import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface SswOption {
  id: string;
  kubun: string;
  sectorId: string;
  sectorJa: string;
  fieldId: string;
  fieldJa: string;
}

interface BatchInfo {
  id: string;
  batchCode: string;
  name: string;
  status: string;
}

interface RecruitmentRequest {
  id: string;
  requestCode: string;
  kubun: string;
  sswSectorId: string;
  sswSectorJa: string;
  sswFieldId: string;
  sswFieldJa: string;
  requestedCount: number;
  allocatedCount: number | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'closed';
  notes: string | null;
  managerNotes: string | null;
  createdAt: string;
  batch: BatchInfo | null;
}

const KUBUN_OPTIONS = ['SSW1', 'SSW2', 'Trainee'] as const;

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
  closed:    'bg-gray-100 text-gray-600',
};

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {t(`requests.status.${status}`)}
    </span>
  );
}

export default function RecruiterRequests() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const qc = useQueryClient();

  const [form, setForm] = useState({
    kubun: 'SSW1' as 'SSW1' | 'SSW2' | 'Trainee',
    sswSectorId: '',
    sswFieldId: '',
    requestedCount: 1,
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState('');

  const { data: sswOptions = [] } = useQuery<SswOption[]>({
    queryKey: ['ssw-options'],
    queryFn: () => api.get('/candidates/ssw-options').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery<{ requests: RecruitmentRequest[] }>({
    queryKey: ['recruiter-requests'],
    queryFn: () => api.get('/recruiter/requests').then((r) => r.data),
  });

  const sectors = useMemo(() => {
    const seen = new Set<string>();
    return sswOptions
      .filter((o) => o.kubun === form.kubun)
      .filter((o) => { if (seen.has(o.sectorId)) return false; seen.add(o.sectorId); return true; });
  }, [sswOptions, form.kubun]);

  const fields = useMemo(() =>
    sswOptions.filter((o) => o.kubun === form.kubun && o.sectorId === form.sswSectorId),
    [sswOptions, form.kubun, form.sswSectorId],
  );

  const getOption = (kubun: string, sectorId: string, fieldId: string) =>
    sswOptions.find((o) => o.kubun === kubun && o.sectorId === sectorId && o.fieldId === fieldId);

  const submitMutation = useMutation({
    mutationFn: (payload: typeof form & { sswSectorJa: string; sswFieldJa: string }) =>
      api.post('/recruiter/requests', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-requests'] });
      setToast(t('requests.form.submitSuccess'));
      setSubmitted(true);
      setForm({ kubun: 'SSW1', sswSectorId: '', sswFieldId: '', requestedCount: 1, notes: '' });
      setTimeout(() => setToast(''), 4000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const opt = getOption(form.kubun, form.sswSectorId, form.sswFieldId);
    submitMutation.mutate({
      ...form,
      sswSectorJa: opt?.sectorJa ?? form.sswSectorId,
      sswFieldJa:  opt?.fieldJa  ?? form.sswFieldId,
    });
  };

  const requests = data?.requests ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">{t('requests.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('requests.subtitle')}</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <span>✓</span> {toast}
        </div>
      )}

      {/* New Request Form — always visible */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-navy-800 mb-1">{t('requests.form.title')}</h2>
        <p className="text-xs text-gray-400 mb-5">{t('requests.form.description')}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Program type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('requests.kubun')}</label>
            <div className="flex gap-6">
              {KUBUN_OPTIONS.map((k) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="kubun"
                    value={k}
                    checked={form.kubun === k}
                    onChange={() => setForm((f) => ({ ...f, kubun: k, sswSectorId: '', sswFieldId: '' }))}
                    className="accent-navy-800 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">{k}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sector + Field */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('requests.sector')}</label>
              <select
                value={form.sswSectorId}
                onChange={(e) => setForm((f) => ({ ...f, sswSectorId: e.target.value, sswFieldId: '' }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-300"
                required
              >
                <option value="">{t('requests.form.selectSector')}</option>
                {sectors.map((s) => (
                  <option key={s.sectorId} value={s.sectorId}>
                    {lang === 'ja' ? s.sectorJa : s.sectorId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('requests.field')}</label>
              <select
                value={form.sswFieldId}
                onChange={(e) => setForm((f) => ({ ...f, sswFieldId: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-navy-300"
                required
                disabled={!form.sswSectorId}
              >
                <option value="">{t('requests.form.selectField')}</option>
                {fields.map((f) => (
                  <option key={f.fieldId} value={f.fieldId}>
                    {lang === 'ja' ? f.fieldJa : f.fieldId}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vacancy count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('requests.requestedCount')}</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={200}
                value={form.requestedCount}
                onChange={(e) => setForm((f) => ({ ...f, requestedCount: Number(e.target.value) }))}
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                required
              />
              <span className="text-xs text-gray-400">{t('requests.form.countHint')}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('requests.notes')}
              <span className="ml-1 text-gray-400 font-normal">({t('optional')})</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder={t('requests.form.notesHint')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy-300"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={submitMutation.isPending || !form.sswSectorId || !form.sswFieldId}
              className="px-6 py-2.5 bg-navy-800 text-white text-sm font-medium rounded-lg hover:bg-navy-700 disabled:opacity-50 transition"
            >
              {submitMutation.isPending ? t('loading') : t('requests.form.submitBtn')}
            </button>
          </div>
        </form>
      </div>

      {/* Requests history */}
      <div>
        <h2 className="text-base font-semibold text-navy-800 mb-3">{t('requests.historyTitle')}</h2>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">{t('loading')}</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-gray-400 text-sm">{submitted ? t('requests.noRequests') : t('requests.noRequestsYet')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.code')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.kubun')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.field')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('requests.requestedCount')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('requests.allocatedCount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.batch')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono font-medium text-navy-800 text-xs">{req.requestCode}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-navy-50 text-navy-700 rounded text-xs font-medium">{req.kubun}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {lang === 'ja' ? req.sswFieldJa : req.sswFieldId}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{req.requestedCount}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{req.allocatedCount ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={req.status} t={t} /></td>
                      <td className="px-4 py-3">
                        {req.batch ? (
                          <span className="font-mono text-xs text-navy-700">{req.batch.batchCode}</span>
                        ) : req.status === 'rejected' && req.managerNotes ? (
                          <span className="text-xs text-gray-500 italic">{req.managerNotes}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
