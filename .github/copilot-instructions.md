# Copilot Instructions — DevSage

## Project Overview

DevSage is an edge-native hackathon management platform. Turborepo monorepo with a Cloudflare Workers API (Hono + D1 + Durable Objects + Queues) and four React SPAs. pnpm workspaces, TypeScript strict throughout.

```
apps/api/          → Cloudflare Worker: Hono API, DOs, queue consumer, cron (port 8787)
apps/web/          → devsage.org — participant-facing (port 5173)
apps/platform/     → platform.devsage.org — organizer dashboard (port 5174)
apps/admin/        → shikdd.devsage.org — platform admin panel (port 5175)
apps/judge/        → judge.devsage.org — judge scoring portal
packages/config/   → Shared tsconfig (base/react/worker) + ESLint flat config (ESLint 9+)
packages/db/       → Drizzle ORM schemas (46 files) + D1 migrations (3 SQL files)
packages/shared/   → Zod schemas (26 files), types, constants — ⚠️ dead code: zero runtime imports
```

## Commands

```bash
pnpm install                 # Install all dependencies
pnpm dev                     # Start all apps (turbo). API resets local D1 DB on each start
pnpm build                   # Build all
pnpm test                    # Run all test suites
pnpm lint                    # Lint all
pnpm typecheck               # Type-check all

# Single package
pnpm --filter @devsage/api test
pnpm --filter @devsage/web test

# Single test file
pnpm --filter @devsage/api exec vitest run src/__tests__/hackathons.test.ts

# DB migration after schema changes
pnpm --filter @devsage/db run generate

# Deploy
pnpm deploy:api              # Deploy API worker
pnpm deploy:web              # Deploy web app
pnpm deploy:judge            # Deploy judge portal
pnpm deploy:all              # Deploy all apps

# Secret scanning
pnpm secrets:scan            # Full repo
pnpm secrets:staged          # Staged files (runs on pre-commit)
```

## Dependency Rules

- Frontend apps (`web`, `platform`, `admin`, `judge`) import from `@devsage/shared` only — **never** from `db` or `api`
- `@devsage/api` imports from `@devsage/shared` and `@devsage/db`
- No circular dependencies, no cross-app imports
- Participant sites (`{slug}.devsage.org`) live in separate repositories

## Architecture

### API (`apps/api`)

- **Entrypoint**: `src/index.ts` — Hono app exporting `fetch`, `queue`, `scheduled` handlers + DO re-exports
- **Middleware chain**: CORS → Request ID → Rate Limiter → Error Handler → optionalAuth (JWT from cookie) → per-route `requireRole()` or `requirePlatformAdmin`
- **Routes**: `src/routes/` (17 files) — slug-based hackathon addressing (`/api/v1/hackathons/:slug/...`)
- **Auth**: API-hosted at `/auth/*` — cookie-based HttpOnly JWT (15-min access + 30-day rotating refresh). Custom HMAC SHA-256 via `crypto.subtle` (no external JWT lib). OTP via CSPRNG. Max password 128 chars
- **Durable Objects**: `src/durable-objects/` — MUST be re-exported from `src/index.ts` or wrangler deploy fails. SQLite-backed only (`new_sqlite_classes`)
- **Queue handlers**: `src/queue/` (7 files) — dispatcher in `queue/index.ts` (github-webhooks + devsage-notifications)
- **Cron**: Hourly (`0 * * * *`) — deadline transitions, reminders, audit hash backfill
- **Services**: `src/services/` (4 files) — fail-open pattern (10s AbortController timeout, log warning, never throw)
- **DB access**: Raw SQL via D1 `.prepare()` — Drizzle ORM schemas exist but are NOT used at runtime
- **Config**: `wrangler.jsonc` only (never `.toml`). Never run wrangler from repo root

### Hackathon State Machine

5-state lifecycle: `draft → active → judging → completed → archived`. Forward-only, except `archived → completed` for score corrections.

### Frontend Apps

