# PROJECT KNOWLEDGE BASE

**Updated:** 2026-02-26  
**Branch:** main  
**Last audit:** 2026-02-26 (full backend security + debt audit completed)

## OVERVIEW

DevSage — edge-native GitHub-native hackathon management platform. Turborepo monorepo: Cloudflare Workers API (Hono + D1 + Durable Objects + Queues) + four React SPAs (Vite + Tailwind v4 + shadcn/ui). pnpm workspaces, TypeScript strict throughout.

Four frontend apps: Web (`devsage.org`), Platform (`platform.devsage.org`), Admin (`shikdd.devsage.org`), Judge (`judge.devsage.org`). Participant sites (`{slug}.devsage.org`) live in separate repos.

## STRUCTURE

```
DevSage/
├── apps/
│   ├── api/          # Cloudflare Worker — Hono API, DOs, queue consumer, cron (port 8787)
│   ├── web/          # devsage.org — Main website, participant-facing (port 5173, 9 pages)
│   ├── platform/     # platform.devsage.org — Organizer dashboard (port 5174, 21 pages)
│   ├── admin/        # shikdd.devsage.org — Platform admin panel (port 5175, 11 pages)
│   └── judge/        # judge.devsage.org — Judge scoring portal (8 pages)
├── packages/
│   ├── config/       # Shared tsconfig (base/react/worker) + ESLint flat config (ESLint 9+)
│   ├── db/           # Drizzle ORM schemas (46 files) + D1 migrations (2 SQL files)
│   └── shared/       # Zod schemas (26 files), types, constants — ⚠️ DEAD CODE: zero imports at runtime
├── debt/             # Technical debt registry — 7 audit documents from 2026-02-26 audit
├── plan/             # Feature specifications — 8 cross-functional docs + 5 role specs + 9-part implementation guide
├── docs/             # Architecture reference — 12 docs: API contracts, data models, deployment, user flows
└── scripts/          # Hackathon site generator CLI (uses external SHIKDD-org/hackathon-template repo)
```

### API Source Map (`apps/api/src/`)

| Directory | Files | Purpose |
|-----------|-------|---------|
| `routes/` | 17 | admin, announcements, audit, auth, hackathon-requests, hackathons, invites, judge-portal, judging, notifications, organizers, rounds, submissions, team-repos, teams, webhooks, workspaces |
| `middleware/` | 9 | auth, cache, cors, error-handler, hackathon, platform-admin, rate-limit, request-id, role |
| `lib/` | 16 | jwt, refresh-token, response, audit, etag, constants, allowed-origin, do-client, webhook-normalize, user-service, etc. |
| `queue/` | 7 | index (dispatcher), notification-handler, notification-logic, push-handler, tag-create-handler, tag-delete-handler, installation-handler |
| `services/` | 4 | email, github, judging-service, smtp |
| `cron/` | 1 | index (hourly: deadline transitions, reminders, audit backfill) |
| `durable-objects/` | 1 | hackathon-state-machine (SQLite-backed, 5-state lifecycle) |
| `__tests__/` | 24 | Integration tests, 223 passing / 0 failures |

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add API route | `apps/api/src/routes/`, mount in `src/index.ts` via `app.route()` | |
| Add Durable Object | `apps/api/src/durable-objects/`, re-export from `src/index.ts` | MUST re-export or wrangler fails |
| Add queue handler | `apps/api/src/queue/`, wire in `queue/index.ts` dispatcher | |
| Add service | `apps/api/src/services/` | Fail-open pattern (10s timeout, never throw) |
| Add middleware | `apps/api/src/middleware/` | Hono `MiddlewareHandler<AppEnv>` |
| Add cron task | `apps/api/src/cron/index.ts` | Each task in independent try-catch |
| Add DB table | `packages/db/src/schema/`, re-export from `schema/index.ts`, run `drizzle-kit generate` | |
| Add Zod schema | `packages/shared/src/schemas/`, re-export from `src/index.ts` with `.js` extension | ⚠️ Currently dead code |
| Add admin page | `apps/admin/src/pages/` | shikdd.devsage.org |
| Add organizer page | `apps/platform/src/pages/` | platform.devsage.org |
| Add judge page | `apps/judge/src/pages/` | judge.devsage.org |
| Add website page | `apps/web/src/pages/` | devsage.org |
| Change Worker bindings | `apps/api/wrangler.jsonc` + `types/env.ts` | |
| Change ESLint | `packages/config/eslint.config.mjs` | Flat config, ESLint 9+ |
| Manage secrets | `apps/api/.dev.vars` (dev), `wrangler secret put` (prod) | |

