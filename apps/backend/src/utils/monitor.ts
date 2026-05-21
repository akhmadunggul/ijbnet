import { sendEmail } from './email';
import { config } from '../config';

// ── Time-series metrics history ───────────────────────────────────────────────

export interface MetricsPoint {
  ts: number;              // Unix ms
  activeUsers: number;     // unique users who made a request in the previous minute
  dbRequestsPerMin: number;
}

const HISTORY_SIZE = 60; // keep 60 one-minute snapshots
const metricsHistory: MetricsPoint[] = [];

// Active-user window: count users seen in the last 5 minutes
const activeUserMap = new Map<string, number>(); // userId → lastSeen ms
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

// DB query counter — incremented by Sequelize logging hook; reset per snapshot
let _dbRequestCount = 0;

export function recordActiveUser(userId: string): void {
  activeUserMap.set(userId, Date.now());
}

export function recordDbQuery(): void {
  _dbRequestCount++;
}

/** Called every minute by the timer in index.ts */
export function snapshotMetrics(): void {
  const now = Date.now();
  // Evict stale users
  for (const [id, ts] of activeUserMap) {
    if (now - ts > ACTIVE_WINDOW_MS) activeUserMap.delete(id);
  }
  metricsHistory.push({
    ts: now,
    activeUsers: activeUserMap.size,
    dbRequestsPerMin: _dbRequestCount,
  });
  if (metricsHistory.length > HISTORY_SIZE) metricsHistory.shift();
  _dbRequestCount = 0;
}

export function getMetricsHistory(): MetricsPoint[] {
  return [...metricsHistory];
}

// ── Hourly sliding counter ────────────────────────────────────────────────────
class HourlyCounter {
  private count = 0;
  private hour = this.currentHour();

  private currentHour() { return Math.floor(Date.now() / 3_600_000); }

  increment(): void {
    const h = this.currentHour();
    if (h !== this.hour) { this.count = 0; this.hour = h; }
    this.count++;
  }

  get(): number {
    return this.currentHour() === this.hour ? this.count : 0;
  }
}

const c5xx     = new HourlyCounter();
const c429     = new HourlyCounter();
const cDbError = new HourlyCounter();

// ── Alert delivery ─────────────────────────────────────────────────────────────
const lastAlert = new Map<string, number>();
const COOLDOWN_MS = 15 * 60 * 1000;

async function deliver(key: string, subject: string, lines: string[]): Promise<void> {
  const now = Date.now();
  if (now - (lastAlert.get(key) ?? 0) < COOLDOWN_MS) return;
  lastAlert.set(key, now);

  const bodyHtml = `<pre style="font-family:monospace">${lines.join('\n')}</pre>`;
  const ts = new Date().toISOString();

  if (config.ALERT_EMAIL) {
    await sendEmail(
      config.ALERT_EMAIL,
      `[IJBNet Alert] ${subject}`,
      `<h3>${subject}</h3>${bodyHtml}<p style="color:#888;font-size:12px">${ts}</p>`,
    );
  }

  // Telegram — best-effort, never throws
  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID) {
    const text = `🚨 *[IJBNet] ${subject}*\n\n${lines.join('\n')}\n\n_${ts}_`;
    fetch(
      `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: config.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
      },
    ).catch(() => { /* intentionally swallowed */ });
  }
}

// ── Public recorders ───────────────────────────────────────────────────────────

export function record5xx(path: string, err: Error): void {
  c5xx.increment();
  deliver('5xx', `Server error on ${path}`, [
    `Path:        ${path}`,
    `Error:       ${err.message}`,
    `5xx this hr: ${c5xx.get()}`,
  ]).catch(console.error);
}

export function record429(context: '429:global' | '429:login'): void {
  c429.increment();
  const count = c429.get();
  // Only alert when a burst is detected, not on every individual hit
  if (count === 50 || count === 200) {
    deliver('429', `Rate-limit burst: ${count} blocked requests this hour`, [
      `Blocked requests this hour: ${count}`,
      `Context: ${context}`,
      `Users may be experiencing access problems.`,
    ]).catch(console.error);
  }
}

export function recordDbError(err: Error): void {
  cDbError.increment();
  deliver('db', 'Database connection error', [
    `Error:          ${err.message}`,
    `DB errors/hr:   ${cDbError.get()}`,
  ]).catch(console.error);
}

export function recordFatal(type: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  deliver('fatal', `Fatal process error — ${type}`, [
    `Type:  ${type}`,
    `Error: ${msg}`,
    `The process may restart shortly.`,
  ]).catch(console.error);
}

export function recordHighMemory(heapUsedMb: number, limitMb: number): void {
  deliver('mem', `Memory pressure: ${heapUsedMb} MB / ${limitMb} MB`, [
    `Heap used:  ${heapUsedMb} MB`,
    `Node limit: ${limitMb} MB`,
    `Approaching OOM — consider restarting or investigating a leak.`,
  ]).catch(console.error);
}

// ── Health snapshot ───────────────────────────────────────────────────────────

export function getMetrics() {
  return {
    errors5xx_1h:       c5xx.get(),
    rateLimitHits_1h:   c429.get(),
    dbErrors_1h:        cDbError.get(),
  };
}
