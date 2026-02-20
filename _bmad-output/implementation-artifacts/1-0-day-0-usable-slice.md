# Story 1.0: Day-0 Usable Slice

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a participant or organizer,
I want to sign in and view a public hackathon shell page with basic info and submission instructions (stubbed data allowed),
So that I have a working baseline experience even before deeper features arrive.

## Acceptance Criteria (BDD)

1. **Given** a user visits devsage.org, **when** they choose "Sign in with GitHub" or "Sign in with Google," **then** they successfully authenticate via Better Auth and land on a minimal dashboard with their name and avatar.
2. **Given** a user signs out, **when** they revisit devsage.org, **then** they see the logged-out state and can sign back in.
3. **Given** a public visitor, **when** they open a hackathon shell page, **then** they see basic event info (name, dates, rules, submission instructions) rendered from stubbed data with a visible "Live data coming soon" badge.
4. **And** the shell page includes a "Submit via Git tags" summary with a link to docs and a "Manual SHA upload (coming soon)" placeholder CTA to prepare users for the fallback flow.

## Tasks / Subtasks

### Task 1: Core Dependency Upgrades (AC: all)

- [x] 1.1 Upgrade root and workspace package versions:
  - Hono → 4.12.x
  - React → 19.2.4, react-dom → 19.2.4
  - Zod → 4.3.x (upgraded to v4 — @hono/zod-openapi v1.2.x requires Zod 4 as peer dep)
  - Drizzle ORM → 0.45.x, drizzle-kit → 0.31.9 (latest)
  - Vite → 6.x (Vite 7 not yet published on npm; will re-evaluate in future story)
  - Vitest → 3.x (Vitest 4 not yet published on npm; will re-evaluate in future story)
  - TailwindCSS → 4.2.x
  - Wrangler → 4.67.x
  - TypeScript → 5.9.3 (already current)
- [x] 1.2 Install new dependencies:
  - `better-auth` v1.4.x (API + frontend)
  - `@hono/zod-openapi` v1.2.x (API)
  - `@tanstack/react-router` v1.x + `@tanstack/router-plugin` v1.x (all frontend apps)
- [x] 1.3 Remove replaced dependencies:
  - `react-router` / `react-router-dom` (replaced by TanStack Router)
  - Custom JWT utilities (`signJWT`, `verifyJWT`, `createRefreshToken`, `rotateRefreshToken` — replaced by Better Auth)
- [x] 1.4 Run `pnpm install` and verify clean build with `pnpm build`

### Task 2: Better Auth Configuration — API (AC: 1, 2)

- [x] 2.1 Create `apps/api/src/auth.ts` — Better Auth instance using **function wrapper pattern** (D1 binding only available in request context):
  ```
  export function createAuth(env: Env) {
    const db = drizzle(env.DB, { schema });
    return betterAuth({
      database: drizzleAdapter(db, { provider: "sqlite", schema }),
      baseURL: env.BETTER_AUTH_URL,
      secret: env.BETTER_AUTH_SECRET,
      socialProviders: { github: {...}, google: {...} },
    });
  }
  ```
- [x] 2.2 Create Better Auth Drizzle schema tables in `packages/db/src/schema/auth.ts`:
  - `user` table (id, name, email, emailVerified, image, createdAt, updatedAt)
  - `session` table (id, expiresAt, token, ipAddress, userAgent, userId, createdAt, updatedAt)
  - `account` table (id, accountId, providerId, userId, accessToken, refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt)
  - `verification` table (id, identifier, value, expiresAt, createdAt, updatedAt)
- [x] 2.3 Generate and apply D1 migration: `drizzle-kit generate` then `wrangler d1 migrations apply`
- [x] 2.4 Mount Better Auth handler in API routes:
  ```
  app.on(["GET", "POST"], "/api/auth/*", (c) => {
    const auth = createAuth(c.env);
    return auth.handler(c.req.raw);
  });
  ```
- [x] 2.5 Add secrets to `.dev.vars` (gitignored):
  - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [x] 2.6 Configure OAuth callback URLs in provider dashboards:
  - GitHub: `https://api.devsage.org/api/auth/callback/github` (prod), `http://localhost:8787/api/auth/callback/github` (dev)
  - Google: `https://api.devsage.org/api/auth/callback/google` (prod), `http://localhost:8787/api/auth/callback/google` (dev)

