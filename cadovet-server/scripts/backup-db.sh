#!/bin/bash
# Dumps the CadoVet database to a timestamped, gzip-compressed file.
# Usage: ./scripts/backup-db.sh [output-dir]   (default: ./backups, next to this script's repo root)
# Restore with: gunzip -c backups/cadovet-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"
#
# Run this on a schedule in production (e.g. a daily cron job or your host's managed-Postgres backup feature) —
# there is no automatic backup built into the app itself.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${1:-$SCRIPT_DIR/../backups}"
mkdir -p "$OUT_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  # Fall back to reading it out of .env if the caller hasn't exported it.
  if [ -f "$SCRIPT_DIR/../.env" ]; then
    export "$(grep -E '^DATABASE_URL=' "$SCRIPT_DIR/../.env" | xargs)"
  fi
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (checked the environment and ../.env). Aborting." >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$OUT_DIR/cadovet-$TIMESTAMP.sql.gz"

pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$OUT_FILE"
echo "Backup written to $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"
