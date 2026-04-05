import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminCandidate } from '../../types/admin';

interface ListResponse {
  candidates: AdminCandidate[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_CONFIG: Record<string, { label: string; labelJa: string; color: string }> = {
  incomplete:   { label: 'Belum Lengkap', labelJa: '未完成',    color: 'bg-gray-100 text-gray-600' },
  submitted:    { label: 'Diajukan',       labelJa: '提出済み',  color: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'Ditinjau',       labelJa: '審査中',    color: 'bg-amber-100 text-amber-700' },
  approved:     { label: 'Disetujui',      labelJa: '承認済み',  color: 'bg-green-100 text-green-700' },
  confirmed:    { label: 'Dikonfirmasi',   labelJa: '確定済み',  color: 'bg-yellow-100 text-yellow-700' },
  rejected:     { label: 'Ditolak',        labelJa: '不採用',    color: 'bg-red-100 text-red-700' },
};

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['incomplete']!;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {lang === 'ja' ? cfg.labelJa : cfg.label}
    </span>
  );
}

export default function AdminCandidates() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [profileStatus, setProfileStatus] = useState(searchParams.get('profileStatus') ?? '');
  const [sswKubun, setSswKubun] = useState(searchParams.get('sswKubun') ?? '');
  const [page, setPage] = useState(1);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (profileStatus) p.set('profileStatus', profileStatus);
    if (sswKubun) p.set('sswKubun', sswKubun);
    p.set('page', String(page));
    return p.toString();
  }, [search, profileStatus, sswKubun, page]);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['admin-candidates', search, profileStatus, sswKubun, page],
    queryFn: () => api.get(`/admin/candidates?${buildQuery()}`).then((r) => r.data),
  });

  function applyFilters() {
    setPage(1);
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (profileStatus) p.set('profileStatus', profileStatus);
    if (sswKubun) p.set('sswKubun', sswKubun);
    setSearchParams(p);
  }

  const candidates = data?.candidates ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-900">{t('admin.candidates.title')}</h1>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          placeholder={t('admin.candidates.search')}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-navy-300"
        />
        <select
          value={profileStatus}
          onChange={(e) => setProfileStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
        >
          <option value="">{t('filterAll')}</option>
          <option value="incomplete">{lang === 'ja' ? '未完成' : 'Belum Lengkap'}</option>
          <option value="submitted">{lang === 'ja' ? '提出済み' : 'Diajukan'}</option>
          <option value="under_review">{lang === 'ja' ? '審査中' : 'Ditinjau'}</option>
          <option value="approved">{lang === 'ja' ? '承認済み' : 'Disetujui'}</option>
          <option value="rejected">{lang === 'ja' ? '不採用' : 'Ditolak'}</option>
        </select>
        <select
          value={sswKubun}
          onChange={(e) => setSswKubun(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
        >
          <option value="">{lang === 'ja' ? 'SSW全て' : 'Semua SSW'}</option>
          <option value="SSW1">SSW1</option>
          <option value="SSW2">SSW2</option>
        </select>
        <button
          onClick={applyFilters}
          className="bg-navy-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-navy-900 transition"
        >
          {lang === 'ja' ? '検索' : 'Cari'}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-sm text-gray-400">{t('loading')}</div>
      ) : candidates.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">{t('noData')}</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.candidates.colCode')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.candidates.colName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SSW</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.candidates.colStatus')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.candidates.colCompleteness')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.candidates.colBodyCheck')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.candidates.colVideos')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {candidates.map((c) => {
                const bcResult = c.bodyCheck?.overallResult;
                const videoCount = c.videos?.length ?? 0;
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => navigate(`/admin/candidates/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.candidateCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.fullName}</td>
                    <td className="px-4 py-3">
                      {c.sswKubun ? (
                        <span className="px-2 py-0.5 bg-navy-100 text-navy-700 rounded text-xs font-medium">
                          {c.sswKubun}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.profileStatus} lang={lang} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-navy-600 rounded-full"
                            style={{ width: `${c.completeness.pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{c.completeness.pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {bcResult === 'pass' ? (
                        <span className="text-green-600">✓</span>
                      ) : bcResult === 'fail' ? (
                        <span className="text-red-500">✗</span>
                      ) : bcResult === 'hold' ? (
                        <span className="text-amber-500">◌</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{videoCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/admin/candidates/${c.id}`)}
                          className="text-xs text-navy-600 hover:underline"
                        >
                          {t('admin.candidates.actionView')}
                        </button>
                        <button
                          onClick={() => navigate(`/admin/body-check/${c.id}`)}
                          className="text-xs text-amber-600 hover:underline"
                        >
                          {t('admin.candidates.actionBodyCheck')}
                        </button>
                        <button
                          onClick={() => navigate(`/admin/videos/${c.id}`)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {t('admin.candidates.actionVideos')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {total} {lang === 'ja' ? '件' : 'total'}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  ←
                </button>
                <span className="text-xs text-gray-500 px-2 py-1">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
