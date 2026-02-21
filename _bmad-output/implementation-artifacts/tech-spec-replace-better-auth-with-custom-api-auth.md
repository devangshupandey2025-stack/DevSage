---
title: 'Replace Better Auth with Custom API Auth (OAuth + Email/Password)'
slug: 'replace-better-auth-with-custom-api-auth'
created: '2026-02-21T12:35:18.9294576+05:30'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - 'TypeScript (strict)'
  - 'Cloudflare Workers + Hono'
  - 'Cloudflare D1 (SQLite), KV, Durable Objects, Queues'
  - 'React 18 + Vite'
  - 'Tailwind CSS v4 + shadcn/ui'
  - 'Drizzle ORM schema package'
  - 'Vitest (Workers pool + jsdom)'
files_to_modify:
  - 'apps/api/src/index.ts'
  - 'apps/api/src/types/env.ts'
  - 'apps/api/src/middleware/auth.ts'
  - 'apps/api/src/middleware/platform-admin.ts'
  - 'apps/api/src/routes/hackathons.ts'
  - 'apps/api/src/routes/workspaces.ts'
  - 'apps/api/src/routes/teams.ts'
  - 'apps/api/src/routes/submissions.ts'
  - 'apps/api/src/routes/admin.ts'
  - 'apps/api/src/routes/announcements.ts'
  - 'apps/api/src/routes/invites.ts'
  - 'apps/api/src/routes/judging.ts'
  - 'apps/api/src/routes/organizers.ts'
  - 'apps/api/src/queue/notification-logic.ts'
  - 'apps/api/wrangler.jsonc'
  - 'apps/admin/src/contexts/auth-context.tsx'
  - 'apps/admin/src/lib/api.ts'
  - 'apps/admin/src/pages/login.tsx'
  - 'apps/admin/vite.config.ts'
  - 'apps/admin/package.json'
  - 'apps/platform/src/contexts/auth-context.tsx'
  - 'apps/platform/src/lib/api.ts'
  - 'apps/platform/src/pages/login.tsx'
  - 'apps/platform/src/pages/judging.tsx'
  - 'apps/platform/vite.config.ts'
  - 'apps/platform/package.json'
  - 'apps/judge/src/contexts/auth-context.tsx'
  - 'apps/judge/src/lib/api.ts'
  - 'apps/judge/src/pages/login.tsx'
  - 'apps/judge/vite.config.ts'
  - 'apps/judge/package.json'
  - 'apps/admin/.env.production'
  - 'apps/platform/.env.production'
  - 'apps/judge/.env.production'
  - 'packages/db/src/schema/index.ts'
  - 'packages/db/src/schema/*.ts (auth table refs + FK imports)'
  - 'packages/db/migrations/*'
  - 'apps/api/src/__tests__/helpers.ts'
  - 'apps/api/src/__tests__/*.test.ts (auth assumptions)'
  - 'package.json'
code_patterns:
  - 'Hono route modules mounted in apps/api/src/index.ts via app.route()'
  - 'Global middleware chain: CORS -> request-id -> optionalAuth -> error handler'
  - 'SQL-first handlers using c.env.DB.prepare(...) with typed .first/.all'
  - 'Response envelope helpers: successResponse/errorResponse/paginatedResponse'
  - 'Role resolution is DB/KV-based in middleware/role.ts (authoritative server-side)'
  - 'Audit and async side-effects via c.executionCtx.waitUntil(...)'
  - 'Cookie-session auth model exists historically (access_token + refresh_token)'
  - 'OAuth state flow via KV with TTL and redirect callbacks'
  - 'ESM .js barrel exports and strict TS types in shared/db packages'
test_patterns:
  - 'API integration tests in apps/api/src/__tests__ using SELF.fetch in Workers runtime'
  - 'Current API tests are Bearer-token + Better Auth table biased (must be refactored)'
  - 'Frontend tests use Vitest + Testing Library (example: apps/web auth-context test)'
  - 'Admin/platform/judge currently have minimal/no auth-focused tests'
---

# Tech-Spec: Replace Better Auth with Custom API Auth (OAuth + Email/Password)

**Created:** 2026-02-21T12:35:18.9294576+05:30

## Overview

### Problem Statement

Better Auth in a separate Cloudflare Worker is not working reliably for this project and introduces coupling across API and three frontend apps. The current state mixes auth models (Bearer token flow for admin/platform/judge and cookie flow for web), making implementation and testing harder.

