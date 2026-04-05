import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { ManagerBatch } from '../../types/manager';

interface BatchListResponse {
  batches: ManagerBatch[];
}

interface CompanyOption {
  id: string;
  name: string;
  nameJa: string | null;
}

interface CompaniesResponse {
  companies: CompanyOption[];
}

const BATCH_STATUS_CONFIG: Record<string, { key: string; color: string }> = {
  draft:     { key: 'chipDraft',     color: 'bg-gray-100 text-gray-600' },
  active:    { key: 'chipActive',    color: 'bg-blue-100 text-blue-700' },
  selection: { key: 'chipSelection', color: 'bg-amber-100 text-amber-700' },
  approved:  { key: 'chipApproved',  color: 'bg-green-100 text-green-700' },
  closed:    { key: 'chipClosed',    color: 'bg-gray-200 text-gray-500' },
};

function BatchStatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const cfg = BATCH_STATUS_CONFIG[status] ?? BATCH_STATUS_CONFIG['draft']!;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {t(cfg.key)}
    </span>
  );
}

interface CreateBatchForm {
  batchCode: string;
  name: string;
  companyId: string;
  quotaTotal: string;
  interviewCandidateLimit: string;
  sswFieldFilter: string;
  expiryDate: string;
}

const EMPTY_FORM: CreateBatchForm = {
  batchCode: '',
  name: '',
  companyId: '',
  quotaTotal: '',
  interviewCandidateLimit: '',
  sswFieldFilter: '',
  expiryDate: '',
};

export default function ManagerBatches() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateBatchForm>(EMPTY_FORM);

  const { data, isLoading } = useQuery<BatchListResponse>({
    queryKey: ['manager-batches'],
    queryFn: () => api.get('/manager/batches').then((r) => r.data),
  });

  const { data: companiesData } = useQuery<CompaniesResponse>({
    queryKey: ['manager-companies'],
    queryFn: () => api.get('/manager/companies').then((r) => r.data),
    staleTime: 300_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/manager/batches', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-batches'] });
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/manager/batches/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-batches'] });
    },
  });

  function handleCreate() {
    if (!form.batchCode) return;
    const payload: Record<string, unknown> = { batchCode: form.batchCode };
    if (form.name) payload.name = form.name;
    if (form.companyId) payload.companyId = form.companyId;
    if (form.quotaTotal) payload.quotaTotal = Number(form.quotaTotal);
    if (form.interviewCandidateLimit) payload.interviewCandidateLimit = Number(form.interviewCandidateLimit);
    if (form.sswFieldFilter) payload.sswFieldFilter = form.sswFieldFilter;
    if (form.expiryDate) payload.expiryDate = form.expiryDate;
    createMutation.mutate(payload);
  }

  const batches = data?.batches ?? [];
  const companies = companiesData?.companies ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy-900">{t('manager.batches.title')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="text-sm bg-navy-700 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition"
        >
          + {t('manager.batches.create')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="text-sm text-gray-400 p-6">{t('loading')}</div>
        ) : batches.length === 0 ? (
          <div className="text-sm text-gray-400 p-6 text-center">{t('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('manager.batches.batchCode')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('manager.batches.company')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('batchStatus')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('manager.batches.quota')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('manager.batches.selected')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colConfirmed')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('manager.batches.expiryDate')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.batchCode ?? '—'}</td>
                    <td className="px-4 py-3 text-navy-900">
                      {b.company
                        ? (lang === 'ja' && b.company.nameJa ? b.company.nameJa : b.company.name)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <BatchStatusBadge status={b.status} t={t} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.quotaTotal ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{b.selectedCount ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{b.confirmedCount ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/manager/batches/${b.id}`)}
                          className="text-xs text-navy-600 hover:underline font-medium"
                        >
                          {t('btnView')}
                        </button>
                        {b.status === 'draft' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: b.id, status: 'active' })}
                            disabled={statusMutation.isPending}
                            className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100 transition disabled:opacity-50"
                          >
                            {t('manager.batches.activate')}
                          </button>
                        )}
                        {b.status === 'selection' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: b.id, status: 'approved' })}
                            disabled={statusMutation.isPending}
                            className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded hover:bg-green-100 transition disabled:opacity-50"
                          >
                            {t('manager.batches.approve')}
                          </button>
                        )}
                        {(b.status === 'active' || b.status === 'selection') && (
                          <button
                            onClick={() => statusMutation.mutate({ id: b.id, status: 'closed' })}
                            disabled={statusMutation.isPending}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded hover:bg-gray-200 transition disabled:opacity-50"
                          >
                            {t('manager.batches.close')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Batch Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-navy-900">{t('manager.batches.create')}</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {t('manager.batches.batchCode')} *
                </label>
                <input
                  type="text"
                  value={form.batchCode}
                  onChange={(e) => setForm((f) => ({ ...f, batchCode: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {t('manager.batches.name')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {t('manager.batches.company')}
                </label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                >
                  <option value="">{t('filterAll')}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {lang === 'ja' && c.nameJa ? c.nameJa : c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    {t('manager.batches.quota')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.quotaTotal}
                    onChange={(e) => setForm((f) => ({ ...f, quotaTotal: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    {t('manager.batches.limit')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.interviewCandidateLimit}
                    onChange={(e) => setForm((f) => ({ ...f, interviewCandidateLimit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {t('manager.batches.sswFieldFilter')}
                </label>
                <input
                  type="text"
                  value={form.sswFieldFilter}
                  onChange={(e) => setForm((f) => ({ ...f, sswFieldFilter: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {t('manager.batches.expiryDate')}
                </label>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }}
                className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 border border-gray-200 transition"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.batchCode || createMutation.isPending}
                className="text-sm bg-navy-700 text-white px-4 py-2 rounded-lg hover:bg-navy-800 transition disabled:opacity-50"
              >
                {createMutation.isPending ? t('loading') : t('btnSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
