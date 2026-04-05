import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  targetCandidateId: string | null;
  ipAddress: string | null;
  payload: unknown;
  createdAt: string;
  user?: { name: string; email: string; role: string } | null;
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  manager: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  recruiter: 'bg-indigo-100 text-indigo-700',
  candidate: 'bg-gray-100 text-gray-700',
};

const ENTITY_TYPES = ['candidate', 'batch', 'user', 'company', 'lpk', 'interview_proposal'];

export default function SuperAdminAuditLog() {
  const { t } = useTranslation();
  const { accessToken } = useAuthStore();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: actionsData } = useQuery<{ actions: string[] }>({
    queryKey: ['audit-log-actions'],
    queryFn: () => api.get('/superadmin/audit-logs/actions').then((r) => r.data),
  });

  const { data, isLoading } = useQuery<{ auditLogs: AuditEntry[]; total: number; page: number; pageSize: number }>({
    queryKey: ['superadmin-audit-logs', page, action, entityType, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (action) params.set('action', action);
      if (entityType) params.set('entityType', entityType);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      return api.get(`/superadmin/audit-logs?${params.toString()}`).then((r) => r.data);
    },
  });

  const handleExportCsv = () => {
    const params = new URLSearchParams({ format: 'csv' });
    if (action) params.set('action', action);
    if (entityType) params.set('entityType', entityType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const url = `/api/superadmin/audit-logs?${params.toString()}`;
    void fetch(url, { headers: { Authorization: `Bearer ${accessToken ?? ''}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'audit-log.csv';
        a.click();
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.auditLog.title')}</h1>
        <button
          onClick={handleExportCsv}
          className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          ↓ {t('superadmin.auditLog.exportCsv')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('superadmin.auditLog.filterAction')}</option>
          {(actionsData?.actions ?? []).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('superadmin.auditLog.filterEntityType')}</option>
          {ENTITY_TYPES.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">{t('superadmin.auditLog.filterDateFrom')}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">{t('superadmin.auditLog.filterDateTo')}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">{t('loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.auditLog.colTimestamp')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.auditLog.colUser')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.auditLog.colAction')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.auditLog.colEntity')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t('superadmin.auditLog.colIp')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.auditLogs ?? []).map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {entry.user ? (
                        <div>
                          <span className="text-xs text-gray-900">{entry.user.name ?? entry.user.email}</span>
                          <span className={`ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ROLE_BADGE[entry.user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                            {entry.user.role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-medium text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {entry.entityType ?? '—'}
                      {entry.entityId && (
                        <span className="ml-1 font-mono text-[10px] text-gray-400">
                          {entry.entityId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{entry.ipAddress ?? '—'}</td>
                  </tr>
                  {expanded === entry.id && entry.payload && (
                    <tr key={`${entry.id}-payload`} className="bg-gray-900">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="text-xs text-gray-300 mb-1 font-medium">{t('superadmin.auditLog.expandPayload')}</div>
                        <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap overflow-auto max-h-48">
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
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
    </div>
  );
}