## DEPENDENCY GRAPH

```
apps/api      → @devsage/shared, @devsage/db, @devsage/config
apps/admin    → @devsage/shared
apps/judge    → @devsage/shared
apps/platform → @devsage/shared
apps/web      → @devsage/shared
packages/db     → @devsage/config
packages/shared → (standalone, only dep: zod)
packages/config → (standalone)
```

**Rules:**
- Frontend apps (`web`, `platform`, `admin`, `judge`) import from `packages/shared` only — **never** from `db` or `api`
- No circular dependencies. No cross-app imports
- Participant sites (`{slug}.devsage.org`) are separate repos

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `HackathonStateMachine` | DO Class | `api/src/durable-objects/hackathon-state-machine.ts` | 5-state lifecycle, submission locking, deadline alarms |
| `authMiddleware` / `optionalAuth` | Middleware | `api/src/middleware/auth.ts` | JWT extraction from HttpOnly `access_token` cookie |
| `requireRole(minRole)` | Middleware | `api/src/middleware/role.ts` | Per-request 6-tier role resolution |
| `resolveRole()` | Function | `api/src/middleware/role.ts` | organizer_roles → judges → team_members → workspace_members → anonymous |
| `requirePlatformAdmin` | Middleware | `api/src/middleware/platform-admin.ts` | Checks `platform_admins` table |
| `rateLimitMiddleware` | Middleware | `api/src/middleware/rate-limit.ts` | Per-IP/per-user via KV (auth, api, webhook, admin tiers) |
| `signJWT()` / `verifyJWT()` | Function | `api/src/lib/jwt.ts` | HMAC SHA-256 via `crypto.subtle`, 15-min expiry |
| `createRefreshToken()` / `rotateRefreshToken()` | Function | `api/src/lib/refresh-token.ts` | Family-based replay detection, 30-day expiry |
| `successResponse()` / `errorResponse()` | Function | `api/src/lib/response.ts` | `{ ok, data, meta }` / `{ ok, error: { code, message } }` |
| `insertAuditEvent()` | Function | `api/src/lib/audit.ts` | Hash chain integrity (user/system/bot/cron actors) |
| `createHackathonHandler` | Function | `api/src/routes/hackathons.ts` | Shared handler for both POST URL patterns |
| `apiRequest<T>()` | Function | `*/src/lib/api.ts` | Per-app fetch wrapper: cookies, 401→refresh→retry |
| `AuthProvider` / `useAuth()` | Context | `*/src/contexts/auth-context.tsx` | `{ user, isAuthenticated, isLoading, logout }` |

## CONVENTIONS

- **ESM strict**: All barrel exports use explicit `.js` extensions
- **Console**: `console.log` banned (warn-level lint). Only `console.warn`/`console.error`
- **Unused vars**: Prefix with `_` (`argsIgnorePattern: '^_'`)
- **Timestamps**: UTC ISO-8601 (`new Date().toISOString()`)
- **UUIDs**: `crypto.randomUUID()` (Workers-native)
- **Response envelope**: `{ ok: true, data, meta }` / `{ ok: false, error: { code, message } }` on all routes
- **Pagination**: Offset (default): `limit` (1–100, default 20), `offset`, `has_more`. Cursor for append-only (audit, commits, notifications)
- **Roles**: 6 per-hackathon: `organizer | co_organizer | judge | team_lead | team_member | anonymous`. Resolved per-request via `resolveRole()`, NOT in JWT
- **Workspace roles**: `owner | admin | member` (stored in `workspace_members.role`)
- **Team roles**: `leader | member` (stored in `team_members.role`)
- **Auth**: Manual OAuth 2.0 (Google + GitHub) → 15-min access JWT + 30-day rotating refresh token in HttpOnly cookies
- **JWT**: Custom HMAC SHA-256 via `crypto.subtle`. Payload: `{ sub, ghid, ghu, fam, iat, exp }`. No external JWT lib
- **OTP**: CSPRNG via `crypto.getRandomValues()` — NOT `Math.random()`
- **Passwords**: Max 128 chars, hashed with PBKDF2
- **State machine**: `draft → active → judging → completed → archived`. Forward-only, except `archived → completed`
- **Services**: Fail-open (10s AbortController timeout, log warning, never throw)
- **Audit**: Every mutation logs via `insertAuditEvent()` with SHA-256 hash chain
- **Middleware chain**: CORS → Request ID → Rate Limiter → Error Handler → optionalAuth → per-route role checks
- **DB access**: Raw SQL via D1 `.prepare()` — Drizzle ORM schemas exist but are NOT used at runtime