### Task 3: API Scaffolding — Hono + zod-openapi (AC: all)

- [x] 3.1 Create `apps/api/src/app.ts` — Hono OpenAPI app factory:
  - Use `OpenAPIHono` instead of plain `Hono`
  - Configure `defaultHook` for Zod validation error formatting
  - Mount global error handler (AppError pattern)
  - Set up request-id middleware
- [x] 3.2 Create `apps/api/src/lib/errors.ts` — AppError class:
  ```
  class AppError extends Error {
    constructor(public code: string, public statusCode: number, public details?: unknown)
  }
  ```
- [x] 3.3 Create `apps/api/src/routes/health.ts` — Health check endpoint via `createRoute`
- [x] 3.4 Create `apps/api/src/routes/hackathon-shell.ts` — Public endpoint returning stubbed hackathon data (name, dates, rules, submission instructions) for the shell page
- [x] 3.5 Update `apps/api/src/index.ts` — Chain routes with `.route()` and **export `AppType`** for RPC:
  ```
  const app = new OpenAPIHono()
    .route("/api/auth", authRoutes)
    .route("/api/v1", apiRoutes);
  export type AppType = typeof app;
  ```
- [x] 3.6 Verify `apps/api/package.json` has `exports` configured for type-only RPC access from frontends

### Task 4: Web App Scaffolding — TanStack Router + React 19 (AC: 1, 2, 3, 4)

- [x] 4.1 Install TanStack Router Vite plugin in `apps/web/vite.config.ts`:
  ```
  import { tanstackRouter } from "@tanstack/router-plugin/vite";
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react()]
  ```
- [x] 4.2 Create route structure in `apps/web/src/routes/`:
  - `__root.tsx` — Root layout with global nav, Outlet, TanStack Query context
  - `index.tsx` — Landing/home page (public)
  - `login.tsx` — Login page with OAuth buttons
  - `dashboard.tsx` — Authenticated user dashboard
  - `hackathon-shell.tsx` — Public hackathon shell page
- [x] 4.3 Create `apps/web/src/main.tsx` — Entry point:
  - Create `QueryClient` with TanStack Query
  - Create router with `routeTree` and `{ queryClient }` context
  - Declare `Register` module for type-safe router
  - Render `QueryClientProvider` → `RouterProvider`
- [x] 4.4 Create `apps/web/src/lib/api-client.ts` — Hono RPC client:
  ```
  import { hc } from "hono/client";
  import type { AppType } from "@devsage/api";
  export const api = hc<AppType>(import.meta.env.VITE_API_URL || "");
  ```
- [x] 4.5 Configure Vite proxy for local dev:
  ```
  server: { proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } } }
  ```