### Solution

Move authentication fully into `apps/api` using the prior custom auth architecture: HttpOnly cookie-based sessions with custom JWT access tokens and rotating refresh tokens, plus OAuth (GitHub/Google) and email/password login. Remove Better Auth dependencies and worker integration, and restore role resolution in API middleware per request.

### Scope

**In Scope:**
- Reintroduce API-hosted auth routes in `apps/api/src/routes/auth.ts` for register, login, OAuth, refresh, logout, me, sessions management, and account deletion flow.
- Remove Better Auth worker usage and integration (`apps/auth` decommissioned).
- Migrate `apps/admin`, `apps/platform`, and `apps/judge` from Better Auth/Bearer model to cookie-based auth requests.
- Restore DB schema to custom auth model (`users`, `refresh_tokens`) with destructive reset allowed.
- Consolidate migrations into one or two clean migration files and remove manual patch migration sprawl.
- Preserve project response envelope, middleware conventions, and role model consistency.

**Out of Scope:**
- Backward compatibility with Better Auth sessions/tables/tokens.
- Non-auth feature redesign unrelated to this migration.

## Context for Development

### Codebase Patterns

- API structure is route-module based (`apps/api/src/routes/*.ts`) with centralized mounting in `apps/api/src/index.ts`.
- Middleware/auth conventions are explicit and composable; auth context is injected into `c.set('user', ...)`.
- Role checks should stay server-authoritative using `resolveRole()` and per-request DB/KV logic (not JWT-embedded role claims).
- Response shape must use project helpers (`successResponse`, `errorResponse`, `paginatedResponse`) across auth endpoints too.
- Current codebase has hybrid auth assumptions: cookie paths in web, Better Auth/Bearer in admin/platform/judge, and JWT-claim checks in some API routes.
- SQL style is direct D1 prepared statements in handlers; avoid introducing ORM-heavy auth flow in API routes.
- Critical security pattern: HttpOnly cookies with rotation + replay-detection for refresh families (historical implementation already exists).
- Breaking changes and destructive DB reset are approved, so compatibility shims are unnecessary.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `apps/api/src/index.ts` | Re-add `/auth` route mount and keep middleware chain order intact |
| `apps/api/src/middleware/auth.ts` | Switch from `Authorization: Bearer` parsing to cookie JWT validation + DB user lookup |
| `apps/api/src/middleware/role.ts` | Existing server-side role resolver to keep as source of truth |
| `apps/api/src/middleware/platform-admin.ts` | Currently depends on `user.platformAdmin` claim; must be DB-checked or derived safely |
| `apps/api/src/routes/hackathons.ts` | Uses `user.workspaceRoles[...]` from JWT claims; needs DB permission checks |
| `apps/api/src/routes/workspaces.ts` | Uses `user.workspaceRoles[...]`; needs DB permission checks |
| `apps/api/src/routes/teams.ts` | Uses `user.hackathonRoles[...]`; needs DB-backed checks |
| `apps/api/src/routes/submissions.ts` | Reads Better Auth `account` table for GitHub username; must move to custom users/oauth model |
| `apps/api/src/routes/admin.ts` | Queries `user` table and `image` field; must realign to custom `users` schema |
| `apps/api/src/routes/announcements.ts` | Joins `user` table and has `console.log` usage; must align schema/logging conventions |
| `apps/api/src/routes/invites.ts` | Joins `user` table in judge invite views |
| `apps/api/src/routes/judging.ts` | `user` joins and judge invite-by-email lookup on Better Auth table shape |
| `apps/api/src/routes/organizers.ts` | `user` joins for organizer listing |
| `apps/api/src/queue/notification-logic.ts` | Recipient resolution currently queries `user` table |
| `apps/web/src/lib/api.ts` | Canonical cookie + `/auth/refresh` retry pattern to replicate in other SPAs |
| `apps/web/src/contexts/auth-context.tsx` | Cookie auth context pattern (`/auth/me`, `/auth/logout`) |
| `apps/admin/src/lib/auth-client.ts` | Better Auth client to remove |
| `apps/platform/src/lib/auth-client.ts` | Better Auth client to remove |
| `apps/judge/src/lib/auth-client.ts` | Better Auth client to remove |
| `apps/admin/src/contexts/auth-context.tsx` | Replace Better Auth session + `/token` JWT decode flow |
| `apps/platform/src/contexts/auth-context.tsx` | Replace Better Auth session + `/token` JWT decode flow |
| `apps/judge/src/contexts/auth-context.tsx` | Replace Better Auth session + `/token` JWT decode flow |
| `apps/admin/src/lib/api.ts` | Remove Bearer token injection and move to `credentials: 'include'` |
| `apps/platform/src/lib/api.ts` | Remove Bearer token injection and move to `credentials: 'include'` |
| `apps/judge/src/lib/api.ts` | Remove Bearer token injection and move to `credentials: 'include'` |
| `apps/admin/vite.config.ts` | Proxy currently points `/api/auth` -> auth worker; must route `/auth` to API worker |
| `apps/platform/vite.config.ts` | Same proxy migration as admin |
| `apps/judge/vite.config.ts` | Same proxy migration as admin |
| `apps/api/src/types/env.ts` | Remove Better Auth-era fields (`AUTH_URL` claim expectations) and reshape `UserContext` |
| `apps/api/wrangler.jsonc` | Remove `AUTH_URL` var; ensure OAuth/auth vars are API-centric |
| `apps/auth/*` | Better Auth worker to decommission/remove from workspace and deploy scripts |
| `package.json` | Remove auth-worker deploy scripts once `apps/auth` is removed |
| `packages/db/src/schema/index.ts` | Replace Better Auth exports with custom auth exports (`users`, `refreshTokens`, etc.) |
| `packages/db/src/schema/auth-*.ts` | Remove/deprecate Better Auth schema files |
| `packages/db/src/schema/users.ts` | Recreate consolidated custom users schema for OAuth + email/password |
| `packages/db/src/schema/refresh-tokens.ts` | Recreate rotating token family table |
| `packages/db/src/schema/deletion-requests.ts` | Required by account deletion endpoints |
| `packages/db/src/schema/*` | All files importing `auth-user.ts` must be updated to `users.ts` FK references |
| `packages/db/migrations/meta/_journal.json` | Currently does not track 0005-0008; migration history is inconsistent |
| `packages/db/migrations/0003_email_password_auth.sql` | Best destructive baseline for custom auth reset |
| `packages/db/migrations/0005_announcements.sql` | Manual add-on to fold into consolidated migration |
| `packages/db/migrations/0006_round_initialization.sql` | Manual add-on to fold into consolidated migration |
| `apps/api/src/__tests__/helpers.ts` | Currently bootstraps Better Auth tables + Bearer auth helpers; must realign |
| `git:eddc92c:apps/api/src/routes/auth.ts` | Historical email/password + refresh/session implementation baseline |
| `git:dd924ff:apps/api/src/routes/auth.ts` | Historical OAuth implementation baseline |
| `git:dd924ff:apps/api/src/lib/oauth.ts` | Historical OAuth provider exchange/state helpers |
| `git:dd924ff:apps/api/src/lib/user-service.ts` | Historical OAuth user upsert/link behavior |

