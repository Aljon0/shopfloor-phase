# Restores a backup made by backup.ps1. REPLACES all current data. Usage: .\scripts\restore.ps1 backups\shopfloor-YYYYMMDD-HHMMSS.sql
param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $File)) { throw "File not found: $File" }
$answer = Read-Host "This replaces ALL current ShopFloor data with $File. Type YES to continue"
if ($answer -ne 'YES') { Write-Host 'Cancelled.'; exit 1 }
docker compose stop web api
docker compose cp $File db:/tmp/restore.sql
docker compose exec -T db psql -U shopfloor -d shopfloor -v ON_ERROR_STOP=1 --single-transaction -q -f /tmp/restore.sql
if ($LASTEXITCODE -ne 0) { docker compose start api web; throw "Restore failed; nothing was changed." }
docker compose exec -T db rm -f /tmp/restore.sql
docker compose start api web
Write-Host 'Restore finished.'
