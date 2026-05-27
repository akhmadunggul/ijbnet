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

  // Relay IPC messages from any worker to all other workers
  cluster.on('message', (sender, msg: ClusterMsg) => {
    for (const w of Object.values(cluster.workers ?? {})) {
      if (w && w.id !== sender.id) w.send(msg);
    }
  });
} else {
  // In-worker IPC handler: apply broadcasted state updates before the app boots
  process.on('message', (msg: ClusterMsg) => {
    if (msg.type === 'SET_COMPLETENESS_MODE') {
      // Dynamic require avoids a circular-module issue at import time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { setCompletenessMode } = require('./utils/completeness') as {
        setCompletenessMode: (m: string) => void;
      };
      setCompletenessMode(msg.mode as 'legacy' | 'cv');
    }
  });

  // Boot the Express server in this worker
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./index');
}