### Technical Decisions

- Authentication lives only in `apps/api` (single worker model).
- Session model is cookie-based with short-lived access JWT and rotating refresh tokens.
- API remains source of truth for role checks; roles are resolved per request, not embedded as authoritative client state.
- Admin/platform/judge frontends will use `credentials: 'include'` pattern instead of Better Auth client SDK.
- Migration strategy is destructive reset because environment is non-production and wipe is approved.
- Prioritize clean API structure and consistent module boundaries over compatibility shims.
- No single historical revision contains both OAuth and email/password simultaneously; implementation must merge two validated historical tracks:
  - OAuth flow baseline from `dd924ff`
  - Email/password + refresh/session baseline from `eddc92c`
- Current API authorization has JWT-claim coupling in `hackathons.ts`, `workspaces.ts`, `teams.ts`; these checks must be rewritten to DB-backed checks to match custom auth and avoid client-claim trust.
- `user` (Better Auth) vs `users` (custom) table naming impacts many SQL joins and selected columns (`image` vs `avatar_url`); this is a cross-cutting refactor surface.
- Better Auth worker decommission includes code, dependencies, workspace/deploy scripts, env vars, and dev proxy rewiring.
- Migration consolidation target is 1-2 files with deterministic destructive reset; manual patch migrations (`0005+`) must be folded into consolidated baseline.

## Implementation Plan

### Tasks

