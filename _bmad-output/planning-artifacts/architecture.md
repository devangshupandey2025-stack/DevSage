---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-19'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-DevSage-2026-02-18.md
  - _bmad-output/project-context.md
  - docs/index.md
  - docs/project-overview.md
  - docs/architecture-api.md
  - docs/architecture-frontends.md
  - docs/api-contracts.md
  - docs/backend-frontend-integration.md
  - docs/data-models.md
  - docs/development-guide.md
  - docs/integration-architecture.md
  - docs/source-tree-analysis.md
workflowType: 'architecture'
project_name: 'DevSage'
user_name: 'Srijan'
date: '2026-02-19'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

87 functional requirements across 10 capability domains:

| Domain | FRs | Architectural Significance |
|--------|-----|---------------------------|
| **Identity & Access** | FR1–FR10 | Three auth methods (GitHub OAuth, Google OAuth, email/password+OTP), dual-token session management, account deletion with anonymization, co-organizer scoped permissions |
| **Workspace & Subscription** | FR11–FR17 | Multi-tenant workspace model, 3-tier subscription enforcement, workspace-level data isolation, leadership continuity design |
| **Hackathon Lifecycle** | FR18–FR26 | 5-state Durable Object state machine, admin approval workflow, multi-round configuration with per-round deadlines/tag patterns/rubrics, hackathon cloning |
| **Team & Participation** | FR27–FR33 | Team formation via invite codes, GitHub App repo linking, team size enforcement, membership lock after deadline |
| **Submission Pipeline** | FR34–FR43 | Git-tag webhook ingestion (HMAC verification, idempotent processing, DLQ), server-side timestamps, late detection, force-push/tag-deletion flagging, manual reconciliation, manual commit SHA upload fallback, real-time submission confirmations (toast/SSE) |
| **Judging & Scoring** | FR44–FR59 | Weighted rubric per round, round-robin auto-assignment, draft/final scoring states, elimination gates, real-time progress tracking, conflict-of-interest workflow, anomaly detection |
| **Platform Administration** | FR60–FR64 | Creation request queue with approve/defer/request-info workflow, platform-wide monitoring, admin privilege layer separate from per-hackathon roles |
| **Notifications** | FR65–FR71 | Multi-channel (email + in-app), 7+ notification types, configurable deadline reminders, OTP delivery |
| **Participant Sites** | FR72–FR78 | Template-based per-hackathon site generation, subdomain deployment, custom domain support (Max tier), public access without auth |
| **Audit & Compliance** | FR79–FR87 | SHA-256 hash-chained audit events, per-hackathon scoping, DPDPA consent, UTC deadline storage with timezone display, CSV/PDF export |

**Non-Functional Requirements:**

| Category | Key Targets | Architectural Impact |
|----------|------------|---------------------|
| **Performance** | Webhook pipeline p95 <30s, API reads p95 <200ms, writes p95 <500ms, leaderboard refresh <5s, frontend budgets: participant FCP <2s, platform FCP <3s, admin FCP <5s (cold) | Edge compute (Workers), D1 single-query reads, KV caching for leaderboards, async queue processing, CI Lighthouse + bundle budgets per app, RUM dashboards (Workers Analytics/Sentry) with alerts on budget regressions |
| **Security** | 15-min JWT + 30-day rotating refresh tokens, HMAC webhook verification, per-subdomain cookies, tiered rate limiting | Custom crypto.subtle JWT (no external libs), KV-backed rate limiter, webhook staleness rejection |
| **Reliability** | Zero silent submission loss, idempotent webhook processing, DLQ with alerting, manual reconciliation | delivery_id uniqueness enforcement, queue retry policies, reconciliation endpoint |
| **Scalability** | Year 1: 10-15 concurrent hackathons, ~120 webhooks/15min peak; Year 2: 50 hackathons, ~750 webhooks/15min | Cloudflare Workers auto-scaling, D1 read-heavy pattern, per-hackathon DO isolation |

**Scale & Complexity:**

- **Primary domain:** Full-stack edge-native SaaS (Cloudflare Workers ecosystem)
- **Complexity level:** High — multi-tenant with domain-specific integrity requirements, 36 DB tables, 90+ endpoints, 4 deployment surfaces, per-hackathon participant sites
- **Estimated architectural components:** ~15 (API Worker, 3 frontend SPAs, 3 shared packages, Durable Object, 2 queue consumers, cron handler, webhook pipeline, participant site template, GitHub App integration, email service)

### Technical Constraints & Dependencies

| Constraint | Source | Impact |
|-----------|--------|--------|
| **Cloudflare Workers runtime** | Platform choice | No Node.js APIs (use Web APIs only), D1 SQLite (not Postgres), KV eventual consistency, DO single-threaded per ID |
| **D1 write serialization** | D1 architecture | Single writer per database — mitigated by read-heavy access pattern, but burst writes near deadlines need monitoring |
| **GitHub webhook delivery** | GitHub platform | Not exactly-once; handlers must be idempotent. Retries up to 3 days. Rate limit: 5,000 req/hr per installation |
| **No external JWT libraries** | Project convention | Custom HMAC SHA-256 via crypto.subtle — intentional to avoid Workers-incompatible deps |
| **Per-subdomain cookies** | Security architecture | Cannot use wildcard .devsage.org domain — each app (api, web, platform, admin) manages cookies independently |
| **ESM strict with .js extensions** | Project convention | All barrel exports require explicit .js extension — enforced across all packages |
| **Drizzle ORM for schema, raw D1 for queries** | Project convention | Schema definitions via Drizzle, but route-level queries use raw prepared statements |
| **Brownfield codebase** | Existing implementation | 36 tables, 90+ endpoints, 3 frontend apps already exist — architecture must align with existing patterns or explicitly propose changes |

### Cross-Cutting Concerns Identified

1. **Authentication & Session Management** — Spans all 4 apps + API. Three auth methods converge to unified dual-token session. Per-subdomain cookie scoping means each frontend handles auth independently via shared pattern (AuthContext + apiRequest wrapper).

2. **Per-Request Role Resolution** — Affects every authenticated API endpoint. 6-tier hierarchy resolved via UNION query against organizer_roles, judges, team_members, workspace_members tables. Cached in KV (60s TTL). Must NOT be stored in JWT.

3. **Audit Trail Integrity** — Every mutation across all routes must call insertAuditEvent() with hash-chain continuity. Actor attribution (user/bot/system/cron) must be deterministic. Audit data survives account deletion via anonymized references.

4. **Multi-Tenant Data Isolation** — All queries must be scoped by workspace_id or hackathon_id. No cross-workspace data leakage in any endpoint, query, or analytics view. Role resolution is per-hackathon, not global.

