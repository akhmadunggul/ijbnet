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

type EditForm = {
  kubun: 'SSW1' | 'SSW2' | 'Trainee';
  sswSectorId: string;
  sswFieldId: string;
  requestedCount: number;
  notes: string;
};

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
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [editingRequest, setEditingRequest] = useState<RecruitmentRequest | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ kubun: 'SSW1', sswSectorId: '', sswFieldId: '', requestedCount: 1, notes: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

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

  const editSectors = useMemo(() => {
    const seen = new Set<string>();
    return sswOptions
      .filter((o) => o.kubun === editForm.kubun)
      .filter((o) => { if (seen.has(o.sectorId)) return false; seen.add(o.sectorId); return true; });
  }, [sswOptions, editForm.kubun]);

  const editFields = useMemo(() =>
    sswOptions.filter((o) => o.kubun === editForm.kubun && o.sectorId === editForm.sswSectorId),
    [sswOptions, editForm.kubun, editForm.sswSectorId],
  );

  const getOption = (kubun: string, sectorId: string, fieldId: string) =>
    sswOptions.find((o) => o.kubun === kubun && o.sectorId === sectorId && o.fieldId === fieldId);

  const submitMutation = useMutation({
    mutationFn: (payload: typeof form & { sswSectorJa: string; sswFieldJa: string }) =>
      api.post('/recruiter/requests', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-requests'] });
      showToast(t('requests.form.submitSuccess'));
      setSubmitted(true);
      setForm({ kubun: 'SSW1', sswSectorId: '', sswFieldId: '', requestedCount: 1, notes: '' });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditForm & { sswSectorJa: string; sswFieldJa: string } }) =>
      api.patch(`/recruiter/requests/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-requests'] });
      showToast(t('requests.editSuccess'));
      setEditingRequest(null);
    },
    onError: () => showToast(t('error'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recruiter/requests/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter-requests'] });
      showToast(t('requests.deleteSuccess'));
      setDeletingId(null);
    },
    onError: () => showToast(t('error'), 'error'),
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

  const openEdit = (req: RecruitmentRequest) => {
    setEditForm({
      kubun: req.kubun as 'SSW1' | 'SSW2' | 'Trainee',
      sswSectorId: req.sswSectorId,
      sswFieldId: req.sswFieldId,
      requestedCount: req.requestedCount,
      notes: req.notes ?? '',
    });
    setEditingRequest(req);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    const opt = getOption(editForm.kubun, editForm.sswSectorId, editForm.sswFieldId);
    editMutation.mutate({
      id: editingRequest.id,
      payload: {
        ...editForm,
        sswSectorJa: opt?.sectorJa ?? editForm.sswSectorId,
        sswFieldJa:  opt?.fieldJa  ?? editForm.sswFieldId,
      },
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
        <div className={`border px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${toastType === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          <span>{toastType === 'error' ? '✗' : '✓'}</span> {toast}
        </div>
      )}

      {/* New Request Form — always visible */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-navy-700 mb-1">{t('requests.form.title')}</h2>
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
                    className="accent-navy-700 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {k === 'Trainee' && lang === 'ja' ? '研修生' : k}
                  </span>
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-100"
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-navy-100"
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
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-100"
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
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy-100"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="px-6 py-2.5 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-900 disabled:opacity-60 transition"
            >
              {submitMutation.isPending ? t('loading') : t('requests.form.submitBtn')}
            </button>
          </div>
        </form>
      </div>

      {/* Requests history */}
      <div>
        <h2 className="text-base font-semibold text-navy-700 mb-3">{t('requests.historyTitle')}</h2>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{lang === 'ja' ? '日付' : 'Tanggal'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.kubun')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{lang === 'ja' ? '分野' : 'Sektor'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.field')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('requests.requestedCount')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('requests.allocatedCount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.batch')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('requests.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono font-medium text-navy-700 text-xs">{req.requestCode}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-navy-50 text-navy-700 rounded text-xs font-medium">
                          {req.kubun === 'Trainee' && lang === 'ja' ? '研修生' : req.kubun}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {lang === 'ja' ? req.sswSectorJa : req.sswSectorId}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {lang === 'ja' ? req.sswFieldJa : req.sswFieldId}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {req.requestedCount}{lang === 'ja' ? '名' : ''}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {req.allocatedCount != null ? `${req.allocatedCount}${lang === 'ja' ? '名' : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={req.status} t={t} /></td>
                      <td className="px-4 py-3">
                        {req.batch ? (
                          <span className="font-mono text-xs text-navy-700">{req.batch.batchCode}</span>
                        ) : req.status === 'rejected' && req.managerNotes ? (
                          <span className="text-xs text-gray-500 italic">{req.managerNotes}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(req)}
                              className="p-1.5 rounded text-navy-600 hover:bg-navy-50 transition"
                              title={t('requests.editBtn')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletingId(req.id)}
                              className="p-1.5 rounded text-red-500 hover:bg-red-50 transition"
                              title={t('requests.deleteBtn')}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1h4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-navy-900">{t('requests.editTitle')}</h3>
              <button onClick={() => setEditingRequest(null)} className="text-gray-400 hover:text-gray-600 transition text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              {/* Program type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('requests.kubun')}</label>
                <div className="flex gap-6">
                  {KUBUN_OPTIONS.map((k) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="edit-kubun"
                        value={k}
                        checked={editForm.kubun === k}
                        onChange={() => setEditForm((f) => ({ ...f, kubun: k, sswSectorId: '', sswFieldId: '' }))}
                        className="accent-navy-700 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {k === 'Trainee' && lang === 'ja' ? '研修生' : k}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sector + Field */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('requests.sector')}</label>
                  <select
                    value={editForm.sswSectorId}
                    onChange={(e) => setEditForm((f) => ({ ...f, sswSectorId: e.target.value, sswFieldId: '' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-100"
                    required
                  >
                    <option value="">{t('requests.form.selectSector')}</option>
                    {editSectors.map((s) => (
                      <option key={s.sectorId} value={s.sectorId}>
                        {lang === 'ja' ? s.sectorJa : s.sectorId}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('requests.field')}</label>
                  <select
                    value={editForm.sswFieldId}
                    onChange={(e) => setEditForm((f) => ({ ...f, sswFieldId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-navy-100"
                    required
                    disabled={!editForm.sswSectorId}
                  >
                    <option value="">{t('requests.form.selectField')}</option>
                    {editFields.map((f) => (
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
                    value={editForm.requestedCount}
                    onChange={(e) => setEditForm((f) => ({ ...f, requestedCount: Number(e.target.value) }))}
                    className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-100"
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
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder={t('requests.form.notesHint')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="px-5 py-2 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-900 disabled:opacity-60 transition"
                >
                  {editMutation.isPending ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">{t('requests.deleteBtn')}</h3>
            <p className="text-sm text-gray-600">{t('requests.deleteConfirm')}</p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-60 transition"
              >
                {deleteMutation.isPending ? t('loading') : t('requests.deleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
