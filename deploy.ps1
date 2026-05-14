param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("staging","prod")]
    [string]$Target
)

# ── Configuration ─────────────────────────────────────────────────
$STAGING_SSH = "root@jinzai.aup.my.id"
$PROD_SSH    = "dockeruser@jinzai.jobagus.id"
$REMOTE_DIR  = "/opt/ijbnet"
# ─────────────────────────────────────────────────────────────────

switch ($Target) {
    "staging" {
        $SshHost     = $STAGING_SSH
        $ComposeFile = "docker-compose.staging.yml"
    }
    "prod" {
        $SshHost     = $PROD_SSH
        $ComposeFile = "docker-compose.prod.yml"
    }
}

$Branch = git rev-parse --abbrev-ref HEAD
Write-Host "Deploying branch '$Branch' to $Target ($SshHost)..."

git push

$RemoteCmd = "set -e && cd $REMOTE_DIR && git pull && docker compose -f $ComposeFile up -d --build && docker image prune -f && echo 'Deploy complete'"
ssh $SshHost $RemoteCmd

Write-Host "Deployed to $Target successfully."
