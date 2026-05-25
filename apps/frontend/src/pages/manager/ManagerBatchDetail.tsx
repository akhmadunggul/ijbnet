import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { ManagerBatch, ManagerCandidate } from '../../types/manager';

interface CandidatePoolResponse {
  candidates: ManagerCandidate[];
  total: number;
}

interface LpkOption {
  id: string;
  name: string;
}

export default function ManagerBatchDetail() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'allocation' | 'approval'>('allocation');
  const [poolLpkId, setPoolLpkId] = useState('');
  const [poolKubun, setPoolKubun] = useState('');
  const [selectedPool, setSelectedPool] = useState<Set<string>>(new Set());
  const [allocateError, setAllocateError] = useState<string | null>(null);

  const { data: batch, isLoading } = useQuery<ManagerBatch>({
    queryKey: ['manager-batch', id],
    queryFn: () => api.get(`/manager/batches/${id}`).then((r) => r.data.batch),
    enabled: !!id,
  });

  const { data: lpksData } = useQuery<{ lpks: LpkOption[] }>({
    queryKey: ['manager-lpks'],
    queryFn: () => api.get('/manager/lpks').then((r) => r.data),
    staleTime: 60_000,
  });

  const poolQuery = `profileStatus=approved&pageSize=100${poolLpkId ? `&lpkId=${poolLpkId}` : ''}${poolKubun ? `&sswKubun=${poolKubun}` : ''}`;

  const { data: poolData } = useQuery<CandidatePoolResponse>({
    queryKey: ['manager-candidate-pool', poolLpkId, poolKubun],
    queryFn: () => api.get(`/manager/candidates?${poolQuery}`).then((r) => r.data),
    enabled: activeTab === 'allocation',
  });

  const allocateMutation = useMutation({
    mutationFn: (candidateIds: string[]) =>
      api.post(`/manager/batches/${id}/allocate`, { candidateIds }),
    onSuccess: () => {
      setSelectedPool(new Set());
      setAllocateError(null);
      queryClient.invalidateQueries({ queryKey: ['manager-batch', id] });
    },
    onError: () => {
      setAllocateError(t('manager.batches.allocationError'));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (candidateId: string) =>
      api.delete(`/manager/batches/${id}/allocate/${candidateId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager-batch', id] }),
  });

  const approveOneMutation = useMutation({
    mutationFn: (candidateId: string) =>
      api.patch(`/manager/batches/${id}/candidates/${candidateId}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager-batch', id] }),
  });

  const approveAllMutation = useMutation({
    mutationFn: () => api.post(`/manager/batches/${id}/approve-all`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager-batch', id] }),
  });

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;
  if (!batch) return <div className="text-sm text-gray-400">{t('noData')}</div>;

  const allocations = batch.allocations ?? [];
  const allocatedIds = new Set(allocations.map((a) => a.candidateId));
  const poolCandidates = (poolData?.candidates ?? []).filter((c) => !allocatedIds.has(c.id));
  const selectedAllocations = allocations.filter((a) => a.isSelected);
  const allocationOpen = batch.status === 'draft' || batch.status === 'active';

  const allPoolSelected =
    poolCandidates.length > 0 && poolCandidates.every((c) => selectedPool.has(c.id));

  function toggleSelectAll() {
    if (allPoolSelected) {
      setSelectedPool(new Set());
    } else {
      setSelectedPool(new Set(poolCandidates.map((c) => c.id)));
    }
  }

  function toggleCandidate(candidateId: string) {
    setSelectedPool((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  }

  function handleFilterChange(lpk: string, kubun: string) {
    setPoolLpkId(lpk);
    setPoolKubun(kubun);
    setSelectedPool(new Set());
  }

  const companyName = batch.company
    ? (lang === 'ja' && batch.company.nameJa ? batch.company.nameJa : batch.company.name)
    : '—';

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <button
        onClick={() => navigate('/manager/batches')}
        className="text-sm text-navy-600 hover:underline"
      >
        ← {t('btnBack')}
      </button>

      <div>
        <h1 className="text-2xl font-semibold text-navy-900">
          {batch.batchCode ?? t('manager.batches.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {companyName}
          {batch.quotaTotal != null && (
            <> · {t('manager.batches.quota')}: {batch.quotaTotal}</>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {(['allocation', 'approval'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-navy-700 text-navy-700'
                : 'border-transparent text-gray-500 hover:text-navy-600'
            }`}
          >
            {tab === 'allocation' ? t('manager.batches.allocationTab') : t('manager.batches.approvalTab')}
          </button>
        ))}
      </div>

      {/* Allocation tab */}
      {activeTab === 'allocation' && (
        <div className="space-y-3">
          {/* Locked banner */}
          {!allocationOpen && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
              <span className="text-base">🔒</span>
              <span>{t('manager.batches.allocationLocked', { status: batch.status })}</span>
            </div>
          )}

          {/* Allocate error */}
          {allocateError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              <span className="text-base">⚠</span>
              <span>{allocateError}</span>
              <button onClick={() => setAllocateError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
            </div>
          )}

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Left: Pool */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
            {/* Pool header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-navy-900">
                {t('manager.batches.candidatePool')}
                {poolCandidates.length > 0 && (
                  <span className="ml-1.5 text-gray-400 font-normal">({poolCandidates.length})</span>
                )}
              </h2>
              {selectedPool.size > 0 && allocationOpen && (
                <button
                  onClick={() => allocateMutation.mutate([...selectedPool])}
                  disabled={allocateMutation.isPending}
                  className="text-xs bg-navy-700 text-white px-3 py-1.5 rounded-lg hover:bg-navy-900 disabled:opacity-50 transition font-medium"
                >
                  {allocateMutation.isPending
                    ? t('loading')
                    : t('manager.batches.addSelected', { n: selectedPool.size })}
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={poolLpkId}
                onChange={(e) => handleFilterChange(e.target.value, poolKubun)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-300"
              >
                <option value="">{t('manager.candidates.lpkFilter')}</option>
                {lpksData?.lpks.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <select
                value={poolKubun}
                onChange={(e) => handleFilterChange(poolLpkId, e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-300"
              >
                <option value="">{t('filterAll')} SSW</option>
                <option value="SSW1">SSW1</option>
                <option value="SSW2">SSW2</option>
                <option value="Trainee">Trainee</option>
              </select>
            </div>

            {/* Select-all row */}
            {poolCandidates.length > 0 && (
              <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPoolSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-navy-700 cursor-pointer"
                />
                <span className="text-xs font-medium text-gray-600">
                  {allPoolSelected
                    ? t('manager.batches.deselectAll')
                    : t('manager.batches.selectAll')}
                </span>
              </label>
            )}

            {/* Candidate rows */}
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {poolCandidates.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">{t('noData')}</p>
              ) : (
                poolCandidates.map((c) => {
                  const checked = selectedPool.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition ${
                        checked ? 'bg-navy-50 border border-navy-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCandidate(c.id)}
                        className="w-4 h-4 accent-navy-700 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy-900 truncate">{c.fullName}</p>
                        <p className="text-xs text-gray-400">{c.candidateCode} · {c.sswKubun ?? '—'}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          allocateMutation.mutate([c.id]);
                        }}
                        disabled={allocateMutation.isPending || !allocationOpen}
                        className="w-7 h-7 flex items-center justify-center bg-navy-700 text-white rounded-full hover:bg-navy-900 transition disabled:opacity-50 text-lg leading-none flex-shrink-0"
                        title={t('manager.batches.allocate')}
                      >
                        +
                      </button>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Allocated */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">
              {t('manager.batches.allocated')} ({allocations.length})
            </h2>
            <div className="space-y-1 max-h-[28rem] overflow-y-auto">
              {allocations.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">{t('noData')}</p>
              ) : (
                allocations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy-900">{a.candidate.fullName}</p>
                      <p className="text-xs text-gray-400">
                        {a.candidate.candidateCode}
                        {a.isSelected && (
                          <span className="ml-2 text-green-600 font-medium">
                            · {t('manager.batches.selected')}
                          </span>
                        )}
                      </p>
                    </div>
                    {!a.isSelected && (
                      <button
                        onClick={() => removeMutation.mutate(a.candidateId)}
                        disabled={removeMutation.isPending}
                        className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition disabled:opacity-50 text-lg leading-none"
                      >
                        −
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Approval tab */}
      {activeTab === 'approval' && (
        <div className="space-y-3">
          {selectedAllocations.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => approveAllMutation.mutate()}
                disabled={approveAllMutation.isPending}
                className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition disabled:opacity-50"
              >
                {approveAllMutation.isPending ? t('loading') : t('manager.batches.approveAll')}
              </button>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            {selectedAllocations.length === 0 ? (
              <div className="text-sm text-gray-400 p-6 text-center">{t('noData')}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colName')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colSelectedDate')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colInterviewStatus')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selectedAllocations.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy-900">{a.candidate.fullName}</p>
                        <p className="text-xs text-gray-400">{a.candidate.candidateCode}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {a.selectedAt
                          ? new Date(a.selectedAt).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'id-ID')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {a.proposal ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {t(`selection.interviewStatus.${a.proposal.status}`)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!a.isConfirmed && (
                          <button
                            onClick={() => approveOneMutation.mutate(a.candidateId)}
                            disabled={approveOneMutation.isPending}
                            className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-lg hover:bg-green-100 transition disabled:opacity-50"
                          >
                            {t('manager.batches.approveOne')}
                          </button>
                        )}
                        {a.isConfirmed && (
                          <span className="text-xs text-green-600 font-medium">
                            {t('manager.batches.approved')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