- [ ] Task 1: Decommission Better Auth worker and workspace-level references
  - File: `apps/auth/package.json`
  - Action: Remove `apps/auth` worker package from active project (or archive/remove directory per repo policy).
  - Notes: This is a breaking change; do not retain runtime coupling to `auth.devsage.org`.
  - File: `package.json`
  - Action: Remove `deploy:auth`, `deploy:auth:secrets`, and any `deploy:all` dependency on auth worker.
  - Notes: Keep API/web/platform/admin/judge deploy scripts intact.

- [ ] Task 2: Replace DB schema exports from Better Auth model to custom auth model
  - File: `packages/db/src/schema/index.ts`
  - Action: Remove Better Auth exports (`user`, `session`, `account`, `verification`, `twoFactor`, `passkey`, `jwks`) and export custom tables (`users`, `refreshTokens`, `deletionRequests`).
  - Notes: Preserve business-table exports and `.js` extensions.
  - File: `packages/db/src/schema/users.ts`
  - Action: Implement consolidated `users` schema supporting both OAuth and email/password (`email`, `name/display`, `password_hash`, `github_id`, `github_username`, `google_id`, `avatar_url`, timestamps).
  - Notes: Use one table only; avoid dual identity tables.
  - File: `packages/db/src/schema/refresh-tokens.ts`
  - Action: Implement rotating refresh-token family schema with hash, family id, revoked/expiry timestamps, indexes.
  - Notes: Must support replay detection logic.
  - File: `packages/db/src/schema/deletion-requests.ts`
  - Action: Ensure account-deletion confirmation table exists and is exported.
  - Notes: Keep confirmation token uniqueness and user FK.

- [ ] Task 3: Rewrite schema FKs and SQL assumptions from `user` to `users`
  - File: `packages/db/src/schema/*.ts` (all files currently importing `./auth-user.js`)
  - Action: Switch FK imports/references to `./users.js`; align FK column references.
  - Notes: This is a large mechanical refactor; maintain existing cascade semantics.
  - File: `apps/api/src/routes/admin.ts`
  - Action: Replace `user` table and `image` column usage with `users` table and `avatar_url`.
  - Notes: Keep response payload compatibility for consuming frontends.
  - File: `apps/api/src/routes/announcements.ts`
  - Action: Replace joins on `user` with `users`, map avatar field, remove `console.log` calls.
  - Notes: Use `console.warn`/`console.error` only where required.
  - File: `apps/api/src/routes/invites.ts`
  - Action: Replace joins on `user` with `users`.
  - Notes: Keep invite token and status behavior unchanged.
  - File: `apps/api/src/routes/judging.ts`
  - Action: Replace `user` joins/lookups with `users`; ensure invite-by-email lookup uses `users.email`.
  - Notes: Preserve judge assignment/scoring behavior.
  - File: `apps/api/src/routes/organizers.ts`
  - Action: Replace `user` joins with `users`.
  - Notes: Keep organizer role semantics unchanged.
  - File: `apps/api/src/routes/teams.ts`
  - Action: Replace `user` joins with `users`.
  - Notes: Maintain role field and membership ordering.
  - File: `apps/api/src/routes/workspaces.ts`
  - Action: Replace `user` joins with `users`.
  - Notes: Keep member listing payload shape stable.
  - File: `apps/api/src/queue/notification-logic.ts`
  - Action: Replace recipient queries from `user` to `users`.
  - Notes: Ensure all notification types still resolve recipients.

- [ ] Task 4: Consolidate migrations into 1-2 deterministic destructive files
  - File: `packages/db/migrations/0000_*.sql` (new consolidated baseline)
  - Action: Create a single full-reset migration that drops and recreates the complete schema in custom-auth shape.
  - Notes: Merge relevant content from `0003_email_password_auth.sql`, `0005_announcements.sql`, and `0006_round_initialization.sql`.
  - File: `packages/db/migrations/0001_*.sql` (optional second file)
  - Action: Keep only a minimal seed/dev-data migration if needed.
  - Notes: Do not split schema logic across many manual patch files.
  - File: `packages/db/migrations/0002_v3_clean_reset.sql`
  - Action: Remove or archive superseded migration files that conflict with consolidated baseline.
  - Notes: Keep repo history clean and deterministic for fresh environments.
  - File: `packages/db/migrations/meta/_journal.json`
  - Action: Regenerate/realign migration journal with final 1-2 migration files.
  - Notes: Avoid orphaned migrations and drift.

