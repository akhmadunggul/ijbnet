import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface CandidateRow {
  id: string;
  candidateCode: string;
  fullName: string;
  profileStatus: string;
  sswKubun: string | null;
  sswFieldId: string | null;
  lpk?: { id: string; name: string } | null;
  completeness: { pct: number };
}

interface SensitiveData {
  nik: string | null;
  bankAccount: string | null;
  vision: string | null;
  tattoo: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  incomplete: 'bg-orange-100 text-orange-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

function SensitiveModal({
  candidateCode,
  data,
  onClose,
}: {
  candidateCode: string;
  data: SensitiveData;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const copy = (v: string | null) => v && void navigator.clipboard.writeText(v);

  const fields: { label: string; value: string | null; copyable?: boolean }[] = [
    { label: t('superadmin.candidates.colNik'), value: data.nik, copyable: true },
    { label: t('superadmin.candidates.colBank'), value: data.bankAccount, copyable: true },
    { label: t('superadmin.candidates.colVision'), value: data.vision },
    { label: t('superadmin.candidates.colTattoo'), value: data.tattoo },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            {t('superadmin.candidates.sensitiveData')} — {candidateCode}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs p-3 rounded-lg mb-4">
          ⚠️ {t('superadmin.candidates.sensitiveWarning')}
        </div>
        <div className="space-y-3">
          {fields.map(({ label, value, copyable }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 w-28">{label}</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-mono text-gray-900 truncate">{value ?? '—'}</span>
                {copyable && value && (
                  <button
                    onClick={() => copy(value)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0"
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-5 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700"
        >
          {t('btnCancel')} — Close
        </button>
      </div>
    </div>
  );
}

function DeleteModal({
  candidate,
  onClose,
}: {
  candidate: CandidateRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(`/superadmin/candidates/${candidate.id}`, { data: { confirmCode } }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin-candidates'] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('toastError'));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          {t('superadmin.candidates.deleteTitle')}
        </h3>
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-4">
          ⚠️ {t('superadmin.candidates.deleteWarning')}
          <div className="mt-1 font-semibold">
            {candidate.fullName} ({candidate.candidateCode})
          </div>
        </div>
        <label className="text-xs font-medium text-gray-600 block mb-1">
          {t('superadmin.candidates.deleteConfirmCode')}
        </label>
        <input
          type="text"
          value={confirmCode}
          onChange={(e) => setConfirmCode(e.target.value)}
          placeholder={candidate.candidateCode}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
        />
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            {t('btnCancel')}
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={confirmCode !== candidate.candidateCode || deleteMutation.isPending}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40"
          >
            {deleteMutation.isPending ? '…' : t('superadmin.candidates.confirmDelete')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminCandidates() {
  const { t } = useTranslation();
  const { accessToken } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sensitiveTarget, setSensitiveTarget] = useState<{ id: string; code: string } | null>(null);
  const [sensitiveData, setSensitiveData] = useState<SensitiveData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CandidateRow | null>(null);

  const { data, isLoading } = useQuery<{ candidates: CandidateRow[]; total: number; page: number; pageSize: number }>({
    queryKey: ['superadmin-candidates', page, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('profileStatus', statusFilter);
      return api.get(`/superadmin/candidates?${params.toString()}`).then((r) => r.data);
    },
  });

  const sensitiveMutation = useMutation({
    mutationFn: (id: string) => api.get(`/superadmin/candidates/${id}/sensitive`).then((r) => r.data),
    onSuccess: (d: SensitiveData) => setSensitiveData(d),
  });

  const handleSensitive = (id: string, code: string) => {
    setSensitiveTarget({ id, code });
    sensitiveMutation.mutate(id);
  };

  const handleExcelDownload = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('profileStatus', statusFilter);
    const url = `/api/export/candidates.xlsx?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'candidates.xlsx');
    // add auth header via fetch
    void fetch(url, { headers: { Authorization: `Bearer ${accessToken ?? ''}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        a.click();
      });
  };

  const handlePdfDownload = (id: string, code: string) => {
    const url = `/api/export/candidates/${id}/profile.pdf`;
    void fetch(url, { headers: { Authorization: `Bearer ${accessToken ?? ''}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${code}-profile.pdf`;
        a.click();
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.candidates.title')}</h1>
        <button
          onClick={handleExcelDownload}
          className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          ↓ {t('export.excel')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('filterSearch')}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All status</option>
          {['incomplete', 'submitted', 'under_review', 'approved', 'confirmed', 'rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">{t('loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colCode')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('filterLpk')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colStatus')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colSSW')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colCompleteness')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.candidates ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.candidateCode}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.fullName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {(c.lpk as { name: string } | null)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[c.profileStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.profileStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.sswKubun ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${c.completeness.pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{c.completeness.pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleSensitive(c.id, c.candidateCode)}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        {t('superadmin.candidates.sensitiveData')}
                      </button>
                      <button
                        onClick={() => handlePdfDownload(c.id, c.candidateCode)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {t('export.pdf')}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        {t('btnDelete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {t('paginationRange', {
              from: (page - 1) * data.pageSize + 1,
              to: Math.min(page * data.pageSize, data.total),
              total: data.total,
            })}
          </span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="border border-gray-200 rounded px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40">
              ← Prev
            </button>
            <button disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)} className="border border-gray-200 rounded px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>
      )}

      {sensitiveTarget && sensitiveData && (
        <SensitiveModal
          candidateCode={sensitiveTarget.code}
          data={sensitiveData}
          onClose={() => { setSensitiveTarget(null); setSensitiveData(null); }}
        />
      )}

      {deleteTarget && (
        <DeleteModal candidate={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