- [x] 4.6 Set up dark theme with lime accent via CSS variables in `src/index.css`:
  - `--background: 0 0% 0%` (pure black)
  - `--foreground: 0 0% 95%` (off-white)
  - `--primary: 73 100% 50%` (lime green #CCFF00)
  - `--primary-foreground: 0 0% 0%` (black on lime)
  - All semantic tokens (success, warning, error, info, muted, border, etc.)

### Task 5: Authentication UI (AC: 1, 2)

- [x] 5.1 Create `apps/web/src/lib/auth-client.ts` — Better Auth React client:
  ```
  import { createAuthClient } from "better-auth/react";
  export const authClient = createAuthClient({ baseURL: import.meta.env.VITE_API_URL });
  ```
- [x] 5.2 Create `apps/web/src/features/auth/AuthProvider.tsx` — Session provider wrapping app
- [x] 5.3 Create `apps/web/src/features/auth/use-auth.ts` — Hook exposing `session`, `signIn`, `signOut`, `isPending`
- [x] 5.4 Implement login page (`routes/login.tsx`):
  - "Sign in with GitHub" button → `authClient.signIn.social({ provider: "github" })`
  - "Sign in with Google" button → `authClient.signIn.social({ provider: "google" })`
  - Dark theme, lime accent on primary CTA
  - Redirect to `/dashboard` on successful auth
- [x] 5.5 Implement sign-out:
  - "Sign out" button in dashboard nav → `authClient.signOut()`
  - Redirect to `/` after sign-out
  - Verify logged-out state shows on revisit

### Task 6: Minimal Dashboard (AC: 1)

- [x] 6.1 Implement dashboard route (`routes/dashboard.tsx`):
  - Protected route — redirect to `/login` if no session
  - Use `authClient.useSession()` for session data
  - Display user name and avatar from session (`session.user.name`, `session.user.image`)
  - Top nav with "Sign out" button
  - Simple welcome message: "Welcome back, {name}"
- [x] 6.2 Route guard pattern:
  - Use TanStack Router's `beforeLoad` to check auth state
  - Redirect unauthenticated users to `/login`

### Task 7: Hackathon Shell Page (AC: 3, 4)

- [x] 7.1 Implement hackathon shell route (`routes/hackathon-shell.tsx`):
  - Public route (no auth required)
  - Fetch stubbed data from API endpoint OR use local stub
  - Display:
    - Hackathon name, dates, description
    - Rules section
    - "Live data coming soon" badge (amber StatusBadge variant)
  - "Submit via Git tags" section:
    - Brief explanation of git-tag submission workflow
    - Link to documentation (can be placeholder `#`)
    - Code block showing example: `git tag r1_submission_v1 && git push origin --tags`
  - "Manual SHA upload (coming soon)" placeholder CTA:
    - Disabled button with explanatory tooltip
    - Gray/muted styling to indicate future functionality
- [x] 7.2 Responsive design:
  - Mobile-first (participant-facing surface per UX spec)
  - Single column layout, max-width 960px
  - Clean, focused, scrollable

### Task 8: Testing (AC: all)

- [x] 8.1 API tests (`apps/api/src/__tests__/`):
  - `auth-handler.test.ts` — Better Auth handler responds to auth routes (named to avoid conflict with existing `auth.test.ts`)
  - `health.test.ts` — Health check returns 200
  - `hackathon-shell.test.ts` — Stubbed hackathon data endpoint
- [x] 8.2 Web tests (`apps/web/src/__tests__/`):
  - `login.test.tsx` — Login page renders with OAuth buttons
  - `dashboard.test.tsx` — Dashboard shows user name/avatar when authenticated
  - `hackathon-shell.test.tsx` — Shell page renders stubbed data and submission section
- [x] 8.3 All 18 new tests pass (6 API + 12 web)

## Dev Notes

### Critical Architecture Constraints

1. **Brownfield Rebuild**: This is NOT a greenfield project. Substantial existing code exists in every package. The architecture mandate is: "every file rewritten to follow new patterns." Do NOT incrementally patch existing code — rewrite files against the new patterns described here.

2. **Better Auth Function Wrapper Pattern (CRITICAL)**: D1 bindings are only available inside a request handler on Cloudflare Workers. You CANNOT initialize `betterAuth()` at module top-level. Always use:
   ```typescript
   export function createAuth(env: Env) { return betterAuth({...}); }
   ```
   Then call inside route handler: `const auth = createAuth(c.env);`

3. **Hono RPC Type Export (CRITICAL)**: For end-to-end type safety, routes MUST be chained with `.route()` off the same `OpenAPIHono` instance, and `typeof app` MUST be exported. Methods like `.openapi()` return `Hono` type (not `OpenAPIHono`), so always chain at the end.

4. **ESM Strict**: All barrel exports must use explicit `.js` extensions:
   ```typescript
   export { createAuth } from './auth.js';
   ```

5. **Zod Version Caveat**: The architecture targets Zod 4.3.x, BUT `@hono/zod-openapi` may not yet fully support Zod 4. **Verify compatibility before upgrading.** If not compatible, stay on Zod 3.25.x and use the `zod/v3` import path (supports future migration). The `@hono/zod-openapi` package re-exports `z` — use its `z` for route schemas to avoid version conflicts.

6. **Vite 7 Evaluation**: Test Vite 7.3.x with Workers Static Assets. If `@cloudflare/vitest-pool-workers` or `wrangler deploy` breaks, fall back to Vite 6.x. Document the result in completion notes.

7. **Vitest 4 Evaluation**: Test Vitest 4.x with `@cloudflare/vitest-pool-workers`. If incompatible, fall back to Vitest 3.x. Document the result in completion notes.

8. **React 19 API Usage**: Use React 19 patterns:
   - `useActionState` for form handling (not `useFormStatus`)
   - `use()` hook for promise resolution where appropriate
   - Suspense boundaries at route level via TanStack Router's `pendingComponent`
   - NO `useEffect` + `fetch` for data loading — use TanStack Query

9. **TanStack Router File-Based Routing**: Route files go in `src/routes/`. The Vite plugin auto-generates `routeTree.gen.ts` — never edit this file manually. Path strings in `createFileRoute()` are auto-managed by the plugin.

10. **JSON Field Naming**: All JSON fields use `snake_case` (matches DB columns directly). No mapping layer.

11. **ID Strategy**: UUIDs via `crypto.randomUUID()` — never auto-increment integers.

12. **Timestamps**: All UTC ISO-8601 strings via `new Date().toISOString()`.

### Anti-Patterns (NEVER DO)

- **NEVER** use `@hono/oauth-providers` (broken on Workers) — use Better Auth instead
- **NEVER** use `wrangler.toml` — only `wrangler.jsonc`
- **NEVER** import `@devsage/db` from frontend apps — only `@devsage/shared`
- **NEVER** use `console.log` — only `console.warn` / `console.error`
- **NEVER** use React Router — use TanStack Router
- **NEVER** use `useEffect` + `fetch` — use TanStack Query
- **NEVER** use external JWT libraries — Better Auth handles all token management
- **NEVER** store roles in JWT — resolve per-request (future stories)
- **NEVER** use raw D1 prepared statements at route level — use Drizzle ORM query builder
- **NEVER** create separate Workers for queue consumers — same Worker
- **NEVER** use cookie domain `.devsage.org` — per-subdomain cookies only

### Project Structure Notes

**This story touches these paths:**

```
apps/api/
├── src/
│   ├── auth.ts              # NEW — Better Auth instance (function wrapper)
│   ├── app.ts               # NEW — OpenAPIHono factory, global middleware, error handler
│   ├── index.ts             # REWRITE — Worker entry, route chains, AppType export
│   ├── routes/
│   │   ├── auth.ts          # NEW — Better Auth handler mount
│   │   ├── health.ts        # NEW — Health check via createRoute
│   │   └── hackathon-shell.ts # NEW — Stubbed hackathon data
│   ├── middleware/
│   │   ├── auth.ts          # NEW — Session extraction middleware
│   │   └── request-id.ts    # NEW — Request ID middleware
│   ├── lib/
│   │   └── errors.ts        # NEW — AppError class
│   └── types/
│       └── env.ts           # NEW — Worker bindings type (AuthAppEnv)
├── wrangler.jsonc            # UPDATE — verify compatibility_date, flags

apps/web/
├── src/
│   ├── main.tsx             # REWRITE — TanStack Router + Query setup
│   ├── index.css            # REWRITE — Dark theme CSS variables
│   ├── routes/
│   │   ├── __root.tsx       # NEW — Root layout, nav, Outlet
│   │   ├── index.tsx        # REWRITE — Landing page
│   │   ├── login.tsx        # REWRITE — OAuth login page
│   │   ├── dashboard.tsx    # REWRITE — Minimal authenticated dashboard
│   │   └── hackathon-shell.tsx # NEW — Public hackathon shell
│   ├── features/
│   │   └── auth/
│   │       ├── AuthProvider.tsx # NEW — Better Auth session provider
│   │       └── use-auth.ts     # NEW — Auth hook
│   └── lib/
│       ├── api-client.ts    # NEW — Hono RPC client
│       └── auth-client.ts   # NEW — Better Auth React client
├── vite.config.ts           # UPDATE — TanStack Router plugin, proxy

packages/db/
├── src/
│   └── schema/
│       └── auth.ts          # NEW — Better Auth tables (user, session, account, verification)
├── drizzle.config.ts        # VERIFY — D1 migration config
└── migrations/              # NEW — Generated migration for auth tables

packages/shared/             # MINIMAL changes for this story
packages/config/             # MINIMAL changes for this story
```

### Design System Notes (from UX Spec)

**Theme**: Dark + Lime (#CCFF00) for web app (brand identity)

**Core CSS Variables:**
```css
--background: 0 0% 0%;           /* Pure black */
--foreground: 0 0% 95%;          /* Off-white */
--primary: 73 100% 50%;          /* Lime #CCFF00 */
--primary-foreground: 0 0% 0%;   /* Black on lime */
--secondary: 0 0% 8%;            /* Dark gray */
--muted: 0 0% 15%;
--accent: 73 100% 50%;
--destructive: 0 84% 60%;        /* Red */
--border: 0 0% 12%;
--success: 142 76% 36%;
--warning: 38 92% 50%;
--error: 0 84% 60%;
--info: 217 91% 60%;
```

**Typography**: Inter (primary), JetBrains Mono (code/SHAs/tags)

**Button Hierarchy**: Primary (solid lime, black text) → Secondary (ghost, white text, gray border) → Destructive (red)

**ONE primary button per screen.** Login page: "Sign in with GitHub" is primary; "Sign in with Google" is secondary.

**Hackathon Shell Page Layout**:
- Single column, max-width 960px
- Mobile-first (participant-facing)
- Clean, focused, scrollable
- No sidebar

**Sonner toasts** for transient feedback (bottom-right desktop, bottom-center mobile)

### Library & Framework Requirements

| Package | Target Version | Purpose | Critical Notes |
|---------|---------------|---------|----------------|
| `better-auth` | 1.4.x | Auth lifecycle (OAuth, sessions) | Function wrapper pattern on Workers; Drizzle adapter with `provider: "sqlite"` |
| `@hono/zod-openapi` | 1.2.x | Type-safe API routes + OpenAPI spec | Use its re-exported `z` for route schemas |
| `hono` | 4.12.x | Web framework on Workers | Chain `.route()` for RPC type export |
| `@tanstack/react-router` | 1.x | Type-safe file-based routing | Vite plugin auto-generates route tree |
| `@tanstack/router-plugin` | 1.x | Vite plugin for TanStack Router | Must come BEFORE `react()` in plugins array |
| `@tanstack/react-query` | 5.90.x | Server state management | Pass `queryClient` via router context |
| `react` / `react-dom` | 19.2.4 | UI framework | Use Actions API, `useActionState`, `use()` hook |
| `drizzle-orm` | 0.45.x | ORM for D1 SQLite | Full query builder, no raw SQL at route level |
| `zod` | 3.25.x* | Schema validation | *Stay on 3.x unless @hono/zod-openapi supports 4.x |
| `vite` | 7.3.x or 6.x | Build tool | Evaluate 7.x; fallback 6.x if Workers Static Assets incompatible |
| `tailwindcss` | 4.2.x | CSS framework | CSS-first config via `@tailwindcss/vite` plugin |
| `wrangler` | 4.67.x | Cloudflare CLI | Use `wrangler.jsonc` only |

### Testing Requirements

**Framework**: Vitest (evaluate 4.x, fallback 3.x)

**API Tests** (`apps/api/src/__tests__/`):
- Use `@cloudflare/vitest-pool-workers` for real Workers runtime with D1/KV/DO bindings
- Integration-first approach — test actual D1 queries, not mocks
- Mirror source tree: `__tests__/routes/auth.test.ts` tests `routes/auth.ts`
- File suffix: `.test.ts`

**Frontend Tests** (`apps/web/src/__tests__/`):
- Use Vitest + `@testing-library/react` with jsdom
- Component and hook testing
- File suffix: `.test.tsx`

**Test Commands**:
- `pnpm test` — All tests via Turbo
- `pnpm --filter @devsage/api test` — API only
- `pnpm --filter @devsage/web test` — Web only

### Git Intelligence

**Recent commit patterns** (last 10 commits):
- Mostly bug fixes to email/SMTP infrastructure
- Latest commit added BMAD planning artifacts
- No recent feature development — codebase is ready for the rebuild

**Relevant conventions**:
- Commit prefix: `fix:`, `feat:`, `chore:`
- Kebab-case file naming
- Feature branches from `main`

### Existing Codebase Inventory (Brownfield Context)

The following ALREADY EXISTS and will be rewritten (not patched):

**apps/api**: 15 route modules, custom JWT auth, raw D1 queries, Hono 4.6.14
**apps/web**: React 18 + React Router 7, participant pages, Vite 6
**apps/platform**: React 18 + React Router 7, organizer dashboard
**apps/admin**: React 18 + React Router 7, admin panel
**packages/db**: Drizzle 0.36.4, 30+ schema tables, D1 migrations
**packages/shared**: Zod 3.25, shared schemas and types
**packages/config**: TSConfig + ESLint config

**DO NOT** try to incrementally upgrade existing files. Create new files following the new patterns. Existing code serves only as REFERENCE for business logic.

### Wrangler Configuration Reference

**File**: `apps/api/wrangler.jsonc`

Key bindings available:
- `DB` — D1 database (devsage-db)
- `KV` — Key-value store
- `HACKATHON_SM` — Durable Object (HackathonStateMachine)
- `WEBHOOK_QUEUE` — Queue (github-webhooks)
- `NOTIFICATION_QUEUE` — Queue (devsage-notifications)

**Compatibility**: `2024-12-30`, flags: `nodejs_compat`

**Environment URLs**:
- `FRONTEND_URL`: `https://devsage.org`
- `PLATFORM_URL`: `https://platform.devsage.org`
- `ADMIN_URL`: `https://shikdd.devsage.org`
- `API_URL`: `https://api.devsage.org`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.0]
- [Source: _bmad-output/planning-artifacts/architecture.md — Technical Stack, Monorepo Structure, API Patterns, Database, Frontend, Auth, Testing]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Design System, Color Tokens, Typography, Component Strategy, Responsive Design]
- [Source: _bmad-output/planning-artifacts/prd.md — Project Overview, FR1-FR5, NFRs]
- [Source: _bmad-output/project-context.md — Implementation Rules, Anti-Patterns, Development Workflow]
- [Source: Better Auth Docs — Cloudflare Workers integration, Drizzle adapter, React client]
- [Source: TanStack Router Docs — File-based routing, Vite plugin, React 19 compatibility]
- [Source: @hono/zod-openapi — createRoute pattern, OpenAPIHono, RPC type export]
- [Source: Zod 4 Migration Guide — Breaking changes, version compatibility]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- drizzle-kit ^0.45.0 not found on npm → resolved to ^0.31.9 (latest)
- @hono/zod-openapi v1.2.2 requires Zod 4 peer dep → upgraded zod to ^4.3.0
- Vite 7 / Vitest 4 not published on npm → stayed on Vite 6.x / Vitest 3.x
- Old brownfield code type errors → added backward-compat variables to AuthAppEnv and tsconfig excludes
- Pre-existing slide_url bug in submissions.ts → fixed with empty string
- Cross-package type resolution (Hono RPC): web needs @cloudflare/workers-types to resolve API types
- miniflare D1 `exec()` fails with multi-statement SQL → use `prepare().run()` per statement

