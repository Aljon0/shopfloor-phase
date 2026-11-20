#!/usr/bin/env sh
# Restores a backup made by backup.sh. REPLACES all current data. Usage: ./scripts/restore.sh backups/shopfloor-YYYYMMDD-HHMMSS.sql.gz
set -eu
[ $# -eq 1 ] && [ -f "$1" ] || { echo "Usage: $0 <backup-file.sql.gz>" >&2; exit 1; }
printf "This replaces ALL current ShopFloor data with %s. Type YES to continue: " "$1"
read -r answer
[ "$answer" = "YES" ] || { echo "Cancelled."; exit 1; }
docker compose stop web api
gunzip -c "$1" | docker compose exec -T db psql -U shopfloor -d shopfloor -v ON_ERROR_STOP=1 --single-transaction -q
docker compose start api web
echo "Restore finished."
