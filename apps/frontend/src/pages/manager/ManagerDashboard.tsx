import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ManagerStats } from '../../types/manager';

const STATUS_CHIP_COLORS: Record<string, string> = {
  incomplete:   'bg-gray-100 text-gray-600',
  submitted:    'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved:     'bg-green-100 text-green-700',
  confirmed:    'bg-yellow-100 text-yellow-700',
  rejected:     'bg-red-100 text-red-700',
};

function StatCard({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-2 shadow-sm">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

export default function ManagerDashboard() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<ManagerStats>({
    queryKey: ['manager-stats'],
    queryFn: () => api.get('/manager/stats').then((r) => r.data),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-400">{t('loading')}</div>;
  }

  const stats = data ?? {
    candidatesByStatus: {},
    activeBatches: 0,
    pendingApprovals: 0,
    interviewsThisWeek: 0,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-navy-900">{t('manager.dashboard.title')}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label={t('manager.dashboard.pendingApprovals')}
          value={stats.pendingApprovals}
          colorClass="text-amber-600"
        />
        <StatCard
          label={t('manager.dashboard.activeBatches')}
          value={stats.activeBatches}
          colorClass="text-navy-700"
        />
        <StatCard
          label={t('manager.dashboard.interviewsThisWeek')}
          value={stats.interviewsThisWeek}
          colorClass="text-green-600"
        />
      </div>

      {/* Candidates by status */}
      {Object.keys(stats.candidatesByStatus).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-navy-900 mb-3">
            {t('manager.dashboard.candidatesByStatus')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.candidatesByStatus).map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  STATUS_CHIP_COLORS[status] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {status}
                <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