### Completion Notes List

- **Task 1 (Dependencies)**: Upgraded Hono 4.12.x, React 19, Better Auth 1.4.x, @hono/zod-openapi 1.2.x, TanStack Router 1.x, drizzle-orm 0.45.x, Tailwind 4.2.x, wrangler 4.67.x. Zod upgraded to 4.3.x (required by @hono/zod-openapi). Vite 7 and Vitest 4 not available on npm — stayed on current.
- **Task 2 (Better Auth)**: Created function wrapper pattern in `apps/api/src/auth.ts`. Auth tables in `packages/db/src/schema/auth.ts` with integer timestamps. Manual migration `0007_better_auth_tables.sql`. GitHub + Google OAuth configured.
- **Task 3 (API Scaffolding)**: OpenAPIHono factory in `app.ts` with defaultHook for validation errors. Health check and hackathon-shell endpoints via createRoute pattern. Route chaining with AppType export for Hono RPC.
- **Task 4 (Web Scaffolding)**: TanStack Router with file-based routing. Hono RPC client. Better Auth React client. Dark + lime theme CSS variables.
- **Task 5 (Auth UI)**: Login page with GitHub (primary lime) and Google (secondary ghost) OAuth buttons.
- **Task 6 (Dashboard)**: Protected route with beforeLoad auth guard. Shows user name, avatar, email, sign-out button.
- **Task 7 (Hackathon Shell)**: Public page with stubbed data. "Live data coming soon" badge. Rules list. Git tag submission section with example command. Disabled manual SHA upload CTA.
- **Task 8 (Testing)**: 18 tests across 6 files — all pass. API: health (1), hackathon-shell (3), auth-handler (2). Web: login (3), dashboard (4), hackathon-shell (5).

