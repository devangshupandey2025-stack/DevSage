# apps/api — Cloudflare Worker API

Hono-based API on Cloudflare Workers. Single Worker handles HTTP routes, Durable Objects, Queue consumer, and Cron triggers. Production: `https://api.devsage.org`.

## STRUCTURE

```
src/
├── index.ts              # Entry: Hono app + DO re-export + queue/cron handlers
├── routes/               # Hono route modules (14 files)
│   ├── auth.ts           # OAuth initiation/callback, JWT/refresh, /auth/me, logout
│   ├── hackathons.ts     # CRUD + state transitions, slug gen, pagination
│   ├── teams.ts          # Create, join (invite code), member management
│   ├── team-repos.ts     # Team repository linking
│   ├── submissions.ts    # Submission queries via DO delegation
│   ├── judging.ts        # Judge invites, rubric CRUD, scoring, assignments, leaderboard
│   ├── rounds.ts         # Hackathon round management
│   ├── organizers.ts     # Organizer role management
│   ├── audit.ts          # Audit log queries
│   ├── workspaces.ts     # Workspace CRUD, membership, invites
│   ├── admin.ts          # Platform admin features (shikdd)
│   ├── notifications.ts  # In-app notification queries
│   ├── invites.ts        # Team/workspace invite management
│   └── webhooks.ts       # GitHub webhook receiver, HMAC verification
├── queue/                # Queue consumer handlers
│   ├── index.ts          # Dispatcher: routes WEBHOOK_QUEUE + NOTIFICATION_QUEUE
│   ├── push-handler.ts   # Commit logging, force-push detection
│   ├── tag-create-handler.ts  # Submission tag → DO locking → commit status
│   ├── tag-delete-handler.ts  # Tag deletion handling
│   ├── installation-handler.ts # GitHub App install/uninstall
│   └── notification-handler.ts # Email dispatch (recipient resolution per type)
├── cron/
│   └── index.ts          # Hourly: deadline checks, reminder notifications
├── durable-objects/      # HackathonStateMachine (single DO, SQLite-backed)
├── middleware/            # cors, request-id, auth, role, rate-limit, platform-admin, error-handler
├── lib/                  # jwt, cookies, oauth, refresh-token, response, audit, etag, submission-tag, webhook-normalize
├── services/             # github.ts, smtp.ts — fail-open pattern (10s timeout, never throw)
├── types/                # env.ts (bindings + context vars), auth.ts (JWT payload type)
└── __tests__/            # Vitest + @cloudflare/vitest-pool-workers (26 test files)
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add route | `src/routes/` | Create file, mount in `src/index.ts` via `app.route()` |
| Add DO | `src/durable-objects/` | MUST re-export class from `src/index.ts` |
| Add middleware | `src/middleware/` | `MiddlewareHandler<AppEnv>` type |
| Add queue handler | `src/queue/` | Add handler, wire in `queue/index.ts` dispatcher |
| Add cron handler | `src/cron/` | Add handler, wire in `cron/index.ts` |
| Add service | `src/services/` | Fail-open: 10s timeout, never throw, log warning |
| Change bindings | `wrangler.jsonc` | Also update `types/env.ts` |
| OAuth flow | `src/lib/oauth.ts` | Manual HTTP — Google + GitHub token exchange |
| JWT ops | `src/lib/jwt.ts` | Custom HMAC SHA-256 via `crypto.subtle`, 15-min access token |
| Refresh tokens | `src/lib/refresh-token.ts` | Opaque tokens, family-based replay detection, 30-day expiry |
| Cookie ops | `src/lib/cookies.ts` | HttpOnly, SameSite=Lax (dev) / Strict+Secure (prod) |
| Response helpers | `src/lib/response.ts` | `successResponse()`, `errorResponse()`, `paginatedResponse()` |
| Audit logging | `src/lib/audit.ts` | `insertAuditEvent()` — user/system/bot/cron actors |
| Webhook parsing | `src/lib/webhook-normalize.ts` | `normalizeGitHubEvent()` → typed union |
| Tag matching | `src/lib/submission-tag.ts` | `matchSubmissionTag()` with `%` version wildcard |
| Add test | `src/__tests__/` | Uses `SELF.fetch()` and `env.DB` from `cloudflare:test` |

## BINDINGS (wrangler.jsonc)

| Binding | Type | Name |
|---------|------|------|
| `DB` | D1 Database | `devsage-db` |
| `KV` | KV Namespace | — |
| `HACKATHON_SM` | Durable Object | `HackathonStateMachine` (SQLite-backed) |
| `WEBHOOK_QUEUE` | Queue | `github-webhooks` |
| `NOTIFICATION_QUEUE` | Queue | `devsage-notifications` |

Cron trigger: `0 * * * *` (hourly deadline checks + reminder notifications).

Secrets (`.dev.vars` locally, `wrangler secret put` for prod):
`JWT_SECRET`, `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET`, `RESEND_API_KEY`

Non-secret vars (in wrangler.jsonc):
`FRONTEND_URL`, `PLATFORM_URL`, `ADMIN_URL`, `API_URL`, `EMAIL_FROM`

## ROUTES

All routes use `/api/v1/` prefix with slug-based hackathon addressing. Response envelope: `{ ok, data, meta }` / `{ ok, error }`.

**Auth** (`/auth`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/github` | — | GitHub OAuth initiate |
| GET | `/auth/callback/github` | — | GitHub OAuth callback |
| GET | `/auth/google` | — | Google OAuth initiate |
| GET | `/auth/callback/google` | — | Google OAuth callback |
| GET | `/auth/me` | JWT | Current user + roles |
| POST | `/auth/refresh` | cookie | Rotate refresh token |
| POST | `/auth/logout` | JWT | Clear session cookies |

