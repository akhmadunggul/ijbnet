import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number; limitMb: number };
  db:     { status: 'ok' | 'error'; responseMs: number };
  redis:  { status: 'ok' | 'error'; responseMs: number };
  metrics: { errors5xx_1h: number; rateLimitHits_1h: number; dbErrors_1h: number };
  alerts:  { email: boolean; telegram: boolean };
}

interface MetricsPoint {
  ts: number;
  activeUsers: number;
  dbRequestsPerMin: number;
  httpRequestsPerMin: number;
  p95ResponseMs: number;
  cpuPct: number;
  errorRatePct: number;
}

interface Limits {
  maxUsers: number;
  maxDbRpm: number;
  maxHttpRpm: number;
  maxResponseMs: number;
  maxCpuPct: number;
  maxErrorPct: number;
}

interface HistoryResponse {
  history: MetricsPoint[];
  limits: Limits;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── SVG time-series chart ─────────────────────────────────────────────────────

type MetricKey = keyof Omit<MetricsPoint, 'ts'>;

function TimeSeriesChart({
  data, valueKey, limit, color, title, unit = '',
}: {
  data: MetricsPoint[];
  valueKey: MetricKey;
  limit: number;
  color: string;
  title: string;
  unit?: string;
}) {
  // Coordinate system — h-auto SVG scales width to container, height follows
  const VW = 420, VH = 160;
  const P = { t: 14, r: 52, b: 30, l: 46 };
  const cW = VW - P.l - P.r;
  const cH = VH - P.t - P.b;

  const values = data.map((d) => d[valueKey] as number);
  const current = values[values.length - 1] ?? 0;
  const peak    = Math.max(...values, 0);
  const ceiling = Math.max(limit * 1.15, peak, 1);

  const toX = (i: number) =>
    data.length < 2 ? P.l + cW / 2 : P.l + (i / (data.length - 1)) * cW;
  const toY = (v: number) => P.t + cH - (v / ceiling) * cH;

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d[valueKey] as number) }));
  const limitY = toY(limit);
  const nearLimit = current >= limit * 0.85;

  const linePath = pts.length > 1
    ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : '';
  const areaPath = pts.length > 1
    ? `M${pts[0].x.toFixed(1)},${toY(0).toFixed(1)} ${linePath.slice(1)} L${pts[pts.length - 1].x.toFixed(1)},${toY(0).toFixed(1)} Z`
    : '';

  // X-axis tick indices: first, every 15 points, last
  const ticks: number[] = [];
  if (data.length > 1) {
    ticks.push(0);
    for (let i = 15; i < data.length - 5; i += 15) ticks.push(i);
    ticks.push(data.length - 1);
  }

  // Y-axis labels: 0, mid, ceiling
  const yLabels = [
    { v: 0,                       y: toY(0) },
    { v: Math.round(ceiling / 2), y: toY(ceiling / 2) },
    { v: Math.round(ceiling),     y: toY(ceiling) },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      {/* Card header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <div className="text-right shrink-0">
          <span className={`text-2xl font-bold tabular-nums leading-none ${nearLimit ? 'text-red-600' : 'text-gray-900'}`}>
            {current}{unit}
          </span>
          <div className="text-xs text-gray-400 mt-0.5">limit {limit}{unit}</div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-sm text-gray-400 italic">
          First snapshot in &lt;1 min…
        </div>
      ) : (
        /* h-auto: SVG fills container width and scales height by aspect ratio */
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto" aria-hidden="true">
          {/* Horizontal grid lines */}
          {yLabels.map(({ y }, i) => (
            <line key={i} x1={P.l} y1={y} x2={VW - P.r} y2={y} stroke="#f3f4f6" strokeWidth="1.5" />
          ))}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill={color} fillOpacity={0.1} />}

          {/* Line */}
          {linePath && (
            <path d={linePath} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Hard-limit dashed line */}
          <line x1={P.l} y1={limitY} x2={VW - P.r} y2={limitY}
            stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5,4" opacity={0.7} />
          <text x={VW - P.r + 3} y={limitY + 5} fontSize="13" fill="#ef4444" opacity={0.85} fontWeight="500">
            {limit}{unit}
          </text>

          {/* Y-axis labels */}
          {yLabels.map(({ v, y }, i) => (
            <text key={i} x={P.l - 5} y={y + 4} fontSize="13" fill="#6b7280" textAnchor="end">
              {v}{unit}
            </text>
          ))}

          {/* Latest value dot */}
          {pts.length > 0 && (
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
              r="4" fill={color} stroke="white" strokeWidth="2" />
          )}

          {/* X-axis time labels */}
          {ticks.map((idx) => (
            <text key={idx} x={toX(idx)} y={VH - 4} fontSize="13" fill="#6b7280"
              textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}>
              {fmtTime(data[idx].ts)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

// ── Small reused components ───────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />;
}

function ServicePill({ label, status, responseMs }: { label: string; status: 'ok' | 'error'; responseMs: number }) {
  const ok = status === 'ok';
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${ok ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
      <StatusDot ok={ok} />
      <div>
        <div className={`text-sm font-semibold ${ok ? 'text-green-800' : 'text-red-800'}`}>{label}</div>
        <div className={`text-xs ${ok ? 'text-green-600' : 'text-red-500'}`}>{ok ? `${responseMs} ms` : 'Unreachable'}</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, warn, danger }: { label: string; value: number; warn: number; danger: number }) {
  const cls = value >= danger ? 'text-red-600 bg-red-50 border-red-100'
    : value >= warn ? 'text-yellow-600 bg-yellow-50 border-yellow-100'
    : 'text-gray-900 bg-white border-gray-100';
  return (
    <div className={`rounded-xl border shadow-sm p-5 ${cls}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs mt-1 font-medium opacity-75">{label}</div>
    </div>
  );
}

function MemoryBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const bar = pct >= 85 ? 'bg-red-500' : pct >= 65 ? 'bg-yellow-400' : 'bg-green-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-500"><span>{used} MB used</span><span>{limit} MB limit</span></div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-400 text-right">{pct}%</div>
    </div>
  );
}

function AlertBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${active ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
      <StatusDot ok={active} />
      {label}
      <span className={`ml-auto ${active ? 'text-green-500' : 'text-gray-300'}`}>{active ? '●' : '○'}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuperAdminMonitor() {
  const { t } = useTranslation();

  const { data: health, isLoading, dataUpdatedAt } = useQuery<HealthResponse>({
    queryKey: ['superadmin-health'],
    queryFn: () => api.get('/superadmin/system/health').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: historyData } = useQuery<HistoryResponse>({
    queryKey: ['superadmin-metrics-history'],
    queryFn: () => api.get('/superadmin/system/metrics-history').then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading || !health) {
    return <div className="text-sm text-gray-500">{t('loading')}</div>;
  }

  const { status, uptime, memory, db, redis, metrics, alerts } = health;
  const degraded    = status === 'degraded';
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';
  const history     = historyData?.history ?? [];
  const limits      = historyData?.limits ?? {
    maxUsers: 100, maxDbRpm: 500, maxHttpRpm: 1000,
    maxResponseMs: 2000, maxCpuPct: 80, maxErrorPct: 1,
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t('superadmin.monitor.title')}</h1>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${degraded ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <StatusDot ok={!degraded} />
            {degraded ? t('superadmin.monitor.degraded') : t('superadmin.monitor.allGood')}
          </span>
          <span className="text-xs text-gray-400">{t('superadmin.monitor.refreshed')}: {lastRefresh}</span>
        </div>
      </div>

      {/* ── Uptime + Services ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col justify-center">
          <div className="text-xs text-gray-500 mb-1">{t('superadmin.monitor.uptime')}</div>
          <div className="text-2xl font-bold text-gray-900">{formatUptime(uptime)}</div>
        </div>
        <ServicePill label={t('superadmin.monitor.db')}  status={db.status}    responseMs={db.responseMs} />
        <ServicePill label="Redis"                        status={redis.status} responseMs={redis.responseMs} />
      </div>

      {/* ── Traffic charts ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {t('superadmin.monitor.sectionTraffic')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TimeSeriesChart data={history} valueKey="activeUsers"        limit={limits.maxUsers}    color="#3b82f6" title={t('superadmin.monitor.activeUsers')}   unit="" />
          <TimeSeriesChart data={history} valueKey="httpRequestsPerMin" limit={limits.maxHttpRpm}  color="#10b981" title={t('superadmin.monitor.httpRpm')}       unit="" />
        </div>
      </div>

      {/* ── Performance charts ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {t('superadmin.monitor.sectionPerformance')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TimeSeriesChart data={history} valueKey="p95ResponseMs"    limit={limits.maxResponseMs} color="#f59e0b" title={t('superadmin.monitor.p95Response')} unit="ms" />
          <TimeSeriesChart data={history} valueKey="dbRequestsPerMin" limit={limits.maxDbRpm}      color="#8b5cf6" title={t('superadmin.monitor.dbRpm')}        unit="" />
        </div>
      </div>

      {/* ── Health charts ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {t('superadmin.monitor.sectionHealth')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TimeSeriesChart data={history} valueKey="cpuPct"        limit={limits.maxCpuPct}   color="#ef4444" title={t('superadmin.monitor.cpu')}       unit="%" />
          <TimeSeriesChart data={history} valueKey="errorRatePct"  limit={limits.maxErrorPct} color="#f43f5e" title={t('superadmin.monitor.errorRate')}  unit="%" />
        </div>
      </div>

      {/* ── Memory ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('superadmin.monitor.memory')}</h2>
        <MemoryBar used={memory.heapUsedMb} limit={memory.limitMb} />
        <div className="mt-3 flex gap-4 text-xs text-gray-400">
          <span>Heap total: {memory.heapTotalMb} MB</span>
          <span>RSS: {memory.rssMb} MB</span>
        </div>
      </div>

      {/* ── Hourly counters ── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('superadmin.monitor.metrics1h')}</h2>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label={t('superadmin.monitor.errors5xx')}     value={metrics.errors5xx_1h}      warn={1}  danger={10}  />
          <MetricCard label={t('superadmin.monitor.rateLimitHits')} value={metrics.rateLimitHits_1h}  warn={20} danger={100} />
          <MetricCard label={t('superadmin.monitor.dbErrors')}      value={metrics.dbErrors_1h}       warn={1}  danger={5}   />
        </div>
      </div>

      {/* ── Alert config ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('superadmin.monitor.alerts')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AlertBadge label={t('superadmin.monitor.emailAlert')}    active={alerts.email} />
          <AlertBadge label={t('superadmin.monitor.telegramAlert')} active={alerts.telegram} />
        </div>
        {!alerts.email && !alerts.telegram && (
          <p className="mt-3 text-xs text-gray-400">{t('superadmin.monitor.noAlertsHint')}</p>
        )}
      </div>

    </div>
  );
}