- [ ] Task 5: Restore custom auth libraries in API and merge OAuth + email/password tracks
  - File: `apps/api/src/lib/jwt.ts`
  - Action: Implement custom HMAC JWT sign/verify with 15-minute expiry payload containing `sub` and token family id.
  - Notes: Use `crypto.subtle`; no external JWT library.
  - File: `apps/api/src/lib/refresh-token.ts`
  - Action: Implement token creation, hashing, rotation, family revoke, and replay detection with grace window.
  - Notes: Match existing project conventions and UTC timestamps.
  - File: `apps/api/src/lib/password.ts`
  - Action: Implement Worker-safe PBKDF2 hash/verify for email/password.
  - Notes: Keep constant-time verification behavior.
  - File: `apps/api/src/lib/cookies.ts`
  - Action: Implement access/refresh cookie setters and clearers for API-domain cookie model.
  - Notes: Refresh cookie path should remain `/auth/refresh`.
  - File: `apps/api/src/lib/oauth.ts`
  - Action: Restore OAuth provider URL generation, state storage/consume, token exchange, profile fetchers.
  - Notes: Keep 10-second timeout fail-fast behavior.
  - File: `apps/api/src/lib/user-service.ts`
  - Action: Restore OAuth upsert/link functions against consolidated `users` schema.
  - Notes: Support GitHub account creation and Google linking semantics.
  - File: `apps/api/src/types/auth.ts`
  - Action: Restore JWT payload type contract for custom auth libs.
  - Notes: Keep strict typing for claims.

- [ ] Task 6: Reintroduce `/auth` route in API with full endpoint set
  - File: `apps/api/src/routes/auth.ts`
  - Action: Implement endpoints: `/register`, `/login`, `/google`, `/github`, `/callback/google`, `/callback/github`, `/refresh`, `/logout`, `/me`, `/sessions`, `/sessions/:familyId`, `/sessions`, `/delete-account`, `/delete-account/confirm`.
  - Notes: Merge OAuth behavior from `dd924ff` and email/password/session behavior from `eddc92c`; no Better Auth dependencies.
  - File: `apps/api/src/index.ts`
  - Action: Mount `app.route('/auth', auth)` and keep current route ordering + middleware chain.
  - Notes: Ensure no route conflicts with `/api/v1/*`.

- [ ] Task 7: Convert API auth middleware and user context back to cookie-based server auth
  - File: `apps/api/src/middleware/auth.ts`
  - Action: Replace Bearer extraction with `access_token` cookie parsing + JWT verify + DB user fetch.
  - Notes: `optionalAuth` should remain non-blocking; `authMiddleware` returns 401 envelope.
  - File: `apps/api/src/types/env.ts`
  - Action: Reshape `UserContext` to custom auth fields and remove Better Auth claim-dependent fields.
  - Notes: Remove `AUTH_URL` binding from type contract.
  - File: `apps/api/wrangler.jsonc`
  - Action: Remove unused `AUTH_URL` var and keep only API-centric auth vars.
  - Notes: Preserve existing non-auth bindings.

- [ ] Task 8: Remove JWT-claim authorization coupling; use DB-backed permission checks
  - File: `apps/api/src/middleware/platform-admin.ts`
  - Action: Replace `user.platformAdmin` trust with DB lookup on `platform_admins` for current user id.
  - Notes: Keep 401 vs 403 semantics unchanged.
  - File: `apps/api/src/routes/hackathons.ts`
  - Action: Replace `user.workspaceRoles[workspaceId]` checks with DB membership/role checks.
  - Notes: Preserve owner/admin gating and existing error codes.
  - File: `apps/api/src/routes/workspaces.ts`
  - Action: Replace `workspaceRoles` claim checks with DB membership role checks.
  - Notes: Preserve owner-only removal behavior.
  - File: `apps/api/src/routes/teams.ts`
  - Action: Replace fallback organizer checks from `user.hackathonRoles` claims with DB role query or middleware-based role resolution.
  - Notes: Keep team-lead override behavior.

- [ ] Task 9: Refactor GitHub repository lookup away from Better Auth `account` table
  - File: `apps/api/src/routes/submissions.ts`
  - Action: Replace `SELECT username FROM account ...` with lookup from custom user GitHub fields (or explicit integration table if added in schema task).
  - Notes: Preserve `/github/repos` endpoint contract and error semantics.

