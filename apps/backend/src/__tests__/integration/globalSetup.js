'use strict';
const mysql2 = require('mysql2/promise');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Read monorepo root .env without importing config.ts
function readEnv() {
  const envPath = path.resolve(__dirname, '../../../../../.env');
  const result = {};
  if (!fs.existsSync(envPath)) return result;
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = val;
  });
  return result;
}

module.exports = async function globalSetup() {
  const env = readEnv();
  const host     = env['DB_HOST'] ?? 'localhost';
  const port     = parseInt(env['DB_PORT'] ?? '3306', 10);
  const user     = env['DB_USER'] ?? 'ijbnet';
  const password = env['DB_PASS'] ?? 'changeme';

  // 1. Create ijbnet_test database (idempotent)
  let conn;
  try {
    conn = await mysql2.createConnection({ host, port, user, password });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `\n\n[Integration] Cannot connect to MySQL at ${host}:${port}.\n` +
      `  Error: ${msg}\n\n` +
      `  Make sure the Docker stack is running:\n` +
      `    docker compose up -d db\n\n` +
      `  Then re-run: pnpm test:integration\n`,
    );
  }

  await conn.execute(
    'CREATE DATABASE IF NOT EXISTS `ijbnet_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  await conn.end();

  // 2. Run all Sequelize migrations against ijbnet_test
  //    NODE_ENV=development so db-config.js picks the development block;
  //    DB_NAME=ijbnet_test overrides the target database.
  const backendRoot = path.resolve(__dirname, '../../../../');
  try {
    execSync('npx sequelize-cli db:migrate', {
      cwd: backendRoot,
      env: { ...process.env, DB_NAME: 'ijbnet_test', NODE_ENV: 'development' },
      stdio: 'pipe',
    });
  } catch (err) {
    const output = err.stdout?.toString() || err.stderr?.toString() || String(err);
    throw new Error(`\n[Integration] Migration failed:\n${output}\n`);
  }

  console.log('\n[Integration] Test DB ready: ijbnet_test\n');
};
