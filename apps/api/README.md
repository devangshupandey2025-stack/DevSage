# @devsage/api

**Cloudflare Worker API**

Hono-based API running on Cloudflare Workers, serving as the backend for the DevSage hackathon platform. A single Worker handles HTTP routes, Durable Objects, Queue consumers, and Cron Triggers. Production endpoint: `https://api.devsage.org`.

## Directory Structure

```
src/
├── index.ts              # Entry — Hono app, DO re-exports, queue/cron handlers
├── routes/               # Route modules: auth, hackathons, teams, submissions, webhooks, judging
├── queue/                # Queue consumer handlers (push, tag-create, tag-delete, installation, notification)
├── durable-objects/      # HackathonStateMachine (SQLite-backed DO)
├── middleware/            # auth, role, error-handler
├── lib/                  # jwt, cookies, oauth, audit, etag, response helpers
├── services/             # External: github, smtp
├── types/                # env.ts (Worker bindings), auth.ts (JWT payload)
└── __tests__/            # Integration tests (vitest-pool-workers)
```

## Development

```bash
# From repo root — starts all apps including API (wrangler dev)
pnpm dev

# API only
pnpm --filter @devsage/api dev
```

Local development requires a `.dev.vars` file with secrets (gitignored). See `docs/v2/setup.md` for required values.

## Worker Bindings

| Binding              | Type            | Name / Class               |
| -------------------- | --------------- | -------------------------- |
| `DB`                 | D1 Database     | `devsage-db`               |
| `KV`                 | KV Namespace    | --                         |
| `HACKATHON_SM`       | Durable Object  | `HackathonStateMachine`    |
| `WEBHOOK_QUEUE`      | Queue           | `github-webhooks`          |
| `NOTIFICATION_QUEUE` | Queue           | `devsage-notifications`    |

Compatibility flags: `nodejs_compat`. Cron trigger: `0 * * * *` (hourly deadline checks).

## API Routes

All v2 routes use the `/api/v1/` prefix with slug-based hackathon addressing. Responses follow a standard envelope:

- Success: `{ ok: true, data, meta }`
- Failure: `{ ok: false, error }`

### Authentication

| Method | Path                       | Description            |
| ------ | -------------------------- | ---------------------- |
| GET    | `/auth/github`             | GitHub OAuth initiate  |
| GET    | `/auth/github/callback`    | GitHub OAuth callback  |
| GET    | `/auth/google`             | Google OAuth initiate  |
| GET    | `/auth/google/callback`    | Google OAuth callback  |
| POST   | `/auth/logout`             | Clear session          |
| GET    | `/auth/me`                 | Current user info      |

### Hackathons (v2)

| Method | Path                                  | Description          |
| ------ | ------------------------------------- | -------------------- |
| GET    | `/api/v1/hackathons`                  | List hackathons      |
| POST   | `/api/v1/hackathons`                  | Create hackathon     |
| GET    | `/api/v1/hackathons/:slug`            | Get by slug          |
| PUT    | `/api/v1/hackathons/:slug`            | Update hackathon     |
| PATCH  | `/api/v1/hackathons/:slug/status`     | Transition phase     |
| DELETE | `/api/v1/hackathons/:slug`            | Delete hackathon     |

### Teams

| Method | Path                                          | Description        |
| ------ | --------------------------------------------- | ------------------ |
| POST   | `/api/v1/hackathons/:slug/teams`              | Create team        |
| GET    | `/api/v1/hackathons/:slug/teams`              | List teams         |
| GET    | `/api/v1/hackathons/:slug/teams/:id`          | Get team           |
| POST   | `/api/v1/hackathons/:slug/teams/:id/join`     | Join team          |
| POST   | `/api/v1/hackathons/:slug/teams/:id/repo`     | Set team repo      |

### Submissions

GET list, GET detail, POST finalize -- scoped under hackathon slug.

### Judging

POST/GET judges, POST assign, GET/POST rubric, POST scores, GET leaderboard -- scoped under hackathon slug.

### Webhooks

| Method | Path                | Description                  |
| ------ | ------------------- | ---------------------------- |
| POST   | `/webhooks/github`  | GitHub App webhook receiver  |

## Auth Model

- **Manual OAuth 2.0** with GitHub and Google providers (not `@hono/oauth-providers`, which is broken on Workers).
- **JWT** stored in an HttpOnly cookie, signed with HMAC SHA-256 via `crypto.subtle`. No external JWT libraries.
- **Roles are resolved per-request per-hackathon**, not stored in the JWT. A user's role can differ across hackathons.
- **7 roles** (ascending privilege): `anonymous`, `participant`, `team_leader`, `judge`, `moderator`, `admin`, `owner`.

## Durable Objects

### HackathonStateMachine

One instance per hackathon, addressed by hackathon ID. Manages phase transitions, submission locking, and deadline enforcement via alarms. Backed by SQLite (`new_sqlite_classes`).

State machine (forward-only, no backward or skip transitions):

```
DRAFT -> REGISTRATION_OPEN -> REGISTRATION_CLOSED -> ACTIVE -> JUDGING -> COMPLETED -> ARCHIVED
```

Durable Object classes **must** be re-exported from `src/index.ts` or wrangler will fail to find them.

## Queue Handlers

The Worker acts as both queue producer and consumer. Handlers live in `src/queue/`:

| Handler                  | Queue                  | Purpose                                      |
| ------------------------ | ---------------------- | -------------------------------------------- |
| `push-handler`           | `github-webhooks`      | Logs commits, detects force pushes            |
| `tag-create-handler`     | `github-webhooks`      | Processes submission tags via DO              |
| `tag-delete-handler`     | `github-webhooks`      | Handles tag deletion                          |
| `installation-handler`   | `github-webhooks`      | GitHub App install/uninstall events           |
| `notification-handler`   | `devsage-notifications` | Sends emails via SMTP                        |

## Testing

```bash
pnpm --filter @devsage/api test
```

Uses `@cloudflare/vitest-pool-workers` -- tests run in a real Workers runtime with actual D1, KV, and Durable Object bindings. No mocking of Cloudflare primitives. Test files live in `src/__tests__/`.

## Deployment

```bash
pnpm deploy:api             # Production deploy
pnpm deploy:api:dev         # Dev environment deploy
pnpm deploy:api:secrets     # Upload secrets from .env.production
```

Configuration lives in `wrangler.jsonc`. Never run wrangler commands from the repo root -- always from `apps/api/` or use the pnpm filter scripts above.

## Key Conventions

- Route files export Hono sub-apps, mounted in `index.ts`.
- Request validation via `@hono/zod-validator` with schemas from `@devsage/shared`.
- DB access through `createDbClient(c.env.DB)` from `@devsage/db`.
- Durable Objects never touch D1 directly -- the Worker mediates all D1 writes.
- Configuration uses `wrangler.jsonc` (not `.toml`).
- No external JWT libraries. No `@hono/oauth-providers`.
- `console.log` is banned -- use `console.warn` or `console.error`.
- All timestamps are UTC ISO-8601 (`new Date().toISOString()`).

For full architecture details, see `docs/v2/architecture/00-overview.md`. For database schemas, see `packages/db`.