## ANTI-PATTERNS (THIS PROJECT)

- `@hono/oauth-providers` — broken on Workers, use manual OAuth
- `wrangler.toml` — use `wrangler.jsonc` only
- Prisma — incompatible with Workers/D1, use Drizzle
- Direct D1 access from inside DO classes — Worker mediates all D1 writes
- Separate Workers for queue consumer — same Worker handles producer + consumer
- Legacy KV-backed DOs — use SQLite-backed (`new_sqlite_classes`)
- `console.log` — use `console.warn`/`console.error` only
- External JWT libraries — use `crypto.subtle` only
- `Math.random()` for anything security-related — use `crypto.getRandomValues()`
- Storing roles in JWT — resolve per-request per-hackathon
- Backward state transitions — forward-only (except archived→completed)
- Cookie domain `.devsage.org` — cookies are per-subdomain
- Organizer features in `apps/web` — those belong in `apps/platform`
- `as string` / `as number` casts for DB results — use proper typing (known debt, see `debt/code-quality-audit.md`)
- Running `wrangler` from repo root — always run from `apps/api/`

## KNOWN TECHNICAL DEBT

⚠️ **Read `debt/` before making architectural decisions.** Key issues:

| Issue | Severity | Location |
|-------|----------|----------|
| 262 raw SQL `.prepare()` calls — no Drizzle ORM usage | HIGH | All route files |
| `packages/shared` is 100% dead code (26 Zod schemas, zero imports) | HIGH | `packages/shared/` |
| No request validation on any API endpoint | CRITICAL | All route files |
| No CSRF protection on cookie-based auth | HIGH | `middleware/auth.ts` |
| ~~25 pre-existing test failures on main~~ | ~~MEDIUM~~ | ✅ Fixed — all 223 tests passing |
| DO UPDATE without WHERE clause | HIGH | `hackathon-state-machine.ts:156,260` |
| Queue handlers reference nonexistent columns | ~~HIGH~~ | ✅ Fixed — `push-handler.ts`, `installation-handler.ts` now use `repo_full_name` |
| No frontend tests (0 across all 4 apps) | MEDIUM | `apps/web,platform,admin,judge` |

Full details: `debt/backend-architecture-critique.md`, `debt/security-audit.md`, `debt/data-integrity-audit.md`

## COMMANDS

```bash
pnpm dev                     # All apps dev (turbo --parallel)
pnpm build                   # Build all
pnpm test                    # Test all
pnpm lint                    # Lint all
pnpm typecheck               # Type-check all
pnpm secrets:scan            # Full repo secret scan
pnpm secrets:staged          # Scan staged files (pre-commit hook)
pnpm deploy:api              # Deploy API worker
pnpm deploy:api:secrets      # Upload API secrets (.env.production)
pnpm deploy:web              # Deploy web app
pnpm deploy:judge            # Deploy judge portal
pnpm deploy:all              # Deploy all apps

# Single package
pnpm --filter @devsage/api test
pnpm --filter @devsage/api exec vitest run src/__tests__/hackathons.test.ts

# DB migration after schema changes
pnpm --filter @devsage/db run generate
```

## TESTING

- **Framework**: Vitest everywhere
- **API tests**: `@cloudflare/vitest-pool-workers` — real Workers runtime with D1/KV/DO bindings. `singleWorker: true`
- **Frontend tests**: jsdom + `@testing-library/react` (⚠️ zero test files exist across all 4 frontend apps)
- **Pattern**: `src/__tests__/**/*.test.ts`, integration-first, minimal mocking
- **Current**: 24 test files, 223 passing, 0 failures
- **No E2E**: No Playwright in CI