- React 18 + Vite + Tailwind CSS v4 + shadcn/ui + React Router v7 + TanStack Query v5
- Path alias: `@/` → `./src/`
- Vite dev proxy forwards `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787`
- Cookie-based auth: `credentials: 'include'`, 401 → auto-refresh → retry (via `apiRequest()` in each app's `lib/api.ts`)
- Brand color: `#CCFF00` (lime green), dark-first theme

### Database (`packages/db`)

- Drizzle ORM with `sqliteTable()` for Cloudflare D1 (46 schema files, 3 migration files)
- D1 quirks: FKs always ON (can't disable), booleans are `integer` (0/1), max 100 bound params, JSON stored as TEXT
- Primary keys: `text('id')` with UUIDs (`crypto.randomUUID()`)
- Timestamps: `text` columns with `sql\`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))\`` defaults
- Schema change workflow: edit `src/schema/` → re-export from `schema/index.ts` → `pnpm --filter @devsage/db run generate` → review migration SQL → commit

### Shared (`packages/shared`)

- Zod schemas + TypeScript types (26 files) — ⚠️ currently zero runtime imports from any app
- Barrel exports in `src/index.ts` use `.js` extensions (ESM strict)
- Naming: `create{Entity}Schema` / `update{Entity}Schema` / `{entity}ResponseSchema`
- Type exports: `z.infer<typeof schema>`

## Conventions

- **ESM strict**: All barrel re-exports use explicit `.js` extensions
- **Console**: `console.log` is banned (warn-level lint). Use `console.warn`/`console.error` only
- **Unused vars**: Prefix with `_` (`argsIgnorePattern: '^_'`)
- **Response envelope**: All API routes return `{ ok: true, data, meta }` or `{ ok: false, error: { code, message } }` via `successResponse()` / `errorResponse()` from `lib/response.ts`
- **Timestamps**: UTC ISO-8601 (`new Date().toISOString()`)
- **UUIDs**: `crypto.randomUUID()` (Workers-native)
- **Pagination**: Offset-based default (`limit`/`offset`/`has_more`). Cursor for append-only endpoints (audit, commits, notifications)
- **Audit trail**: Every mutation logs via `insertAuditEvent()` with SHA-256 hash chain integrity
- **Roles**: 6-tier per-hackathon: `organizer | co_organizer | judge | team_lead | team_member | anonymous`. Resolved per-request via `resolveRole()`, NOT stored in JWT. Platform admins are a separate layer
- **Workspace roles**: `owner | admin | member`
- **Team roles**: `leader | member`

## Anti-Patterns

- `wrangler.toml` — use `wrangler.jsonc` only
- Prisma — incompatible with Workers/D1, use Drizzle
- `@hono/oauth-providers` — broken on Workers, use manual OAuth
- Direct D1 access from inside DO classes — Worker mediates all D1 writes
- External JWT libraries — use `crypto.subtle` only
- `Math.random()` for security — use `crypto.getRandomValues()`
- Storing roles in JWT — resolve per-request per-hackathon
- `console.log` — use `console.warn`/`console.error`
- Organizer features in `apps/web` — those belong in `apps/platform`
- Legacy KV-backed DOs — use SQLite-backed (`new_sqlite_classes`)
- Running `wrangler` from repo root — always from `apps/api/`

## Testing

- **Framework**: Vitest everywhere
- **API tests**: `@cloudflare/vitest-pool-workers` — runs in real Workers runtime with D1/KV/DO bindings. `singleWorker: true`. Tests in `apps/api/src/__tests__/` (24 files)
- **Frontend tests**: jsdom + `@testing-library/react` — ⚠️ zero test files across all 4 frontend apps
- **Pattern**: Integration-first, minimal mocking. Test helpers in `src/__tests__/helpers.ts`
- Each API test calls `ensureSchema()` in `beforeAll` and `resetDb()` in `beforeEach`

## Git Hooks & Security

- **Pre-commit**: `secretlint` scans staged files — blocks commits containing secrets
- **Pre-push**: Full repo secret scan — blocks pushes with secrets
- **CI**: `gitleaks` on every PR + push to main. Quality gate (typecheck+lint+test) before deploy
- API dev secrets go in `apps/api/.dev.vars` (gitignored). Never put secrets in `VITE_*` env vars

## Key Files for Common Tasks

| Task | Location |
|------|----------|
| Add API route | `apps/api/src/routes/`, mount in `src/index.ts` via `app.route()` |
| Add Durable Object | `apps/api/src/durable-objects/`, re-export from `src/index.ts` |
| Add queue handler | `apps/api/src/queue/`, wire in `queue/index.ts` dispatcher |
| Add DB table | `packages/db/src/schema/`, re-export from `schema/index.ts`, run `drizzle-kit generate` |
| Add Zod schema | `packages/shared/src/schemas/`, re-export from `src/index.ts` with `.js` extension |
| Add middleware | `apps/api/src/middleware/` — use `MiddlewareHandler<AppEnv>` pattern |
| Change Worker bindings | `apps/api/wrangler.jsonc` + update `types/env.ts` |
| Change ESLint | `packages/config/eslint.config.mjs` (flat config, ESLint 9+) |

## Agent Skills (`.agents/skills/`)

23 skills installed. Load relevant skills before starting work.

| Skill | Use For |
|-------|---------|
| `workers-best-practices` | Worker code review/writing (retrieval-first from CF docs) |
| `wrangler` | CLI, `wrangler.jsonc` config, deploying, bindings |
| `hono-cloudflare` | Hono routes, bindings, KV/D1/R2/DO/Queue integration |
| `hono-api-scaffolder` | Scaffolding route files with validation and error handling |
| `durable-objects` | DO classes, RPC, SQLite storage, alarms, WebSockets |
| `d1-drizzle-schema` | Drizzle for D1 (FK quirks, booleans, 100-param limit) |
| `drizzle-migrations` | Migration workflow, schema drift, SQL-first migrations |
| `api-design` | REST patterns, status codes, pagination, rate limiting |
| `auth-security-reviewer` | Auth audit: session, CSRF, cookie security |
| `email-and-password-best-practices` | Login/register, password reset |
| `two-factor-authentication-best-practices` | TOTP, backup codes, 2FA |
| `zod` | Schema validation, `safeParse`, refinements |
| `typescript-expert` | Strict mode, type-safe patterns, TDD |
| `typescript-advanced-types` | Generics, conditional/mapped types |
| `vitest` / `vitest-testing` | Vitest patterns, mocking, async testing |
| `shadcn` | shadcn/ui components, Radix, forms, a11y |
| `tailwind-v4-shadcn` | Tailwind v4 + shadcn/ui, dark mode, CSS vars |
| `performance` | LCP, fonts, caching, Core Web Vitals |
| `nodejs-backend-patterns` | Production Node.js patterns |
| `monorepo-management` | Turborepo, pnpm workspaces |
| `find-skills` | Discover and install new skills |

## Known Debt

Read `debt/` folder before making architectural decisions. Key issues documented in `AGENTS.md` debt table and 7 audit documents in `debt/`.