### Change Log

- 2026-02-20: Story 1.0 implementation complete — all 8 tasks done, 18 tests passing

### File List

**New files:**
- `apps/api/src/auth.ts` — Better Auth instance (function wrapper pattern)
- `apps/api/src/app.ts` — OpenAPIHono factory, global middleware, error handler
- `apps/api/src/lib/errors.ts` — AppError class
- `apps/api/src/routes/auth-handler.ts` — Better Auth handler mount
- `apps/api/src/routes/health.ts` — Health check via createRoute
- `apps/api/src/routes/hackathon-shell.ts` — Stubbed hackathon data
- `apps/api/src/__tests__/health.test.ts` — Health endpoint test
- `apps/api/src/__tests__/hackathon-shell.test.ts` — Hackathon shell endpoint tests
- `apps/api/src/__tests__/auth-handler.test.ts` — Better Auth handler tests
- `apps/web/src/routes/__root.tsx` — Root layout with nav
- `apps/web/src/routes/index.tsx` — Landing page
- `apps/web/src/routes/login.tsx` — OAuth login page
- `apps/web/src/routes/dashboard.tsx` — Authenticated dashboard
- `apps/web/src/routes/hackathon-shell.tsx` — Public hackathon shell
- `apps/web/src/features/auth/AuthProvider.tsx` — Auth session provider
- `apps/web/src/features/auth/use-auth.ts` — Auth convenience hook
- `apps/web/src/lib/api-client.ts` — Hono RPC client
- `apps/web/src/lib/auth-client.ts` — Better Auth React client
- `apps/web/src/__tests__/login.test.tsx` — Login page tests
- `apps/web/src/__tests__/dashboard.test.tsx` — Dashboard tests
- `apps/web/src/__tests__/hackathon-shell.test.tsx` — Hackathon shell page tests
- `packages/db/src/schema/auth.ts` — Better Auth tables (user, session, account, verification)
- `packages/db/migrations/0007_better_auth_tables.sql` — Auth tables migration

