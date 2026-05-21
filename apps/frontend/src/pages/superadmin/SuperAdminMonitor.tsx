import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface HealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number; limitMb: number };
  db:    { status: 'ok' | 'error'; responseMs: number };
  redis: { status: 'ok' | 'error'; responseMs: number };
  metrics: { errors5xx_1h: number; rateLimitHits_1h: number; dbErrors_1h: number };
  alerts: { email: boolean; telegram: boolean };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}
    />
  );
}

function ServicePill({
  label,
  status,
  responseMs,
}: {
  label: string;
  status: 'ok' | 'error';
  responseMs: number;
}) {
  const ok = status === 'ok';
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        ok ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
      }`}
    >
      <StatusDot ok={ok} />
      <div>
        <div className={`text-sm font-semibold ${ok ? 'text-green-800' : 'text-red-800'}`}>
          {label}
        </div>
        <div className={`text-xs ${ok ? 'text-green-600' : 'text-red-500'}`}>
          {ok ? `${responseMs} ms` : 'Unreachable'}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  warn,
  danger,
}: {
  label: string;
  value: number;
  warn: number;
  danger: number;
}) {
  const color =
    value >= danger
      ? 'text-red-600 bg-red-50 border-red-100'
      : value >= warn
      ? 'text-yellow-600 bg-yellow-50 border-yellow-100'
      : 'text-gray-900 bg-white border-gray-100';

  return (
    <div className={`rounded-xl border shadow-sm p-5 ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs mt-1 font-medium opacity-75">{label}</div>
    </div>
  );
}

function MemoryBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 85 ? 'bg-red-500' : pct >= 65 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{used} MB used</span>
        <span>{limit} MB limit</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-400 text-right">{pct}%</div>
    </div>
  );
}

function AlertBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
        active
          ? 'bg-green-50 border-green-100 text-green-700'
          : 'bg-gray-50 border-gray-100 text-gray-400'
      }`}
    >
      <StatusDot ok={active} />
      {label}
      <span className={`ml-auto ${active ? 'text-green-500' : 'text-gray-300'}`}>
        {active ? '●' : '○'}
      </span>
    </div>
  );
}

export default function SuperAdminMonitor() {
  const { t } = useTranslation();

  const { data, isLoading, dataUpdatedAt } = useQuery<HealthResponse>({
    queryKey: ['superadmin-health'],
    queryFn: () => api.get('/superadmin/system/health').then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <div className="text-sm text-gray-500">{t('loading')}</div>;
  }

  const { status, uptime, memory, db, redis, metrics, alerts } = data;
  const degraded = status === 'degraded';
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.monitor.title')}</h1>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
              degraded
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            <StatusDot ok={!degraded} />
            {degraded ? t('superadmin.monitor.degraded') : t('superadmin.monitor.allGood')}
          </span>
          <span className="text-xs text-gray-400">
            {t('superadmin.monitor.refreshed')}: {lastRefresh}
          </span>
        </div>
      </div>

      {/* Uptime + Services */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col justify-center">
          <div className="text-xs text-gray-500 mb-1">{t('superadmin.monitor.uptime')}</div>
          <div className="text-2xl font-bold text-gray-900">{formatUptime(uptime)}</div>
        </div>
        <ServicePill label={t('superadmin.monitor.db')} status={db.status} responseMs={db.responseMs} />
        <ServicePill label="Redis" status={redis.status} responseMs={redis.responseMs} />
      </div>

      {/* Memory */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('superadmin.monitor.memory')}</h2>
        <MemoryBar used={memory.heapUsedMb} limit={memory.limitMb} />
        <div className="mt-3 flex gap-4 text-xs text-gray-400">
          <span>Heap total: {memory.heapTotalMb} MB</span>
          <span>RSS: {memory.rssMb} MB</span>
        </div>
      </div>

      {/* Metrics */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('superadmin.monitor.metrics1h')}</h2>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            label={t('superadmin.monitor.errors5xx')}
            value={metrics.errors5xx_1h}
            warn={1}
            danger={10}
          />
          <MetricCard
            label={t('superadmin.monitor.rateLimitHits')}
            value={metrics.rateLimitHits_1h}
            warn={20}
            danger={100}
          />
          <MetricCard
            label={t('superadmin.monitor.dbErrors')}
            value={metrics.dbErrors_1h}
            warn={1}
            danger={5}
          />
        </div>
      </div>

      {/* Alert config */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('superadmin.monitor.alerts')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AlertBadge label={t('superadmin.monitor.emailAlert')} active={alerts.email} />
          <AlertBadge label={t('superadmin.monitor.telegramAlert')} active={alerts.telegram} />
        </div>
        {!alerts.email && !alerts.telegram && (
          <p className="mt-3 text-xs text-gray-400">
            {t('superadmin.monitor.noAlertsHint')}
          </p>
        )}
      </div>
    </div>
  );
}