**Hackathons** (`/api/v1/hackathons`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | opt | List (paginated) |
| POST | `/` | organizer+ | Create hackathon |
| GET | `/:slug` | opt | Get by slug |
| PUT | `/:slug` | organizer+ | Update hackathon |
| PATCH | `/:slug/status` | organizer+ | Transition phase |
| DELETE | `/:slug` | owner | Delete hackathon |

**Teams** (`/api/v1/hackathons/:slug/teams`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | team_member+ | Create team |
| GET | `/` | anon+ | List teams |
| GET | `/:id` | anon+ | Get team |
| POST | `/:id/join` | team_member+ | Join via code |
| DELETE | `/:id/members/:userId` | team_lead+ | Remove member |
| POST | `/:id/repo` | team_lead+ | Set team repo |

**Judging** (`/api/v1/hackathons/:slug/judging`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/judges` | organizer+ | Invite judge |
| GET | `/judges` | anon+ | List judges |
| POST | `/judges/:id/respond` | judge | Accept/decline |
| GET | `/rubric` | anon+ | Get rubric |
| POST | `/rubric` | organizer+ | Set rubric (bulk) |
| POST | `/judges/assign` | organizer+ | Round-robin assign |
| POST | `/scores` | judge | Submit score |
| GET | `/leaderboard` | varies | Weighted leaderboard |

**Other mounted routes**: `/:slug/rounds`, `/:slug/organizers`, `/:slug/audit`, `/:slug/submissions`, `/api/v1/workspaces`, `/api/v1/admin`, `/api/v1/notifications`, `/api/v1/invites`, `/webhooks/github`.

## CONVENTIONS

- **Middleware chain**: CORS → Request ID → Optional Auth → Error Handler (global). Protected routes add `authMiddleware` → `requireRole(minRole)`
- **Role resolution**: `requireRole()` auto-injects `c.get('hackathon')` and `c.get('role')` from slug param
- **DB access**: `createDb(c.env.DB)` from `@devsage/db`. Drizzle query builder
- **Validation**: `@hono/zod-validator` with schemas from `@devsage/shared`
- **DO communication**: `stub.fetch('http://do/endpoint')`. DOs NEVER touch D1
- **Queue**: Webhook route enqueues → `queue()` dispatcher → handlers process
- **Idempotency**: Webhook handlers check `webhook_delivery_id` UNIQUE constraint
- **Error handler**: Global `app.onError(errorHandler)` returns `{ ok: false, error: { code, message } }`
- **Dev auth bypass**: `DEV_AUTH_BYPASS` env var injects dev user (local only)

## ANTI-PATTERNS

- DO classes NOT re-exported from `index.ts` → wrangler deploy fails silently
- Accessing D1 from inside a Durable Object class
- Using `@hono/oauth-providers` (broken on Workers)
- Running `wrangler` from repo root (no config there)
- Using external JWT libraries — use `crypto.subtle` only
- Services that throw on failure — use fail-open pattern

## TESTING

```bash
pnpm --filter @devsage/api test
```

Uses `@cloudflare/vitest-pool-workers` — real Workers runtime with D1/KV/DO bindings. `SELF.fetch()` for integration tests. `singleWorker: true`, `isolatedStorage: false`. Test helpers in `__tests__/helpers.ts` (schema setup, DB reset, auth cookie generation, 7-user seed data). 26 test files covering auth, hackathons, teams, submissions, judging, webhooks, state machine, cron, roles, audit.
