# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package: @devsage/api

Cloudflare Worker serving the DevSage business API — Hono routes, auth routes, Durable Objects, Queue consumers, and Cron handlers. Auth is API-hosted and cookie-based (`/auth/*`) with JWT access tokens + rotating refresh tokens. All D1 writes are mediated through the Worker (never directly from DOs).

## Commands

```bash
# From repo root
pnpm --filter @devsage/api run dev        # Local dev (resets D1 + applies migrations + seeds)
pnpm --filter @devsage/api run test       # Run all tests
pnpm --filter @devsage/api exec vitest run src/__tests__/hackathons.test.ts  # Single test file
pnpm --filter @devsage/api run build      # Type-check (tsc --noEmit)
pnpm --filter @devsage/api run deploy     # Deploy to Cloudflare
```

## Source Layout

```
src/
├── index.ts              # Hono app — mounts routes, exports fetch/queue/scheduled + DO re-export
├── types/env.ts          # AppEnv — Bindings (DB, KV, DO, Queues) + Variables (user, role, hackathon)
├── middleware/            # Global + per-route middleware
├── routes/               # Hono route files including /auth endpoints
├── lib/                  # Shared utilities (response helpers, audit, etag, webhook-normalize, etc.)
├── services/             # External integrations (GitHub, SMTP, email, judging)
├── queue/                # Queue dispatcher + handlers (push, tag, installation, notification)
├── cron/                 # Hourly: deadline transitions, reminders, audit hash backfill
├── durable-objects/      # HackathonStateMachine DO (lifecycle, submission locking)
└── __tests__/            # ~24 integration test files + helpers.ts
```

## Key Patterns

### Auth (API-Hosted Cookie Sessions)
`routes/auth.ts` handles register/login/oauth/refresh/logout/me flows. `optionalAuth` reads the `access_token` cookie, verifies HS256 signature via `crypto.subtle`, and populates `c.set('user', ...)` after DB-backed role hydration.

### Middleware Chain (applied in order)
CORS → Request ID → optionalAuth (JWT from cookie) → errorHandler → per-route: `requireRole(minRole)` or `requirePlatformAdmin`

### Route Mounting
All hackathon routes use slug-based addressing: `/api/v1/hackathons/:slug/...`. Webhooks at `/webhooks`. Mount new routes in `src/index.ts` via `app.route()`.

### Response Envelope
All routes must use helpers from `lib/response.ts`:
- `successResponse(c, data, meta?)` → `{ ok: true, data, meta }`
- `errorResponse(c, status, code, message)` → `{ ok: false, error: { code, message } }`
- `paginatedResponse(c, data, total, limit, offset)` → adds `meta.has_more`
- `cursorPaginatedResponse(c, data, nextCursor, hasMore)`

### Role System
`UserContext` contains `hackathonRoles: Record<string, string[]>` (slug → roles) and `workspaceRoles: Record<string, string>` (workspace_id → role) plus `platformAdmin: boolean`. The `requireRole()` middleware checks these against the current hackathon slug.

### Services Pattern
All external service calls use fail-open: 10s AbortController timeout, log warning, never throw. See `src/services/`.

### Audit Trail
Every mutation must call `insertAuditEvent()` (via `c.executionCtx.waitUntil()` to avoid blocking). SHA-256 hash chain for tamper detection. Actor types: `user | system | bot | cron`.

### Durable Objects
`HackathonStateMachine` manages the 5-state lifecycle + submission locking with optimistic versioning. MUST be re-exported from `src/index.ts` or wrangler deploy fails. Uses SQLite-backed storage (`new_sqlite_classes`).

### Queue Handlers
`src/queue/index.ts` dispatches by queue name:
- `github-webhooks` → push/tag/installation handlers
- `devsage-notifications` → email dispatch with idempotency keys

### Cron (Hourly)
Checks submission deadlines → transitions to `judging`, sends 24h/1h reminders, backfills unhashed audit events.

## Wrangler Configuration
All bindings in `wrangler.jsonc` (never `.toml`). Never run wrangler from repo root.
- **DB**: D1 `devsage-db`, migrations at `../../packages/db/migrations`
- **KV**: Single namespace (rate limits, OAuth state)
- **DO**: `HACKATHON_SM` (HackathonStateMachine class)
- **Queues**: `WEBHOOK_QUEUE`, `NOTIFICATION_QUEUE` (max batch: 10, max retries: 3)
- **Cron**: `0 * * * *`
- Update `types/env.ts` whenever bindings change

## Testing
- **Framework**: Vitest + `@cloudflare/vitest-pool-workers` (runs in real Workers runtime)
- **Config**: `singleWorker: true`, `isolatedStorage: false`, miniflare bindings for test secrets
- **Helpers**: `src/__tests__/helpers.ts` — `ensureSchema()`, `resetDb()`, `SEED` object, `authCookie()`, insert helpers, `seedFullScenario()`
- **Pattern**: Integration-first, minimal mocking. Each test calls `ensureSchema()` in `beforeAll` and `resetDb()` in `beforeEach`