5. **Subscription Tier Enforcement** — Feature gating (co-organizers, custom domains, audit logs, deadline reminders, participant sites) must be checked at middleware/handler level based on workspace subscription status.

6. **Webhook Pipeline Reliability** — The submission pipeline (HMAC verify → normalize → enqueue → process → record) must guarantee no silent data loss. Idempotency via delivery_id, DLQ for failures, manual reconciliation as safety net.

7. **Notification Orchestration** — 7+ notification types across email and in-app channels. Idempotent delivery, configurable per-hackathon per-user preferences, fail-open SMTP with retry.

8. **Timezone-Sensitive Deadline Enforcement** — All deadlines stored UTC, displayed IST. Server-side receipt time is authoritative for late detection. Cron-based reminder system checks hourly.

## Technology Foundation & Stack Evaluation

### Primary Technology Domain

Full-stack edge-native SaaS on Cloudflare Workers ecosystem — optimized Turborepo + pnpm monorepo.

### Brownfield Assessment

This is a brownfield project with substantial existing infrastructure: 36 DB tables, 90+ API endpoints, 3 frontend SPAs, and a proven deployment pipeline. The architectural rebuild preserves the **stack choices** (which are sound) while upgrading all packages and rearchitecting code quality, patterns, and conventions.

**Approach:** Keep → Upgrade → Rebuild

- **Keep** the Cloudflare Workers ecosystem, React SPAs, Turborepo monorepo, and core library choices
- **Upgrade** all packages to latest compatible versions
- **Rebuild** code within the optimized architecture — every file rewritten to follow the new patterns

### Version Analysis & Upgrade Plan

| Package | Current | Latest | Action | Risk | Notes |
|---------|---------|--------|--------|------|-------|
| TypeScript | 5.9.3 | 5.9.3 | ✅ Current | None | Already latest |
| Hono | 4.6.14 | 4.12.0 | ⬆️ Upgrade | Low | Minor bumps within v4, backward compatible |
| React | 18.3.1 | 19.2.4 | ⬆️ Major Upgrade | Medium | React 19: improved Suspense, transitions, use() hook, Actions API |
| Vite | 6.0.0 | 7.3.1 | ⚠️ Evaluate | Medium | Major version — verify Workers Static Assets compatibility, requires Node ≥20.19 or ≥22.12 |
| Tailwind CSS | 4.0.0 | 4.2.0 | ⬆️ Upgrade | Low | Minor improvements to v4 engine |
| Drizzle ORM | 0.36.4 | 0.45.1 | ⬆️ Upgrade | Low–Medium | Significant D1 improvements, new relational query features |
| TanStack Query | 5.90.21 | 5.90.21 | ✅ Current | None | Already latest |
| React Router | 7.0.0 | 7.13.0 | ⬆️ Upgrade | Low | Minor improvements, better type safety |
| Vitest | 3.2.4 | 4.0.18 | ⚠️ Evaluate | Medium–High | Major version — must verify @cloudflare/vitest-pool-workers compatibility |
| Wrangler | 4.63.0 | 4.67.0 | ⬆️ Upgrade | Low | Minor bumps, latest Worker features |

### Technology Decisions Summary

**Keep (architecturally sound choices):**

- **Hono on Cloudflare Workers** — Best-in-class Workers framework. No better alternative exists
- **React + Vite SPAs** — Correct pattern for Workers Static Assets deployment
- **Drizzle ORM + D1** — Only production-grade ORM with native D1 support
- **Zod** — Standard for runtime validation + type inference
- **TanStack React Query** — Best server-state management for React
- **Tailwind CSS v4** — CSS-first configuration, excellent DX
- **Radix UI + shadcn/ui** — Proven headless + styled component pattern
- **Turborepo + pnpm** — Optimal monorepo tooling for this structure
- **Custom JWT via crypto.subtle** — Correct for Workers (no Node.js crypto)
- **Per-subdomain cookies** — Security-correct approach for multi-app auth

**Upgrade to latest (low risk):**

- Hono → 4.12.x, Tailwind → 4.2.x, Drizzle → 0.45.x, React Router → 7.13.x, Wrangler → 4.67.x

**Major upgrades (evaluate during implementation):**

- React 18 → 19: Adopt React 19 for the rebuild. Benefits: improved Suspense data fetching, useActionState for form handling, use() hook for promise resolution. All SPAs rewritten against React 19 APIs
- Vite 6 → 7: Evaluate Vite 7 compatibility with Cloudflare Workers Static Assets build. If incompatible, pin Vite 6.x (still excellent)
- Vitest 3 → 4: Evaluate Vitest 4 compatibility with @cloudflare/vitest-pool-workers. If incompatible, pin Vitest 3.x (still well-supported)

### Monorepo Structure (Retained & Optimized)

```
DevSage/                              # Turborepo root
├── apps/
│   ├── api/                          # @devsage/api — Cloudflare Worker (Hono)
│   ├── web/                          # @devsage/web — devsage.org (React SPA)
│   ├── platform/                     # @devsage/platform — platform.devsage.org (React SPA)
│   └── admin/                        # @devsage/admin — shikdd.devsage.org (React SPA)
├── packages/
│   ├── shared/                       # @devsage/shared — Zod schemas, types, constants
│   ├── db/                           # @devsage/db — Drizzle ORM schemas, D1 migrations
│   └── config/                       # @devsage/config — tsconfig + ESLint flat config
├── templates/
│   └── hackathon-site/               # Per-hackathon participant site template
└── docs/                             # Architecture & API documentation
```

**Workspace isolation for focused DX:**

- `pnpm --filter @devsage/api` — Focus on API only
- `turbo run dev --filter=@devsage/platform` — Single-app dev
- Turbo's dependency graph ensures only affected packages rebuild

**Dependency rules (unchanged):**

- Frontend apps import from `@devsage/shared` only (never `db` or `api`)
- `@devsage/db` depends on `@devsage/config` only
- `@devsage/shared` is standalone (only dep: zod)
- No circular dependencies, no cross-app imports

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

1. Full Drizzle query builder for all data access (Zod 4 + Drizzle 0.45.x)
2. Better Auth v1.4.x for complete auth lifecycle (OAuth, sessions, tokens, cookies)
3. `@hono/zod-openapi` v1.2.x for type-safe API routes with auto-generated OpenAPI spec
4. Hono RPC client (`hc<AppType>`) for end-to-end type-safe frontend↔API communication
5. TanStack Router v1.x for type-safe routing with Zod search params

**Important Decisions (Shape Architecture):**

