#!/usr/bin/env sh
# Writes a compressed copy of the ShopFloor database to ./backups. Run from the folder with docker-compose.yml.
# The stack keeps running; the copy is consistent (pg_dump uses a snapshot).
set -eu
mkdir -p backups
FILE="backups/shopfloor-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U shopfloor -d shopfloor --no-owner --clean --if-exists | gzip > "$FILE"
# An empty or tiny file means the dump failed; do not leave it looking like a good backup.
if [ "$(wc -c < "$FILE")" -lt 1000 ]; then rm -f "$FILE"; echo "Backup failed: the dump was empty. Is the stack running?" >&2; exit 1; fi
echo "Backup written to $FILE"
