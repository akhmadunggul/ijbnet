import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Company {
  id: string;
  name: string;
  nameJa: string | null;
}

interface BatchInfo {
  id: string;
  batchCode: string;
  name: string;
  status: string;
  quotaTotal: number;
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
  confirmedAt: string | null;
  createdAt: string;
  company: Company | null;
  requester: { id: string; name: string } | null;
  batch: BatchInfo | null;
}

const STATUS_TABS = ['all', 'pending', 'confirmed', 'rejected'] as const;

function statusBadge(status: string, t: (k: string) => string) {
  const cls: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-800',
    confirmed: 'bg-green-100 text-green-800',
    rejected:  'bg-red-100 text-red-800',
    closed:    'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {t(`requests.status.${status}`)}
    </span>
  );
}

export default function ManagerRequests() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [confirmModal, setConfirmModal] = useState<RecruitmentRequest | null>(null);
  const [rejectModal, setRejectModal] = useState<RecruitmentRequest | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [allocInput, setAllocInput] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const { data, isLoading } = useQuery<{ requests: RecruitmentRequest[] }>({
    queryKey: ['manager-requests', statusFilter],
    queryFn: () =>
      api.get(`/manager/requests${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`).then((r) => r.data),
  });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmMutation = useMutation({
    mutationFn: (payload: { id: string; allocatedCount?: number; managerNotes?: string }) =>
      api.post(`/manager/requests/${payload.id}/confirm`, {
        allocatedCount: payload.allocatedCount,
        managerNotes: payload.managerNotes,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-requests'] });
      qc.invalidateQueries({ queryKey: ['manager-batches'] });
      setConfirmModal(null);
      showToast(t('requests.confirm.success'));
    },
    onError: () => showToast(t('toastError'), false),
  });

  const rejectMutation = useMutation({
    mutationFn: (payload: { id: string; managerNotes?: string }) =>
      api.post(`/manager/requests/${payload.id}/reject`, { managerNotes: payload.managerNotes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-requests'] });
      setRejectModal(null);
      showToast(t('requests.reject.success'));
    },
    onError: () => showToast(t('toastError'), false),
  });

  const openConfirm = (req: RecruitmentRequest) => {
    setAllocInput(String(Math.ceil(req.requestedCount * 1.5)));
    setManagerNotes('');
    setConfirmModal(req);
  };

  const openReject = (req: RecruitmentRequest) => {
    setManagerNotes('');
    setRejectModal(req);
  };

  const pendingCount = data?.requests.filter((r) => r.status === 'pending').length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-navy-900">{t('requests.managerTitle')}</h1>

      {/* Toast */}
      {toast && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${
          toast.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Pending banner */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <button
          onClick={() => setStatusFilter('pending')}
          className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm hover:bg-amber-100 transition text-left"
        >
          <span className="font-bold">{pendingCount}</span>
          <span>{lang === 'ja' ? '件の未処理リクエストがあります' : 'permintaan menunggu konfirmasi'}</span>
          <span className="ml-auto text-amber-600">→</span>
        </button>
      )}

      {/* Status tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              statusFilter === s
                ? 'border-navy-800 text-navy-800'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'all' ? (lang === 'ja' ? '全て' : 'Semua') : t(`requests.status.${s}`)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('loading')}</div>
        ) : !data?.requests.length ? (
          <div className="p-8 text-center text-gray-400 text-sm">{t('requests.noRequests')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">{t('requests.code')}</th>
                <th className="px-4 py-3 text-left">{lang === 'ja' ? '企業' : 'Perusahaan'}</th>
                <th className="px-4 py-3 text-left">{t('requests.kubun')}</th>
                <th className="px-4 py-3 text-left">{t('requests.field')}</th>
                <th className="px-4 py-3 text-right">{t('requests.requestedCount')}</th>
                <th className="px-4 py-3 text-right">{t('requests.allocatedCount')}</th>
                <th className="px-4 py-3 text-left">{t('requests.status')}</th>
                <th className="px-4 py-3 text-left">{lang === 'ja' ? 'アクション' : 'Aksi'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-navy-800">{req.requestCode}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {lang === 'ja' && req.company?.nameJa ? req.company.nameJa : req.company?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-navy-50 text-navy-700 rounded text-xs font-medium">{req.kubun}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{lang === 'ja' ? req.sswFieldJa : req.sswFieldId}</td>
                  <td className="px-4 py-3 text-right font-medium">{req.requestedCount}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{req.allocatedCount ?? '—'}</td>
                  <td className="px-4 py-3">{statusBadge(req.status, t)}</td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openConfirm(req)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                        >
                          {t('requests.confirm.btn')}
                        </button>
                        <button
                          onClick={() => openReject(req)}
                          className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition"
                        >
                          {t('requests.reject.btn')}
                        </button>
                      </div>
                    ) : req.batch ? (
                      <div>
                        <span className="font-mono text-xs text-navy-700">{req.batch.batchCode}</span>
                        {req.allocatedCount && (
                          <span className="ml-2 text-xs text-gray-400">({req.allocatedCount} {lang === 'ja' ? '名' : 'orang'})</span>
                        )}
                      </div>
                    ) : req.status === 'rejected' && req.managerNotes ? (
                      <span className="text-xs text-gray-500 italic">{req.managerNotes}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Notes column for rejected rows — rendered as expandable detail below */}

      {/* ── Confirm Modal ─────────────────────────────────────────────────────── */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-navy-900 mb-1">{t('requests.confirm.title')}</h3>
            <p className="text-sm text-gray-500 mb-1">
              {confirmModal.requestCode} — {lang === 'ja' ? confirmModal.sswFieldJa : confirmModal.sswFieldId}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              {lang === 'ja' && confirmModal.company?.nameJa
                ? confirmModal.company.nameJa
                : confirmModal.company?.name ?? ''}
              {' · '}{confirmModal.kubun}
            </p>

            {confirmModal.notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 mb-4">
                <span className="font-medium">{t('requests.notes')}: </span>{confirmModal.notes}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('requests.allocatedCount')}
                  <span className="ml-2 text-xs text-gray-400 font-normal">{t('requests.confirm.hint')}</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={allocInput}
                  onChange={(e) => setAllocInput(e.target.value)}
                  className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('requests.managerNotes')}</label>
                <textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder={lang === 'ja' ? '任意' : 'Opsional'}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={() =>
                  confirmMutation.mutate({
                    id: confirmModal.id,
                    allocatedCount: Number(allocInput) || undefined,
                    managerNotes: managerNotes || undefined,
                  })
                }
                disabled={confirmMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                {confirmMutation.isPending ? '…' : t('requests.confirm.btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ──────────────────────────────────────────────────────── */}
      {rejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setRejectModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-navy-900 mb-1">{t('requests.reject.title')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {rejectModal.requestCode} — {lang === 'ja' ? rejectModal.sswFieldJa : rejectModal.sswFieldId}
              {' ('}{rejectModal.kubun}{')'}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('requests.reject.notes')}</label>
              <textarea
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder={lang === 'ja' ? '却下理由（任意）' : 'Alasan penolakan (opsional)'}
              />
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={() =>
                  rejectMutation.mutate({ id: rejectModal.id, managerNotes: managerNotes || undefined })
                }
                disabled={rejectMutation.isPending}
                className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
              >
                {rejectMutation.isPending ? '…' : t('requests.reject.btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
