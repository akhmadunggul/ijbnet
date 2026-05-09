import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Company { id: string; name: string; nameJa: string | null; }
interface BatchInfo { id: string; batchCode: string; name: string; status: string; quotaTotal: number; }
interface RecruitmentRequest {
  id: string; requestCode: string; kubun: string;
  sswSectorId: string; sswSectorJa: string; sswFieldId: string; sswFieldJa: string;
  requestedCount: number; allocatedCount: number | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'closed';
  notes: string | null; managerNotes: string | null;
  confirmedAt: string | null; createdAt: string;
  company: Company | null; requester: { id: string; name: string } | null; batch: BatchInfo | null;
}
interface PoolCandidate {
  id: string; candidateCode: string; fullName: string;
  gender: string | null; dateOfBirth: string | null;
  sswKubun: string | null; sswFieldId: string | null;
  closeupUrl: string | null;
  bodyCheck: { result: string | null } | null;
  tests: { testName: string | null; pass: boolean | null; score: number | null }[];
}

const STATUS_TABS = ['all', 'pending', 'confirmed', 'rejected'] as const;

function calcAge(dob: string | null) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function getJlpt(tests: PoolCandidate['tests']) {
  for (const lvl of ['N1','N2','N3','N4','N5','JFT-Basic']) {
    const t = tests.find((x) => x.testName?.includes(lvl) && x.pass);
    if (t) return lvl;
  }
  return null;
}

