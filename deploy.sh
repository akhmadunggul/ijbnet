#!/bin/bash
set -e

# ── Configuration ─────────────────────────────────────────────────
STAGING_SSH="root@jinzai.aup.my.id"        # Windows 10 server
STAGING_DIR='C:\ijbnet'
PROD_SSH="dockeruser@jinzai.jobagus.id"    # Linux server
PROD_DIR="/opt/ijbnet"
# ─────────────────────────────────────────────────────────────────

TARGET=${1:-}

if [ -z "$TARGET" ]; then
    echo "Usage: ./deploy.sh [staging|prod]"
    exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$TARGET" = "prod" ] && [ "$BRANCH" != "main" ]; then
    echo "Refusing to deploy branch '$BRANCH' to prod. Switch to main first."
    exit 1
fi

echo "→ Deploying branch '$BRANCH' to $TARGET..."

git push

case "$TARGET" in
    staging)
        # Windows remote: route through cmd.exe so && chaining (with
        # fail-fast) works regardless of the server's default SSH shell.
        ssh "$STAGING_SSH" "cmd /c \"cd /d $STAGING_DIR && git fetch origin && git checkout $BRANCH && git pull && docker compose -f docker-compose.staging.yml up -d --build && docker image prune -f && echo Deploy complete\""
        ;;
    prod)
        ssh "$PROD_SSH" bash -s << EOF
set -e
cd "$PROD_DIR"
git fetch origin
git checkout $BRANCH
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
echo "✓ Done"
EOF
        ;;
    *)
        echo "Unknown target: '$TARGET'. Use 'staging' or 'prod'."
        exit 1
        ;;
esac

echo "✓ Deployed to $TARGET"
