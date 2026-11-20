# ShopFloor deployment on a LAN (Phase 9)

One computer (the **server PC**) runs three containers: the database, the API and the web app. Everyone else opens the server PC's address in a browser. Nothing needs the internet once the images are built.

## What you need
- Docker Desktop (Windows) or Docker Engine with Compose, on the server PC. Internet is needed **once**, to build the images.
- The server PC on the same network as the other computers, and kept on during working hours.

## First start
1. Put the project folder on the server PC. Open a terminal in the folder that contains `docker-compose.yml`.
2. Copy `.env.example` to `.env` and edit it:
   - `POSTGRES_PASSWORD`: choose one.
   - `JWT_SECRET`: 32+ random characters (the file shows how to generate one).
   - `ALLOWED_ORIGINS`: exactly what people will type in the browser, e.g. `http://192.168.1.50:8080`. If this does not match, sign-in works but saving anything is refused ("origin not allowed").
   - Leave `COOKIE_SECURE=false` while using plain `http://` on the LAN.
3. Start: `docker compose up -d --build` (first build takes several minutes).
4. First time only, create the sample reference data and demo users: `docker compose run --rm api npm run db:seed`. The demo users share `SEED_PASSWORD`. **Change every demo password in Settings, or deactivate the demo users, before real use.**
5. Open `http://<server-address>:8080` and sign in.

Starting also applies any pending database migrations. If a migration fails the API stops and `docker compose logs api` says why; the app is never left half-upgraded silently.

## A stable address
Other computers need an address that does not change.
- **Easiest:** in the router's admin page, give the server PC a DHCP reservation (a fixed IP such as `192.168.1.50`). Then use `ALLOWED_ORIGINS=http://192.168.1.50:8080`.
- **Nicer:** add a hostname such as `shopfloor.local` in the router's local DNS, or in each computer's hosts file. Then put that exact address in `ALLOWED_ORIGINS` (you may list several, separated by commas, e.g. the IP and the name).
- After changing `.env`: `docker compose up -d`.

## Let other computers in (Windows firewall)
On the server PC, allow inbound TCP on `WEB_PORT` (default 8080), in an elevated PowerShell:
`New-NetFirewallRule -DisplayName "ShopFloor" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private`
(The network must be set to "Private". Only the web port is published; the database and API are not reachable from the network.)

## Health and failures
- `docker compose ps` shows each service and its health (`healthy` / `unhealthy`).
- Web health: `http://<server>:8080/healthz`. API + database health: `http://<server>:8080/api/health` (returns 503 with "database unavailable" when the database is down).
- Containers restart automatically after a crash or a PC reboot (Docker Desktop must start with Windows: Settings > General > "Start Docker Desktop when you sign in").
- Logs: `docker compose logs -f api`.

## Data persists
Data lives in the Docker volume `shopfloor-pgdata`, so `docker compose restart`, `down` and `up` keep it. `docker compose down -v` **deletes it**; never add `-v` unless you mean to wipe everything.

## Backup and restore
Backups are plain database dumps in `backups/`. Run them from the project folder with the stack running.
- Backup: `./scripts/backup.sh` (Mac/Linux/Git Bash) or `.\scripts\backup.ps1` (PowerShell).
- Restore (replaces all current data, asks you to type YES): `./scripts/restore.sh backups/<file>.sql.gz` or `.\scripts\restore.ps1 backups\<file>.sql`.
- Take a backup before every update. Copy the `backups` folder to a USB drive or another PC regularly; a backup on the same disk does not protect against a dead disk.
- Daily backup on Windows: Task Scheduler > Create Basic Task > daily > Start a program `powershell.exe` with arguments `-ExecutionPolicy Bypass -File C:\path\to\shopfloor\scripts\backup.ps1`, and "Start in" set to the project folder.
- **Practise a restore once** on a spare copy before you need it.

## Updating
1. Backup. 2. Replace the project files. 3. `docker compose up -d --build`. Migrations run on start.

## Acceptance checks to run on your network
These need real computers and cannot be done by the build; tick them off once:
- [ ] `docker compose up -d --build` starts all three services and they show `healthy`.
- [ ] Sign in from the server PC and from a second computer on the LAN; record a report on one and see it on the other.
- [ ] `docker compose restart`, then confirm the data is still there.
- [ ] Disconnect the internet (unplug the router's WAN or disable Wi-Fi to the internet) and repeat a core workflow: submit, approve, dashboard.
- [ ] Run a backup, delete something harmless, restore, confirm it came back.
- [ ] Stop the database (`docker compose stop db`): `/api/health` should report unavailable; start it again and the app recovers.

## Troubleshooting
- "This request came from an origin that is not allowed" when saving: `ALLOWED_ORIGINS` does not exactly match the address in the browser bar (check http vs https, the port, spelling). Fix `.env`, then `docker compose up -d`.
- Other computers cannot connect: firewall rule above, wrong network profile (Public), or the server PC's address changed.
- Too many sign-in attempts: the limit is 10 per minute per computer.
- Sessions last `SESSION_HOURS` (default 10).

## Security notes
- Keep `.env` private; it holds the database password and the session secret. Changing `JWT_SECRET` signs everyone out.
- Plain http on a trusted LAN is the supported setup. Do not expose the web port to the internet. Remote access needs a separate secure design (Phase 10).
