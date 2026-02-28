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
├── middleware/            # 10 files: cors, csrf, request-id, auth, role, rate-limit, platform-admin, error-handler, etag, judge-portal
├── routes/               # 17 route files including /auth endpoints
├── lib/                  # 16 files: jwt, cookies, oauth, refresh-token, response, audit, etag, submission-tag, webhook-normalize, validate, etc.
├── services/             # 4 files: github.ts, smtp.ts, email.ts, judging.ts — fail-open pattern
├── queue/                # Queue dispatcher + 5 handlers (push, tag-create, tag-delete, installation, notification)
├── cron/                 # Hourly: deadline transitions, reminders, audit hash backfill
├── durable-objects/      # HackathonStateMachine DO (lifecycle, submission locking)
└── __tests__/            # 24 integration test files + helpers.ts (223 passing tests)
```

## Key Patterns

### Auth (API-Hosted Cookie Sessions)
`routes/auth.ts` handles register/login/oauth/refresh/logout/me flows. `optionalAuth` reads the `access_token` cookie, verifies HS256 signature via `crypto.subtle`, and populates `c.set('user', ...)` after DB-backed role hydration.

### Middleware Chain (applied in order)
CORS → CSRF (Origin validation) → Request ID → Rate Limiter (4 tiers) → optionalAuth (JWT from cookie) → errorHandler → per-route: `requireRole(minRole)` or `requirePlatformAdmin`

**Rate limit tiers** (KV-based, mounted in `index.ts`):
- `auth`: 10 req/min (login, register, password reset)
- `api`: 100 req/min (general API)
- `webhook`: 200 req/min (GitHub webhooks)
- `admin`: 50 req/min (admin panel)

### Request Validation
All body-parsing endpoints use `validateBody(schema)` from `lib/validate.ts` with Zod schemas imported from `@devsage/shared`. This is a custom middleware wrapper — NOT `@hono/zod-validator`.

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

---

## Skill Routing

**Load skills from `.agents/skills/` BEFORE starting work.** Skills contain domain-specific rules and anti-patterns that override general knowledge.

### When to Load Which Skills

| Working On | Load These Skills |
|------------|------------------|
| Any Worker code changes | `workers-best-practices`, `wrangler` |
| New API routes | `hono-api-scaffolder`, `hono-cloudflare`, `api-design` |
| REST endpoint design (naming, status codes, pagination) | `api-design` |
| Hono middleware or bindings | `hono-cloudflare`, `workers-best-practices` |
| Durable Objects | `durable-objects`, `workers-best-practices` |
| DB schema changes | `d1-drizzle-schema`, `drizzle-migrations` |
| Migrations | `drizzle-migrations` |
| Zod request/response schemas | `zod` |
| Writing or running tests | `vitest`, `vitest-testing` |
| Auth/session security | `auth-security-reviewer` |
| Email/password auth | `email-and-password-best-practices` |
| Two-factor authentication | `two-factor-authentication-best-practices` |
| TypeScript type issues | `typescript-expert`, `typescript-advanced-types` |
| Deploying / wrangler config | `wrangler` |
| Backend architecture | `nodejs-backend-patterns` |
| Performance optimization | `performance` |
| Frontend components (shadcn) | `shadcn`, `tailwind-v4-shadcn` |

### Multi-Concern Task Decomposition

For tasks touching multiple areas, use subagents with targeted skill sets:

| Task | Decomposition |
|------|--------------|
| **New CRUD endpoint** | 1. Schema (`d1-drizzle-schema`) → 2. Zod types (`zod`) → 3. Route (`hono-api-scaffolder`, `api-design`) + Tests (`vitest`) in parallel |
| **New Durable Object** | 1. DO class (`durable-objects`) → 2. Route integration (`hono-cloudflare`) + Tests (`vitest`) in parallel |
| **Auth feature** | 1. Security review (`auth-security-reviewer`) → 2. Implementation (`email-and-password-best-practices`) → 3. Tests (`vitest`) |
| **Queue handler** | 1. Handler (`workers-best-practices`) + Tests (`vitest`) in parallel |
| **Perf optimization** | 1. Profile (`workers-best-practices`, `performance`) + 2. DB queries (`d1-drizzle-schema`) in parallel |

---

## Remaining Debt (as of 2026-02-28)

Items verified against live code. See `debt/` for full details.

### CRITICAL — Must Fix Before Next Deploy Phase

| ID | Item | File(s) | Effort |
|----|------|---------|--------|
| API-001 | `getInstallationToken()` is a stub — always returns cached KV token, never authenticates with GitHub App | `services/github.ts` | M |
| SEC-003 | Legacy Bearer path trusts JWT claims without DB verification | `middleware/auth.ts` | S |
| SEC-007 | SMTP credentials logged in plaintext on connection errors | `services/smtp.ts` | S |
| SEC-014 | Error handler dev-mode detection via `JWT_SECRET` prefix — leaks stack traces if secret starts with `dev` | `middleware/error-handler.ts` | S |

### HIGH — Security & Data Integrity

| ID | Item | File(s) | Effort |
|----|------|---------|--------|
| SEC-006 | User enumeration via registration endpoint (different errors for existing vs new email) | `routes/auth.ts` | S |
| SEC-011 | PBKDF2 iteration count is 100k (OWASP recommends 600k for SHA-256) | `routes/auth.ts` | S |
| SEC-015 | GitHub OAuth email fallback may use unverified email | `routes/auth.ts` | M |
| API-019 | Audit event insert in `waitUntil()` failures silently swallowed | `lib/audit.ts` | S |
| API-020 | `backfillAuditHashes` — one corrupt event blocks entire batch | `cron/index.ts` | S |
| API-052 | Invite code generation has modulo bias (`randomUUID` → char-at) | `routes/teams.ts` | S |
| SEC-008/009 | Rate limiter & password reset token TOCTOU race (KV read-then-write) | `middleware/rate-limit.ts`, `routes/auth.ts` | M |
| SEC-010 | OAuth state consumption not atomic (KV delete after use) | `routes/auth.ts` | M |

### MEDIUM — Performance

| ID | Item | File(s) | Effort |
|----|------|---------|--------|
| API-038 | Auth middleware runs 6 DB queries per authenticated request (no KV caching) | `middleware/auth.ts` | L |
| API-039 | Global `MAX(sequence)` query on every audit insert | `lib/audit.ts` | M |
| API-040 | Unbounded query for notification recipients (no LIMIT) | `queue/notification-handler.ts` | S |
| API-041 | Seed endpoint: 600+ sequential DB inserts | `routes/admin.ts` | M |
| PERF | CryptoKey re-imported on every JWT sign/verify (~1-2ms waste) | `lib/jwt.ts` | S |
| PERF | Missing DB indexes: `invites.status`, `submissions.submitted_at`, `users.created_at` | schema files | S |
| PERF | N+1 in score submission loop (sequential per-criterion inserts) | `routes/judging.ts` | M |
| PERF | Sequential email fan-out in notification handler | `queue/notification-handler.ts` | M |
| PERF | Serial cron task execution (deadline checks → reminders → backfill) | `cron/index.ts` | S |

### MEDIUM — Code Quality

| ID | Item | File(s) | Effort |
|----|------|---------|--------|
| API-023 | Duplicate `VALID_TRANSITIONS` map in routes + DO | `routes/hackathons.ts`, `durable-objects/` | S |
| API-028 | Email HTML templates hardcoded inline | `services/email.ts` | M |
| API-029 | 15+ magic numbers (pagination limits, timing values) | scattered | S |
| API-030 | Massive code duplication between hackathon creation routes (workspace vs direct) | `routes/hackathons.ts`, `routes/workspaces.ts` | M |
| API-043–046 | Type safety: `as string`/`as number` casts, untyped DB results | scattered | L |
| ARCH | Fat controller pattern — no service layer, business logic in route handlers | all route files | XL |
| ARCH | 262 raw SQL `.prepare()` calls — Drizzle ORM schemas exist but unused | all route files | XL |

### LOW — Polish

| ID | Item | File(s) | Effort |
|----|------|---------|--------|
| API-002 | Template creation silently discards rounds/rubric data | `routes/hackathons.ts` | M |
| API-035 | No notification dispatch on announcement creation | `routes/hackathons.ts` | S |
| API-036 | No audit trail for announcements, rounds, rubric changes | `routes/rounds.ts`, `routes/judging.ts` | S |
| API-037 | Missing `joined_at` on team member insert | `routes/teams.ts` | S |
| API-042 | No pagination on judge listing endpoint | `routes/judging.ts` | S |
| API-050 | DO alarm and cron double-fire risk (no dedup) | `durable-objects/`, `cron/` | M |
| SEC-012 | Audit hash chain doesn't include event content (only prev_hash) | `lib/audit.ts` | M |

---

## Plan Gaps (Features Not Yet Implemented)

Tracked against `plan/` docs. These are features described in planning docs with no corresponding API code.

| Gap | Plan Doc | Description | Effort |
|-----|----------|-------------|--------|
| GAP-001 | `workspace-system.md` | **Billing & subscription system** — completely absent, no Stripe integration | XL |
| GAP-002 | `auth-system.md` | **TOTP 2FA** — DB schema exists (`user_totp_secrets`, `backup_codes`), no API endpoints | L |
| GAP-003 | `hackathon-lifecycle.md` | **Hackathon registration** on branded sites — only "coming soon" placeholder | L |
| GAP-004 | `judging-system.md` | **Judging time windows** — no `scoring_opens_at`/`scoring_closes_at` enforcement | M |
| GAP-005 | `judging-system.md` | **Judge guidelines/instructions** — no field or endpoint | S |
| GAP-006 | `admin-platform.md` | **Analytics backend API** — platform uses mock data, no real endpoints | L |
| GAP-007 | `notification-system.md` | **Eliminated team notifications & disbanding** — not implemented | M |
| GAP-008 | `team-management.md` | **Per-round submission tag patterns** — single global pattern only | S |
| GAP-009 | `hackathon-lifecycle.md` | **Template CRUD API** — schema exists, no routes | M |
| GAP-010 | `workspace-system.md` | **Workspace deletion endpoint** | S |
| GAP-011 | `workspace-system.md` | **Ownership transfer endpoint** | S |
| GAP-012 | `notification-system.md` | **Notification preferences enforcement** | M |
| GAP-013 | `team-management.md` | **Submission schema gaps** — route references 9 DB fields that don't exist (title, description, demo_url, video_url, etc.) | M |

---

## Recently Fixed (Confirmed in Code)

These items from `debt/` have been verified as resolved:

- **Zod validation** on all 53 body-parsing endpoints via `validateBody()` + `@devsage/shared` schemas
- **CORS wildcards removed** (`*.pages.dev`, `*.workers.dev` no longer allowed)
- **CSRF protection** added via Origin-header validation middleware
- **Rate limiting** applied globally with 4 tiers (auth/api/webhook/admin)
- **OTP** uses `crypto.getRandomValues()` (CSPRNG, not `Math.random()`)
- **Queue handler columns** fixed (`repo_full_name` instead of wrong column)
- **judge-portal.ts** uses correct columns (`starts_at`, `judging_starts`, `judging_ends`)
- **Account deletion cascade** properly deletes dependent records
- **CI quality gates** (typecheck + lint + test) before deploy
- **CI script injection** fixed, secret scan branch corrected (`main` not `master`)
