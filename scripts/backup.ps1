# Writes a copy of the ShopFloor database to .\backups. Run from the folder with docker-compose.yml (Windows PowerShell).
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path backups | Out-Null
$name = "backups\shopfloor-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
# --file inside the container avoids PowerShell re-encoding the dump; docker cp then moves it out.
docker compose exec -T db sh -c "pg_dump -U shopfloor -d shopfloor --no-owner --clean --if-exists -f /tmp/backup.sql"
if ($LASTEXITCODE -ne 0) { throw "Backup failed. Is the stack running?" }
docker compose cp db:/tmp/backup.sql $name
docker compose exec -T db rm -f /tmp/backup.sql
if ((Get-Item $name).Length -lt 1000) { Remove-Item $name; throw "Backup failed: the dump was empty." }
Write-Host "Backup written to $name"
