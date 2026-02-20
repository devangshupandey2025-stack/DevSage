---
project_name: 'DevSage'
user_name: 'Srijan'
date: '2026-02-18'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Language:** TypeScript ^5.9.3 (strict mode everywhere)
- **API:** Hono ^4.6.14 on Cloudflare Workers (compatibility date 2024-12-30, `nodejs_compat`)
- **Frontend:** React 18.3.1, React Router 7.0.0, Vite 6.0.0
- **Styling:** Tailwind CSS 4.0.0 (v4 engine mode via `@tailwindcss/vite` plugin)
- **UI:** Radix UI (headless) + CVA 0.7.1 (variants) + `cn()` utility (clsx + tailwind-merge)
- **DB:** Drizzle ORM ^0.36.4 (schema definitions), D1 SQLite (runtime)
- **Validation:** Zod ^3.25.0 + @hono/zod-validator ^0.4.1
- **Data Fetching:** TanStack React Query 5.90.21 (web + platform apps only)
- **Animations:** Framer Motion 11.0.0, GSAP 3.14.2
- **Monorepo:** pnpm 10.28.2, Turbo (latest)
- **Testing:** Vitest ^3.2.4, @cloudflare/vitest-pool-workers ^0.12.10
- **Deploy:** Wrangler 4.63.0, Cloudflare Pages (frontends)
- **Bindings:** D1 (DB), KV (rate limiting/OAuth state), Durable Objects (SQLite-backed), Queues (WEBHOOK_QUEUE, NOTIFICATION_QUEUE)

## Critical Implementation Rules

### Language-Specific Rules

- **ESM strict:** All imports in barrel exports use explicit `.js` extensions (`export { foo } from './foo.js'`)
- **Type-only imports:** Use `import type { ... }` for types
- **Path alias:** `@/` → `./src/` in all frontend apps
- **No `console.log`:** Only `console.warn` / `console.error` allowed (lint: warn)
- **Unused vars:** Prefix with `_` to suppress (`argsIgnorePattern: '^_'`)
- **No `any` escape hatches:** Never use `as any`, `@ts-ignore`, or `@ts-expect-error`
- **Timestamps:** All UTC ISO-8601 (`new Date().toISOString()`)
- **UUIDs:** `crypto.randomUUID()` (Workers-native, no external lib)
- **Error handling (API):** Try-catch in handlers → errors bubble to `errorHandler` middleware → standard `errorResponse()` envelope
- **Services pattern:** Fail-open — 10s timeout via AbortController, log warning, never throw

### Framework-Specific Rules

**Hono / Cloudflare Workers:**
- **Middleware chain:** CORS → Request ID → Optional Auth → Error Handler (global); per-route: `authMiddleware` → `hackathonContext` → `requireRole` → handler
- **Response envelope on ALL routes:** `successResponse(c, data, { meta })` / `errorResponse(c, status, code, message)` — never return raw JSON
- **Pagination:** Offset-based (default: `limit` 1–100, `offset`, `has_more`); cursor-based for append-only endpoints (audit, notifications)
- **Route mounting:** Under `/api/v1/` with slug-based hackathon addressing (`/api/v1/hackathons/:slug/...`)
- **Durable Objects:** MUST be re-exported from `apps/api/src/index.ts` or wrangler deploy fails
- **Queue consumer:** Same Worker handles producer + consumer — never create separate Workers
- **Rate limiting:** KV-backed with `waitUntil()` for non-blocking writes
- **D1 access:** Raw prepared statements in routes (`c.env.DB.prepare(...).bind(...)`), not Drizzle ORM at route level
- **Auth:** JWT in HttpOnly `access_token` cookie, custom HMAC SHA-256 via `crypto.subtle` — no external JWT libs
- **Roles:** 6-tier per-hackathon (`organizer | co_organizer | judge | team_lead | team_member | anonymous`), resolved per-request via `resolveRole()` — NOT stored in JWT

**React Frontend:**
- **Components:** Radix UI (headless) + CVA (variants) + `cn()` utility for class merging
- **UI primitives:** `src/components/ui/` — shadcn/ui pattern
- **Routing:** React Router v7, lazy code-splitting with Suspense, `<ProtectedRoute>` wrapper
- **Auth state:** `AuthProvider` context → `useAuth()` hook (fetches `/auth/me` on mount)
- **API client:** `apiRequest<T>(endpoint, options)` — credentials via cookies, 401 → silent refresh → retry
- **Data fetching:** TanStack React Query with `queryOptions()` (web + platform); admin uses direct `apiRequest()`
- **Query defaults:** 5min staleTime, 1hr gcTime, 1 retry, no window focus refetch

