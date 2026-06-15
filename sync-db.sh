#!/usr/bin/env bash
# Copy the local dev database to the Pi.
# Usage: ./sync-db.sh
set -euo pipefail

PI_HOST="admin@192.168.68.100"
DB="backend/todo.db"

if [ ! -f "$DB" ]; then
  echo "Error: $DB not found" && exit 1
fi

echo "▸ Copying database to Pi..."
scp "$DB" "${PI_HOST}:/tmp/todo.db"

echo "▸ Swapping database in container..."
ssh "${PI_HOST}" "cd /home/admin/ember \
  && docker compose stop \
  && docker cp /tmp/todo.db ember-ember-1:/data/todo.db \
  && docker compose start"

echo "✓ Done"
