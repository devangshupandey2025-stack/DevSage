# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevSage is a GitHub-native hackathon management platform. Edge-native monorepo running on Cloudflare Workers (API) with four frontend SPAs (web, platform, admin, judge). Turborepo + pnpm workspaces, TypeScript strict throughout.

## Commands

```bash
pnpm install                 # Install all dependencies
pnpm dev                     # Start all apps in parallel (turbo). API resets local D1 DB on each start
pnpm build                   # Build all packages and apps
pnpm test                    # Run all test suites
pnpm lint                    # Lint all packages
pnpm typecheck               # Type-check all packages

# Run tests for a single package
pnpm --filter @devsage/api test
pnpm --filter @devsage/web test
pnpm --filter @devsage/shared test

# Run a single test file
pnpm --filter @devsage/api exec vitest run src/__tests__/hackathons.test.ts

# Generate DB migration after schema changes
pnpm --filter @devsage/db run generate

# Deploy
pnpm deploy:api              # Deploy API worker to Cloudflare
pnpm deploy:web              # Deploy web app
pnpm deploy:judge            # Deploy judge portal
pnpm deploy:all              # Deploy all apps
pnpm deploy:api:secrets      # Upload secrets from .env.production

# Secrets scanning
pnpm secrets:scan            # Full repo scan
pnpm secrets:staged          # Scan staged files (runs on pre-commit)
```

## Architecture

### Monorepo Structure

```
apps/api/          → @devsage/api      — Cloudflare Worker: Hono API + DOs + Queues + Cron (port 8787)
apps/web/          → @devsage/web      — devsage.org (port 5173) — public website, participant-facing
apps/platform/     → @devsage/platform — platform.devsage.org (port 5174) — organizer dashboard
apps/admin/        → @devsage/admin    — shikdd.devsage.org (port 5175) — platform admin panel
apps/judge/        → @devsage/judge    — judge.devsage.org — judge scoring portal
packages/config/   → @devsage/config   — Shared tsconfig (base/react/worker) + ESLint flat config (ESLint 9+)
packages/db/       → @devsage/db       — Drizzle ORM schemas (46 files) + D1 migrations (3 SQL files)
packages/shared/   → @devsage/shared   — Zod schemas (26 files), types, constants — ⚠️ dead code: zero runtime imports
```

### Dependency Rules

- Frontend apps (`web`, `platform`, `admin`, `judge`) import from `@devsage/shared` only — never from `db` or `api`
- `@devsage/api` imports from `@devsage/shared` and `@devsage/db`
- No circular dependencies, no cross-app imports
- Participant sites (`{slug}.devsage.org`) are separate repositories

### Auth Architecture (apps/api)

Single-worker auth pattern:
- **API Worker** (`apps/api`, port 8787, `api.devsage.org`) handles auth and business APIs
- Auth routes served from `/auth/*` (email/password + OAuth + refresh/logout/me)
- Session: HttpOnly cookies (`access_token`, `refresh_token`) with refresh-token rotation
- Roles resolved server-side from DB each request — NOT stored in JWT
- OTP via CSPRNG (`crypto.getRandomValues()`), passwords max 128 chars

Frontend auth flow (web/platform/admin/judge):
1. Login calls `POST /auth/login` (or OAuth start routes)
2. API sets auth cookies
3. App bootstrap calls `GET /auth/me`
4. API requests use `credentials: 'include'`; on 401, clients call `POST /auth/refresh` then retry

### API Architecture (apps/api)

- **Entrypoint**: `src/index.ts` — Hono app, exports `fetch`, `queue`, `scheduled` handlers + DO re-export
- **Middleware chain**: CORS → Request ID → Rate Limiter → Error Handler → optionalAuth (JWT verify) → per-route role checks
- **Routes**: `src/routes/` (17 files) — slug-based hackathon addressing (`/api/v1/hackathons/:slug/...`)
- **Durable Objects**: `src/durable-objects/` — MUST be re-exported from `src/index.ts` or wrangler fails. SQLite-backed only
- **Queue handlers**: `src/queue/` (7 files) — dispatcher in `queue/index.ts`
- **Services**: `src/services/` (4 files) — fail-open pattern (10s timeout, never throw)
- **Config**: `wrangler.jsonc` (never wrangler.toml). Never run wrangler from repo root
- **DB access**: Raw SQL via D1 `.prepare()` — Drizzle ORM schemas exist but are NOT used at runtime

