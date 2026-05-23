#!/usr/bin/env bash
# IJBNet — daily backup to Google Drive via rclone
#
# SETUP (one-time, on the VPS):
#   1. Install rclone:  curl https://rclone.org/install.sh | sudo bash
#   2. Configure GDrive: rclone config
#        - Choose "n" (new remote) → name it "gdrive"
#        - Type: Google Drive  →  leave client_id/secret blank
#        - Scope: drive.file (or drive for full access)
#        - Complete the OAuth flow in your browser
#   3. Make script executable:  chmod +x /opt/ijbnet/scripts/backup.sh
#   4. Test a dry run:  /opt/ijbnet/scripts/backup.sh --dry-run
#   5. Add to crontab:  crontab -e
#        0 2 * * * /opt/ijbnet/scripts/backup.sh >> /var/log/ijbnet-backup.log 2>&1

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
COMPOSE_DIR="/opt/ijbnet"
ENV_FILE="$COMPOSE_DIR/.env"
BACKUP_DIR="/opt/ijbnet/backups"
RCLONE_REMOTE="gdrive:ijbnet-backups"
RETENTION_DAYS=30
DRY_RUN=false

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

env_val() {
  # Read a key from .env, strip surrounding quotes
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//"
}

# ── Load DB credentials from .env ─────────────────────────────────────────────
DB_NAME=$(env_val DB_NAME)
DB_USER=$(env_val DB_USER)
DB_PASS=$(env_val DB_PASS)

if [[ -z "$DB_NAME" || -z "$DB_USER" || -z "$DB_PASS" ]]; then
  log "ERROR: Could not read DB_NAME / DB_USER / DB_PASS from $ENV_FILE"
  exit 1
fi

# ── Detect Docker volume name (handles project-name prefix) ──────────────────
UPLOADS_VOLUME=$(docker volume ls --filter name=uploads_data --format '{{.Name}}' | head -1)
if [[ -z "$UPLOADS_VOLUME" ]]; then
  log "ERROR: Could not find Docker volume matching 'uploads_data'"
  exit 1
fi

# ── Prepare staging directory ─────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
STAGE="$BACKUP_DIR/$TIMESTAMP"

if $DRY_RUN; then
  log "=== DRY RUN — no files will be written or uploaded ==="
  log "Would dump DB: $DB_NAME  →  $STAGE/db_${TIMESTAMP}.sql.gz"
  log "Would archive volume: $UPLOADS_VOLUME  →  $STAGE/uploads_${TIMESTAMP}.tar.gz"
  log "Would upload to: $RCLONE_REMOTE/$TIMESTAMP"
  exit 0
fi

mkdir -p "$STAGE"
log "=== IJBNet backup started (${TIMESTAMP}) ==="

# ── 1. MySQL dump ─────────────────────────────────────────────────────────────
DB_FILE="$STAGE/db_${TIMESTAMP}.sql.gz"
log "Dumping database '$DB_NAME'..."
docker exec ijbnet_db \
  mysqldump \
    --user="$DB_USER" \
    --password="$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --set-gtid-purged=OFF \
    "$DB_NAME" \
  | gzip > "$DB_FILE"
log "  → $(du -sh "$DB_FILE" | cut -f1)  saved"

# ── 2. Uploads volume ─────────────────────────────────────────────────────────
UPLOADS_FILE="$STAGE/uploads_${TIMESTAMP}.tar.gz"
log "Archiving uploads volume '$UPLOADS_VOLUME'..."
docker run --rm \
  -v "${UPLOADS_VOLUME}:/data:ro" \
  -v "${STAGE}:/backup" \
  alpine \
  tar czf "/backup/uploads_${TIMESTAMP}.tar.gz" -C /data .
log "  → $(du -sh "$UPLOADS_FILE" | cut -f1)  saved"

# ── 3. Upload to Google Drive ─────────────────────────────────────────────────
log "Uploading to Google Drive ($RCLONE_REMOTE/$TIMESTAMP)..."
rclone copy "$STAGE" "$RCLONE_REMOTE/$TIMESTAMP" \
  --transfers=4 \
  --stats=0
log "  → Upload complete"

# ── 4. Prune old local backups ────────────────────────────────────────────────
log "Pruning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

# ── 5. Prune old remote backups ───────────────────────────────────────────────
log "Pruning remote backups older than ${RETENTION_DAYS} days..."
rclone delete "$RCLONE_REMOTE" \
  --min-age "${RETENTION_DAYS}d" \
  --rmdirs

log "=== Backup completed successfully ==="
