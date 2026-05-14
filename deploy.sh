#!/bin/bash
set -e

# ── Configuration ─────────────────────────────────────────────────
STAGING_SSH="root@jinzai.aup.my.id"
PROD_SSH="dockeruser@jinzai.jobagus.id"
REMOTE_DIR="/opt/ijbnet"
# ─────────────────────────────────────────────────────────────────

TARGET=${1:-}

if [ -z "$TARGET" ]; then
    echo "Usage: ./deploy.sh [staging|prod]"
    exit 1
fi

case "$TARGET" in
    staging)
        SSH_HOST="$STAGING_SSH"
        COMPOSE_FILE="docker-compose.staging.yml"
        ;;
    prod)
        SSH_HOST="$PROD_SSH"
        COMPOSE_FILE="docker-compose.prod.yml"
        ;;
    *)
        echo "Unknown target: '$TARGET'. Use 'staging' or 'prod'."
        exit 1
        ;;
esac

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "→ Deploying branch '$BRANCH' to $TARGET ($SSH_HOST)..."

git push

ssh "$SSH_HOST" bash -s << EOF
set -e
cd "$REMOTE_DIR"
git pull
docker compose -f $COMPOSE_FILE up -d --build
docker image prune -f
echo "✓ Done"
EOF

echo "✓ Deployed to $TARGET"
