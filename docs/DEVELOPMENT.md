# Local development (WSL 2 + Docker + PostgreSQL)

This guide covers running NexusHarness CRM natively inside WSL 2 with its
stateful dependencies in Docker. It is the fastest edit/restart loop and avoids
the port collisions of the full `docker-compose.yml` stack.

## Why a separate compose file

`docker-compose.yml` is the production-like stack: Traefik on `80/443/8080`,
the app on `3000`, PostgreSQL on `5432`, NATS on `4222/8222`, Verdaccio on
`4873`, Directus on `8055` and Dify on `5001`. Those are the default ports for
almost every other project, so it cannot run next to a second stack.

`docker-compose.dev.yml` starts **only the stateful dependencies** on a private
port range and leaves the Node server to run natively in WSL, where file watching
and source maps actually work:

| Service | Host port | Container port |
| --- | --- | --- |
| PostgreSQL 16 | `5434` | `5432` |
| NATS client | `4223` | `4222` |
| NATS monitoring | `8223` | `8222` |
| Verdaccio | `4874` | `4873` |

## First-run setup

```bash
# 1. Dependencies (PostgreSQL, NATS, Verdaccio)
docker compose -f docker-compose.dev.yml up -d

# 2. Environment
cp .env.development.example .env
# Generate a real signing secret; the server falls back to an ephemeral one
# otherwise, which invalidates all tokens on every restart.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Node dependencies
npm install

# 4. Start the server (Vite middleware mode + API on the same port)
npm run dev
```

The app is then on <http://localhost:3100>.

## Verifying a running instance

```bash
npm run smoke     # 12 probes: health, ready, OpenAPI, auth, RBAC, metrics
```

The script logs in as the seeded superadmin `usr_alexey` and checks the CRM,
social, marketplace and telemetry endpoints. It exits non-zero on any mismatch,
so it can gate a release check.

## Seeded accounts

`ensureSeeded()` runs on boot and is idempotent. Demo logins (tenant `acme`):

| User ID | Role | Login |
| --- | --- | --- |
| `usr_alexey` | `portal_superadmin` | passwordless by `userId` |
| `usr_elena` | `sales_head` | passwordless by `userId` |
| `usr_dmitry` | `sales_manager` | passwordless by `userId` |
| `usr_auditor` | `viewer` | passwordless by `userId` |

Password login by `email` additionally requires the seeded password; `userId`
login is the demo shortcut and is intended for local use.

## Database

Set `POSTGRES_URL` in `.env` to use the containerised PostgreSQL. Leave it empty
to fall back to the embedded PGlite database in `./data/pgdata`, which needs no
Docker at all and is what the test suite uses (`PGDATA_DIR=memory://`).

Both paths apply the same `DDL_SQL` on connect, so schema drift between local
PGlite and containerised PostgreSQL is not possible.

```bash
# Inspect data
docker exec -it nexus-dev-postgres psql -U nexus -d nexus_crm -c '\dt'

# Full reset (drops the volume and re-seeds on next boot)
docker compose -f docker-compose.dev.yml down -v
```

## Repository location matters

Keep the checkout on the WSL filesystem (`~/projects/mvr`), not under `/mnt/c`.
The 9p mount that backs `/mnt/c` makes every `stat` a round trip to Windows, and
this project reads thousands of modules. Measured on the same machine, same
commit:

| Location | `npm test` | `npm run build` |
| --- | --- | --- |
| `/mnt/c/...` (Windows drive) | ~50 s | ~13 s |
| `~/...` (WSL ext4) | ~10 s | ~1.4 s |

The 5x gap on tests is why `vitest.config.ts` raises `testTimeout` to 60 s: on
`/mnt/c` one cold dynamic import alone took over 40 seconds.

## Tests and checks

```bash
npm run lint     # tsc --noEmit
npm test         # vitest run (50 tests)
npm run build    # production Vite build into dist/
```

`tests/api.test.ts` starts the Express app on an ephemeral port against
in-memory PGlite, so the suite needs neither Docker nor a free fixed port.

Note that several suites import browser-side modules (recharts, fullcalendar,
jsPDF) transitively. On a cold cache — and especially with the repository on a
bind-mounted Windows drive — one dynamic import can take 40+ seconds, which is
why `vitest.config.ts` raises `testTimeout` above the 5 s default.

## Production-like stack

```bash
docker compose up -d --build
```

The `postgres` service mounts `docker/postgres-init/`, which creates the
`directus` and `dify` databases that the sidecar services expect. Directus keeps
its `directus_*` system tables in its own database so they never collide with
the Drizzle-managed CRM schema.

If the default ports are already taken, override them instead of editing the
file:

```bash
APP_PORT=13000 docker compose up -d --build
```

## Troubleshooting

**`npm install` fails with ERESOLVE.** `.npmrc` sets `legacy-peer-deps=true`
because `@mattermost/client` declares `typescript ^4.3 || ^5` as an optional peer
while the project runs TypeScript 7. Do not drop the flag: its `Client4`/
`WebSocketClient` types are still consumed at runtime.

**`Cannot find module 'react-is'`.** `recharts` lists `react-is` as a peer only.
It is a direct dependency in `package.json`; run `npm install` after updating.

**`/api/health` is green but the UI is blank.** In dev the API and Vite share
one port. Check the terminal for a Vite transform error; the HTML shell is
served even when a module fails to compile.

**NATS events do not arrive.** `NATS_URL=nats://127.0.0.1:4223` must match the
host port from `docker-compose.dev.yml`, not `4222`. Without `NATS_URL` the app
falls back to an in-process bus that persists events to PostgreSQL, which looks
similar but does not exercise the real JetStream path.
