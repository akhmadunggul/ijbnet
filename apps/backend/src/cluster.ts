import cluster from 'cluster';
import os from 'os';

interface ClusterMsg {
  type: 'SET_COMPLETENESS_MODE';
  mode: string;
}

const WORKERS = parseInt(process.env['CLUSTER_WORKERS'] ?? '0', 10) || os.cpus().length;

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