## SECRETS / SECURITY

- **Pre-commit**: `secretlint` scans staged files — blocks commits with secrets
- **Pre-push**: Full repo scan — blocks pushes with secrets
- **CI**: `gitleaks` on every PR + push to main
- **Quality gate**: typecheck + lint + test run before any deploy (added 2026-02-26)
- **Dev secrets**: `apps/api/.dev.vars` (gitignored)
- **Prod secrets**: `wrangler secret put` or `wrangler secret bulk`
- **Frontend env**: Only `VITE_*` (client-visible). **Never put secrets in VITE_* vars**
- **Required**: `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET`, `FRONTEND_URL`, `PLATFORM_URL`, `JUDGE_URL`, `ADMIN_URL`, `SMTP_URL/USERNAME/PASSWORD/EMAIL_ADDR`

## DOCUMENTATION MAP

### `debt/` — What's Wrong (Audit & Critique)

| Document | Coverage |
|----------|----------|
| `COMPREHENSIVE-DEBT-AUDIT.md` | Master audit: 292 items across API, web, platform, packages, CI/CD |
| `backend-architecture-critique.md` | Architecture criticism: raw SQL, dead code, fat controllers |
| `security-audit.md` | 29 security findings with severity ratings |
| `performance-audit.md` | DB indexes, N+1 queries, caching gaps |
| `code-quality-audit.md` | TypeScript quality, testing gaps, code smells |
| `data-integrity-audit.md` | Schema mismatches, FK analysis, dead tables |
| `ci-cd-audit.md` | Pipeline gaps, missing automation, deploy strategy |

### `plan/` — What We're Building (Feature Specs)

| Document | Coverage |
|----------|----------|
| `auth-system.md` | 19 endpoints, 9 user flows, dual-token architecture |
| `hackathon-lifecycle.md` | 5-state machine, CRUD, templates, deadline automation |
| `judging-system.md` | Rubric, auto-assign, scoring, leaderboard |
| `team-management.md` | Teams, repos, submissions, invite system |
| `workspace-system.md` | Workspace CRUD, membership, types |
| `notification-system.md` | Webhooks, queues, email, 17 notification types |
| `admin-platform.md` | Platform admin, organizer tools, audit system |
| `api-architecture.md` | Complete API reference, middleware chain, conventions |
| `guide/` | 9-part implementation guide (01-architecture → 09-end-to-end-flows) |
| `role-*.md` | Per-role user journey specs: club-president, club-vp, event-lead, judge, participant |

### `docs/` — Architecture Reference

| Document | Coverage |
|----------|----------|
| `api-contracts.md` | All API endpoints with auth/role requirements |
| `architecture-api.md` | Backend architecture deep-dive |
| `architecture-frontends.md` | All 4 frontend apps |
| `data-models.md` | Complete DB schema reference (537 lines) |
| `deployment.md` | Deploy pipeline, D1 migrations |
| `development-guide.md` | Local setup, commands, testing |
| `integration-architecture.md` | API-frontend integration patterns |
| `user-flows.md` | End-to-end user journeys |
| `project-overview.md` | High-level project overview |
| `source-tree-analysis.md` | Repo structure analysis |

## AGENT SKILLS

23 skills installed in `.agents/skills/`. **Always load relevant skills before starting work** — they contain domain-specific rules, patterns, and anti-patterns that override general knowledge.

### Skill Inventory

