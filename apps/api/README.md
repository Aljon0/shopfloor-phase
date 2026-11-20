# ShopFloor API (Phase 8A–8B)

Node + Express 5 + Prisma 7 + PostgreSQL. Phase 8A covers the foundation: database schema for every entity,
migrations, seed data, real sign-in with role-based access, and the Settings module.
Phase 8B adds production orders. Reports, approvals, downtime, quality, dashboard and analytics move over in 8C–8D; until then those screens keep using demo data in the browser.

## First-time setup (Windows, PowerShell, from the repo root)

```powershell
npm install
Copy-Item apps\api\.env.example apps\api\.env          # then edit JWT_SECRET (32+ random characters)
Copy-Item apps\web\.env.example apps\web\.env.local
npm run db:up                                          # PostgreSQL 16 in Docker (needs Docker Desktop running)
npm run db:generate                                    # generates the Prisma client (required after every install)
npm run db:migrate                                     # applies migrations
npm run db:seed                                        # reference data + 9 demo users
```

Run it (two terminals):

```powershell
npm run dev:api        # http://localhost:4000
npm run dev:web:api    # http://localhost:5173
```

Demo users (password = `SEED_PASSWORD` from your `.env`, default `ChangeMe-Demo-2026!`):
`carlo.reyes@northstar.example` (administrator), `mira.santos@…` (manager), `rosa.villanueva@…` and `benjie.ramos@…` (supervisors),
`juan.delacruz@…`, `mark.bautista@…`, `maria.reyes@…`, `carlo.mendoza@…`, `jose.ramos@…` (operators).
Change these passwords before using real data. The seed never overwrites the password of a user that already exists.

## Using it from other computers on the LAN
1. Add the address people type in their browser to `ALLOWED_ORIGINS` (for example `http://192.168.1.20:5173`) and restart the API.
2. Keep `COOKIE_SECURE=false` while the site is plain HTTP. Set it to `true` only behind HTTPS. Phase 9 covers the proper reverse proxy.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev:api` | API with auto-restart |
| `npm run db:migrate` | Apply committed migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev -w apps/api` | Create a new migration after changing `schema.prisma` |
| `npm run db:seed` | Idempotent seed |
| `npm run db:reset -w apps/api` | Drop and rebuild the dev database (destroys data) |
| `npm run test -w apps/api` | Unit tests; integration tests run when `TEST_DATABASE_URL` is set |

Integration tests (use the separate `shopfloor_test` database that `db:up` creates):
```powershell
$env:TEST_DATABASE_URL="postgresql://shopfloor:shopfloor@localhost:5432/shopfloor_test"; npm run test -w apps/api
```
They rebuild that database's schema from the migration SQL on every run, so never point `TEST_DATABASE_URL` at real data.

## Security notes
- Passwords are hashed with scrypt; the session is a signed JWT in an httpOnly, SameSite=Lax cookie.
- Every request re-reads the user, so deactivating someone, changing their role or resetting their password ends their sessions immediately.
- Role checks happen in the API. Hiding links in the web app is only a convenience.
- Non-GET requests from an origin not in `ALLOWED_ORIGINS` are rejected. Sign-in is rate limited (10 per minute per address).
- Settings records are never deleted, only deactivated, and every change is written to the audit log.

See `docs/API.md` for the endpoints.
