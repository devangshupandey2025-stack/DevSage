# 01 — Architecture

## Runtime

- **API:** Single Cloudflare Worker (`apps/api`). Handles HTTP, queues, cron, Durable Objects.
- **Database:** Cloudflare D1 (SQLite). Single database `devsage-db`.
- **Cache/State:** Cloudflare KV (rate limits, OAuth state, role cache, leaderboard cache).
- **State Machine:** Durable Object `HackathonStateMachine` (SQLite-backed).
- **Queues:** `github-webhooks` (webhook processing), `devsage-notifications` (email + in-app).
- **Cron:** Hourly (`0 * * * *`) — deadline checks, reminders, audit maintenance.

## Worker Entrypoint

```
apps/api/src/index.ts
├── export default { fetch, queue, scheduled }
└── export { HackathonStateMachine }
```

The single worker exports:
- `fetch` — Hono app handling all HTTP requests
- `queue` — Queue consumer dispatching to handlers
- `scheduled` — Cron job dispatcher
- `HackathonStateMachine` — Durable Object class (MUST be re-exported here or wrangler fails)

## Bindings (wrangler.jsonc → env.ts)

| Binding | Type | Name/ID |
|---------|------|---------|
| `DB` | D1Database | `devsage-db` |
| `KV` | KVNamespace | Rate limits, OAuth, cache |
| `HACKATHON_SM` | DurableObjectNamespace | State machine per hackathon |
| `WEBHOOK_QUEUE` | Queue | `github-webhooks` |
| `NOTIFICATION_QUEUE` | Queue | `devsage-notifications` |
| `JWT_SECRET` | Secret | HMAC-SHA256 signing key |
| `GOOGLE_CLIENT_ID/SECRET` | Secret | Google OAuth |
| `GITHUB_CLIENT_ID/SECRET` | Secret | GitHub OAuth |
| `GITHUB_WEBHOOK_SECRET` | Secret | HMAC webhook verification |
| `SMTP_URL/USERNAME/PASSWORD` | Secret | Email sending |
| `FRONTEND_URL` | Var | `https://devsage.org` |
| `PLATFORM_URL` | Var | `https://platform.devsage.org` |
| `ADMIN_URL` | Var | `https://shikdd.devsage.org` |
| `JUDGE_URL` | Var | `https://judge.devsage.org` |

## Middleware Pipeline

Every request flows through this chain in order:

```
Request
  → CORS (allowed origins, credentials)
  → Request ID (X-Request-Id header)
  → Optional Auth (extract JWT from cookie/header, set user context)
  → Error Handler (catch unhandled errors, format response)
  → [Route-specific middleware]
    → authMiddleware (require valid auth)
    → hackathonContext (load hackathon by :slug)
    → requireRole('co_organizer') (check role hierarchy)
    → requirePlatformAdmin (check platform_admins table)
  → Handler
Response
```

## URL Structure

```
/                                       → Health check
/health                                 → Health check
/auth/*                                 → Authentication (no /api/v1 prefix)
/webhooks/github                        → GitHub webhooks (no /api/v1 prefix)
/api/v1/hackathons                      → Hackathon CRUD
/api/v1/hackathons/:slug/teams          → Teams within hackathon
/api/v1/hackathons/:slug/submissions    → Submissions within hackathon
/api/v1/hackathons/:slug/judging        → Judging within hackathon
/api/v1/hackathons/:slug/rounds         → Rounds within hackathon
/api/v1/hackathons/:slug/organizers     → Organizers within hackathon
/api/v1/hackathons/:slug/announcements  → Announcements within hackathon
/api/v1/hackathons/:slug/audit          → Audit log within hackathon
/api/v1/workspaces                      → Workspace management
/api/v1/notifications                   → User notifications
/api/v1/invites                         → Invite acceptance
/api/v1/judge/hackathons                → Judge portal
/api/v1/admin                           → Platform admin
/api/v1/hackathon-requests              → Hackathon request pipeline
```

Key design decisions:
- Auth routes live at `/auth/*` (not `/api/v1/auth`) for cookie simplicity
- Webhooks live at `/webhooks/github` — external systems call this
- Everything else is `/api/v1/` prefixed for versioning
- Hackathons are addressed by **slug** (not ID) for readability
- Sub-resources are nested: `/hackathons/:slug/teams/:teamId/members`

## Monorepo Dependency Graph

```
apps/api      → @devsage/shared, @devsage/db, @devsage/config
apps/web      → @devsage/shared
apps/platform → @devsage/shared
apps/admin    → @devsage/shared
apps/judge    → @devsage/shared
packages/db     → @devsage/config
packages/shared → (standalone, only zod)
packages/config → (standalone)
```

**Hard rules:**
- Frontend apps NEVER import from `@devsage/db` or `@devsage/api`
- No cross-app imports (web can't import from platform)
- No circular dependencies
- `@devsage/shared` is the only bridge between API and frontends

## Frontend Apps

| App | Domain | Port | Purpose | Users |
|-----|--------|------|---------|-------|
| `apps/web` | `devsage.org` | 5173 | Public website, hackathon listing | Everyone |
| `apps/platform` | `platform.devsage.org` | 5174 | Organizer dashboard | Presidents, VPs, Event Leads |
| `apps/admin` | `shikdd.devsage.org` | 5175 | Platform admin panel | DevSage team |
| `apps/judge` | `judge.devsage.org` | 5176 | Judge scoring portal | Judges |

All frontends use Vite dev proxy: `/api/v1`, `/auth`, `/webhooks` → `http://localhost:8787`