6. React 19 Actions + `useActionState` for form handling (no form library)
7. Route-based code splitting via TanStack Router `lazy()`
8. Workers Static Assets + GitHub Actions for all deployments
9. Vitest + Playwright for testing (unit/integration + E2E)

**Deferred Decisions (Post-MVP):**

10. KV caching — add only when bottlenecks are proven (no caching initially)
11. Advanced observability (Logpush, external APM) — start with built-in Workers Observability

### Data Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **ORM Usage** | Full Drizzle query builder everywhere | Type-safe queries, auto-generated SQL, consistent DX. No raw D1 prepared statements |
| **Zod Version** | Zod 4.3.x (upgrade from 3.x) | Required by `@hono/zod-openapi`. Full rebuild, clean migration |
| **Drizzle Version** | 0.45.x | Latest D1 improvements, relational query support |
| **Caching** | No KV caching initially | Add tiered caching only when real bottlenecks are proven |
| **Migration Strategy** | Drop and recreate | D1 is early-stage, no production data to preserve. Clean slate |
| **Validation** | Zod 4 schemas shared via `@devsage/shared` | Single source of truth for validation, shared between API + frontends |

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Auth Framework** | Better Auth v1.4.x | Complete auth lifecycle: OAuth (GitHub + Google), email/password, session management, cookies |
| **Session Management** | Better Auth native sessions | Replaces custom JWT (signJWT/verifyJWT) and refresh token rotation |
| **Cookie Strategy** | Better Auth `crossSubDomainCookies` | Per-subdomain cookies managed by Better Auth, replaces manual cookie handling |
| **Role Resolution** | Extended Better Auth session with cached roles | Roles attached to session, refreshed periodically. Reduces per-request DB lookups |
| **Rate Limiting** | Cloudflare built-in rate limiting | Configured in dashboard/wrangler rules. Zero custom application code |
| **Webhook Verification** | HMAC SHA-256 (kept) | GitHub webhook signature verification — not affected by Better Auth change |

**Removed components:** `signJWT()`, `verifyJWT()`, `createRefreshToken()`, `rotateRefreshToken()`, custom KV rate limiter middleware

### API & Communication Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API Framework** | Hono 4.12.x + `@hono/zod-openapi` 1.2.x | Type-safe route definitions with auto-generated OpenAPI spec |
| **Error Format** | Structured envelope: `{ ok, error: { code, message, details } }` | Typed error codes via Zod, auto-documented in OpenAPI |
| **Response Envelope** | `{ ok: true, data, meta }` (kept) | Consistent API responses, now typed via Zod-OpenAPI |
| **Frontend Client** | Hono RPC client `hc<AppType>()` + TanStack Query | End-to-end type safety from API route definitions to frontend calls |
| **API Documentation** | Auto-generated OpenAPI spec + Swagger UI | Always in sync with code, generated from route definitions |
| **Pagination** | Offset-based with `limit`/`offset`/`has_more` (kept) | Cursor-based for append-only endpoints (audit, notifications) |

### Frontend Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Framework** | React 19.x | Improved Suspense, transitions, Actions API, `use()` hook |
| **Routing** | TanStack Router v1.x | Type-safe routing with Zod search param validation, file-based routes |
| **Server State** | TanStack Query v5 (kept) | Best server-state management, integrates with Hono RPC client |
| **Client State** | React 19 built-ins only | `useState`, `useReducer`, `useContext`. No external state library |
| **Form Handling** | React 19 Actions + `useActionState` | Native form handling with Suspense transitions, Zod validation from `@devsage/shared` |
| **Code Splitting** | Route-based via TanStack Router `lazy()` | Per-route lazy loading for optimal initial load times |
| **Styling** | Tailwind CSS v4.2.x + shadcn/ui (kept) | CSS-first config, excellent DX, Radix-based accessible components |
| **Build Tool** | Vite 7.x (evaluate) or 6.x (fallback) | Verify Workers Static Assets / Cloudflare Pages compatibility before committing to v7 |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Frontend Deployment** | Workers Static Assets via GitHub Actions | Deployed via `wrangler deploy`, consistent with API deployment pipeline |
| **API Deployment** | GitHub Actions → `wrangler deploy` | CI runs lint/typecheck/test, deploys on push to main |
| **Monitoring** | Workers Observability (built-in) | Native Cloudflare tracing, logs, analytics. Zero external dependencies |
| **Testing: API** | Vitest + `@cloudflare/vitest-pool-workers` | Real D1/KV/DO bindings in test, integration-first approach |
| **Testing: Frontend** | Vitest + `@testing-library/react` | Component and hook testing with jsdom |
| **Testing: E2E** | Playwright | Critical flow coverage: auth, hackathon creation, submission, judging |
| **Secret Management** | `wrangler secret put` (prod), `.dev.vars` (dev) | Kept — proven pattern |
| **Pre-commit** | secretlint + lint-staged (kept) | Block commits/pushes with secrets |

### Decision Impact Analysis

**Implementation Sequence:**

1. `@devsage/shared` — Upgrade to Zod 4, rewrite all schemas
2. `@devsage/db` — Upgrade Drizzle to 0.45.x, rewrite schemas, regenerate migrations
3. `@devsage/config` — Update tsconfig, ESLint for new packages
4. `apps/api` — Better Auth integration, `@hono/zod-openapi` routes, full Drizzle queries
5. `apps/web` — React 19, TanStack Router, Hono RPC client, Better Auth React client
6. `apps/platform` — Same frontend architecture as web
7. `apps/admin` — Same frontend architecture as web
8. E2E tests — Playwright setup after all apps functional

**Cross-Component Dependencies:**

- Zod 4 upgrade affects `@devsage/shared` → all consumers must upgrade simultaneously
- Better Auth changes DB schema (user, session, account tables) → `@devsage/db` schemas must align
- `@hono/zod-openapi` changes route definition syntax → all API routes must be rewritten
- Hono RPC client requires API type exports → `@devsage/shared` or `@devsage/api` must export `AppType`
- TanStack Router replaces React Router → all frontend routing code must be rewritten

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

12 areas where AI agents could make different choices — all resolved below.

### Naming Patterns

**Database Naming (Drizzle + D1):**

- Tables: `snake_case`, plural — `hackathons`, `team_members`, `audit_events`
- Columns: `snake_case` — `created_at`, `hackathon_id`, `is_active`
- Foreign keys: `{referenced_table_singular}_id` — `hackathon_id`, `user_id`, `team_id`
- Indexes: `idx_{table}_{columns}` — `idx_hackathons_slug`, `idx_team_members_user_id`
- Primary keys: `id` (UUID via `crypto.randomUUID()`)

**API JSON Naming:**

