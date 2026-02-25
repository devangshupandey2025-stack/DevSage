# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-15  
**Branch:** main

## OVERVIEW

DevSage — edge-native GitHub-native hackathon platform. Turborepo monorepo: Cloudflare Workers API (Hono + D1 + Durable Objects + Queues) + three React SPAs (Vite + Tailwind v4 + shadcn/ui). pnpm workspaces, TypeScript strict throughout.

Four frontend apps: Admin (`shikdd.devsage.org`), Organizer Platform (`platform.devsage.org`), Judge Portal (`judge.devsage.org`), Main Website (`devsage.org`). Participant sites (`{slug}.devsage.org`) live in separate repos.

## STRUCTURE

```
DevSage/
├── apps/
│   ├── api/          # Cloudflare Worker — Hono API, DOs, queue consumer, cron
│   ├── admin/        # shikdd.devsage.org — Platform admin panel (React + Vite)
│   ├── judge/        # judge.devsage.org — Judge scoring portal (React + Vite + Tailwind v4 + shadcn/ui)
│   ├── platform/     # platform.devsage.org — Organizer dashboard (React + Vite + Tailwind v4 + shadcn/ui)
│   └── web/          # devsage.org — Main website (React + Vite)
├── packages/
│   ├── config/       # Shared tsconfig variants (base, react, worker) + ESLint flat config
│   ├── db/           # Drizzle ORM schemas (~35 tables) + D1 migrations
│   └── shared/       # Zod schemas, types, constants (only dep: zod)
├── docs/             # Architecture docs, API contracts, data models, deployment guides
└── scripts/          # Hackathon site generator CLI (uses external SHIKDD-org/hackathon-template repo)
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
| Add admin page | `apps/admin/src/pages/` | shikdd.devsage.org — platform admin features |
| Add organizer page | `apps/platform/src/pages/` | platform.devsage.org — hackathon management |
| Add judge page | `apps/judge/src/pages/` | judge.devsage.org — judge scoring portal |
| Add website page | `apps/web/src/pages/` | devsage.org — public marketing/info pages |
| Add judging endpoint | `apps/api/src/routes/judging.ts` | Judge invites, rubric, scoring, leaderboard |
| Add webhook handler | `apps/api/src/routes/webhooks.ts` | HMAC signature verification, enqueue to WEBHOOK_QUEUE |
| Add notification type | `apps/api/src/queue/notification-handler.ts` | Add case to switch, add recipient resolution logic |
| Add cron handler | `apps/api/src/cron/` | Add handler, wire in `cron/index.ts` |
| Change Worker bindings | `apps/api/wrangler.jsonc` | Also update `types/env.ts` |
| Change tsconfig | `packages/config/` | Base, react, worker variants |
| Change ESLint | `packages/config/eslint.config.mjs` | Flat config (ESLint 9+) |
| Manage secrets | `apps/api/.dev.vars` (dev), `wrangler secret put` (prod) | See SECRETS / SECURITY section below |

## DEPENDENCY GRAPH

```
apps/api      → @devsage/shared, @devsage/db, @devsage/config
apps/admin    → @devsage/shared
apps/judge    → @devsage/shared
apps/platform → @devsage/shared
apps/web      → @devsage/shared
packages/db     → @devsage/config
packages/shared → (standalone, only zod)
packages/config → (standalone, configs only)
```

**Dependency rules:**
- `apps/admin`, `apps/judge`, `apps/platform`, `apps/web` may import from `packages/shared` only (never from `db` or `api`)
- No circular dependencies. No cross-app imports
- Participant sites (`{slug}.devsage.org`) are maintained in separate repositories

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `HackathonStateMachine` | Class | `api/src/durable-objects/hackathon-state-machine.ts` | Core DO: 5-state lifecycle, submission locking, deadline alarms |
| `authMiddleware` / `optionalAuth` | Middleware | `api/src/middleware/auth.ts` | JWT extraction + validation from HttpOnly `access_token` cookie |
| `requireRole(minRole)` | Middleware | `api/src/middleware/role.ts` | Per-request role resolution (6-tier hierarchy) |
| `resolveRole()` | Function | `api/src/middleware/role.ts` | Checks organizer_roles → judges → team_members → workspace_members → anonymous |
| `requirePlatformAdmin` | Middleware | `api/src/middleware/platform-admin.ts` | Checks `platform_admins` table for shikdd admin access |
| `requestIdMiddleware` | Middleware | `api/src/middleware/request-id.ts` | Generates `X-Request-Id` header on every request |
| `rateLimitMiddleware` | Middleware | `api/src/middleware/rate-limit.ts` | Per-IP/per-user rate limiting via KV |
| `signJWT()` / `verifyJWT()` | Function | `api/src/lib/jwt.ts` | Custom HMAC SHA-256 via `crypto.subtle`, 15-min access token expiry |
| `createRefreshToken()` / `rotateRefreshToken()` | Function | `api/src/lib/refresh-token.ts` | Opaque refresh tokens with family-based replay detection, 30-day expiry |
| `successResponse()` / `errorResponse()` / `paginatedResponse()` | Function | `api/src/lib/response.ts` | Standard envelope: `{ ok, data, meta }` / `{ ok, error: { code, message } }` |
| `insertAuditEvent()` | Function | `api/src/lib/audit.ts` | Audit logging with hash chain integrity (user/system/bot/cron actors) |
| `normalizeGitHubEvent()` | Function | `api/src/lib/webhook-normalize.ts` | Parses GitHub payloads → typed union (push, tag, install) |
| `apiRequest<T>()` | Function | `web/src/lib/api.ts` | Fetch wrapper: cookies, 401→auto-refresh→retry, VITE_API_ORIGIN |
| `AuthProvider` / `useAuth()` | Context | `*/src/contexts/auth-context.tsx` | User state: `{ user, isAuthenticated, isLoading, logout }` |

## CONVENTIONS

- **ESM strict**: All imports use explicit `.js` extensions in barrel exports
- **Console**: `console.log` banned (warn). Only `console.warn`/`console.error` allowed
- **Unused vars**: Prefix with `_` to suppress lint (`argsIgnorePattern: '^_'`)
- **no-explicit-any**: Warn, not error — but never use `as any` / `@ts-ignore` / `@ts-expect-error`
- **Timestamps**: All UTC ISO-8601 (`new Date().toISOString()`)
- **UUIDs**: `crypto.randomUUID()` (Workers-native)
- **Response envelope**: `{ ok: true, data, meta }` / `{ ok: false, error: { code, message } }` on all routes
- **Pagination**: Offset (default) with `limit` (1–100, default 20), `offset` (default 0), `has_more`. Cursor for append-only endpoints (audit, commits, notifications)
- **Roles**: 6 per-hackathon roles: `organizer | co_organizer | judge | team_lead | team_member | anonymous`. Resolved per-request via `resolveRole()`, NOT in JWT. Platform admins are a separate layer (`shikdd.devsage.org`)
- **Auth**: Manual OAuth 2.0 (Google + GitHub) → dual-token: 15-min access JWT + 30-day rotating refresh token in HttpOnly cookies. NOT `@hono/oauth-providers` (broken on Workers)
- **JWT**: Custom HMAC SHA-256 via `crypto.subtle`. Payload: `{ sub, ghid, ghu, fam, iat, exp }`. No external JWT lib
- **State machine**: `draft → active → judging → completed → archived`. Forward-only, except `archived → completed` (un-archive for score corrections)
- **Services**: Fail-open pattern — 10s timeout via AbortController, log warning, never throw
- **Audit trail**: Every mutation logs audit event via `insertAuditEvent()` with hash chain integrity
- **Middleware chain**: CORS → Request ID → Rate Limiter → Error Handler → Auth → Role Resolution → Handler

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
- Backward state transitions — forward-only through 5 states (except archived→completed un-archive)
- Setting cookie domain to `.devsage.org` — cookies are per-subdomain to prevent cross-domain leakage
- Putting organizer/management features in `apps/web` — those belong in `apps/platform`

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
pnpm deploy:judge            # Deploy judge portal
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
- Required secrets: `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET`, `FRONTEND_URL`, `PLATFORM_URL`, `JUDGE_URL`, `ADMIN_URL`, `SMTP_URL/USERNAME/PASSWORD/EMAIL_ADDR`

## AGENT SKILLS & SUBAGENT STRATEGY

Skills are installed in `.agents/skills/`. **Always load the relevant skill(s) before starting a task** — each skill contains domain-specific rules, patterns, anti-patterns, and reference docs that override general knowledge.

### How to Use Skills

1. **Before starting any task**, check the routing table below to identify which skills apply
2. **Load skills** via the `/skill-name` command or by reading the SKILL.md in `.agents/skills/{name}/`
3. **For multi-package tasks**, use subagents — each subagent loads its own skill set and works in parallel
4. **When unsure** which skill to use, load `find-skills` to discover the right one

### Skill Routing Table

| When you're doing this | Load these skills |
|------------------------|-------------------|
| Writing/reviewing Cloudflare Worker code | `workers-best-practices`, `wrangler` |
| Creating/modifying Durable Objects | `durable-objects`, `workers-best-practices` |
| Scaffolding new Hono API routes | `hono-api-scaffolder`, `hono-cloudflare` |
| Writing Hono middleware or bindings | `hono-cloudflare`, `workers-best-practices` |
| Designing REST API endpoints | `api-design`, `hono-api-scaffolder` |
| Creating/modifying Drizzle DB schemas | `d1-drizzle-schema`, `drizzle-migrations` |
| Running or creating DB migrations | `drizzle-migrations`, `d1-drizzle-schema` |
| Writing Zod validation schemas | `zod` |
| Writing/fixing TypeScript types | `typescript-expert`, `typescript-advanced-types` |
| Writing or running Vitest tests | `vitest`, `vitest-testing` |
| Building React UI with shadcn/ui | `shadcn`, `tailwind-v4-shadcn` |
| Styling with Tailwind CSS v4 | `tailwind-v4-shadcn` |
| Optimizing frontend performance | `performance` |
| Reviewing auth/session security | `auth-security-reviewer` |
| Implementing email/password auth | `email-and-password-best-practices` |
| Implementing 2FA/MFA | `two-factor-authentication-best-practices` |
| Working with Node.js backend patterns | `nodejs-backend-patterns`, `nodejs-backend-typescript` |
| Configuring wrangler.jsonc or deploying | `wrangler` |
| Managing monorepo structure/config | `monorepo-management` |
| Looking for a skill that doesn't exist yet | `find-skills` |

### Skill Combinations by Package

| Package | Primary Skills |
|---------|---------------|
| `apps/api` | `workers-best-practices`, `wrangler`, `hono-cloudflare`, `hono-api-scaffolder`, `api-design`, `durable-objects`, `d1-drizzle-schema`, `drizzle-migrations`, `auth-security-reviewer`, `vitest`, `vitest-testing`, `zod`, `typescript-expert` |
| `apps/web` | `shadcn`, `tailwind-v4-shadcn`, `performance`, `typescript-expert`, `vitest`, `vitest-testing`, `zod` |
| `apps/platform` | `shadcn`, `tailwind-v4-shadcn`, `performance`, `typescript-expert`, `vitest`, `vitest-testing`, `zod` |
| `apps/admin` | `shadcn`, `tailwind-v4-shadcn`, `typescript-expert`, `zod` |
| `packages/db` | `d1-drizzle-schema`, `drizzle-migrations`, `typescript-expert` |
| `packages/shared` | `zod`, `typescript-expert`, `typescript-advanced-types` |

---

### Subagent Strategy

**Use subagents for any task that spans 2+ packages or involves independent workstreams.** Subagents run in parallel, each with its own skill context, and report results back. This prevents context pollution and speeds up multi-step work.

#### When to Use Subagents

- **Cross-package features** (e.g., new API endpoint + frontend page + Zod schema + DB table)
- **Independent research** (e.g., exploring API code while separately exploring frontend code)
- **Parallel implementation** (e.g., writing tests while writing implementation)
- **Code review** across multiple domains (e.g., reviewing auth security + frontend accessibility)

#### When NOT to Use Subagents

- Single-file changes or fixes within one package
- Simple tasks that don't benefit from parallelism
- Tasks where later steps depend on earlier step outputs (use sequential flow instead)

#### Subagent Decomposition Patterns

**Pattern 1: Full-Stack Feature (DB + API + Shared + Frontend)**

| Subagent | Package | Skills | Task |
|----------|---------|--------|------|
| 1 — Schema | `packages/db` | `d1-drizzle-schema`, `drizzle-migrations` | Create/modify DB table, generate migration |
| 2 — Validation | `packages/shared` | `zod`, `typescript-advanced-types` | Create request/response Zod schemas + types |
| 3 — API Route | `apps/api` | `hono-api-scaffolder`, `hono-cloudflare`, `api-design`, `workers-best-practices` | Implement route handler with middleware |
| 4 — Frontend | `apps/web` or `apps/platform` | `shadcn`, `tailwind-v4-shadcn`, `performance` | Build page/component consuming the API |

> Run subagents 1 & 2 in parallel (no dependency), then 3 (depends on schema + types), then 4 (depends on API).

**Pattern 2: New API Endpoint (No Frontend)**

| Subagent | Package | Skills | Task |
|----------|---------|--------|------|
| 1 — Schema + Types | `packages/db` + `packages/shared` | `d1-drizzle-schema`, `zod` | DB table + Zod schemas |
| 2 — Route | `apps/api` | `hono-api-scaffolder`, `hono-cloudflare`, `api-design` | Route handler + middleware |
| 3 — Tests | `apps/api` | `vitest`, `vitest-testing`, `workers-best-practices` | Integration tests |

> Run 1 first, then 2 & 3 in parallel.

**Pattern 3: Auth Feature (Login / OAuth / 2FA)**

| Subagent | Package | Skills | Task |
|----------|---------|--------|------|
| 1 — Security Review | `apps/api` | `auth-security-reviewer` | Review existing auth for vulnerabilities |
| 2 — Auth Backend | `apps/api` | `email-and-password-best-practices`, `two-factor-authentication-best-practices` | Implement auth endpoints |
| 3 — Auth Frontend | `apps/web` or `apps/platform` | `shadcn`, `tailwind-v4-shadcn` | Login/register/2FA UI |
| 4 — Auth Tests | `apps/api` | `vitest`, `vitest-testing` | Auth integration tests |

> Run 1 first (findings inform 2), then 2 & 3 in parallel, then 4.

**Pattern 4: Frontend Page (No API Changes)**

| Subagent | Package | Skills | Task |
|----------|---------|--------|------|
| 1 — UI | `apps/web` or `apps/platform` | `shadcn`, `tailwind-v4-shadcn`, `performance` | Build page layout + components |
| 2 — Tests | same app | `vitest`, `vitest-testing` | Component/page tests |

> Run 1 first, then 2.

**Pattern 5: Durable Object Feature**

| Subagent | Package | Skills | Task |
|----------|---------|--------|------|
| 1 — DO Implementation | `apps/api` | `durable-objects`, `workers-best-practices` | DO class + RPC methods |
| 2 — Route Integration | `apps/api` | `hono-cloudflare`, `hono-api-scaffolder` | Route calling the DO via stub |
| 3 — DO Tests | `apps/api` | `vitest`, `vitest-testing`, `durable-objects` | DO integration tests |

> Run 1 first, then 2 & 3 in parallel.

**Pattern 6: Performance Optimization**

| Subagent | Package | Skills | Task |
|----------|---------|--------|------|
| 1 — API Perf | `apps/api` | `workers-best-practices`, `performance` | Optimize Worker code, streaming, caching |
| 2 — Frontend Perf | `apps/web` or `apps/platform` | `performance`, `tailwind-v4-shadcn` | LCP, bundle size, lazy loading, caching |

> Run both in parallel.

**Pattern 7: Test Suite Expansion**

| Subagent | Package | Skills | Task |
|----------|---------|--------|------|
| 1 — API Tests | `apps/api` | `vitest`, `vitest-testing`, `workers-best-practices` | Workers pool integration tests |
| 2 — Frontend Tests | `apps/web` | `vitest`, `vitest-testing` | jsdom + @testing-library/react tests |
| 3 — Schema Tests | `packages/shared` | `vitest`, `vitest-testing`, `zod` | Zod schema validation tests |

> Run all three in parallel.

**Pattern 8: Monorepo / Config Changes**

| Subagent | Package | Skills | Task |
|----------|---------|--------|------|
| 1 — Config | `packages/config` | `monorepo-management`, `typescript-expert` | tsconfig / ESLint / Turborepo config |
| 2 — Verify | all apps | `vitest`, `vitest-testing` | Run builds + tests across packages to verify |

> Run 1 first, then 2.

---

### Installed Skills Reference (`.agents/skills/`)

| Skill | Description |
|-------|-------------|
| `api-design` | REST API design patterns — resource naming, status codes, pagination, filtering, versioning, rate limiting |
| `auth-security-reviewer` | Reviews auth implementation for session, CSRF, cookie security, and auth flow vulnerabilities |
| `d1-drizzle-schema` | Generate Drizzle ORM schemas for Cloudflare D1 with correct D1-specific patterns |
| `drizzle-migrations` | Migration-first DB development workflow — SQL-first migrations, snapshots, schema drift detection |
| `durable-objects` | Create and review Cloudflare Durable Objects — RPC, SQLite storage, alarms, WebSockets |
| `email-and-password-best-practices` | Secure email/password auth implementation rules (Better Auth) |
| `find-skills` | Discover and install new agent skills from the ecosystem |
| `hono-api-scaffolder` | Scaffold Hono API routes — route files, middleware, Zod validation, error handling |
| `hono-cloudflare` | Hono on Cloudflare Workers — bindings, KV, D1, R2, DO, Queues, edge patterns |
| `monorepo-management` | Turborepo, Nx, pnpm workspaces — builds, dependency management, shared code |
| `nodejs-backend-patterns` | Production Node.js backend patterns — middleware, error handling, auth, DB integration |
| `nodejs-backend-typescript` | Node.js + TypeScript backend — Express/Fastify, routing, middleware, DB |
| `performance` | Web performance optimization — LCP, fonts, caching, Core Web Vitals, runtime efficiency |
| `shadcn` | shadcn/ui component patterns — Radix, Tailwind styling, forms, data tables, theming, accessibility |
| `tailwind-v4-shadcn` | Tailwind CSS v4 + shadcn/ui + Vite — @theme inline, CSS variables, dark mode, common gotchas |
| `two-factor-authentication-best-practices` | Secure 2FA implementation rules — TOTP, backup codes, trusted devices (Better Auth) |
| `typescript-advanced-types` | Advanced TypeScript types — generics, conditionals, mapped types, template literals, utility types |
| `typescript-expert` | TypeScript strict mode, type-safe patterns, tsconfig, TDD workflow |
| `vitest` | Vitest testing — setup, async patterns, mocking with vi.*, snapshots, performance, environments |
| `vitest-testing` | Practical Vitest patterns — assertions, async testing, vi.mock/vi.fn, quick reference |
| `workers-best-practices` | Cloudflare Workers production best practices — streaming, floating promises, bindings, security |
| `wrangler` | Wrangler CLI — deploy, develop, manage Workers, KV, R2, D1, Queues, Workflows, Containers |
| `zod` | Zod schema validation — type safety, parsing, safeParse, z.infer, refinements, composition |

## NOTES

- Three frontend apps: `admin` (shikdd.devsage.org), `platform` (platform.devsage.org), `judge` (judge.devsage.org), `web` (devsage.org)
- Participant sites (`{slug}.devsage.org`) are separate repos, generated via `scripts/generate-hackathon-site.js` from external `SHIKDD-org/hackathon-template` repo
- Vite dev proxy: `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787` (prefix matching)
- Production API: `https://api.devsage.org`. Routes use `/api/v1/` prefix with slug-based hackathon addressing
- DB migrations path in wrangler.jsonc: `../../packages/db/migrations` (relative from apps/api)
- Durable Objects MUST be re-exported from `apps/api/src/index.ts` or wrangler fails
- Cron trigger: `0 * * * *` (hourly) — checks submission deadlines, sends reminder notifications
- OAuth state stored in KV with 10-min TTL
- Architecture docs: `docs/` (api-contracts.md, architecture-*.md, data-models.md, deployment.md, development-guide.md)
- Complexity hotspots: `hackathon-state-machine.ts`, `judging.ts`, `notification-handler.ts`