### Hackathon State Machine

5-state lifecycle: `draft → active → judging → completed → archived`. Forward-only transitions, except `archived → completed` for score corrections.

### Frontend Apps

- React 18 + Vite + Tailwind CSS v4 + shadcn/ui + React Router + TanStack Query
- Path alias: `@/` → `./src/`
- Vite dev proxy forwards `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787`
- Cookie-based auth with `credentials: 'include'` via API-hosted `/auth/*`
- Brand color: `#CCFF00` (lime green), dark-first theme

### Database (`packages/db`)

- Drizzle ORM with `sqliteTable()` for Cloudflare D1 (46 schema files, 3 migration files)
- D1 quirks: FKs always ON, booleans are `integer` (0/1), max 100 bound params, JSON stored as TEXT
- Primary keys: `text('id')` with UUIDs (`crypto.randomUUID()`)
- Timestamps: `text` columns with `sql\`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))\`` defaults
- Schema change workflow: edit `src/schema/` → re-export from `schema/index.ts` → `pnpm --filter @devsage/db run generate` → review migration SQL → commit

## Testing

- **Framework**: Vitest everywhere
- **API tests**: `@cloudflare/vitest-pool-workers` — runs in Workers runtime with real D1/KV/DO bindings. `singleWorker: true`. Tests in `apps/api/src/__tests__/*.test.ts` (24 files)
- **Frontend tests**: jsdom + `@testing-library/react` — ⚠️ zero test files exist across all 4 apps
- **Test pattern**: Integration-first, minimal mocking, inline test helpers (`src/__tests__/helpers.ts`)
- **Current**: 198 passing, 25 pre-existing failures (e2e-lifecycle, team-repos, workspaces)

## Dev Environment

- Node.js >= 20 (`.nvmrc`: 20)
- pnpm workspaces (see `pnpm-workspace.yaml`)
- API dev secrets go in `apps/api/.dev.vars` (gitignored)
- `pnpm dev` auto-resets local D1 database with seed accounts
- Production: API at `api.devsage.org`

## Conventions

- **ESM strict**: All imports use explicit `.js` extensions in barrel exports
- **Console**: `console.log` banned (warn-level lint). Use `console.warn`/`console.error` only
- **Unused vars**: Prefix with `_` (`argsIgnorePattern: '^_'`)
- **Response envelope**: `{ ok: true, data, meta }` / `{ ok: false, error: { code, message } }` via `successResponse()` / `errorResponse()`
- **Timestamps**: UTC ISO-8601 (`new Date().toISOString()`)
- **UUIDs**: `crypto.randomUUID()` (Workers-native)
- **Pagination**: Offset-based default (`limit`/`offset`/`has_more`). Cursor for append-only (audit, commits, notifications)
- **Roles**: 6 per-hackathon: `organizer | co_organizer | judge | team_lead | team_member | anonymous`. Resolved per-request via `resolveRole()`, NOT in JWT
- **Workspace roles**: `owner | admin | member`
- **Team roles**: `leader | member`
- **Audit trail**: Every mutation logs via `insertAuditEvent()` with SHA-256 hash chain integrity
- **JWT**: Custom HMAC SHA-256 via `crypto.subtle`, 15-min expiry. No external JWT lib
- **Services**: Fail-open (10s AbortController timeout, log warning, never throw)

## Anti-Patterns to Avoid