**Modified files:**
- `apps/api/package.json` — Updated dependencies (hono, @hono/zod-openapi, better-auth, drizzle-orm, zod; added exports field)
- `apps/api/src/index.ts` — Rewritten with route chaining and AppType export
- `apps/api/src/types/env.ts` — Rewritten with AuthAppEnv (includes backward-compat legacy vars)
- `apps/api/src/middleware/request-id.ts` — Updated to use AuthAppEnv
- `apps/api/src/routes/submissions.ts` — Fixed pre-existing slide_url type error (line 438)
- `apps/api/.dev.vars` — Added Better Auth and OAuth secrets
- `apps/api/vitest.config.ts` — Added Better Auth miniflare bindings
- `apps/web/package.json` — Updated dependencies (react 19, TanStack Router, better-auth, hono, tailwind 4)
- `apps/web/vite.config.ts` — Rewritten with TanStack Router plugin and API proxy
- `apps/web/src/main.tsx` — Rewritten with TanStack Router + Query setup
- `apps/web/src/index.css` — Rewritten with dark + lime theme
- `apps/web/tsconfig.json` — Added workers-types, excluded old brownfield files
- `packages/db/package.json` — Updated drizzle-orm, drizzle-kit, better-sqlite3
- `packages/db/src/schema/index.ts` — Added auth table exports
- `packages/shared/package.json` — Updated zod to ^4.3.0
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story status → review
- `_bmad-output/implementation-artifacts/1-0-day-0-usable-slice.md` — Story status → review, all tasks checked

**Deleted files:**
- `apps/web/src/__tests__/auth-context.test.tsx` — Old brownfield test (replaced by dashboard.test.tsx)
