# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-12  
**Commit:** e2320ae  
**Branch:** main

## OVERVIEW

DevSage — edge-native hackathon platform. Turborepo monorepo: Cloudflare Workers API (Hono + D1 + Durable Objects + Queues) + React SPA (Vite + Tailwind v4 + shadcn/ui). pnpm workspaces, TypeScript strict throughout.

## STRUCTURE

```
DevSage/
├── apps/
│   ├── api/          # Cloudflare Worker — Hono API, DOs, queue consumer, cron
│   ├── web/          # React SPA — Vite, React Router v7, Tailwind v4, shadcn/ui
│   └── worker/       # ORPHANED — no package.json, leftover from earlier experiment
├── packages/
│   ├── config/       # Shared tsconfig variants (base, react, worker) + ESLint flat config
│   ├── db/           # Drizzle ORM schemas (~15 tables) + D1 migrations
│   └── shared/       # Zod schemas, types, constants (only dep: zod)
├── docs/             # architecture.md, setup.md, deployment.md, secrets.md, contributing.md
└── .sisyphus/        # Plans, notepads, learnings (agent workspace)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add API route | `apps/api/src/routes/` | Hono router, mount in `src/index.ts` via `app.route()` |
| Add Durable Object | `apps/api/src/durable-objects/` | MUST re-export from `src/index.ts` |
| Add queue handler | `apps/api/src/queue/` | Add handler, wire in `queue/index.ts` dispatcher |
| Add external service | `apps/api/src/services/` | Fail-open pattern (10s timeout, never throw) |
| Add middleware | `apps/api/src/middleware/` | Hono `MiddlewareHandler<AuthAppEnv>` pattern |
| Add DB table | `packages/db/src/schema/` | Drizzle SQLite, re-export from `schema/index.ts`, run `drizzle-kit generate` |
| Add Zod schema | `packages/shared/src/schemas/` | Re-export from `src/index.ts` with `.js` extension |
| Add UI page | `apps/web/src/pages/` | Add route in `App.tsx`, wrap with `ProtectedRoute` if auth required |
| Add UI component | `apps/web/src/components/` | shadcn/ui primitives in `components/ui/` |
| Add judging endpoint | `apps/api/src/routes/judging.ts` | Judge invites, rubric, scoring, leaderboard |
| Add webhook handler | `apps/api/src/routes/webhooks.ts` | HMAC signature verification, enqueue to WEBHOOK_QUEUE |
| Add notification type | `apps/api/src/queue/notification-handler.ts` | Add case to switch, add recipient resolution logic |
| Change Worker bindings | `apps/api/wrangler.jsonc` | Also update `types/env.ts` |
| Change tsconfig | `packages/config/` | Base, react, worker variants |
| Change ESLint | `packages/config/eslint.config.mjs` | Flat config (ESLint 9+) |
| Manage secrets | `docs/v2/secrets.md` | Full conventions documented there |

## DEPENDENCY GRAPH

```
apps/api  → @devsage/shared, @devsage/db, @devsage/config
apps/web  → @devsage/shared
packages/db     → @devsage/config
packages/shared → (standalone, only zod)
packages/config → (standalone, configs only)
```

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `HackathonStateMachine` | Class | `api/src/durable-objects/hackathon-state-machine.ts` | Core DO: 7-state lifecycle, submission locking, deadline alarms |
| `authMiddleware` / `optionalAuth` | Middleware | `api/src/middleware/auth.ts` | JWT extraction + validation from HttpOnly cookie |
| `requireRole(minRole)` | Middleware | `api/src/middleware/role.ts` | Per-request role resolution (7-tier hierarchy) |
| `resolveRole()` | Function | `api/src/middleware/role.ts` | Checks organizer_roles → judges → team_members → anonymous |
| `signJWT()` / `verifyJWT()` | Function | `api/src/lib/jwt.ts` | Custom HMAC SHA-256 via `crypto.subtle`, 7-day expiry |
| `apiRequest<T>()` | Function | `web/src/lib/api.ts` | Fetch wrapper: cookies, 401→redirect, VITE_API_ORIGIN |
| `AuthProvider` / `useAuth()` | Context | `web/src/contexts/auth-context.tsx` | User state: `{ user, isAuthenticated, isLoading, logout }` |
| `normalizeGitHubEvent()` | Function | `api/src/lib/webhook-normalize.ts` | Parses GitHub payloads → typed union (push, tag, install) |
| `successResponse()` / `errorResponse()` | Function | `api/src/lib/response.ts` | Standard envelope: `{ ok, data, meta }` / `{ ok, error }` |
| `insertAuditEvent()` | Function | `api/src/lib/audit.ts` | Audit logging (user/system/bot/cron actors) |

## CONVENTIONS

- **ESM strict**: All imports use explicit `.js` extensions in barrel exports
- **Console**: `console.log` banned (warn). Only `console.warn`/`console.error` allowed
- **Unused vars**: Prefix with `_` to suppress lint (`argsIgnorePattern: '^_'`)
- **no-explicit-any**: Warn, not error — but never use `as any` / `@ts-ignore` / `@ts-expect-error`
- **Timestamps**: All UTC ISO-8601 (`new Date().toISOString()`)
- **UUIDs**: `crypto.randomUUID()` (Workers-native)
- **Response envelope**: `{ ok: true, data, meta }` / `{ ok: false, error: { code, message } }` on all v2 routes
- **Pagination**: `limit` (1–100, default 10–20), `offset` (default 0)
- **Roles**: 7 per-hackathon roles: `anonymous | participant | team_leader | judge | moderator | admin | owner`. Resolved per-request via `resolveRole()`, NOT in JWT
- **Auth**: Manual OAuth 2.0 (Google + GitHub) → JWT in HttpOnly cookie. NOT `@hono/oauth-providers` (broken on Workers)
- **JWT**: Custom HMAC SHA-256 via `crypto.subtle`. Payload: `{ sub, ghid, ghu, iat, exp }`. 7-day expiry. No external JWT lib
- **State machine**: `DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED → ACTIVE → JUDGING → COMPLETED → ARCHIVED`. Forward-only, no backward/skip
- **Services**: Fail-open pattern — 10s timeout via AbortController, log warning, never throw
- **Audit trail**: Every mutation logs audit event via `insertAuditEvent()`

## ANTI-PATTERNS (THIS PROJECT)

- `@hono/oauth-providers` — broken on Cloudflare Workers, use manual OAuth
- `wrangler.toml` — use `wrangler.jsonc` only
- Prisma — incompatible with Workers/D1, use Drizzle
- Direct D1 access from inside DO classes — Worker mediates all D1 writes
- Separate Workers for queue consumer — same Worker handles producer + consumer
- Legacy KV-backed DOs — use SQLite-backed (`new_sqlite_classes`)
- No `console.log` — use `console.warn`/`console.error` for structured logs
- External JWT libraries — use `crypto.subtle` only
- Storing roles in JWT — resolve per-request per-hackathon
- Backward/skip state transitions — forward-only through 7 states

## WRANGLER / DEPLOY

```bash
# Deploy API (from repo root)
pnpm deploy:api
# → pnpm --filter @devsage/api run deploy → wrangler deploy

