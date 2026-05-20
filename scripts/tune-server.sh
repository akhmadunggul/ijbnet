#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# IJBNet — VPS tuning script for Ubuntu 24.04 / 4 vCPU / 8 GB RAM
# Run once on the server as root:  sudo bash scripts/tune-server.sh
# Safe to re-run; idempotent.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "[1/4] Kernel / TCP tuning (/etc/sysctl.d/99-ijbnet.conf)"
cat > /etc/sysctl.d/99-ijbnet.conf << 'EOF'
# ── Accept queue ───────────────────────────────────────────────────────────
# Ubuntu 24.04 default is 4096; raise to match Caddy's backlog.
net.core.somaxconn           = 65535
net.core.netdev_max_backlog  = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# ── TIME_WAIT sockets ──────────────────────────────────────────────────────
# Allow new connections to reuse TIME_WAIT slots instead of waiting 60 s.
net.ipv4.tcp_tw_reuse = 1

# ── Ephemeral port range ───────────────────────────────────────────────────
# Default 32768–60999 → 28 k ports; raise to 64 k for bursty load.
net.ipv4.ip_local_port_range = 1024 65535

# ── File descriptors (system-wide) ────────────────────────────────────────
fs.file-max  = 1048576
fs.nr_open   = 1048576

# ── Redis: prevent OOM killer from hitting Redis under memory pressure ─────
vm.overcommit_memory = 1

# ── Transparent huge pages off (Redis recommendation) ─────────────────────
# Handled separately via rc.local / systemd; sysctl can't disable THP.
EOF

sysctl --system
echo "  → sysctl applied"

echo "[2/4] Persistent file-descriptor limits (/etc/security/limits.d/99-ijbnet.conf)"
cat > /etc/security/limits.d/99-ijbnet.conf << 'EOF'
# Allow any user (and therefore any Docker child process) to open 1M fds.
*    soft nofile 1048576
*    hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
EOF
echo "  → limits written (effective on next login / service restart)"

echo "[3/4] Docker daemon defaults (/etc/docker/daemon.json)"
DAEMON_JSON=/etc/docker/daemon.json

# Merge into existing daemon.json if it exists, otherwise create fresh.
if [ -f "$DAEMON_JSON" ]; then
  # Simple merge: add default-ulimits if not present.
  python3 - "$DAEMON_JSON" << 'PYEOF'
import json, sys
path = sys.argv[1]
with open(path) as f:
    cfg = json.load(f)
cfg.setdefault("default-ulimits", {})
cfg["default-ulimits"]["nofile"] = {"Name": "nofile", "Hard": 1048576, "Soft": 1048576}
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
print("  → merged into existing daemon.json")
PYEOF
else
  cat > "$DAEMON_JSON" << 'EOF'
{
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 1048576,
      "Soft": 1048576
    }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
EOF
  echo "  → created new daemon.json"
fi

echo "  → reloading Docker daemon (containers keep running)"
systemctl reload docker || systemctl restart docker

echo "[4/4] Disable Transparent Huge Pages (helps Redis + MySQL)"
# Write a systemd oneshot unit so this persists across reboots.
cat > /etc/systemd/system/disable-thp.service << 'EOF'
[Unit]
Description=Disable Transparent Huge Pages
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=basic.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled'
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/defrag'
RemainAfterExit=yes

[Install]
WantedBy=basic.target
EOF

systemctl daemon-reload
systemctl enable --now disable-thp.service
echo "  → THP disabled now and on reboot"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Tuning complete. Verify with:"
echo ""
echo "  sysctl net.core.somaxconn net.ipv4.tcp_tw_reuse fs.file-max"
echo "  cat /proc/sys/vm/overcommit_memory"
echo "  cat /sys/kernel/mm/transparent_hugepage/enabled"
echo "  docker info | grep -i 'open files'"
echo "═══════════════════════════════════════════════════════════════"
