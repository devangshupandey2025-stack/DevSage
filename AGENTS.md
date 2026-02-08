# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-06  
**Commit:** 2d2d14a  
**Branch:** main

## OVERVIEW

DevSage — edge-native hackathon platform. Turborepo monorepo: Cloudflare Workers API (Hono + D1 + Durable Objects + Queues) + React SPA (Vite + Tailwind + shadcn/ui). pnpm workspaces, TypeScript strict throughout.

## STRUCTURE

```
DevSage/
├── apps/
│   ├── api/          # Cloudflare Worker — Hono API, DOs, queue consumer
│   └── web/          # React SPA — Vite, React Router, Tailwind, shadcn/ui
├── packages/
│   ├── config/       # Shared tsconfig variants + ESLint flat config
│   ├── db/           # Drizzle ORM schemas + D1 migrations
│   └── shared/       # Zod schemas, types, constants (shared between api & web)
├── docs/             # secrets.md — secret handling conventions
└── .sisyphus/        # Plans, notepads, learnings (agent workspace)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add API route | `apps/api/src/routes/` | Hono router, mount in `src/index.ts` |
| Add Durable Object | `apps/api/src/durable-objects/` | MUST re-export from `src/index.ts` |
| Add DB table | `packages/db/src/schema/` | Drizzle SQLite, re-export from `schema/index.ts`, run `drizzle-kit generate` |
| Add Zod schema | `packages/shared/src/schemas/` | Re-export from `src/index.ts` |
| Add UI page | `apps/web/src/pages/` | Add route in `App.tsx` |
| Add UI component | `apps/web/src/components/` | shadcn/ui in `components/ui/` |
| Add middleware | `apps/api/src/middleware/` | Hono middleware pattern |
| Change tsconfig | `packages/config/` | Base, react, worker variants |
| Change ESLint | `packages/config/eslint.config.mjs` | Flat config (ESLint 9+) |
| Manage secrets | `docs/secrets.md` | Full conventions documented there |

## DEPENDENCY GRAPH

```
apps/api  → @devsage/shared, @devsage/db, @devsage/config
apps/web  → @devsage/shared
packages/db     → @devsage/config
packages/shared → (standalone, only zod)
packages/config → (standalone, configs only)
```

## CONVENTIONS

- **ESM strict**: All imports use explicit `.js` extensions in barrel exports
- **Console**: `console.log` banned (warn). Only `console.warn`/`console.error` allowed
- **Unused vars**: Prefix with `_` to suppress lint (`argsIgnorePattern: '^_'`)
- **no-explicit-any**: Warn, not error — but never use `as any` / `@ts-ignore` / `@ts-expect-error`
- **Timestamps**: All UTC ISO-8601 (`new Date().toISOString()`)
- **UUIDs**: `crypto.randomUUID()` (Workers-native)
- **Roles**: Exactly 2 hardcoded: `organiser` | `participant`. No more.
- **Auth**: Manual OAuth 2.0 (Google + GitHub) → JWT in HttpOnly cookie. NOT `@hono/oauth-providers` (broken on Workers)
- **JWT**: Custom HMAC SHA-256 via `crypto.subtle`. No external JWT lib.
- **State machine**: `DRAFT → REGISTRATION_OPEN → HACKING → SUBMISSION_CLOSED → COMPLETED`. No backward/skip transitions.

## ANTI-PATTERNS (THIS PROJECT)

- `@hono/oauth-providers` — broken on Cloudflare Workers, use manual OAuth
- `wrangler.toml` — use `wrangler.jsonc` only
- Prisma — incompatible with Workers/D1, use Drizzle
- Direct D1 access from inside DO classes — Worker mediates all D1 writes
- Separate Workers for queue consumer — same Worker handles producer + consumer
- Legacy KV-backed DOs — use SQLite-backed (`new_sqlite_classes`)
- WebSocket / email / R2 / full-text search — not in scope
- More than 2 roles — only organiser + participant

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
pnpm deploy:api:secrets       # Upload API secrets (.env.production)
pnpm deploy:web              # Deploy web app
```

## TESTING

- **Framework**: Vitest 2.1.9 everywhere
- **API tests**: `@cloudflare/vitest-pool-workers` — runs in Workers runtime with real D1/KV/DO bindings
- **Web tests**: jsdom + `@testing-library/react`
- **Pattern**: `src/__tests__/**/*.test.ts` (colocated in src)
- **Style**: Integration-first, minimal mocking, inline helpers
- **No E2E**: No Playwright in CI

## SECRETS / SECURITY

- Pre-commit hook: `secretlint` scans staged files — **blocks commits with secrets**
- Pre-push hook: full repo secret scan — **blocks pushes with secrets**
- CI: `gitleaks` on every PR + push to master
- API dev secrets: `apps/api/.dev.vars` (gitignored)
- API prod secrets: deploy via `wrangler secret put`
- Web env: only `VITE_*` (client-visible). **Never put secrets in web app.**
- `.env*` files gitignored (except `apps/web/.env.production`)

## NOTES

- `apps/worker/` exists but is orphaned (no package.json) — leftover from earlier experiment
- `apps/web/src/routes.tsx` exists but is unused — `App.tsx` defines all routes directly
- Vite dev proxy: `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787` (wrangler dev)
- Production API is hosted at `https://api.devsage.org` (routes are `/auth/*`, `/hackathons/*`, `/webhooks/*`)
- DB migrations path in wrangler.jsonc: `../../packages/db/migrations` (relative from apps/api)
- Durable Objects MUST be re-exported from `apps/api/src/index.ts` or wrangler fails
- Plan doc: `.sisyphus/plans/devsage-mvp.md` — full architecture decisions + task history