- [ ] Task 10: Migrate admin/platform/judge clients to cookie auth flow
  - File: `apps/admin/src/lib/api.ts`
  - Action: Remove token getter/Bearer header logic; send `credentials: 'include'`; add `/auth/refresh` retry-on-401 pattern.
  - Notes: Mirror `apps/web/src/lib/api.ts`.
  - File: `apps/platform/src/lib/api.ts`
  - Action: Same cookie-auth API wrapper conversion as admin.
  - Notes: Keep error handling envelope expectations.
  - File: `apps/judge/src/lib/api.ts`
  - Action: Same cookie-auth API wrapper conversion as admin.
  - Notes: Maintain redirect-to-login behavior on auth failure.
  - File: `apps/admin/src/contexts/auth-context.tsx`
  - Action: Replace Better Auth session flow with `/auth/me` bootstrap and `/auth/logout` action.
  - Notes: Compute `isPlatformAdmin` and `isOrganizer` from `/auth/me` response shape.
  - File: `apps/platform/src/contexts/auth-context.tsx`
  - Action: Replace Better Auth session flow with `/auth/me` bootstrap and `/auth/logout`.
  - Notes: Provide `hackathonRoles`/`workspaceRoles` only if needed by UI; avoid JWT decoding.
  - File: `apps/judge/src/contexts/auth-context.tsx`
  - Action: Replace Better Auth session flow with `/auth/me` bootstrap and `/auth/logout`.
  - Notes: Derive `isJudge` from role data returned by `/auth/me`.
  - File: `apps/admin/src/pages/login.tsx`
  - Action: Submit credentials to `/auth/login` via API helper instead of `signIn.email`.
  - Notes: Keep visual design unchanged.
  - File: `apps/platform/src/pages/login.tsx`
  - Action: Submit credentials to `/auth/login` and preserve redirect behavior.
  - Notes: Keep query-param redirect semantics.
  - File: `apps/judge/src/pages/login.tsx`
  - Action: Submit credentials to `/auth/login` and preserve redirect behavior.
  - Notes: Keep invite redirect compatibility.
  - File: `apps/platform/src/pages/judging.tsx`
  - Action: Remove assumptions tied to token refresh API semantics; ensure role refresh uses `/auth/me` refresh path.
  - Notes: Keep judge UX unchanged.

- [ ] Task 11: Remove Better Auth client code, dependencies, and env/proxy settings from frontends
  - File: `apps/admin/src/lib/auth-client.ts`
  - Action: Remove file and imports.
  - Notes: Ensure no residual references.
  - File: `apps/platform/src/lib/auth-client.ts`
  - Action: Remove file and imports.
  - Notes: Ensure no residual references.
  - File: `apps/judge/src/lib/auth-client.ts`
  - Action: Remove file and imports.
  - Notes: Ensure no residual references.
  - File: `apps/admin/package.json`
  - Action: Remove `better-auth` and `@better-auth/passkey` dependencies.
  - Notes: Reinstall lockfile after dependency cleanup.
  - File: `apps/platform/package.json`
  - Action: Remove `better-auth` and `@better-auth/passkey`.
  - Notes: Keep all other deps unchanged.
  - File: `apps/judge/package.json`
  - Action: Remove `better-auth` and `@better-auth/passkey`.
  - Notes: Keep all other deps unchanged.
  - File: `apps/admin/vite.config.ts`
  - Action: Replace `/api/auth` proxy target with `/auth` -> `http://localhost:8787`.
  - Notes: Align with web app proxy style.
  - File: `apps/platform/vite.config.ts`
  - Action: Same proxy migration.
  - Notes: Ensure both `/api/v1` and `/auth` are proxied to API worker.
  - File: `apps/judge/vite.config.ts`
  - Action: Same proxy migration.
  - Notes: Ensure consistent local dev.
  - File: `apps/admin/.env.production`
  - Action: Remove `VITE_AUTH_URL`; keep `VITE_API_ORIGIN`.
  - Notes: Auth is now API-hosted.
  - File: `apps/platform/.env.production`
  - Action: Remove `VITE_AUTH_URL`.
  - Notes: Auth is now API-hosted.
  - File: `apps/judge/.env.production`
  - Action: Remove `VITE_AUTH_URL`.
  - Notes: Auth is now API-hosted.

