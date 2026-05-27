import cluster from 'cluster';
import os from 'os';
import http from 'http';
import { AggregatorRegistry, register } from 'prom-client';

interface ClusterMsg {
  type: 'SET_COMPLETENESS_MODE';
  mode: string;
}

const WORKERS = parseInt(process.env['CLUSTER_WORKERS'] ?? '0', 10) || os.cpus().length;

// Port dedicated to Prometheus scraping — served by the master so metrics
// are always aggregated across all workers regardless of OS round-robin.
const METRICS_PORT = parseInt(process.env['METRICS_PORT'] ?? '9464', 10);

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} — spawning ${WORKERS} worker(s)`);

  for (let i = 0; i < WORKERS; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[cluster] Worker ${worker.process.pid} died (${signal ?? code}) — restarting`);
    cluster.fork();
  });

  // Relay SET_COMPLETENESS_MODE from any worker to all others
  cluster.on('message', (sender, msg: ClusterMsg) => {
    if ((msg as { type?: string }).type === 'SET_COMPLETENESS_MODE') {
      for (const w of Object.values(cluster.workers ?? {})) {
        if (w && w.id !== sender.id) w.send(msg);
      }
    }
    // prom-client AggregatorRegistry also uses cluster IPC — let it pass through
  });

  // Aggregated metrics endpoint for Prometheus — collects from all workers via IPC
  const aggregatorRegistry = new AggregatorRegistry();
  http.createServer(async (_req, res) => {
    try {
      const metrics = await aggregatorRegistry.clusterMetrics();
      res.writeHead(200, { 'Content-Type': register.contentType });
      res.end(metrics);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  }).listen(METRICS_PORT, '0.0.0.0', () => {
    console.log(`[cluster] Metrics aggregator listening on :${METRICS_PORT}`);
  });

} else {
  // In-worker IPC: apply broadcasted state updates
  process.on('message', (msg: ClusterMsg) => {
    if (msg.type === 'SET_COMPLETENESS_MODE') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { setCompletenessMode } = require('./utils/completeness') as {
        setCompletenessMode: (m: string) => void;
      };
      setCompletenessMode(msg.mode as 'legacy' | 'cv');
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./index');
}