function statusBadge(status: string, t: (k: string) => string) {
  const cls: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800', closed: 'bg-gray-100 text-gray-600',
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
  // Confirm modal state — step 1: details, step 2: select candidates
  const [confirmReq, setConfirmReq] = useState<RecruitmentRequest | null>(null);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [allocInput, setAllocInput] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [rejectModal, setRejectModal] = useState<RecruitmentRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const { data, isLoading } = useQuery<{ requests: RecruitmentRequest[] }>({
    queryKey: ['manager-requests', statusFilter],
    queryFn: () =>
      api.get(`/manager/requests${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`).then((r) => r.data),
  });

  // Candidate pool for selected request (step 2)
  const { data: poolData, isLoading: poolLoading } = useQuery<{ candidates: PoolCandidate[] }>({
    queryKey: ['request-pool', confirmReq?.id],
    queryFn: () => api.get(`/manager/requests/${confirmReq!.id}/pool`).then((r) => r.data),
    enabled: !!confirmReq && confirmStep === 2,
  });

  const target = confirmReq ? confirmReq.requestedCount * 2 : 0;

  const confirmMutation = useMutation({
    mutationFn: (payload: { id: string; allocatedCount?: number; managerNotes?: string; candidateIds: string[] }) =>
      api.post(`/manager/requests/${payload.id}/confirm`, {
        allocatedCount: payload.allocatedCount,
        managerNotes: payload.managerNotes,
        candidateIds: payload.candidateIds,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-requests'] });
      qc.invalidateQueries({ queryKey: ['manager-batches'] });
      setConfirmReq(null);
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
    setAllocInput(String(req.requestedCount * 2));
    setManagerNotes('');
    setSelectedIds(new Set());
    setConfirmStep(1);
    setConfirmReq(req);
  };

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < target) next.add(id);
      return next;
    });
  };

  const pendingCount = data?.requests.filter((r) => r.status === 'pending').length ?? 0;

  // Filter pool by search
  const [poolSearch, setPoolSearch] = useState('');
  const filteredPool = useMemo(() => {
    const q = poolSearch.toLowerCase();
    return (poolData?.candidates ?? []).filter(
      (c) => !q || c.fullName.toLowerCase().includes(q) || c.candidateCode.toLowerCase().includes(q),
    );
  }, [poolData, poolSearch]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-navy-900">{t('requests.managerTitle')}</h1>

      {toast && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${toast.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.msg}
        </div>
      )}

      {pendingCount > 0 && statusFilter !== 'pending' && (
        <button
          onClick={() => setStatusFilter('pending')}
          className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm hover:bg-amber-100 transition text-left"
        >
          <span className="font-bold">{pendingCount}</span>
          <span>{lang === 'ja' ? '件の未処理リクエストがあります' : 'permintaan menunggu konfirmasi'}</span>
          <span className="ml-auto">→</span>
        </button>
      )}

      <div className="flex gap-0 border-b border-gray-200">
        {STATUS_TABS.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${statusFilter === s ? 'border-navy-800 text-navy-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {s === 'all' ? (lang === 'ja' ? '全て' : 'Semua') : t(`requests.status.${s}`)}
          </button>
        ))}
      </div>

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
                  <td className="px-4 py-3 text-gray-700">{lang === 'ja' && req.company?.nameJa ? req.company.nameJa : req.company?.name ?? '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-navy-50 text-navy-700 rounded text-xs font-medium">{req.kubun}</span></td>
                  <td className="px-4 py-3 text-gray-700">{lang === 'ja' ? req.sswFieldJa : req.sswFieldId}</td>
                  <td className="px-4 py-3 text-right font-medium">{req.requestedCount}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{req.allocatedCount ?? '—'}</td>
                  <td className="px-4 py-3">{statusBadge(req.status, t)}</td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button onClick={() => openConfirm(req)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition">
                          {t('requests.confirm.btn')}
                        </button>
                        <button onClick={() => { setRejectNotes(''); setRejectModal(req); }}
                          className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition">
                          {t('requests.reject.btn')}
                        </button>
                      </div>
                    ) : req.batch ? (
                      <span className="font-mono text-xs text-navy-700">{req.batch.batchCode}</span>
                    ) : req.managerNotes ? (
                      <span className="text-xs text-gray-500 italic">{req.managerNotes}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Confirm Modal ─────────────────────────────────────────────────────────── */}
      {confirmReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmReq(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-navy-900">{t('requests.confirm.title')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {confirmReq.requestCode} · {lang === 'ja' ? confirmReq.sswFieldJa : confirmReq.sswFieldId} ({confirmReq.kubun})
                  {' · '}{lang === 'ja' && confirmReq.company?.nameJa ? confirmReq.company.nameJa : confirmReq.company?.name}
                </p>
              </div>
              {/* Step indicator */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={confirmStep === 1 ? 'font-bold text-navy-700' : ''}>{lang === 'ja' ? '1. 詳細' : '1. Detail'}</span>
                <span>→</span>
                <span className={confirmStep === 2 ? 'font-bold text-navy-700' : ''}>{lang === 'ja' ? '2. 候補者選択' : '2. Pilih Kandidat'}</span>
              </div>
            </div>

            {/* Step 1: details */}
            {confirmStep === 1 && (
              <div className="px-6 py-5 space-y-4 overflow-y-auto">
                {confirmReq.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
                    <span className="font-medium">{t('requests.notes')}: </span>{confirmReq.notes}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ja' ? '希望人数' : 'Jumlah diminta'}</label>
                    <p className="text-2xl font-bold text-navy-800">{confirmReq.requestedCount}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {t('requests.allocatedCount')} <span className="text-gray-300">({t('requests.confirm.hint')})</span>
                    </label>
                    <input type="number" min={1} value={allocInput}
                      onChange={(e) => setAllocInput(e.target.value)}
                      className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('requests.managerNotes')}</label>
                  <textarea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)}
                    rows={2} placeholder={lang === 'ja' ? '任意' : 'Opsional'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                </div>
              </div>
            )}

            {/* Step 2: candidate selection */}
            {confirmStep === 2 && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
                  <input type="text" value={poolSearch} onChange={(e) => setPoolSearch(e.target.value)}
                    placeholder={lang === 'ja' ? '名前・コードで検索…' : 'Cari nama atau kode…'}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                  <span className={`text-sm font-medium ${selectedIds.size >= target ? 'text-green-600' : 'text-gray-500'}`}>
                    {selectedIds.size} / {target} {lang === 'ja' ? '名選択' : 'dipilih'}
                  </span>
                </div>

                <div className="overflow-y-auto flex-1 px-6 py-3">
                  {poolLoading ? (
                    <div className="text-center py-8 text-gray-400 text-sm">{t('loading')}</div>
                  ) : !filteredPool.length ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      {lang === 'ja' ? '該当する候補者がいません' : 'Tidak ada kandidat yang sesuai'}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left w-8" />
                          <th className="px-3 py-2 text-left">{lang === 'ja' ? '候補者' : 'Kandidat'}</th>
                          <th className="px-3 py-2 text-center">{lang === 'ja' ? '性別' : 'JK'}</th>
                          <th className="px-3 py-2 text-center">{lang === 'ja' ? '年齢' : 'Umur'}</th>
                          <th className="px-3 py-2 text-center">JLPT</th>
                          <th className="px-3 py-2 text-center">{lang === 'ja' ? '体力' : 'Cek Fisik'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredPool.map((c) => {
                          const checked = selectedIds.has(c.id);
                          const disabled = !checked && selectedIds.size >= target;
                          return (
                            <tr key={c.id}
                              onClick={() => !disabled && toggleCandidate(c.id)}
                              className={`cursor-pointer transition ${checked ? 'bg-green-50' : disabled ? 'opacity-40' : 'hover:bg-gray-50'}`}>
                              <td className="px-3 py-2 text-center">
                                <input type="checkbox" checked={checked} readOnly disabled={disabled}
                                  className="accent-green-600" />
                              </td>
                              <td className="px-3 py-2">
                                <p className="font-medium text-navy-800">{c.fullName}</p>
                                <p className="text-xs text-gray-400">{c.candidateCode}</p>
                              </td>
                              <td className="px-3 py-2 text-center text-xs">{c.gender === 'M' ? (lang === 'ja' ? '男' : 'L') : c.gender === 'F' ? (lang === 'ja' ? '女' : 'P') : '—'}</td>
                              <td className="px-3 py-2 text-center text-xs">{calcAge(c.dateOfBirth) ?? '—'}</td>
                              <td className="px-3 py-2 text-center text-xs font-medium">{getJlpt(c.tests) ?? '—'}</td>
                              <td className="px-3 py-2 text-center">
                                {c.bodyCheck?.result === 'pass' ? <span className="text-green-600 text-xs">✓</span>
                                  : c.bodyCheck?.result === 'fail' ? <span className="text-red-500 text-xs">✗</span>
                                  : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <button onClick={() => setConfirmReq(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                {t('btnCancel')}
              </button>
              <div className="flex gap-3">
                {confirmStep === 2 && (
                  <button onClick={() => setConfirmStep(1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                    ← {lang === 'ja' ? '戻る' : 'Kembali'}
                  </button>
                )}
                {confirmStep === 1 ? (
                  <button onClick={() => setConfirmStep(2)}
                    className="px-5 py-2 bg-navy-800 text-white text-sm rounded-lg hover:bg-navy-700 transition">
                    {lang === 'ja' ? '候補者を選択 →' : 'Pilih Kandidat →'}
                  </button>
                ) : (
                  <button
                    onClick={() => confirmMutation.mutate({
                      id: confirmReq.id,
                      allocatedCount: Number(allocInput) || undefined,
                      managerNotes: managerNotes || undefined,
                      candidateIds: Array.from(selectedIds),
                    })}
                    disabled={confirmMutation.isPending}
                    className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                    {confirmMutation.isPending ? '…' : `${t('requests.confirm.btn')} (${selectedIds.size})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ──────────────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-navy-900 mb-1">{t('requests.reject.title')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {rejectModal.requestCode} — {lang === 'ja' ? rejectModal.sswFieldJa : rejectModal.sswFieldId} ({rejectModal.kubun})
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('requests.reject.notes')}</label>
              <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
                rows={3} placeholder={lang === 'ja' ? '却下理由（任意）' : 'Alasan penolakan (opsional)'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">{t('btnCancel')}</button>
              <button onClick={() => rejectMutation.mutate({ id: rejectModal.id, managerNotes: rejectNotes || undefined })}
                disabled={rejectMutation.isPending}
                className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition">
                {rejectMutation.isPending ? '…' : t('requests.reject.btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
