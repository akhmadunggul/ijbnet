import { useState } from 'react';
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
  maxUsers: number; maxDbRpm: number; maxHttpRpm: number;
  maxResponseMs: number; maxCpuPct: number; maxErrorPct: number;
}

interface HistoryResponse { history: MetricsPoint[]; limits: Limits; }

type Range = '1h' | '1d' | '1w' | '1m';
type MetricKey = keyof Omit<MetricsPoint, 'ts'>;

// ── Grafana color palette ─────────────────────────────────────────────────────
// Background layers
const BG_PAGE   = '#111215';
const BG_PANEL  = '#1a1d23';
const BG_INSET  = '#0d0f13';
const BD_PANEL  = '#2c3038';
const TEXT_PRI  = '#ccccdc';
const TEXT_SEC  = '#9ea7bd';
const TEXT_MUT  = '#6c737a';
const TEXT_DIM  = '#3c4048';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

function fmtTick(ts: number, range: Range): string {
  const d = new Date(ts);
  return (range === '1h' || range === '1d')
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtVal(v: number, unit: string): string {
  return (unit === '%' || unit === 'ms') ? v.toFixed(1) : Math.round(v).toString();
}

// Smooth monotone cubic bezier path — gives Grafana's characteristic curve
function buildLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], curr = pts[i];
    const cpx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C${cpx},${prev.y.toFixed(1)} ${cpx},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }
  return d;
}

function buildAreaPath(pts: { x: number; y: number }[], baseY: number): string {
  if (pts.length < 2) return '';
  const line = buildLinePath(pts);
  return `${line} L${pts[pts.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L${pts[0].x.toFixed(1)},${baseY.toFixed(1)} Z`;
}

// ── SVG time-series chart — Grafana style ─────────────────────────────────────