**Tailwind CSS v4:**
- Engine mode via `@tailwindcss/vite` plugin (NOT PostCSS)
- CSS-first config: `@import "tailwindcss"` + `@plugin "tailwindcss-animate"` + `@custom-variant dark`
- Theme: HSL CSS variables (background, foreground, primary, destructive, etc.)

### Testing Rules

- **Framework:** Vitest everywhere
- **API tests:** `@cloudflare/vitest-pool-workers` — real Workers runtime with actual D1/KV/DO bindings, `singleWorker: true`
- **Frontend tests:** jsdom + `@testing-library/react`
- **File location:** `src/__tests__/**/*.test.ts` (colocated in src)
- **Philosophy:** Integration-first, minimal mocking, inline helpers
- **Test secrets:** Configured in miniflare bindings config (not env vars)
- **No E2E:** No Playwright in CI

### Code Quality & Style Rules

- **ESLint:** Flat config (ESLint 9+), shared from `packages/config/eslint.config.mjs`
- **File naming:** kebab-case for all files (`hackathon-state-machine.ts`)
- **Component naming:** PascalCase (`DashboardLayout.tsx`)
- **DB tables:** snake_case (`team_members`, `organizer_roles`)
- **Comments:** Only when clarification needed — no boilerplate comments
- **Barrel exports:** Every package/module has `index.ts` re-exporting with `.js` extensions
- **New DB table:** Define in `packages/db/src/schema/`, re-export from `schema/index.ts`, run `drizzle-kit generate`
- **New Zod schema:** Define in `packages/shared/src/schemas/`, re-export from `src/index.ts` with `.js` extension
- **New route:** Create in `apps/api/src/routes/`, mount in `src/index.ts` via `app.route()`
- **New middleware:** `MiddlewareHandler<AuthAppEnv>` type pattern

### Development Workflow Rules

- **Dev:** `pnpm dev` — all apps via Turbo; ports: web (default), platform (5174), admin (5175), API (8787)
- **Build/Test/Lint:** `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm typecheck` — all Turbo-orchestrated
- **Deploy API:** `pnpm deploy:api` — never run `wrangler` from repo root
- **Secrets (dev):** `apps/api/.dev.vars` (gitignored)
- **Secrets (prod):** `wrangler secret put` or `wrangler secret bulk` — never commit secrets
- **Frontend env:** Only `VITE_*` vars — NEVER put secrets in web apps
- **Pre-commit hook:** `secretlint` blocks commits containing secrets
- **Pre-push hook:** Full repo secret scan blocks pushes with secrets
- **CI:** `gitleaks` on every PR + push to master
- **DB migrations:** Run `drizzle-kit generate` from `packages/db`, path in wrangler.jsonc is `../../packages/db/migrations`
- **Vite proxy (dev):** `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787`

### Critical Don't-Miss Rules

**Anti-Patterns (NEVER do these):**
- ❌ `@hono/oauth-providers` — broken on Workers, use manual OAuth
- ❌ `wrangler.toml` — use `wrangler.jsonc` only
- ❌ Prisma — incompatible with Workers/D1, use Drizzle
- ❌ Direct D1 inside Durable Objects — Worker mediates all D1 writes
- ❌ Separate Workers for queue consumers — same Worker handles both
- ❌ External JWT libs — use `crypto.subtle` only
- ❌ Roles in JWT — resolve per-request per-hackathon via `resolveRole()`
- ❌ Backward state transitions — forward-only: `draft → active → judging → completed → archived` (except `archived→completed`)
- ❌ Cookie domain `.devsage.org` — cookies are per-subdomain
- ❌ Organizer features in `apps/web` — belong in `apps/platform`
- ❌ Cross-app imports — never import between `apps/`
- ❌ Frontend importing `@devsage/db` — only `@devsage/shared` allowed

**Security:**
- Every mutation → `insertAuditEvent()` with hash chain integrity
- Webhooks: HMAC signature verification, enqueue to WEBHOOK_QUEUE
- Refresh tokens: family-based replay detection, 30-day expiry, rotation on use
- OAuth state: KV with 10-min TTL
- JWT: 15-min access token, payload `{ sub, ghid, ghu, fam, iat, exp }`

**Architecture Boundaries:**
- `apps/admin` = shikdd.devsage.org (platform admin only)
- `apps/platform` = platform.devsage.org (organizer/judge dashboard)
- `apps/web` = devsage.org (public marketing/info)
- Participant sites (`{slug}.devsage.org`) = separate repositories
- Production API: `https://api.devsage.org`

**Dependency Rules:**
- `apps/admin`, `apps/platform`, `apps/web` → `@devsage/shared` only (never `db` or `api`)
- `apps/api` → `@devsage/shared` + `@devsage/db`
- No circular dependencies, no cross-app imports

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-18
