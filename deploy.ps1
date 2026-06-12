param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("staging","prod")]
    [string]$Target
)

# ── Configuration ─────────────────────────────────────────────────
$STAGING_SSH = "root@jinzai.aup.my.id"      # Windows 10 server
$STAGING_DIR = "C:\ijbnet"
$PROD_SSH    = "dockeruser@jinzai.jobagus.id" # Linux server
$PROD_DIR    = "/opt/ijbnet"
# ─────────────────────────────────────────────────────────────────

$Branch = git rev-parse --abbrev-ref HEAD

if ($Target -eq "prod" -and $Branch -ne "main") {
    Write-Host "Refusing to deploy branch '$Branch' to prod. Switch to main first." -ForegroundColor Red
    exit 1
}

Write-Host "Deploying branch '$Branch' to $Target..."

git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "git push failed; aborting deploy." -ForegroundColor Red
    exit 1
}

switch ($Target) {
    "staging" {
        # Windows remote: route through cmd.exe so && chaining (with
        # fail-fast) works regardless of the server's default SSH shell.
        $Steps = "cd /d $STAGING_DIR && git fetch origin && git checkout $Branch && git pull && docker compose -f docker-compose.staging.yml up -d --build && docker image prune -f && echo Deploy complete"
        $RemoteCmd = "cmd /c `"$Steps`""
        ssh $STAGING_SSH $RemoteCmd
    }
    "prod" {
        # Linux remote: bash syntax.
        $RemoteCmd = "set -e && cd $PROD_DIR && git fetch origin && git checkout $Branch && git pull && docker compose -f docker-compose.prod.yml up -d --build && docker image prune -f && echo 'Deploy complete'"
        ssh $PROD_SSH $RemoteCmd
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Remote deploy failed (exit $LASTEXITCODE)." -ForegroundColor Red
    exit 1
}

Write-Host "Deployed to $Target successfully."