function TimeSeriesChart({
  data, valueKey, limit, color, title, unit = '', range,
}: {
  data: MetricsPoint[]; valueKey: MetricKey; limit: number;
  color: string; title: string; unit?: string; range: Range;
}) {
  const VW = 420, VH = 100;
  const P = { t: 6, r: 46, b: 20, l: 38 };
  const cW = VW - P.l - P.r, cH = VH - P.t - P.b;

  const values  = data.map((d) => d[valueKey] as number);
  const current = values[values.length - 1] ?? 0;
  const minVal  = values.length ? Math.min(...values) : 0;
  const maxVal  = values.length ? Math.max(...values) : 0;
  const avgVal  = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const ceiling = Math.max(limit * 1.15, maxVal, 1);

  const nearLimit = current >= limit * 0.85;
  const overLimit = current >= limit;
  const valColor  = overLimit ? '#F2495C' : nearLimit ? '#FF9830' : TEXT_PRI;

  const toX = (i: number) =>
    data.length < 2 ? P.l + cW / 2 : P.l + (i / (data.length - 1)) * cW;
  const toY = (v: number) => P.t + cH - (v / ceiling) * cH;

  const pts     = data.map((d, i) => ({ x: toX(i), y: toY(d[valueKey] as number) }));
  const limitY  = toY(limit);
  const baseY   = toY(0);
  const linePath = buildLinePath(pts);
  const areaPath = buildAreaPath(pts, baseY);

  const yLabels = [
    { v: 0,                       y: toY(0) },
    { v: Math.round(ceiling / 2), y: toY(ceiling / 2) },
    { v: Math.round(ceiling),     y: toY(ceiling) },
  ];

  const stride = Math.max(1, Math.round(data.length / 5));
  const ticks: number[] = data.length > 1
    ? (() => {
        const t = [0];
        for (let i = stride; i < data.length - Math.floor(stride / 2); i += stride) t.push(i);
        if (t[t.length - 1] !== data.length - 1) t.push(data.length - 1);
        return t;
      })()
    : [];

  const gradId = `gf-${valueKey}`;

  return (
    <div style={{ background: BG_PANEL, borderColor: BD_PANEL }}
      className="rounded-lg border overflow-hidden">

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2"
        style={{ borderBottom: `1px solid ${BD_PANEL}` }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: TEXT_SEC }}>
            {title}
          </span>
        </div>
        <span className="text-xl font-bold tabular-nums leading-none" style={{ color: valColor }}>
          {fmtVal(current, unit)}{unit}
        </span>
      </div>

      {/* Chart */}
      <div className="px-1 pt-1">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs italic" style={{ color: TEXT_DIM }}>
            Waiting for first snapshot…
          </div>
        ) : (
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto" aria-hidden="true">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
                <stop offset="70%"  stopColor={color} stopOpacity="0.06" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {yLabels.map(({ y }, i) => (
              <line key={i} x1={P.l} y1={y} x2={VW - P.r} y2={y}
                stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            ))}

            {/* Area fill */}
            {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}

            {/* Main line */}
            {linePath && (
              <path d={linePath} stroke={color} strokeWidth="1.75"
                fill="none" strokeLinejoin="round" strokeLinecap="round" />
            )}

            {/* Threshold dashed line */}
            <line x1={P.l} y1={limitY} x2={VW - P.r} y2={limitY}
              stroke="#F2495C" strokeWidth="1" strokeDasharray="4,3" opacity="0.65" />
            <text x={VW - P.r + 3} y={limitY + 4} fontSize="11" fill="#F2495C" opacity="0.8" fontWeight="600">
              {fmtVal(limit, unit)}{unit}
            </text>

            {/* Y-axis labels */}
            {yLabels.map(({ v, y }, i) => (
              <text key={i} x={P.l - 4} y={y + 4} fontSize="11" fill={TEXT_MUT} textAnchor="end">
                {v}{unit}
              </text>
            ))}

            {/* Latest point indicator */}
            {pts.length > 0 && (
              <>
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
                  r="4.5" fill={BG_PANEL} stroke={color} strokeWidth="2" />
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
                  r="2" fill={color} />
              </>
            )}

            {/* X-axis time labels */}
            {ticks.map((idx) => (
              <text key={idx} x={toX(idx)} y={VH - 3} fontSize="11" fill={TEXT_MUT}
                textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}>
                {fmtTick(data[idx].ts, range)}
              </text>
            ))}
          </svg>
        )}
      </div>

      {/* Stats row — Min / Avg / Max / Now */}
      <div className="grid grid-cols-4" style={{ borderTop: `1px solid ${BD_PANEL}` }}>
        {(['Min', 'Avg', 'Max', 'Now'] as const).map((label, i) => {
          const v = [minVal, avgVal, maxVal, current][i];
          const isNow = label === 'Now';
          const nowColor = isNow ? valColor : TEXT_PRI;
          return (
            <div key={label} className="py-2 text-center"
              style={{ borderRight: i < 3 ? `1px solid ${BD_PANEL}` : undefined }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
                style={{ color: TEXT_MUT }}>{label}</div>
              <div className="text-sm font-bold tabular-nums"
                style={{ color: nowColor }}>
                {fmtVal(v, unit)}{unit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Range selector ────────────────────────────────────────────────────────────

function RangeSelector({ value, onChange, labels }: {
  value: Range; onChange: (r: Range) => void; labels: Record<Range, string>;
}) {
  return (
    <div className="flex gap-1 rounded-lg p-1" style={{ background: BG_INSET, border: `1px solid ${BD_PANEL}` }}>
      {(['1h', '1d', '1w', '1m'] as Range[]).map((r) => (
        <button key={r} onClick={() => onChange(r)}
          className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
          style={value === r
            ? { background: '#3d4658', color: TEXT_PRI }
            : { color: TEXT_MUT }}>
          {labels[r]}
        </button>
      ))}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{
        backgroundColor: ok ? '#73BF69' : '#F2495C',
        boxShadow: ok ? '0 0 6px rgba(115,191,105,0.7)' : '0 0 6px rgba(242,73,92,0.7)',
      }} />
  );
}

function ServicePill({ label, status, responseMs }: { label: string; status: 'ok' | 'error'; responseMs: number }) {
  const ok = status === 'ok';
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border"
      style={{
        background: ok ? 'rgba(115,191,105,0.07)' : 'rgba(242,73,92,0.07)',
        borderColor: ok ? 'rgba(115,191,105,0.2)' : 'rgba(242,73,92,0.2)',
      }}>
      <StatusDot ok={ok} />
      <div>
        <div className="text-sm font-semibold" style={{ color: ok ? '#73BF69' : '#F2495C' }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: ok ? '#4d8c47' : '#a83443' }}>
          {ok ? `${responseMs} ms` : 'Unreachable'}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, warn, danger }: { label: string; value: number; warn: number; danger: number }) {
  const color = value >= danger ? '#F2495C' : value >= warn ? '#FF9830' : TEXT_PRI;
  const bg    = value >= danger ? 'rgba(242,73,92,0.08)' : value >= warn ? 'rgba(255,152,48,0.08)' : BG_PANEL;
  const bd    = value >= danger ? 'rgba(242,73,92,0.25)' : value >= warn ? 'rgba(255,152,48,0.25)' : BD_PANEL;
  return (
    <div className="rounded-lg border p-5" style={{ background: bg, borderColor: bd }}>
      <div className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-xs mt-1 font-medium" style={{ color: TEXT_MUT }}>{label}</div>
    </div>
  );
}

function MemoryBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 85 ? '#F2495C' : pct >= 65 ? '#FF9830' : '#73BF69';
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs" style={{ color: TEXT_MUT }}>
        <span>{used} MB used</span><span>{limit} MB limit</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#2c3038' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <div className="text-xs text-right" style={{ color: TEXT_MUT }}>{pct}% heap</div>
    </div>
  );
}

function AlertBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium"
      style={{
        background: active ? 'rgba(115,191,105,0.07)' : BG_PANEL,
        borderColor: active ? 'rgba(115,191,105,0.2)' : BD_PANEL,
        color: active ? '#73BF69' : TEXT_MUT,
      }}>
      <StatusDot ok={active} />
      <span>{label}</span>
      <span className="ml-auto text-xs font-bold" style={{ color: active ? '#73BF69' : TEXT_DIM }}>
        {active ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuperAdminMonitor() {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>('1h');

  const rangeLabels: Record<Range, string> = {
    '1h': t('superadmin.monitor.range1h'),
    '1d': t('superadmin.monitor.range1d'),
    '1w': t('superadmin.monitor.range1w'),
    '1m': t('superadmin.monitor.range1m'),
  };

  const { data: health, isLoading, dataUpdatedAt } = useQuery<HealthResponse>({
    queryKey: ['superadmin-health'],
    queryFn: () => api.get('/superadmin/system/health').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: historyData, isFetching: historyFetching } = useQuery<HistoryResponse>({
    queryKey: ['superadmin-metrics-history', range],
    queryFn: () => api.get(`/superadmin/system/metrics-history?range=${range}`).then((r) => r.data),
    refetchInterval: range === '1h' ? 60_000 : 300_000,
  });

  if (isLoading || !health) {
    return (
      <div className="flex items-center justify-center h-32 text-sm" style={{ color: TEXT_MUT }}>
        {t('loading')}
      </div>
    );
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
    // Break out of the parent's p-4/p-6 padding to fill the page with dark background
    <div className="-mx-4 -my-4 md:-mx-6 md:-my-6 min-h-screen space-y-6 px-4 py-6 md:px-6"
      style={{ background: BG_PAGE }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold tracking-wide" style={{ color: TEXT_PRI }}>
          {t('superadmin.monitor.title')}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{
              background: degraded ? 'rgba(242,73,92,0.12)' : 'rgba(115,191,105,0.12)',
              color: degraded ? '#F2495C' : '#73BF69',
            }}>
            <StatusDot ok={!degraded} />
            {degraded ? t('superadmin.monitor.degraded') : t('superadmin.monitor.allGood')}
          </span>
          <span className="text-xs" style={{ color: TEXT_MUT }}>
            {t('superadmin.monitor.refreshed')}: {lastRefresh}
          </span>
        </div>
      </div>

      {/* ── Uptime + Services ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border flex flex-col justify-center px-5 py-4"
          style={{ background: BG_PANEL, borderColor: BD_PANEL }}>
          <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: TEXT_MUT }}>
            {t('superadmin.monitor.uptime')}
          </div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: TEXT_PRI }}>
            {formatUptime(uptime)}
          </div>
        </div>
        <ServicePill label={t('superadmin.monitor.db')} status={db.status} responseMs={db.responseMs} />
        <ServicePill label="Redis" status={redis.status} responseMs={redis.responseMs} />
      </div>

      {/* ── Time range selector ── */}
      <div className="rounded-lg border px-4 py-3" style={{ background: BG_PANEL, borderColor: BD_PANEL }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: TEXT_SEC }}>
            {t('superadmin.monitor.timeRange')}
          </span>
          <div className="flex items-center gap-3">
            {historyFetching && (
              <span className="text-xs animate-pulse" style={{ color: TEXT_MUT }}>Loading…</span>
            )}
            <RangeSelector value={range} onChange={setRange} labels={rangeLabels} />
          </div>
        </div>
        {history.length === 0 && range !== '1h' && (
          <p className="mt-2 text-xs italic" style={{ color: TEXT_MUT }}>
            {t('superadmin.monitor.noDataYet')}
          </p>
        )}
      </div>

      {/* ── Traffic charts ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_MUT }}>
          {t('superadmin.monitor.sectionTraffic')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TimeSeriesChart data={history} valueKey="activeUsers"        limit={limits.maxUsers}    color="#5794F2" title={t('superadmin.monitor.activeUsers')}   unit=""    range={range} />
          <TimeSeriesChart data={history} valueKey="httpRequestsPerMin" limit={limits.maxHttpRpm}  color="#73BF69" title={t('superadmin.monitor.httpRpm')}       unit=""    range={range} />
        </div>
      </div>

      {/* ── Performance charts ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_MUT }}>
          {t('superadmin.monitor.sectionPerformance')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TimeSeriesChart data={history} valueKey="p95ResponseMs"    limit={limits.maxResponseMs} color="#FF9830" title={t('superadmin.monitor.p95Response')} unit="ms"  range={range} />
          <TimeSeriesChart data={history} valueKey="dbRequestsPerMin" limit={limits.maxDbRpm}      color="#B877D9" title={t('superadmin.monitor.dbRpm')}        unit=""    range={range} />
        </div>
      </div>

      {/* ── Health charts ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_MUT }}>
          {t('superadmin.monitor.sectionHealth')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TimeSeriesChart data={history} valueKey="cpuPct"       limit={limits.maxCpuPct}   color="#F2495C" title={t('superadmin.monitor.cpu')}       unit="%" range={range} />
          <TimeSeriesChart data={history} valueKey="errorRatePct" limit={limits.maxErrorPct} color="#FF7383" title={t('superadmin.monitor.errorRate')}  unit="%" range={range} />
        </div>
      </div>

      {/* ── Memory ── */}
      <div className="rounded-lg border p-5" style={{ background: BG_PANEL, borderColor: BD_PANEL }}>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: TEXT_SEC }}>
          {t('superadmin.monitor.memory')}
        </h2>
        <MemoryBar used={memory.heapUsedMb} limit={memory.limitMb} />
        <div className="mt-3 flex gap-4 text-xs" style={{ color: TEXT_MUT }}>
          <span>Heap total: {memory.heapTotalMb} MB</span>
          <span>RSS: {memory.rssMb} MB</span>
        </div>
      </div>

      {/* ── Hourly counters ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_MUT }}>
          {t('superadmin.monitor.metrics1h')}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label={t('superadmin.monitor.errors5xx')}     value={metrics.errors5xx_1h}     warn={1}  danger={10}  />
          <MetricCard label={t('superadmin.monitor.rateLimitHits')} value={metrics.rateLimitHits_1h} warn={20} danger={100} />
          <MetricCard label={t('superadmin.monitor.dbErrors')}      value={metrics.dbErrors_1h}      warn={1}  danger={5}   />
        </div>
      </div>

      {/* ── Alert config ── */}
      <div className="rounded-lg border p-5" style={{ background: BG_PANEL, borderColor: BD_PANEL }}>
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_SEC }}>
          {t('superadmin.monitor.alerts')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AlertBadge label={t('superadmin.monitor.emailAlert')}    active={alerts.email} />
          <AlertBadge label={t('superadmin.monitor.telegramAlert')} active={alerts.telegram} />
        </div>
        {!alerts.email && !alerts.telegram && (
          <p className="mt-3 text-xs" style={{ color: TEXT_MUT }}>{t('superadmin.monitor.noAlertsHint')}</p>
        )}
      </div>

    </div>
  );
}
