# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevSage is a GitHub-native hackathon management platform. Edge-native monorepo running on Cloudflare Workers (API) with frontend SPAs (web, platform, admin, judge). Turborepo + pnpm workspaces, TypeScript strict throughout.

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
pnpm deploy:api:secrets      # Upload secrets from .env.production

# Secrets scanning
pnpm secrets:scan            # Full repo scan
pnpm secrets:staged          # Scan staged files (runs on pre-commit)
```

## Architecture

### Monorepo Structure

```
apps/api/          → @devsage/api      — Cloudflare Worker: Hono API + Durable Objects + Queues + Cron
apps/web/          → @devsage/web      — devsage.org (port 5173) — public website, participant-facing
apps/platform/     → @devsage/platform — platform.devsage.org (port 5174) — organizer/judge dashboard
apps/admin/        → @devsage/admin    — shikdd.devsage.org (port 5175) — platform admin panel
packages/config/   → @devsage/config   — Shared tsconfig (base/react/worker) + ESLint flat config
packages/db/       → @devsage/db       — Drizzle ORM schemas (~38 tables) + D1 migrations
packages/shared/   → @devsage/shared   — Zod schemas, types, constants (only dep: zod)
```

### Dependency Rules

- Frontend apps (`web`, `platform`, `admin`) import from `@devsage/shared` only — never from `db` or `api`
- `@devsage/api` imports from `@devsage/shared` and `@devsage/db`
- No circular dependencies, no cross-app imports
- Participant sites (`{slug}.devsage.org`) are separate repositories

### Auth Architecture (apps/api)

Single-worker auth pattern:
- **API Worker** (`apps/api`, port 8787, `api.devsage.org`) handles auth and business APIs.
- Auth routes are served from `/auth/*` (email/password + OAuth + refresh/logout/me).
- Session model is HttpOnly cookies (`access_token`, `refresh_token`) with refresh-token rotation.
- User roles are resolved server-side from DB each request.

Frontend auth flow (web/platform/admin/judge):
1. Login calls `POST /auth/login` (or OAuth start routes).
2. API sets auth cookies.
3. App bootstrap calls `GET /auth/me`.
4. API requests use `credentials: 'include'`; on 401, clients call `POST /auth/refresh` then retry.

### API Architecture (apps/api)

- **Entrypoint**: `src/index.ts` — Hono app, exports `fetch`, `queue`, `scheduled` handlers + DO re-export
- **Middleware chain**: CORS → Request ID → optionalAuth (JWT verify) → Error Handler → per-route role checks
- **Routes**: `src/routes/` — slug-based hackathon addressing (`/api/v1/hackathons/:slug/...`)
- **Durable Objects**: `src/durable-objects/` — MUST be re-exported from `src/index.ts` or wrangler fails
- **Queue handlers**: `src/queue/` — dispatcher in `queue/index.ts`
- **Services**: `src/services/` — fail-open pattern (10s timeout, never throw)
- **Config**: `wrangler.jsonc` (never wrangler.toml). Never run wrangler from repo root

### Hackathon State Machine

5-state lifecycle: `draft → active → judging → completed → archived`. Forward-only transitions, except `archived → completed` for score corrections.

### Frontend Apps

- React 18 + Vite + Tailwind CSS v4 + shadcn/ui + React Router + TanStack Query
- Path alias: `@/` → `./src/`
- Vite dev proxy forwards `/api/v1` → `http://localhost:8787`
- Platform/admin/judge/web: cookie-based auth with `credentials: 'include'` via API-hosted `/auth/*`

## Testing

- **Framework**: Vitest everywhere
- **API tests**: `@cloudflare/vitest-pool-workers` — runs in Workers runtime with real D1/KV/DO bindings. `singleWorker: true`. Tests in `apps/api/src/__tests__/*.test.ts`
- **Web tests**: jsdom + `@testing-library/react`
- **Test pattern**: Integration-first, minimal mocking, inline test helpers (`src/__tests__/helpers.ts`)

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
- **Response envelope**: `{ ok: true, data, meta }` / `{ ok: false, error: { code, message } }` on all API routes
- **Timestamps**: UTC ISO-8601 (`new Date().toISOString()`)
- **UUIDs**: `crypto.randomUUID()` (Workers-native)
- **Pagination**: Offset-based default (`limit`/`offset`/`has_more`). Cursor for append-only (audit, commits, notifications)
- **Audit trail**: Every mutation logs via `insertAuditEvent()` with hash chain integrity

## Anti-Patterns to Avoid

- `wrangler.toml` — use `wrangler.jsonc` only
- Prisma — incompatible with Workers/D1, use Drizzle
- Direct D1 access from inside Durable Object classes — Worker mediates all D1 writes
- `console.log` — use `console.warn`/`console.error`
- Organizer features in `apps/web` — those belong in `apps/platform`
- SQLite-backed DOs only (`new_sqlite_classes`) — no legacy KV-backed DOs
- Bearer-only auth assumptions in frontend/API middleware

## Git Hooks

- **Pre-commit**: `secretlint` scans staged files — blocks commits with secrets
- **Pre-push**: Full repo secret scan via `secretlint` — blocks pushes with secrets
- **CI**: `gitleaks` on every PR + push to main (`.github/workflows/secret-scan.yml`)

## Key Files for Common Tasks

| Task | Location |
|------|----------|
| Add API route | `apps/api/src/routes/`, mount in `src/index.ts` via `app.route()` |
| Add auth feature | `apps/api/src/routes/auth.ts` + `apps/api/src/lib/*auth*` |
| Add Durable Object | `apps/api/src/durable-objects/`, re-export from `src/index.ts` |
| Add queue handler | `apps/api/src/queue/`, wire in `queue/index.ts` dispatcher |
| Add DB table | `packages/db/src/schema/`, re-export from `schema/index.ts`, run `drizzle-kit generate` |
| Add Zod schema | `packages/shared/src/schemas/`, re-export from `src/index.ts` with `.js` extension |
| Change Worker bindings | `apps/api/wrangler.jsonc` + update `types/env.ts` |
| Change tsconfig | `packages/config/` (base, react, worker variants) |
| Change ESLint | `packages/config/eslint.config.mjs` (flat config, ESLint 9+) |