- All JSON fields: `snake_case` — `{ hackathon_id, created_at, team_name }`
- Matches database columns directly — no mapping layer needed
- Request bodies and response payloads use identical field names

**API Endpoint Naming:**

- Pattern: `/api/v1/{resource_plural}/:param/{sub_resource_plural}`
- Examples: `/api/v1/hackathons/:slug/teams/:team_id/members`
- Always plural nouns: `/hackathons` not `/hackathon`
- Parameters: `:snake_case` — `:team_id`, `:hackathon_slug`
- Query params: `snake_case` — `?page_size=20&sort_by=created_at`

**Code Naming:**

- TypeScript variables/functions: `camelCase` — `getHackathon()`, `teamId`
- TypeScript types/interfaces: `PascalCase` — `Hackathon`, `TeamMember`, `CreateHackathonInput`
- React components: `PascalCase` — `HackathonCard`, `TeamList`
- Component files: `PascalCase.tsx` — `HackathonCard.tsx`, `TeamList.tsx`
- Non-component files: `kebab-case.ts` — `api-client.ts`, `use-hackathon.ts`
- Constants: `UPPER_SNAKE_CASE` — `MAX_TEAM_SIZE`, `DEFAULT_PAGE_SIZE`
- Zod schemas: `camelCase` with `Schema` suffix — `createHackathonSchema`, `teamMemberSchema`

### Structure Patterns

**API Project Organization (`apps/api/src/`):**

```
src/
├── routes/              # Hono OpenAPI route definitions
│   ├── hackathons.ts
│   ├── teams.ts
│   ├── judging.ts
│   └── webhooks.ts
├── middleware/           # Hono middleware
│   ├── auth.ts           # Better Auth session middleware
│   ├── role.ts           # Role resolution (from session cache)
│   └── request-id.ts
├── durable-objects/      # Cloudflare Durable Objects
│   └── hackathon-state-machine.ts
├── queue/                # Queue consumer handlers
├── cron/                 # Cron trigger handlers
├── services/             # External service integrations (fail-open)
├── lib/                  # Shared utilities (audit, response helpers, webhook normalize)
├── auth.ts               # Better Auth instance configuration
├── __tests__/            # Test files mirroring src/ structure
│   ├── routes/
│   ├── middleware/
│   └── durable-objects/
└── index.ts              # Worker entry point, DO re-exports
```

**Frontend Organization (`apps/{web,platform,admin}/src/`):**

```
src/
├── features/             # Feature modules
│   ├── auth/             # Auth components, hooks
│   │   ├── AuthProvider.tsx
│   │   ├── LoginPage.tsx
│   │   └── use-auth.ts
│   ├── hackathons/       # Hackathon management
│   │   ├── HackathonCard.tsx
│   │   ├── HackathonList.tsx
│   │   ├── CreateHackathonForm.tsx
│   │   └── use-hackathons.ts
│   └── teams/
├── components/           # Shared UI components (shadcn/ui wrappers)
│   ├── ui/               # shadcn/ui primitives
│   ├── Layout.tsx
│   └── ErrorBoundary.tsx
├── lib/                  # Shared utilities
│   └── api-client.ts     # Hono RPC client instance
├── routes/               # TanStack Router route definitions (file-based)
├── __tests__/            # Test files mirroring src/ structure
└── main.tsx              # App entry point
```

**Test Location:**

- Co-located `__tests__` directory inside `src/`
- Mirrors source tree: `src/__tests__/routes/hackathons.test.ts` tests `src/routes/hackathons.ts`
- Test file suffix: `.test.ts` or `.test.tsx`
- E2E tests: `tests/e2e/` at app root (Playwright)

### Format Patterns

**API Response Envelope:**

```typescript
// Success
{ ok: true, data: T, meta?: { total, limit, offset, has_more } }

// Error
{ ok: false, error: { code: string, message: string, details?: unknown } }
```

**Error Codes:** `UPPER_SNAKE_CASE` — `HACKATHON_NOT_FOUND`, `INSUFFICIENT_PERMISSIONS`, `VALIDATION_ERROR`, `SUBMISSION_DEADLINE_PASSED`

**Timestamps:** All UTC ISO-8601 strings — `new Date().toISOString()`. Never Unix timestamps. Frontend displays in user's locale.

**IDs:** UUIDs via `crypto.randomUUID()`. Never auto-increment integers.

**Null Handling:** Use `null` in JSON (not `undefined`). Drizzle nullable columns → `null` in responses.

**Booleans:** `true`/`false` in JSON. Column names: `is_active`, `has_submitted`, `can_edit`.

### Communication Patterns

**Audit Events:**

- Event naming: `snake_case.action` — `hackathon.created`, `team.member_added`, `submission.received`
- Actor types: `user`, `system`, `bot`, `cron`
- Hash chain: SHA-256 of previous event hash + current payload

**Queue Messages:**

- Type field: `UPPER_SNAKE_CASE` — `PROCESS_WEBHOOK`, `SEND_NOTIFICATION`, `GENERATE_SITE`
- Payload: typed via Zod schemas in `@devsage/shared`

**Logging:**

- `console.warn()` for operational warnings
- `console.error()` for actual errors
- Never `console.log()` — enforced by ESLint
- Include `request_id` in all log messages

### Process Patterns

**API Error Handling:**

```typescript
class AppError extends Error {
  constructor(
    public code: string,       // e.g., 'HACKATHON_NOT_FOUND'
    public statusCode: number, // e.g., 404
    public details?: unknown
  ) { super(code); }
}

// Global Hono error handler formats all errors into envelope
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      err.statusCode
    );
  }
  return c.json(
    { ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500
  );
});
```

**Frontend Loading States:**

- Use TanStack Query's `isPending` / `isError` / `data` from `useQuery` / `useMutation`
- Route-level Suspense boundaries via TanStack Router's `pendingComponent`
- `ErrorBoundary` components at route level for error recovery
- No manual `isLoading` state management

**Module Exports:**

- Each module/feature has `index.ts` barrel export
- Explicit `.js` extensions in barrel re-exports: `export { HackathonCard } from './HackathonCard.js'`
- `@devsage/shared` exports all public schemas/types from `src/index.ts`
- `@devsage/db` exports all schemas from `src/schema/index.ts`

**Service Pattern (external integrations):**

- Fail-open: 10s timeout via `AbortController`, log warning, never throw
- Return `null` on failure, let caller decide behavior

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow `snake_case` for database columns AND JSON response fields
2. Use `PascalCase` for component files matching their export name
3. Place tests in `src/__tests__/` mirroring the source tree
4. Use the `AppError` class for all API errors (never manual error responses)
5. Use `crypto.randomUUID()` for IDs (never auto-increment)
6. Use `new Date().toISOString()` for timestamps (never Unix)
7. Use barrel exports with `.js` extensions in all packages
8. Never use `console.log` — only `console.warn`/`console.error`
9. Organize frontend code by feature in `src/features/`
10. Use TanStack Query for all server state (never `useEffect` + `fetch`)