- [ ] Task 12: Rebuild and realign tests to custom auth model
  - File: `apps/api/src/__tests__/helpers.ts`
  - Action: Replace Better Auth table bootstrap (`user/account/session`) with custom auth bootstrap (`users/refresh_tokens`); replace Bearer helper with cookie helper for auth-required endpoints.
  - Notes: Keep shared seeding utilities and role fixtures.
  - File: `apps/api/src/__tests__/auth.test.ts`
  - Action: Restore or recreate auth integration tests for register/login/oauth/refresh/logout/me/sessions/delete flows.
  - Notes: Include cookie assertions.
  - File: `apps/api/src/__tests__/*.test.ts` (route suites relying on Authorization header helpers)
  - Action: Update request helper usage to custom auth mechanism and new schema naming.
  - Notes: Prioritize tests touching auth/role/membership boundaries.
  - File: `apps/web/src/__tests__/auth-context.test.tsx`
  - Action: Use as baseline pattern for admin/platform/judge auth-context tests.
  - Notes: Add equivalent tests in each app if absent.

- [ ] Task 13: Update operational docs/config references and finalize rollout consistency
  - File: `apps/api/CLAUDE.md`
  - Action: Remove statements describing auth-worker token validation architecture.
  - Notes: Document API-hosted custom auth model.
  - File: `docs/api-contracts.md`
  - Action: Confirm auth routes, flow, and middleware descriptions match restored implementation.
  - Notes: Keep envelope and rate-limit details accurate.
  - File: `docs/architecture-api.md`
  - Action: Remove Better Auth worker architecture references and update auth section.
  - Notes: Ensure state-machine and middleware docs remain intact.
  - File: `apps/api/.env.production`
  - Action: Remove Better Auth-specific vars and keep only custom auth/OAuth secrets.
  - Notes: Secrets rotation handled outside git-tracked files.
  - File: `apps/api/src/types/env.ts`
  - Action: Ensure env type and runtime vars are aligned with final wrangler config and secrets.
  - Notes: Prevent drift between type layer and deployment config.

### Acceptance Criteria

- [ ] AC 1: Given a new user submits valid email/password to `/auth/register`, when the request succeeds, then the API creates a `users` row and sets `access_token` + `refresh_token` HttpOnly cookies.
- [ ] AC 2: Given valid credentials on `/auth/login`, when authentication succeeds, then the API updates `last_login_at` and returns success envelope with cookies set.
- [ ] AC 3: Given invalid credentials on `/auth/login`, when authentication fails, then the API returns `401 INVALID_CREDENTIALS` without setting auth cookies.
- [ ] AC 4: Given a valid refresh cookie on `/auth/refresh`, when rotation succeeds, then old refresh token is revoked, a new family token is issued, and access cookie is renewed.
- [ ] AC 5: Given a replayed/revoked refresh token, when `/auth/refresh` is called, then the API rejects with auth error and clears auth cookies.
- [ ] AC 6: Given an authenticated user calls `/auth/logout`, when request completes, then family tokens are revoked and auth cookies are cleared.
- [ ] AC 7: Given OAuth login via `/auth/google` or `/auth/github`, when callback succeeds, then user identity is upserted/linked in `users` and cookie session is established.
- [ ] AC 8: Given missing/invalid OAuth state in callback, when callback is invoked, then the API rejects with deterministic auth error and no session cookies.
- [ ] AC 9: Given admin/platform/judge/web frontends submit requests after migration, when API calls occur, then requests use `credentials: 'include'` and no Bearer token header dependency remains.
- [ ] AC 10: Given `apps/admin`, `apps/platform`, `apps/judge` login pages, when user logs in successfully, then they route to app dashboard using API-hosted `/auth/login`.
- [ ] AC 11: Given protected routes in admin/platform/judge, when `/auth/me` indicates insufficient role, then UI shows access denied state and not protected content.
- [ ] AC 12: Given API routes that previously trusted JWT role claims (`hackathons/workspaces/teams`), when permissions are evaluated, then authorization comes from DB-backed checks and cannot be spoofed by client claims.
- [ ] AC 13: Given API SQL joins for users, when routes run after migration, then all user lookups use `users` schema and expected avatar/name/email fields map correctly.
- [ ] AC 14: Given `apps/api/src/routes/submissions.ts`, when `/github/repos` is called, then GitHub username lookup works without Better Auth `account` table.
- [ ] AC 15: Given migration reset on fresh DB, when migrations run, then schema converges correctly using 1-2 consolidated migration files and excludes Better Auth tables.
- [ ] AC 16: Given workspace scripts and deploy commands, when project scripts execute, then no auth-worker deploy command remains and build/test scripts pass without `apps/auth`.
- [ ] AC 17: Given API integration tests, when test suite runs, then auth-related tests pass using custom cookie/session model and updated schema helpers.
- [ ] AC 18: Given frontend builds for admin/platform/judge/web, when production builds run, then there are no unresolved imports to `better-auth` or `auth-client.ts`.
- [ ] AC 19: Given CORS and cookie settings, when requests originate from allowed frontends, then cross-origin credentialed auth works for `/auth/*` and `/api/v1/*`.
- [ ] AC 20: Given docs and type definitions are updated, when developers reference auth architecture, then documentation and runtime config consistently describe API-hosted custom auth.

