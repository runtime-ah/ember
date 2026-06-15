#!/usr/bin/env bash
# Deploy Ember to the Pi.
# Usage: ./deploy.sh
set -euo pipefail

PI_HOST="admin@192.168.68.100"
PI_DIR="/home/admin/ember"
CADDY_FILE="/etc/caddy/Caddyfile"
EMBER_PORT=8001

echo "▸ Syncing code to Pi..."
rsync -a --delete \
  --exclude='.git/' \
  --exclude='frontend/node_modules/' \
  --exclude='backend/.venv/' \
  --exclude='**/__pycache__/' \
  --exclude='**/*.pyc' \
  --exclude='**/*.db' \
  ./ "${PI_HOST}:${PI_DIR}/"

echo "▸ Building and starting Docker container..."
ssh "${PI_HOST}" "cd '${PI_DIR}' && docker compose up -d --build"

echo "▸ Updating Caddy..."
# Stream the Python update script to the Pi, then run it with sudo
ssh "${PI_HOST}" "cat > /tmp/ember_caddy_update.py" <<'PYEOF'
import re, sys

path = sys.argv[1]
port = sys.argv[2]
MARKER = "handle_path /ember"

with open(path) as f:
    content = f.read()

if MARKER in content:
    print("  ✓ Caddy block already present")
    sys.exit(0)

block = f"""
    handle_path /ember* {{
        reverse_proxy 127.0.0.1:{port}
    }}
"""

updated, n = re.subn(r"(\n[ \t]*handle\s*\{)", block + r"\1", content, count=1)

if n == 0:
    print("  ⚠  Could not find catch-all 'handle {' block in Caddyfile.")
    print("  Add this manually before the final catch-all and run: sudo systemctl reload caddy")
    print(block)
    sys.exit(0)

with open(path, "w") as f:
    f.write(updated)

print("  ✓ Caddy block added")
PYEOF

ssh "${PI_HOST}" "sudo python3 /tmp/ember_caddy_update.py '${CADDY_FILE}' '${EMBER_PORT}' \
  && sudo caddy validate --config '${CADDY_FILE}' \
  && sudo systemctl reload caddy"

echo ""
echo "✓ Done — https://pi.tail56f1a8.ts.net/ember"
