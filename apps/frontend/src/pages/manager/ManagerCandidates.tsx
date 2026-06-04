import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import type { ManagerCandidate } from '../../types/manager';

async function downloadBatchCvPdf(candidateIds: string[], accessToken: string | null) {
  const resp = await fetch('/api/export/candidates/batch-cv.pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken ?? ''}`,
    },
    body: JSON.stringify({ candidateIds }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err['message'] as string) ?? `HTTP ${resp.status}`);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `batch-cv-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ListResponse {
  candidates: ManagerCandidate[];
  total: number;
  page: number;
  pageSize: number;
}

interface LpkOption {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<string, { key: string; color: string }> = {
  incomplete:   { key: 'chipIncomplete',  color: 'bg-gray-100 text-gray-600' },
  submitted:    { key: 'chipSubmitted',   color: 'bg-blue-100 text-blue-700' },
  under_review: { key: 'chipUnderReview', color: 'bg-amber-100 text-amber-700' },
  approved:     { key: 'chipApproved',    color: 'bg-green-100 text-green-700' },
  confirmed:    { key: 'chipConfirmed',   color: 'bg-yellow-100 text-yellow-700' },
  rejected:     { key: 'chipRejected',    color: 'bg-red-100 text-red-700' },
};

function StatusChip({ status, t }: { status: string; t: (k: string) => string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['incomplete']!;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {t(cfg.key)}
    </span>
  );
}

export default function ManagerCandidates() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();

  const [search, setSearch] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [sswKubun, setSswKubun] = useState('');
  const [lpkId, setLpkId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Clear selection when any filter changes so stale IDs from other filter
  // views (e.g. K6 test users visible on a different LPK tab) don't bleed in.
  useEffect(() => { setSelectedIds(new Set()); }, [search, profileStatus, sswKubun, lpkId]);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (profileStatus) p.set('profileStatus', profileStatus);
    if (sswKubun) p.set('sswKubun', sswKubun);
    if (lpkId) p.set('lpkId', lpkId);
    p.set('page', String(page));
    p.set('pageSize', '20');
    return p.toString();
  }, [search, profileStatus, sswKubun, lpkId, page]);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['manager-candidates', search, profileStatus, sswKubun, lpkId, page],
    queryFn: () => api.get(`/manager/candidates?${buildQuery()}`).then((r) => r.data),
  });

  const { data: lpksData } = useQuery<{ lpks: LpkOption[] }>({
    queryKey: ['manager-lpks'],
    queryFn: () => api.get('/manager/lpks').then((r) => r.data),
    staleTime: 300_000,
  });

  function applyFilters() {
    setPage(1);
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function togglePage(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  async function handleBatchCvDownload() {
    if (selectedIds.size === 0) return;
    setBatchDownloading(true);
    setBatchError(null);
    try {
      await downloadBatchCvPdf([...selectedIds], accessToken);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : 'Download gagal.');
    } finally {
      setBatchDownloading(false);
    }
  }

  const handleExcelDownload = () => {
    const params = new URLSearchParams();
    if (profileStatus) params.set('profileStatus', profileStatus);
    if (lpkId) params.set('lpkId', lpkId);
    const url = `/api/export/candidates.xlsx?${params.toString()}`;
    void fetch(url, { headers: { Authorization: `Bearer ${accessToken ?? ''}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'candidates.xlsx';
        a.click();
      });
  };

  const candidates = data?.candidates ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.ceil(total / pageSize);
  const lpks = lpksData?.lpks ?? [];
  const pageIds = candidates.map((c) => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold text-navy-900">{t('manager.candidates.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              {batchError && <span className="text-xs text-red-500">{batchError}</span>}
              <button
                onClick={() => { void handleBatchCvDownload(); }}
                disabled={batchDownloading}
                className="bg-navy-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-navy-900 transition disabled:opacity-60 flex items-center gap-1.5"
              >
                {batchDownloading ? (
                  <span>Generating…</span>
                ) : (
                  <span>↓ Download CV ({selectedIds.size})</span>
                )}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
              >
                Batal pilih
              </button>
            </div>
          )}
          <button
            onClick={handleExcelDownload}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            ↓ {t('export.excel')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          placeholder={t('filterSearch')}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-navy-300"
        />
        <select
          value={profileStatus}
          onChange={(e) => { setProfileStatus(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
        >
          <option value="">{t('filterAll')}</option>
          <option value="incomplete">{t('chipIncomplete')}</option>
          <option value="submitted">{t('chipSubmitted')}</option>
          <option value="under_review">{t('chipUnderReview')}</option>
          <option value="approved">{t('chipApproved')}</option>
          <option value="confirmed">{t('chipConfirmed')}</option>
          <option value="rejected">{t('chipRejected')}</option>
        </select>
        <select
          value={sswKubun}
          onChange={(e) => { setSswKubun(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
        >
          <option value="">{t('filterAll')} SSW</option>
          <option value="SSW1">SSW1</option>
          <option value="SSW2">SSW2</option>
          <option value="Trainee">Trainee</option>
        </select>
        <select
          value={lpkId}
          onChange={(e) => { setLpkId(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
        >
          <option value="">{t('manager.candidates.lpkFilter')}</option>
          {lpks.map((lpk) => (
            <option key={lpk.id} value={lpk.id}>{lpk.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="text-sm text-gray-400 p-6">{t('loading')}</div>
        ) : candidates.length === 0 ? (
          <div className="text-sm text-gray-400 p-6 text-center">{t('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                      onChange={(e) => togglePage(pageIds, e.target.checked)}
                      className="accent-navy-700 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colCode')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colName')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colLpk')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colStatus')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colSSW')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colCompleteness')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colBodyCheck')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {candidates.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50/60 transition ${selectedIds.has(c.id) ? 'bg-navy-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="accent-navy-700 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.candidateCode}</td>
                    <td className="px-4 py-3 font-medium text-navy-900">{c.fullName}</td>
                    <td className="px-4 py-3 text-gray-600">{c.lpk?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={c.profileStatus} t={t} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.sswKubun ?? '—'}</td>
                    <td className="px-4 py-3">
                      {c.completeness != null ? (
                        <span className="text-xs font-medium text-navy-700">
                          {c.completeness.pct}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.bodyCheck?.overallResult ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.bodyCheck.overallResult === 'pass'
                              ? 'bg-green-100 text-green-700'
                              : c.bodyCheck.overallResult === 'hold'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {c.bodyCheck.overallResult}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate(`/manager/candidates/${c.id}`)}
                          className="text-xs text-navy-600 hover:text-navy-800 font-medium hover:underline"
                        >
                          {t('btnView')}
                        </button>
                        <button
                          onClick={() => navigate(`/manager/candidates/${c.id}/cv`)}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline"
                        >
                          CV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {t('paginationRange', {
              from: (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, total),
              total,
            })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              ‹
            </button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
