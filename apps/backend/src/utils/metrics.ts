import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Use the default registry so AggregatorRegistry can collect across cluster workers
export { register };

collectDefaultMetrics({ register, prefix: 'ijbnet_node_' });

export const httpRequestsTotal = new Counter({
  name: 'ijbnet_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const httpRequestDuration = new Histogram({
  name: 'ijbnet_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const dbQueriesTotal = new Counter({
  name: 'ijbnet_db_queries_total',
  help: 'Total database queries executed',
});

export const rateLimitHitsTotal = new Counter({
  name: 'ijbnet_rate_limit_hits_total',
  help: 'Total rate-limit (429) responses',
  labelNames: ['context'] as const,
});

export const errors5xxTotal = new Counter({
  name: 'ijbnet_errors_5xx_total',
  help: 'Total HTTP 5xx responses',
});

export const activeUsersGauge = new Gauge({
  name: 'ijbnet_active_users',
  help: 'Unique users active in the last 5 minutes',
});

/** Normalise a raw URL path to a stable route pattern for metric labels. */
export function normalizeRoute(url: string): string {
  return url
    .split('?')[0]!
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:n')
    .replace(/\/[^/]{32,}$/g, '/:token');  // long opaque segments (tokens, hashes)
}
