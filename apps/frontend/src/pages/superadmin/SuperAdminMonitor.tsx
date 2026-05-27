import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface HealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
  db:    { status: 'ok' | 'error'; responseMs: number };
  redis: { status: 'ok' | 'error'; responseMs: number };
  metrics: { errors5xx_1h: number; rateLimitHits_1h: number; dbErrors_1h: number };
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${ok ? 'bg-green-400' : 'bg-red-500'}`}
    />
  );
}

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SuperAdminMonitor() {
  const { t } = useTranslation();

  const { data: health, isLoading } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const grafanaUrl = `${window.location.origin}/grafana`;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">{t('monitor_title', 'System Monitor')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('monitor_grafana_desc', 'Detailed metrics, charts, and history are available in Grafana.')}
            </p>
          </div>
          <a
            href={grafanaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-700 hover:bg-navy-800 text-white text-sm font-medium rounded-lg transition-colors shadow"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {t('monitor_open_grafana', 'Open Grafana')}
          </a>
        </div>

        {/* Health snapshot */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">{t('monitor_health', 'Service Health')}</h2>

          {isLoading && (
            <p className="text-sm text-gray-400">{t('loading', 'Loading…')}</p>
          )}

          {health && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Overall */}
              <div className="flex items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                <StatusDot ok={health.status === 'ok'} />
                <div>
                  <p className="text-xs text-gray-500">{t('monitor_overall', 'Overall')}</p>
                  <p className={`text-sm font-semibold ${health.status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                    {health.status === 'ok' ? t('monitor_ok', 'Healthy') : t('monitor_degraded', 'Degraded')}
                  </p>
                </div>
              </div>

              {/* Uptime */}
              <div className="flex items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                <StatusDot ok={true} />
                <div>
                  <p className="text-xs text-gray-500">{t('monitor_uptime', 'Uptime')}</p>
                  <p className="text-sm font-semibold text-gray-800">{fmt(health.uptime)}</p>
                </div>
              </div>

              {/* Database */}
              <div className="flex items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                <StatusDot ok={health.db.status === 'ok'} />
                <div>
                  <p className="text-xs text-gray-500">{t('monitor_db', 'Database')}</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {health.db.status === 'ok' ? `${health.db.responseMs} ms` : t('monitor_error', 'Error')}
                  </p>
                </div>
              </div>

              {/* Redis */}
              <div className="flex items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                <StatusDot ok={health.redis.status === 'ok'} />
                <div>
                  <p className="text-xs text-gray-500">{t('monitor_redis', 'Redis')}</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {health.redis.status === 'ok' ? `${health.redis.responseMs} ms` : t('monitor_error', 'Error')}
                  </p>
                </div>
              </div>

              {/* Memory */}
              <div className="flex items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                <StatusDot ok={health.memory.heapUsedMb < health.memory.heapTotalMb * 0.85} />
                <div>
                  <p className="text-xs text-gray-500">{t('monitor_memory', 'Heap')}</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {health.memory.heapUsedMb} MB / {health.memory.heapTotalMb} MB
                  </p>
                </div>
              </div>

              {/* 5xx errors */}
              <div className="flex items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                <StatusDot ok={health.metrics.errors5xx_1h < 10} />
                <div>
                  <p className="text-xs text-gray-500">{t('monitor_5xx', '5xx errors (1 h)')}</p>
                  <p className={`text-sm font-semibold ${health.metrics.errors5xx_1h >= 10 ? 'text-red-600' : 'text-gray-800'}`}>
                    {health.metrics.errors5xx_1h}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Grafana CTA */}
        <div className="bg-navy-800 rounded-xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-lg">{t('monitor_grafana_cta', 'View full metrics in Grafana')}</p>
            <p className="text-navy-300 text-sm mt-1">
              {t('monitor_grafana_cta_desc', 'HTTP latency, DB throughput, error rates, Node.js heap, and event loop lag — all in real time.')}
            </p>
          </div>
          <a
            href={grafanaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-gold-500 hover:bg-gold-600 text-navy-900 text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {t('monitor_open_grafana', 'Open Grafana')}
          </a>
        </div>

      </div>
    </div>
  );
}