| Skill | What it Provides | When to Load |
|-------|-----------------|--------------|
| `workers-best-practices` | Cloudflare Workers production patterns, anti-patterns. **Retrieval-first** — fetches latest docs before writing/reviewing | Writing/reviewing any Worker code, checking for floating promises, global state, streaming issues |
| `wrangler` | Wrangler CLI reference for Workers, KV, R2, D1, Queues, Workflows, Containers, Secrets Store | Running wrangler commands, configuring `wrangler.jsonc`, deploying, managing bindings |
| `hono-cloudflare` | Hono on Workers — type-safe bindings, KV/D1/R2/DO integration, queue/scheduled handlers | Writing Hono routes, middleware, accessing Cloudflare bindings |
| `hono-api-scaffolder` | Scaffolds Hono route files with middleware, Zod validation, error handling, generates API docs | Adding new API routes, creating endpoints, generating `API_ENDPOINTS.md` |
| `durable-objects` | DO patterns — RPC methods, SQLite storage, alarms, WebSockets, sharding. **Retrieval-first** | Creating/reviewing DOs, implementing stateful coordination, testing DOs with Vitest |
| `d1-drizzle-schema` | Drizzle ORM for D1: correct column types, FK enforcement, 100-param limit, JSON-as-TEXT | Creating DB tables, modifying schemas, understanding D1 quirks vs standard SQLite |
| `drizzle-migrations` | Migration-first workflow: SQL-first migrations, snapshots, schema drift detection | Running/creating DB migrations, resolving migration conflicts |
| `api-design` | REST API design: resource naming, status codes, pagination, filtering, versioning, rate limiting | Designing new endpoints, reviewing API contracts |
| `auth-security-reviewer` | Reviews auth implementation: session management, CSRF, cookie security, auth flow vulns | Auditing auth code, reviewing session security, checking CSRF protection |
| `email-and-password-best-practices` | Secure email/password auth rules (based on Better Auth patterns) | Implementing login/register, password reset, email verification |
| `two-factor-authentication-best-practices` | 2FA implementation: TOTP, backup codes, trusted devices | Adding 2FA/MFA features |
| `zod` | Zod schema validation: type safety, `safeParse`, `z.infer`, refinements, composition | Writing/reviewing Zod schemas, request validation |
| `typescript-expert` | TypeScript strict mode, type-safe patterns, tsconfig, TDD workflow | Building type-safe code, refactoring JS→TS, complex type definitions |
| `typescript-advanced-types` | Generics, conditional types, mapped types, template literals, utility types | Complex type logic, reusable type utilities, compile-time type safety |
| `vitest` | Vitest framework: setup, async testing, `vi.*` mocking, snapshots, performance | Writing/debugging Vitest tests |
| `vitest-testing` | Practical Vitest patterns: assertions, `vi.mock`/`vi.fn`, quick reference | Quick reference for test patterns |
| `shadcn` | shadcn/ui: Radix primitives, Tailwind styling, React Hook Form, data tables, theming, a11y | Writing/reviewing shadcn/ui components |
| `tailwind-v4-shadcn` | Tailwind CSS v4 + shadcn/ui + Vite: `@theme inline`, CSS variables, dark mode, common v4 gotchas | Setting up Tailwind v4, debugging theme/color issues, dark mode |
| `performance` | Web performance: LCP, fonts, caching, Core Web Vitals, runtime efficiency | Optimizing load times, bundle size, page speed |
| `nodejs-backend-patterns` | Production Node.js: middleware, error handling, auth, DB integration, API design | Building backend services, REST APIs |
| `nodejs-backend-typescript` | Node.js + TypeScript: Express/Fastify servers, routing, middleware, DB integration | TypeScript backend development |
| `monorepo-management` | Turborepo, Nx, pnpm workspaces: builds, dependency management, shared code | Monorepo config, build optimization, dependency issues |
| `find-skills` | Discovers and installs new agent skills from the ecosystem | Looking for skills not currently installed |

### Skill Routing Table

| Task | Load These Skills |
|------|-------------------|
| Writing/reviewing Cloudflare Worker code | `workers-best-practices`, `wrangler` |
| Creating/modifying Durable Objects | `durable-objects`, `workers-best-practices` |
| Scaffolding new Hono API routes | `hono-api-scaffolder`, `hono-cloudflare` |
| Designing REST API endpoints | `api-design`, `hono-api-scaffolder` |
| Creating/modifying Drizzle DB schemas | `d1-drizzle-schema`, `drizzle-migrations` |
| Writing Zod validation schemas | `zod` |
| Writing/fixing TypeScript types | `typescript-expert`, `typescript-advanced-types` |
| Writing or running Vitest tests | `vitest`, `vitest-testing` |
| Building React UI with shadcn/ui | `shadcn`, `tailwind-v4-shadcn` |
| Styling with Tailwind CSS v4 | `tailwind-v4-shadcn` |
| Optimizing frontend performance | `performance` |
| Reviewing auth/session security | `auth-security-reviewer` |
| Implementing email/password auth | `email-and-password-best-practices` |
| Implementing 2FA/MFA | `two-factor-authentication-best-practices` |
| Configuring wrangler.jsonc or deploying | `wrangler` |
| Managing monorepo structure/config | `monorepo-management` |
| Looking for a skill that doesn't exist | `find-skills` |