- `wrangler.toml` — use `wrangler.jsonc` only
- Prisma — incompatible with Workers/D1, use Drizzle
- `@hono/oauth-providers` — broken on Workers, use manual OAuth
- Direct D1 access from inside DO classes — Worker mediates all D1 writes
- `console.log` — use `console.warn`/`console.error`
- External JWT libraries — use `crypto.subtle` only
- `Math.random()` for security — use `crypto.getRandomValues()`
- Storing roles in JWT — resolve per-request per-hackathon
- Organizer features in `apps/web` — those belong in `apps/platform`
- Legacy KV-backed DOs — use SQLite-backed (`new_sqlite_classes`)
- Running `wrangler` from repo root — always run from `apps/api/`

## Git Hooks & Security

- **Pre-commit**: `secretlint` scans staged files — blocks commits containing secrets
- **Pre-push**: Full repo secret scan — blocks pushes with secrets
- **CI**: `gitleaks` on every PR + push to main + quality gate (typecheck+lint+test) before deploy
- API dev secrets go in `apps/api/.dev.vars` (gitignored). Never put secrets in `VITE_*` env vars

## Key Files for Common Tasks

| Task | Location |
|------|----------|
| Add API route | `apps/api/src/routes/`, mount in `src/index.ts` via `app.route()` |
| Add auth feature | `apps/api/src/routes/auth.ts` + `apps/api/src/lib/*auth*` |
| Add Durable Object | `apps/api/src/durable-objects/`, re-export from `src/index.ts` |
| Add queue handler | `apps/api/src/queue/`, wire in `queue/index.ts` dispatcher |
| Add DB table | `packages/db/src/schema/`, re-export from `schema/index.ts`, run `drizzle-kit generate` |
| Add Zod schema | `packages/shared/src/schemas/`, re-export from `src/index.ts` with `.js` extension |
| Add middleware | `apps/api/src/middleware/` — use `MiddlewareHandler<AppEnv>` pattern |
| Change Worker bindings | `apps/api/wrangler.jsonc` + update `types/env.ts` |
| Change ESLint | `packages/config/eslint.config.mjs` (flat config, ESLint 9+) |

## Agent Skills (`.agents/skills/`)

23 skills installed. Load relevant skills before starting work — they contain domain-specific patterns and anti-patterns.

| Skill | Use For |
|-------|---------|
| `workers-best-practices` | Writing/reviewing Worker code (retrieval-first from CF docs) |
| `wrangler` | CLI commands, `wrangler.jsonc` config, deploying, bindings |
| `hono-cloudflare` | Hono routes, bindings, KV/D1/R2/DO/Queue integration |
| `hono-api-scaffolder` | Scaffolding new route files with validation and error handling |
| `durable-objects` | DO classes, RPC, SQLite storage, alarms, WebSockets |
| `d1-drizzle-schema` | Drizzle schemas for D1 (FK quirks, boolean/datetime, 100-param limit) |
| `drizzle-migrations` | Migration workflow, schema drift, SQL-first migrations |
| `api-design` | REST API design patterns, status codes, pagination |
| `auth-security-reviewer` | Auth audit: session, CSRF, cookie security, auth flows |
| `email-and-password-best-practices` | Login/register, password reset, email verification |
| `two-factor-authentication-best-practices` | TOTP, backup codes, trusted devices |
| `zod` | Schema validation, `safeParse`, `z.infer`, refinements |
| `typescript-expert` | Strict mode, type-safe patterns, tsconfig, TDD |
| `typescript-advanced-types` | Generics, conditional types, mapped types, utility types |
| `vitest` / `vitest-testing` | Vitest framework patterns, `vi.*` mocking, async testing |
| `shadcn` | shadcn/ui components, Radix, forms, data tables, a11y |
| `tailwind-v4-shadcn` | Tailwind v4 + shadcn/ui + Vite, dark mode, CSS variables |
| `performance` | LCP, fonts, caching, Core Web Vitals, bundle optimization |
| `nodejs-backend-patterns` | Production Node.js patterns, middleware, error handling |
| `monorepo-management` | Turborepo, pnpm workspaces, build optimization |
| `find-skills` | Discover and install new skills |

## Known Debt

Read `debt/` folder before making architectural decisions. See `AGENTS.md` for full debt table and documentation map.