## Additional Context

### Dependencies

- Runtime dependencies:
- `hono`, `drizzle-orm`, `@devsage/db`, `@devsage/shared` in API worker.
- Web Crypto API (`crypto.subtle`) for JWT + password hashing.
- KV binding for OAuth state and rate-limiting keys.
- D1 tables: `users`, `refresh_tokens`, `platform_admins`, `organizer_roles`, `workspace_members`, `team_members`, and related business entities.
- External services:
- GitHub OAuth endpoints + user profile/email APIs.
- Google OAuth token + userinfo endpoints.
- SMTP remains independent for notifications/account flows where needed.
- Internal dependencies/order:
- DB schema reset and migration consolidation must land before API route/middleware refactors.
- API auth route/middleware conversion must land before frontend client migration.
- Frontend auth-context and API wrapper conversion must land before deleting Better Auth dependencies/files.
- Test helper refactor depends on finalized schema/auth API behavior.

### Testing Strategy

- API automated tests:
- Add/restore integration tests for `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/sessions`, `/auth/delete-account*`, and OAuth callback error branches.
- Update route tests that currently rely on `Authorization: Bearer` helper to cookie/session-based auth helper.
- Validate role-protected routes (`admin`, `workspaces`, `hackathons`, `teams`, `judging`) with DB-backed permission checks.
- DB/migration tests:
- Run fresh migration on empty D1 database and verify expected tables/indexes exist, Better Auth tables absent.
- Run destructive reset path in dev and verify boot sequence (seed + API tests) remains deterministic.
- Frontend automated tests:
- Add auth-context tests for admin/platform/judge mirroring `apps/web` pattern (`/auth/me` success and 401 behavior).
- Add API wrapper tests for 401 -> `/auth/refresh` -> retry flow in admin/platform/judge.
- Manual verification matrix:
- Admin login/logout and admin-only route access.
- Organizer login/logout, hackathon create/update, and workspace permission checks.
- Judge login/logout, invite acceptance, and scoring access.
- OAuth login flow for GitHub + Google end-to-end (dev/prod callback URLs).
- Cookie behavior: set/refresh/clear across app domains with `credentials: include`.
- Non-regression checks:
- `pnpm lint`, `pnpm typecheck`, `pnpm test` at repo level.
- Targeted API tests: `pnpm --filter @devsage/api test`.
- Frontend builds: `pnpm --filter @devsage/admin build`, `pnpm --filter @devsage/platform build`, `pnpm --filter @devsage/judge build`, `pnpm --filter @devsage/web build`.

### Notes

- High-risk items:
- OAuth + email/password histories come from different commits and require careful merge to avoid regressions.
- Cross-cutting table rename (`user` -> `users`) touches many routes and queue logic; missing one query causes runtime errors.
- Cookie/CORS behavior across multiple subdomains can break silently if domain/path/samesite settings drift.
- Permissions risk exists during removal of JWT-embedded role claims; DB checks must preserve existing authorization semantics.
- Migration risk is high due to inconsistent journal/manual files; consolidated reset must be validated from scratch.
- Known limitations (accepted):
- Backward compatibility with Better Auth sessions/tables is intentionally not supported.
- Existing environments will be wiped/reset as approved.
- Future considerations (out of scope for this change set):
- Optional second-factor auth can be reintroduced later as custom flow if needed.
- Dedicated auth service can be revisited only if Workers compatibility problems are resolved and complexity budget allows.
- Session management UX can be expanded in frontends after baseline rollback stabilizes.