### Skills by Package

| Package | Primary Skills |
|---------|---------------|
| `apps/api` | `workers-best-practices`, `wrangler`, `hono-cloudflare`, `hono-api-scaffolder`, `api-design`, `durable-objects`, `d1-drizzle-schema`, `drizzle-migrations`, `auth-security-reviewer`, `vitest`, `vitest-testing`, `zod`, `typescript-expert` |
| `apps/web` | `shadcn`, `tailwind-v4-shadcn`, `performance`, `typescript-expert`, `vitest`, `vitest-testing`, `zod` |
| `apps/platform` | `shadcn`, `tailwind-v4-shadcn`, `performance`, `typescript-expert`, `vitest`, `vitest-testing`, `zod` |
| `apps/admin` | `shadcn`, `tailwind-v4-shadcn`, `typescript-expert`, `zod` |
| `apps/judge` | `shadcn`, `tailwind-v4-shadcn`, `typescript-expert`, `zod` |
| `packages/db` | `d1-drizzle-schema`, `drizzle-migrations`, `typescript-expert` |
| `packages/shared` | `zod`, `typescript-expert`, `typescript-advanced-types` |

### Subagent Strategy

Use subagents for tasks spanning 2+ packages. Common patterns:

1. **Full-stack feature**: Schema → Zod → API route → Frontend (sequential dependencies)
2. **API endpoint**: Schema+types (parallel) → Route + Tests (parallel)
3. **Auth feature**: Security review → Backend + Frontend (parallel) → Tests
4. **Frontend page**: UI → Tests (sequential)
5. **DO feature**: DO class → Route + Tests (parallel)
6. **Performance**: API perf ‖ Frontend perf (parallel)
7. **Test expansion**: API tests ‖ Frontend tests ‖ Schema tests (all parallel)

### Skill-Specific Patterns for This Project

**D1/Drizzle** (`d1-drizzle-schema`): D1 FKs are always ON (can't disable). Booleans are `integer` (0/1). Max 100 bound params per query (affects bulk inserts). JSON stored as TEXT. Currently all DB access is raw SQL — Drizzle schemas exist but are not used at runtime.

**Workers** (`workers-best-practices`): Retrieval-first — fetch latest docs before writing. Check for floating promises, global mutable state, streaming patterns. Our Worker exports `fetch`, `queue`, `scheduled` from `src/index.ts`.

**Durable Objects** (`durable-objects`): SQLite-backed only (`new_sqlite_classes`). Must re-export from `src/index.ts`. Worker mediates all D1 writes — DOs should not access D1 directly. Current DO: `HackathonStateMachine` with 5-state lifecycle.

**Hono** (`hono-cloudflare`): Type-safe bindings via `Hono<AppEnv>`. D1, KV, DO, Queue bindings accessed via `c.env`. Routes mounted via `app.route()` in `src/index.ts`.

**Auth** (`auth-security-reviewer`): Cookie-based HttpOnly JWT. No CSRF protection (known debt). Family-based refresh token rotation with replay detection. Max password length 128 chars. CSPRNG for OTP.

## NOTES

- Four frontend apps: `web` (devsage.org), `platform` (platform.devsage.org), `admin` (shikdd.devsage.org), `judge` (judge.devsage.org)
- Participant sites (`{slug}.devsage.org`) are separate repos via `scripts/generate-hackathon-site.js`
- Vite dev proxy: `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787`
- Production API: `https://api.devsage.org` with `/api/v1/` prefix, slug-based hackathon addressing
- DB migrations path in wrangler.jsonc: `../../packages/db/migrations` (relative from apps/api)
- Durable Objects MUST be re-exported from `apps/api/src/index.ts` or wrangler deploy fails
- Cron: `0 * * * *` (hourly) — deadline transitions, reminders, audit hash backfill
- OAuth state stored in KV with 10-min TTL
- Brand color: `#CCFF00` (lime green), dark-first theme
- Complexity hotspots: `hackathon-state-machine.ts`, `judging.ts`, `notification-handler.ts`, `auth.ts`
