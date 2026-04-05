import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminDashboardData, AuditLogEntry } from '../../types/admin';

const STATUS_COLORS: Record<string, string> = {
  incomplete: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  confirmed: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-navy-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then((r) => r.data),
  });

  if (isLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>;
  if (!data) return null;

  const { stats, recentLogs } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-navy-900">{t('admin.dashboard.title')}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={lang === 'ja' ? '候補者総数' : 'Total Kandidat'} value={stats.total} />
        <StatCard
          label={t('admin.dashboard.pendingReview')}
          value={stats.pendingReview}
          sub={lang === 'ja' ? '提出 + 審査中' : 'submitted + review'}
        />
        <StatCard
          label={t('admin.dashboard.bodyCheckPending')}
          value={stats.bodyCheckPending}
          sub={`${stats.bodyCheckCompleted} ${lang === 'ja' ? '完了' : 'selesai'}`}
        />
        <StatCard
          label={lang === 'ja' ? '動画リンク' : 'Video Ditautkan'}
          value={stats.videosLinked}
        />
      </div>

      {/* Status breakdown */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">
          {lang === 'ja' ? 'ステータス別' : 'Status Kandidat'}
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.statusBreakdown).map(([status, count]) => (
            <button
              key={status}
              onClick={() => navigate(`/admin/candidates?profileStatus=${status}`)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {status}: {count}
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      {recentLogs.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">{t('admin.dashboard.recentActivity')}</p>
          <ul className="space-y-3">
            {recentLogs.map((log: AuditLogEntry) => (
              <li key={log.id} className="flex items-start gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-navy-300 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                    {log.action}
                  </span>
                  {log.user && (
                    <span className="text-gray-500 ml-2 text-xs">{log.user.name ?? log.user.email}</span>
                  )}
                </div>
                <span className="text-xs text-gray-300 shrink-0">{formatDate(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