# Upload API production secrets (from repo root)
pnpm deploy:api:secrets

# Deploy Web (from repo root)
pnpm deploy:web

# Local dev
pnpm dev                    # All apps in parallel (turbo)

# Set production secrets (from apps/api/)
wrangler secret put KEY                 # Individual
wrangler secret bulk .env.production    # Bulk from file

# NEVER run wrangler from repo root — no wrangler.jsonc here
# account_id is baked into apps/api/wrangler.jsonc — no env var needed
# Auth via `wrangler login` (OAuth) — no API tokens needed
```

## COMMANDS

```bash
pnpm dev                     # All apps dev (turbo --parallel)
pnpm build                   # Build all (turbo)
pnpm test                    # Test all (turbo)
pnpm lint                    # Lint all
pnpm typecheck               # Type-check all
pnpm secrets:scan            # Full repo secret scan
pnpm secrets:staged          # Scan staged files only
pnpm deploy:api              # Deploy API worker
pnpm deploy:api:secrets      # Upload API secrets (.env.production)
pnpm deploy:web              # Deploy web app
```

## TESTING

- **Framework**: Vitest everywhere
- **API tests**: `@cloudflare/vitest-pool-workers` — runs in Workers runtime with real D1/KV/DO bindings. `singleWorker: true`. Test secrets in miniflare bindings config
- **Web tests**: jsdom + `@testing-library/react`
- **Shared tests**: Minimal vitest config
- **Pattern**: `src/__tests__/**/*.test.ts` (colocated in src)
- **Style**: Integration-first, minimal mocking, inline helpers
- **No E2E**: No Playwright in CI

## SECRETS / SECURITY

- Pre-commit hook: `secretlint` scans staged files — **blocks commits with secrets**
- Pre-push hook: full repo secret scan — **blocks pushes with secrets**
- CI: `gitleaks` on every PR + push to master (`.github/workflows/secret-scan.yml`)
- API dev secrets: `apps/api/.dev.vars` (gitignored)
- API prod secrets: deploy via `wrangler secret put` or `wrangler secret bulk`
- Web env: only `VITE_*` (client-visible). **Never put secrets in web app.**
- `.env*` files gitignored (except `apps/web/.env.production`)
- Required secrets: `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET`, `FRONTEND_URL`, `SMTP_URL/USERNAME/PASSWORD/EMAIL_ADDR`

## NOTES

- `apps/worker/` exists but is orphaned (no package.json) — leftover from earlier experiment
- Vite dev proxy: `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787` (prefix matching)
- Production API: `https://api.devsage.org`. v2 routes use `/api/v1/` prefix with slug-based hackathon addressing
- DB migrations path in wrangler.jsonc: `../../packages/db/migrations` (relative from apps/api)
- Durable Objects MUST be re-exported from `apps/api/src/index.ts` or wrangler fails
- Cron trigger: `0 * * * *` (hourly) — checks submission deadlines, auto-transitions phases
- OAuth state stored in KV with 10-min TTL
- Plan docs: `.sisyphus/plans/devsage-mvp.md` (architecture), `.sisyphus/plans/backend-v2.md` (v2 rewrite)
- Complexity hotspots: `hackathon-state-machine.ts` (606 LOC), `judging.ts` (587 LOC), `notification-handler.ts` (461 LOC), `home.tsx` (1054 LOC)