**Anti-Patterns (NEVER do these):**

- ❌ `camelCase` in JSON responses — always `snake_case`
- ❌ `useEffect` + `fetch` for data loading — use TanStack Query
- ❌ Manual loading state (`useState(false)`) — use Query's `isPending`
- ❌ `try/catch` in route handlers — throw `AppError`, global handler catches
- ❌ Direct D1 SQL — use Drizzle query builder
- ❌ `console.log` — only `warn`/`error`
- ❌ Auto-increment IDs — use UUIDs
- ❌ Wildcard cookie domain — per-subdomain via Better Auth config

## Project Structure & Boundaries

### Complete Project Directory Structure

```
DevSage/
├── .github/
│   └── workflows/
│       ├── api-deploy.yml           # Lint → Typecheck → Test → wrangler deploy (push to main)
│       ├── ci.yml                   # PR checks: lint, typecheck, test for all packages
│       └── secret-scan.yml          # gitleaks on PRs + push to main
├── .husky/
│   ├── pre-commit                   # secretlint on staged files + lint-staged
│   └── pre-push                     # Full repo secret scan
├── turbo.json                       # Turborepo pipeline configuration
├── pnpm-workspace.yaml              # pnpm workspace definition
├── package.json                     # Root scripts: dev, build, test, lint, typecheck, deploy:*
├── tsconfig.json                    # Root TypeScript config (references)
├── .gitignore
├── .secretlintrc.json
│
├── apps/
│   ├── api/                         # @devsage/api — Cloudflare Worker
│   │   ├── wrangler.jsonc           # Worker config: D1, KV, DOs, Queues, cron
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts         # @cloudflare/vitest-pool-workers config
│   │   ├── .dev.vars                # Local dev secrets (gitignored)
│   │   └── src/
│   │       ├── index.ts             # Worker entry point, DO re-exports, app.route() mounts
│   │       ├── auth.ts              # Better Auth instance (providers, Drizzle adapter, plugins)
│   │       ├── app.ts               # Hono OpenAPI app factory, global middleware, error handler
│   │       ├── types/
│   │       │   └── env.ts           # AuthAppEnv, Worker bindings type
│   │       ├── routes/
│   │       │   ├── auth.ts          # Better Auth handler mount (/api/auth/*)
│   │       │   ├── hackathons.ts    # CRUD, lifecycle, cloning (FR18-FR26)
│   │       │   ├── teams.ts         # Formation, invites, membership (FR27-FR33)
│   │       │   ├── submissions.ts   # Submission queries, manual reconciliation (FR34-FR43)
│   │       │   ├── judging.ts       # Rubrics, assignment, scoring, leaderboard (FR44-FR59)
│   │       │   ├── workspaces.ts    # Workspace CRUD, subscription management (FR11-FR17)
│   │       │   ├── admin.ts         # Platform admin: approval queue, monitoring (FR60-FR64)
│   │       │   ├── notifications.ts # Notification preferences, in-app notifications (FR65-FR71)
│   │       │   ├── webhooks.ts      # GitHub webhook receiver, HMAC verify (FR34-FR43)
│   │       │   ├── audit.ts         # Audit log queries, export (FR79-FR87)
│   │       │   └── health.ts        # Health check endpoint
│   │       ├── middleware/
│   │       │   ├── auth.ts          # Better Auth session middleware (extracts user/session)
│   │       │   ├── role.ts          # Role resolution from cached session data
│   │       │   ├── platform-admin.ts # Platform admin check
│   │       │   └── request-id.ts    # X-Request-Id generation
│   │       ├── durable-objects/
│   │       │   └── HackathonStateMachine.ts  # 5-state lifecycle DO
│   │       ├── queue/
│   │       │   ├── index.ts         # Queue dispatcher
│   │       │   ├── webhook-handler.ts    # Process GitHub webhooks → submissions
│   │       │   └── notification-handler.ts # Process notification queue → email/in-app
│   │       ├── cron/
│   │       │   ├── index.ts         # Cron dispatcher
│   │       │   └── deadline-checker.ts   # Hourly: check deadlines, trigger reminders
│   │       ├── services/
│   │       │   ├── github.ts        # GitHub API client (fail-open, 10s timeout)
│   │       │   └── email.ts         # SMTP email service (fail-open)
│   │       ├── lib/
│   │       │   ├── errors.ts        # AppError class definition
│   │       │   ├── response.ts      # successResponse(), paginatedResponse() helpers
│   │       │   ├── audit.ts         # insertAuditEvent() with hash chain
│   │       │   └── webhook-normalize.ts  # GitHub payload → typed union
│   │       └── __tests__/
│   │           ├── routes/
│   │           │   ├── hackathons.test.ts
│   │           │   ├── teams.test.ts
│   │           │   ├── judging.test.ts
│   │           │   ├── webhooks.test.ts
│   │           │   └── auth.test.ts
│   │           ├── middleware/
│   │           │   └── role.test.ts
│   │           ├── durable-objects/
│   │           │   └── hackathon-state-machine.test.ts
│   │           └── queue/
│   │               ├── webhook-handler.test.ts
│   │               └── notification-handler.test.ts
│   │
│   ├── web/                         # @devsage/web — devsage.org (public website)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── .env.production          # VITE_API_ORIGIN (client-visible only)
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx             # App entry point, TanStack Router + QueryClient
│   │       ├── routeTree.gen.ts     # Auto-generated by TanStack Router
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   │   ├── AuthProvider.tsx
│   │       │   │   ├── LoginPage.tsx
│   │       │   │   ├── OAuthCallback.tsx
│   │       │   │   └── use-auth.ts
│   │       │   ├── hackathons/
│   │       │   │   ├── HackathonCard.tsx
│   │       │   │   ├── HackathonList.tsx
│   │       │   │   ├── HackathonDetail.tsx
│   │       │   │   └── use-hackathons.ts
│   │       │   ├── teams/
│   │       │   │   ├── TeamDashboard.tsx
│   │       │   │   ├── JoinTeamForm.tsx
│   │       │   │   └── use-teams.ts
│   │       │   └── submissions/
│   │       │       ├── SubmissionStatus.tsx
│   │       │       └── use-submissions.ts
│   │       ├── components/
│   │       │   ├── ui/              # shadcn/ui primitives
│   │       │   ├── Layout.tsx
│   │       │   ├── Navbar.tsx
│   │       │   └── ErrorBoundary.tsx
│   │       ├── lib/
│   │       │   └── api-client.ts    # Hono RPC client instance
│   │       ├── routes/              # TanStack Router file-based routes
│   │       │   ├── __root.tsx
│   │       │   ├── index.tsx
│   │       │   ├── login.tsx
│   │       │   ├── hackathons/
│   │       │   │   ├── index.tsx
│   │       │   │   └── $slug.tsx
│   │       │   └── dashboard.tsx
│   │       └── __tests__/
│   │           └── features/
│   │               ├── auth/
│   │               └── hackathons/
│   │
│   ├── platform/                    # @devsage/platform — platform.devsage.org (organizer/judge)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── .env.production
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── routeTree.gen.ts
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── hackathons/
│   │       │   │   ├── CreateHackathonForm.tsx
│   │       │   │   ├── HackathonSettings.tsx
│   │       │   │   ├── HackathonDashboard.tsx
│   │       │   │   └── use-hackathon-management.ts
│   │       │   ├── teams/
│   │       │   │   ├── TeamManagement.tsx
│   │       │   │   └── use-team-admin.ts
│   │       │   ├── judging/
│   │       │   │   ├── RubricEditor.tsx
│   │       │   │   ├── JudgeAssignment.tsx
│   │       │   │   ├── ScoringInterface.tsx
│   │       │   │   ├── Leaderboard.tsx
│   │       │   │   └── use-judging.ts
│   │       │   ├── submissions/
│   │       │   │   ├── SubmissionReview.tsx
│   │       │   │   ├── ReconciliationPanel.tsx
│   │       │   │   └── use-submission-admin.ts
│   │       │   └── notifications/
│   │       │       ├── NotificationCenter.tsx
│   │       │       └── use-notifications.ts
│   │       ├── components/
│   │       │   ├── ui/
│   │       │   ├── Layout.tsx
│   │       │   └── ErrorBoundary.tsx
│   │       ├── lib/
│   │       │   └── api-client.ts
│   │       ├── routes/
│   │       │   ├── __root.tsx
│   │       │   ├── index.tsx
│   │       │   ├── hackathons/
│   │       │   │   ├── new.tsx
│   │       │   │   ├── $slug.tsx
│   │       │   │   ├── $slug.settings.tsx
│   │       │   │   ├── $slug.teams.tsx
│   │       │   │   ├── $slug.judging.tsx
│   │       │   │   └── $slug.submissions.tsx
│   │       │   └── notifications.tsx
│   │       └── __tests__/
│   │
│   └── admin/                       # @devsage/admin — shikdd.devsage.org (platform admin)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── .env.production
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── routeTree.gen.ts
│           ├── features/
│           │   ├── auth/
│           │   ├── approval-queue/
│           │   │   ├── ApprovalQueue.tsx
│           │   │   ├── RequestDetail.tsx
│           │   │   └── use-approval-queue.ts
│           │   ├── monitoring/
│           │   │   ├── PlatformDashboard.tsx
│           │   │   ├── HackathonOverview.tsx
│           │   │   └── use-platform-stats.ts
│           │   └── audit/
│           │       ├── AuditLogViewer.tsx
│           │       └── use-audit-logs.ts
│           ├── components/
│           │   ├── ui/
│           │   └── Layout.tsx
│           ├── lib/
│           │   └── api-client.ts
│           ├── routes/
│           └── __tests__/
│
├── packages/
│   ├── shared/                      # @devsage/shared — Zod 4 schemas, types, constants
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts             # Barrel export
│   │       ├── schemas/
│   │       │   ├── hackathon.ts
│   │       │   ├── team.ts
│   │       │   ├── submission.ts
│   │       │   ├── judging.ts
│   │       │   ├── workspace.ts
│   │       │   ├── notification.ts
│   │       │   ├── auth.ts
│   │       │   └── common.ts        # paginationSchema, idSchema, slugSchema
│   │       ├── types/
│   │       │   ├── hackathon.ts
│   │       │   ├── api.ts           # ApiResponse, ApiError, PaginatedResponse
│   │       │   └── enums.ts         # HackathonState, Role, SubscriptionTier
│   │       └── constants/
│   │           ├── limits.ts        # MAX_TEAM_SIZE, DEFAULT_PAGE_SIZE
│   │           └── roles.ts         # Role hierarchy definition
│   │
│   ├── db/                          # @devsage/db — Drizzle ORM schemas + D1 migrations
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   ├── migrations/
│   │   └── src/
│   │       ├── index.ts
│   │       ├── client.ts            # D1 → Drizzle client factory
│   │       └── schema/
│   │           ├── index.ts
│   │           ├── users.ts         # Better Auth user/session/account + extensions
│   │           ├── workspaces.ts
│   │           ├── hackathons.ts
│   │           ├── teams.ts
│   │           ├── submissions.ts
│   │           ├── judging.ts
│   │           ├── notifications.ts
│   │           ├── audit.ts
│   │           └── relations.ts     # Drizzle relations for all tables
│   │
│   └── config/                      # @devsage/config — Shared configuration
│       ├── package.json
│       ├── tsconfig.base.json
│       ├── tsconfig.react.json
│       ├── tsconfig.worker.json
│       └── eslint.config.mjs
│
├── templates/
│   └── hackathon-site/              # Per-hackathon participant site template (FR72-FR78)
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│
├── tests/                           # E2E tests (Playwright)
│   ├── playwright.config.ts
│   └── e2e/
│       ├── auth.spec.ts
│       ├── hackathon-lifecycle.spec.ts
│       ├── team-management.spec.ts
│       ├── submission-flow.spec.ts
│       └── judging-flow.spec.ts
│
└── docs/
    ├── api/                         # Auto-generated from OpenAPI spec
    └── architecture.md
```

