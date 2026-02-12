# apps/api — Cloudflare Worker API

Hono-based API running on Cloudflare Workers. Single Worker handles HTTP routes, Durable Objects, Queue consumer, and Cron triggers. Production: `https://api.devsage.org`.

## STRUCTURE

```
src/
├── index.ts              # Entry: Hono app + DO re-exports + queue handler + cron handler
├── routes/               # Hono route modules (6 files)
│   ├── auth.ts           # OAuth initiation/callback, JWT creation, /auth/me, logout
│   ├── hackathons.ts     # CRUD + state machine transitions, slug generation, pagination
│   ├── teams.ts          # Create, join (invite code), repo linking, member management
│   ├── submissions.ts    # Submission queries via DO delegation
│   ├── judging.ts        # Judge invites, rubric CRUD, scoring, assignment, leaderboard
│   └── webhooks.ts       # GitHub webhook receiver, HMAC signature verification
├── queue/                # Queue consumer handlers (6 files)
│   ├── index.ts          # Dispatcher: routes WEBHOOK_QUEUE + NOTIFICATION_QUEUE messages
│   ├── push-handler.ts   # Commit logging, force-push detection
│   ├── tag-create-handler.ts  # Submission tag matching, DO locking, commit status
│   ├── tag-delete-handler.ts  # Tag deletion handling
│   ├── installation-handler.ts # GitHub App install/uninstall
│   └── notification-handler.ts # Email dispatch (8 notification types, recipient resolution)
├── durable-objects/      # HackathonStateMachine (single DO, SQLite-backed)
├── middleware/            # auth (JWT), role (per-request resolution), error-handler
├── lib/                  # jwt, cookies, oauth, response, audit, etag, submission-tag, webhook-normalize
├── services/             # github.ts (commit status), smtp.ts (email) — fail-open pattern
├── types/                # env.ts (Worker bindings), auth.ts (Hono context types)
└── __tests__/            # Vitest with @cloudflare/vitest-pool-workers (15 test files)
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add route | `src/routes/` | Create file, mount in `src/index.ts` via `app.route()` |
| Add DO | `src/durable-objects/` | MUST re-export class from `src/index.ts` |
| Add middleware | `src/middleware/` | `MiddlewareHandler<AuthAppEnv>` type |
| Add queue handler | `src/queue/` | Add handler, wire in `queue/index.ts` dispatcher |
| Add service | `src/services/` | Fail-open: 10s timeout, never throw, log warning |
| Change bindings | `wrangler.jsonc` | Also update `types/env.ts` |
| OAuth flow | `src/lib/oauth.ts` | Manual HTTP — Google + GitHub token exchange |
| JWT ops | `src/lib/jwt.ts` | Custom HMAC SHA-256 via `crypto.subtle`, 7-day expiry |
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

Cron trigger: `0 * * * *` (hourly deadline checks + auto-transitions).

Secrets (in `.dev.vars` locally, `wrangler secret put` for prod):
`JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `FRONTEND_URL`, `SMTP_URL`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_EMAIL_ADDR`

## ROUTES

All v2 routes use `/api/v1/` prefix with slug-based hackathon addressing. Response envelope: `{ ok, data, meta }` / `{ ok, error }`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/github` | — | GitHub OAuth initiate |
| GET | `/auth/callback/github` | — | GitHub OAuth callback |
| GET | `/auth/google` | — | Google OAuth initiate |
| GET | `/auth/callback/google` | — | Google OAuth callback |
| GET | `/auth/me` | JWT | Current user + roles |
| POST | `/auth/logout` | JWT | Clear session cookie |
| GET | `/api/v1/hackathons` | opt | List (paginated) |
| POST | `/api/v1/hackathons` | admin+ | Create hackathon |
| GET | `/api/v1/hackathons/:slug` | opt | Get by slug |
| PUT | `/api/v1/hackathons/:slug` | admin+ | Update hackathon |
| PATCH | `/api/v1/hackathons/:slug/status` | admin+ | Transition phase |
| DELETE | `/api/v1/hackathons/:slug` | owner | Delete hackathon |
| POST | `/api/v1/hackathons/:slug/teams` | participant+ | Create team |
| GET | `/api/v1/hackathons/:slug/teams` | anon+ | List teams |
| GET | `/api/v1/hackathons/:slug/teams/:id` | anon+ | Get team |
| POST | `/api/v1/hackathons/:slug/teams/:id/join` | participant+ | Join via code |
| DELETE | `/api/v1/hackathons/:slug/teams/:id/members/:userId` | team_leader+ | Remove member |
| POST | `/api/v1/hackathons/:slug/teams/:id/repo` | team_leader+ | Set team repo |
| POST | `/api/v1/hackathons/:slug/judges` | admin+ | Invite judge |
| GET | `/api/v1/hackathons/:slug/judges` | anon+ | List judges |
| POST | `/api/v1/hackathons/:slug/judges/:id/respond` | judge | Accept/decline |
| GET | `/api/v1/hackathons/:slug/rubric` | anon+ | Get rubric |
| POST | `/api/v1/hackathons/:slug/rubric` | admin+ | Set rubric (bulk) |
| POST | `/api/v1/hackathons/:slug/judges/assign` | admin+ | Round-robin assign |
| POST | `/api/v1/hackathons/:slug/scores` | judge | Submit score |
| GET | `/api/v1/hackathons/:slug/leaderboard` | varies | Weighted leaderboard |
| POST | `/webhooks/github` | HMAC | GitHub App webhook |

## CONVENTIONS

- **Middleware chain**: Public routes → none. Protected → `authMiddleware` → `requireRole(minRole)` → handler
- **Role resolution**: `requireRole()` auto-injects `c.get('hackathon')` and `c.get('role')` from slug param
- **DB access**: `createDbClient(c.env.DB)` from `@devsage/db`. Drizzle query builder
- **Validation**: `@hono/zod-validator` with schemas from `@devsage/shared`
- **DO communication**: `stub.fetch('http://do/endpoint')`. DOs NEVER touch D1
- **Queue**: Webhook route enqueues → `queue()` handler dispatches → handlers process. Retry: exponential backoff capped at 5min
- **Idempotency**: Webhook handlers check `webhook_delivery_id` UNIQUE constraint
- **Error handler**: Global `app.onError(errorHandler)` returns `{ error, code }` JSON

## ANTI-PATTERNS

- DO classes NOT re-exported from `index.ts` → wrangler deploy fails silently
- Accessing D1 from inside a Durable Object class
- Using `@hono/oauth-providers` (broken on Workers)
- Running `wrangler` from repo root (no config there)
- Using external JWT libraries — use `crypto.subtle` only
- Services that throw on failure — use fail-open pattern

## TESTING

```bash
pnpm --filter @devsage/api test       # Run API tests
```

Tests use `@cloudflare/vitest-pool-workers` — real Workers runtime with D1/KV/DO bindings. `SELF.fetch()` for integration tests. Inline helpers (JWT signing, DB setup/teardown). `singleWorker: true`. Test secrets hardcoded in miniflare bindings config.
