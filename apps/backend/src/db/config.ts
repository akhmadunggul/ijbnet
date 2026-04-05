import path from 'path';
import fs from 'fs';

// Load .env for sequelize-cli context
const envPath = path.join(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

const dbConfig = {
  development: {
    username: process.env['DB_USER'] ?? 'ijbnet',
    password: process.env['DB_PASS'] ?? 'changeme',
    database: process.env['DB_NAME'] ?? 'ijbnet_db',
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '3306', 10),
    dialect: 'mysql' as const,
    logging: false,
  },
  test: {
    username: process.env['DB_USER'] ?? 'ijbnet',
    password: process.env['DB_PASS'] ?? 'changeme',
    database: process.env['DB_NAME'] ?? 'ijbnet_test',
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '3306', 10),
    dialect: 'mysql' as const,
    logging: false,
  },
  production: {
    username: process.env['DB_USER'] ?? '',
    password: process.env['DB_PASS'] ?? '',
    database: process.env['DB_NAME'] ?? '',
    host: process.env['DB_HOST'] ?? '',
    port: parseInt(process.env['DB_PORT'] ?? '3306', 10),
    dialect: 'mysql' as const,
    logging: false,
  },
};

module.exports = dbConfig;
export default dbConfig;