### Architectural Boundaries

**Package Dependency Rules:**

```
apps/api      → @devsage/shared, @devsage/db, @devsage/config
apps/web      → @devsage/shared, @devsage/api (type-only for RPC)
apps/platform → @devsage/shared, @devsage/api (type-only for RPC)
apps/admin    → @devsage/shared, @devsage/api (type-only for RPC)
packages/db   → @devsage/config
packages/shared → (standalone, only zod)
packages/config → (standalone)
```

**API Layer Boundaries:**

| Layer | Responsibility | Can Access |
|-------|---------------|-----------|
| **Routes** (`routes/`) | Request handling, validation, response formatting | Middleware context, Drizzle DB, Services, Lib |
| **Middleware** (`middleware/`) | Auth, roles, request metadata | Better Auth API, DB (for role resolution) |
| **Durable Objects** (`durable-objects/`) | Stateful coordination (state machine) | Own SQLite storage, Worker via stub |
| **Queue Handlers** (`queue/`) | Async processing (webhooks, notifications) | Drizzle DB, Services |
| **Cron Handlers** (`cron/`) | Scheduled tasks | Drizzle DB, Queue (to enqueue) |
| **Services** (`services/`) | External API calls (GitHub, email) | Nothing internal — pure I/O |
| **Lib** (`lib/`) | Shared utilities | Nothing — pure functions |

