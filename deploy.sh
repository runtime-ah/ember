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
  --exclude='backend/.env' \
  --exclude='**/__pycache__/' \
  --exclude='**/*.pyc' \
  --exclude='**/*.db' \
  ./ "${PI_HOST}:${PI_DIR}/"

echo "▸ Building and starting Docker container..."
ssh "${PI_HOST}" "cd '${PI_DIR}' && docker compose up -d --build"

echo "▸ Updating Caddy..."
# Stream the Python update script to the Pi, then run it with sudo
MCP_PORT=8765

ssh "${PI_HOST}" "cat > /tmp/ember_caddy_update.py" <<'PYEOF'
import re, sys

path = sys.argv[1]
ember_port = sys.argv[2]
mcp_port = sys.argv[3]
EMBER_MARKER = "handle_path /ember"
MCP_MARKER = "handle /mcp"

with open(path) as f:
    content = f.read()

blocks_to_add = ""

if MCP_MARKER not in content:
    blocks_to_add += f"""
    handle /mcp* {{
        reverse_proxy 127.0.0.1:{mcp_port}
    }}
"""
else:
    print("  ✓ MCP Caddy block already present")

if EMBER_MARKER not in content:
    blocks_to_add += f"""
    handle_path /ember* {{
        reverse_proxy 127.0.0.1:{ember_port}
    }}
"""
else:
    print("  ✓ Ember Caddy block already present")

if not blocks_to_add:
    sys.exit(0)

updated, n = re.subn(r"(\n[ \t]*handle\s*\{)", blocks_to_add + r"\1", content, count=1)

if n == 0:
    print("  ⚠  Could not find catch-all 'handle {' block in Caddyfile.")
    print("  Add this manually before the final catch-all and run: sudo systemctl reload caddy")
    print(blocks_to_add)
    sys.exit(0)

with open(path, "w") as f:
    f.write(updated)

print("  ✓ Caddy blocks added")
PYEOF

ssh "${PI_HOST}" "sudo python3 /tmp/ember_caddy_update.py '${CADDY_FILE}' '${EMBER_PORT}' '${MCP_PORT}' \
  && sudo caddy validate --config '${CADDY_FILE}' \
  && sudo systemctl reload caddy"

echo ""
echo "✓ Done — https://pi.tail56f1a8.ts.net/ember"
