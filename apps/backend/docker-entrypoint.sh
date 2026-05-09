#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
cd /app/apps/backend
npx sequelize-cli db:migrate

echo "[entrypoint] Starting server..."
exec node /app/apps/backend/dist/apps/backend/src/index.js