**Frontend Layer Boundaries:**

| Layer | Responsibility | Can Access |
|-------|---------------|-----------|
| **Routes** (`routes/`) | Page layout, params, data loading | Features, Components |
| **Features** (`features/`) | Business logic components + hooks | Components, Lib, @devsage/shared |
| **Components** (`components/`) | Shared UI primitives | Only other components, no features |
| **Lib** (`lib/`) | API client, utilities | @devsage/shared, @devsage/api (types) |

### Requirements to Structure Mapping

| FR Domain | API Routes | API Other | Frontend (web) | Frontend (platform) | Frontend (admin) |
|-----------|-----------|-----------|----------------|---------------------|------------------|
| **Identity & Access** (FR1-10) | `routes/auth.ts` | `auth.ts` (Better Auth) | `features/auth/` | `features/auth/` | `features/auth/` |
| **Workspace & Subscription** (FR11-17) | `routes/workspaces.ts` | — | — | `features/workspaces/` | — |
| **Hackathon Lifecycle** (FR18-26) | `routes/hackathons.ts` | `durable-objects/` | `features/hackathons/` | `features/hackathons/` | `features/monitoring/` |
| **Team & Participation** (FR27-33) | `routes/teams.ts` | — | `features/teams/` | `features/teams/` | — |
| **Submission Pipeline** (FR34-43) | `routes/webhooks.ts`, `routes/submissions.ts` | `queue/webhook-handler.ts` | `features/submissions/` | `features/submissions/` | — |
| **Judging & Scoring** (FR44-59) | `routes/judging.ts` | — | — | `features/judging/` | — |
| **Platform Admin** (FR60-64) | `routes/admin.ts` | — | — | — | `features/approval-queue/`, `features/monitoring/` |
| **Notifications** (FR65-71) | `routes/notifications.ts` | `queue/notification-handler.ts` | — | `features/notifications/` | — |
| **Participant Sites** (FR72-78) | — | — | — | — | — (`templates/`) |
| **Audit & Compliance** (FR79-87) | `routes/audit.ts` | `lib/audit.ts` | — | — | `features/audit/` |

### Cross-Cutting Concerns Mapping

| Concern | Implementation Location |
|---------|----------------------|
| **Authentication** | `apps/api/src/auth.ts`, `middleware/auth.ts`, all frontend `features/auth/` |
| **Role Resolution** | `middleware/role.ts`, Better Auth session plugin extension |
| **Audit Trail** | `lib/audit.ts`, called from all mutation routes |
| **Data Isolation** | Enforced via Drizzle queries (scoped by `workspace_id`/`hackathon_id`) |
| **Subscription Enforcement** | Middleware or route-level check against workspace tier |
| **Error Handling** | `lib/errors.ts`, `app.ts` (global handler), frontend `ErrorBoundary.tsx` |
| **Logging** | `console.warn`/`console.error` with request_id, Workers Observability |

### Integration Points

**Internal Communication:**

- **Frontend → API:** Hono RPC client over HTTPS (type-safe, credentials: include)
- **API → D1:** Drizzle query builder (all reads/writes)
- **API → Durable Objects:** Worker stub via `env.HACKATHON_STATE_MACHINE.get(id)`
- **API → Queue:** `env.WEBHOOK_QUEUE.send()` / `env.NOTIFICATION_QUEUE.send()`
- **Queue → D1:** Drizzle query builder (consumer handlers)
- **Cron → Queue:** Enqueues notifications/checks via queue bindings

**External Integrations:**

- **GitHub OAuth:** Better Auth GitHub provider → GitHub API
- **Google OAuth:** Better Auth Google provider → Google API
- **GitHub Webhooks:** `routes/webhooks.ts` → HMAC verify → queue → `webhook-handler.ts`
- **GitHub API:** `services/github.ts` — repo info, org membership (fail-open, 10s timeout)
- **Email (SMTP):** `services/email.ts` — notifications, OTP delivery (fail-open)

**Data Flow (Submission Pipeline):**

```
GitHub push → Webhook POST → HMAC verify → Queue → Normalize payload
→ Idempotency check (delivery_id) → Create/update submission record
→ Late detection (server timestamp vs deadline) → Audit event
→ Notification queue → Email + in-app notification
```

- **Manual SHA Upload Fallback:** `POST /api/v1/hackathons/:slug/submissions/manual` accepts repo_owner, repo_name, commit_sha, optional tag and notes (auth required, team-member only). The handler enqueues the same normalization/queue path as webhooks, logs an audit event, and surfaces status to the team dashboard.
- **Real-Time Submission Confirmation:** Queue processing emits `submission.status` events to `NOTIFICATION_QUEUE` and an SSE feed (`/api/v1/submissions/events`) consumed by apps/web and apps/platform. Clients show toast + inline status (pending → recorded → failed) with auto-retry fallback to polling when SSE is unavailable.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

- ✅ Better Auth v1.4.x + Drizzle adapter + D1 SQLite — fully compatible
- ✅ `@hono/zod-openapi` v1.2.x + Zod 4.3.x — compatible (1.2.x requires Zod ^4.0.0)
- ✅ Hono RPC client + TanStack Query — complementary (RPC for types, Query for caching/state)
- ✅ TanStack Router v1.x + React 19 — compatible
- ✅ Workers Static Assets + Vite build — proven deployment pattern
- ✅ Per-subdomain cookies maintained — Better Auth `crossSubDomainCookies` NOT enabled
- ✅ Role enrichment via Better Auth plugin/hook at session creation

**Pattern Consistency:**

- ✅ snake_case in DB and JSON aligns with Drizzle column naming
- ✅ PascalCase component files work with TanStack Router file-based routing
- ✅ Feature-based organization supports route-based code splitting
- ✅ AppError pattern works with `@hono/zod-openapi` error schemas
- ✅ Barrel exports with `.js` extensions required for Workers runtime

**Structure Alignment:**

- ✅ API structure supports Hono OpenAPI route definitions
- ✅ Frontend feature organization maps cleanly to TanStack Router routes
- ✅ Package boundaries prevent circular dependencies
- ✅ Test co-location with `__tests__` works with Vitest config

