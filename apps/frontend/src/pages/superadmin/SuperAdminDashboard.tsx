import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface StatsResponse {
  users: { total: number; byRole: Record<string, number> };
  candidates: { total: number; byStatus: Record<string, number> };
  batches: { total: number; active: number; byStatus: Record<string, number> };
  interviews: { proposed: number; scheduled: number; completed: number };
  dbStatus: 'ok' | 'error';
  recentAuditEntries: Array<{
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
    user?: { name: string; email: string; role: string } | null;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  incomplete: 'bg-orange-100 text-orange-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  manager: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  recruiter: 'bg-indigo-100 text-indigo-700',
  candidate: 'bg-gray-100 text-gray-700',
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<StatsResponse>({
    queryKey: ['superadmin-stats'],
    queryFn: () => api.get('/superadmin/system/stats').then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <div className="text-sm text-gray-500">{t('loading')}</div>;
  }

  const { users, candidates, batches, interviews, dbStatus, recentAuditEntries } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.dashboard.title')}</h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              dbStatus === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dbStatus === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
            {t('superadmin.dashboard.dbStatus')}:{' '}
            {dbStatus === 'ok' ? t('superadmin.dashboard.connected') : t('superadmin.dashboard.error')}
          </span>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('superadmin.dashboard.totalUsers')} value={users.total} />
        <StatCard label={t('superadmin.dashboard.totalCandidates')} value={candidates.total} />
        <StatCard label={t('superadmin.dashboard.activeBatches')} value={batches.active} sub={`/ ${batches.total} total`} />
        <StatCard
          label={t('superadmin.dashboard.interviewsPipeline')}
          value={interviews.proposed + interviews.scheduled}
          sub={`${interviews.completed} completed`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by role */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('superadmin.dashboard.totalUsers')}</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(users.byRole).map(([role, count]) => (
              <span
                key={role}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {role}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Candidates by status */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('superadmin.dashboard.totalCandidates')}</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(candidates.byStatus).map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('superadmin.dashboard.recentActivity')}</h2>
        {recentAuditEntries.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noData')}</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentAuditEntries.map((entry) => (
              <div key={entry.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono font-medium text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">
                    {entry.action}
                  </span>
                  {entry.user && (
                    <span className="ml-2 text-xs text-gray-500">
                      {entry.user.name ?? entry.user.email}
                      <span
                        className={`ml-1 inline-flex items-center text-[10px] px-1 rounded ${ROLE_COLORS[entry.user.role] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {entry.user.role}
                      </span>
                    </span>
                  )}
                  {entry.entityType && (
                    <span className="ml-2 text-xs text-gray-400">→ {entry.entityType}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