### Requirements Coverage Validation ✅

**Functional Requirements (87 FRs across 10 domains):**

| FR Domain | Coverage | Architectural Support |
|-----------|----------|----------------------|
| Identity & Access (FR1-10) | ✅ Full | Better Auth (GitHub, Google, email/password), session management |
| Workspace & Subscription (FR11-17) | ✅ Full | `routes/workspaces.ts`, tier enforcement middleware |
| Hackathon Lifecycle (FR18-26) | ✅ Full | `routes/hackathons.ts`, HackathonStateMachine DO |
| Team & Participation (FR27-33) | ✅ Full | `routes/teams.ts`, invite codes, size enforcement |
| Submission Pipeline (FR34-43) | ✅ Full | `routes/webhooks.ts`, queue processing, idempotency |
| Judging & Scoring (FR44-59) | ✅ Full | `routes/judging.ts`, rubrics, assignment, scoring |
| Platform Administration (FR60-64) | ✅ Full | `routes/admin.ts`, admin app features |
| Notifications (FR65-71) | ✅ Full | Queue-based, email + in-app channels |
| Participant Sites (FR72-78) | ✅ Full | `templates/hackathon-site/`, separate repos |
| Audit & Compliance (FR79-87) | ✅ Full | `lib/audit.ts`, hash-chained events, export |

**Non-Functional Requirements:**

| NFR | Coverage | How Addressed |
|-----|----------|--------------|
| Performance (p95 <200ms reads) | ✅ | D1 reads at edge, Workers auto-scaling, no cold starts |
| Security | ✅ | Better Auth, HMAC webhooks, Cloudflare rate limiting, per-subdomain cookies |
| Reliability | ✅ | Queue + idempotency + DLQ, audit trail integrity |
| Scalability | ✅ | Workers horizontal scaling, per-hackathon DO isolation, D1 read-heavy pattern |

### Implementation Readiness Validation ✅

**Decision Completeness:**

- ✅ All critical technology decisions documented with specific versions
- ✅ 10 enforcement guidelines for AI agent consistency
- ✅ Anti-patterns clearly listed
- ✅ Code examples provided for key patterns (AppError, response envelope)

**Structure Completeness:**

- ✅ Complete directory tree with all planned files
- ✅ All 87 FRs mapped to specific file locations
- ✅ Cross-cutting concerns mapped to implementation locations
- ✅ Integration points and data flows documented

**Pattern Completeness:**

- ✅ Naming conventions cover DB, JSON, TS, React components, files
- ✅ Module export pattern with .js extensions specified
- ✅ Error handling pattern with global handler defined
- ✅ Loading state pattern using TanStack Query + Suspense defined

### Gap Analysis Results

**No Critical Gaps** — All requirements have architectural support.

**Important (address during implementation):**

1. **Better Auth role enrichment plugin** — Custom plugin needed to attach per-hackathon roles to session. Define plugin API during `apps/api` implementation
2. **Hono RPC type export configuration** — `@devsage/api` package.json needs `exports` configured for type-only consumption by frontends
3. **Vite 7 / Vitest 4 compatibility** — Evaluate during implementation. Fall back to Vite 6 / Vitest 3 if incompatible

**Deferred (post-MVP):**

4. **KV caching** — Add when performance bottlenecks are identified
5. **WebSocket/real-time** — SSE in-scope for submission confirmations; leaderboard real-time can use polling initially, upgrade to WebSocket via DOs later
6. **File uploads** — Not in current FRs; add via R2 if needed
7. **Internationalization** — UTC storage + IST display handled; full i18n deferred

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (87 FRs, NFRs, 8 cross-cutting concerns)
- [x] Scale and complexity assessed (High — multi-tenant SaaS, 36 tables, 90+ endpoints)
- [x] Technical constraints identified (Workers runtime, D1, no Node.js APIs)
- [x] Cross-cutting concerns mapped to implementation locations

**✅ Technology Stack**

- [x] All packages specified with target versions
- [x] Version compatibility verified
- [x] Upgrade paths documented (React 18→19, Zod 3→4, etc.)
- [x] Fallback options identified (Vite 6 if 7 incompatible)

**✅ Architectural Decisions**

- [x] 11 critical + important decisions documented
- [x] Data architecture: full Drizzle, Zod 4, no KV caching initially
- [x] Auth: Better Auth full lifecycle, per-subdomain sessions
- [x] API: Hono + zod-openapi + RPC client, structured error envelope
- [x] Frontend: React 19 + TanStack Router + Query, feature-based org
- [x] Infrastructure: Workers Static Assets, GitHub Actions, Workers Observability

**✅ Implementation Patterns**

- [x] Naming conventions established (DB, JSON, TS, files)
- [x] Structure patterns defined (API layers, frontend features)
- [x] Communication patterns specified (audit events, queue messages, logging)
- [x] Process patterns documented (error handling, loading states, exports)
- [x] 10 enforcement rules + 8 anti-patterns documented

**✅ Project Structure**

- [x] Complete directory structure with all files
- [x] Component boundaries established (API layers, frontend layers)
- [x] Integration points mapped (internal + external)
- [x] Requirements to structure mapping complete (all 10 FR domains)

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**

1. End-to-end type safety: Zod 4 → Drizzle → Hono OpenAPI → Hono RPC → TanStack Query
2. Clear separation of concerns across monorepo packages
3. Comprehensive enforcement rules prevent AI agent conflicts
4. Every FR domain mapped to specific files and routes
5. Better Auth eliminates custom auth complexity (~500 lines of JWT/token code removed)

**Areas for Future Enhancement:**

1. Real-time updates (WebSocket via DOs) — polling sufficient for MVP
2. KV caching layer — add when performance data warrants it
3. Advanced observability (Logpush, external APM) — Workers Observability sufficient initially
4. Multi-region D1 replicas — single region sufficient for Year 1 scale

### Implementation Handoff

**AI Agent Guidelines:**

- Follow ALL architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and layer boundaries
- Refer to this document for all architectural questions
- When in doubt, prefer the pattern documented here over alternatives

**Implementation Sequence:**

1. `@devsage/config` — Update tsconfig variants, ESLint config
2. `@devsage/shared` — Upgrade to Zod 4, rewrite all schemas
3. `@devsage/db` — Upgrade Drizzle 0.45.x, rewrite schemas, generate migrations
4. `apps/api` — Better Auth + `@hono/zod-openapi` routes + Drizzle queries
5. `apps/web` — React 19 + TanStack Router + Hono RPC client
6. `apps/platform` — Same frontend architecture as web
7. `apps/admin` — Same frontend architecture as web
8. `tests/e2e/` — Playwright E2E tests
