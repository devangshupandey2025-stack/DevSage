# DevSage API Architecture & Conventions

> **Standalone reference** — everything you need to understand, develop for, and operate the DevSage API.
>
> Last updated: 2025-07-15 · Branch: main

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Entrypoint](#3-entrypoint)
4. [Middleware Chain](#4-middleware-chain)
5. [Route Architecture](#5-route-architecture)
6. [Response Conventions](#6-response-conventions)
7. [Error Handling](#7-error-handling)
8. [Database Access Pattern](#8-database-access-pattern)
9. [Environment & Bindings](#9-environment--bindings)
10. [Durable Objects](#10-durable-objects)
11. [Queue System](#11-queue-system)
12. [Cron Jobs](#12-cron-jobs)
13. [Service Layer](#13-service-layer)
14. [Authentication Architecture](#14-authentication-architecture)
15. [Testing Architecture](#15-testing-architecture)
16. [Deployment](#16-deployment)
17. [Conventions](#17-conventions)
18. [Known Issues & Future Architecture Plans](#18-known-issues--future-architecture-plans)

---

## 1. Overview

The DevSage API is a **single Cloudflare Worker** built with the **Hono** framework. It handles:

- **REST API** — CRUD for hackathons, teams, submissions, judging, notifications, etc.
- **Authentication** — Cookie-based JWT auth with refresh-token rotation (served from `/auth/*`)
- **Durable Objects** — `HackathonStateMachine` for lifecycle management and submission locking
- **Queues** — Async processing of GitHub webhooks and notification fan-out
- **Cron** — Hourly scheduled tasks (deadline transitions, reminders, audit backfill)

**Runtime:** Cloudflare Workers (V8 isolate, no Node.js APIs unless opted in via `nodejs_compat`)

**Framework stack:**
| Layer | Technology |
|-------|-----------|
| HTTP framework | Hono |
| Database | Cloudflare D1 (SQLite) via raw SQL |
| Schema definitions | Drizzle ORM (build-time only) |
| Validation | Zod (in `@devsage/shared`, not yet wired to routes) |
| State management | Durable Objects (SQLite-backed) |
| Async processing | Cloudflare Queues |
| Caching | Cloudflare KV |
| Auth | Custom HMAC-SHA256 JWT via `crypto.subtle` |

**Package:** `@devsage/api` at `apps/api/`

---

## 2. Architecture Diagram

```
                            ┌──────────────────────────────────────────────────────┐
                            │                  Cloudflare Edge                      │
                            │                                                      │
  Client Request            │  ┌─────────────────────────────────────────────┐     │
  (browser/mobile)          │  │            Worker: @devsage/api              │     │
  ──────────────────────►   │  │                                             │     │
                            │  │  ┌─────────┐  ┌──────────┐  ┌───────────┐  │     │
  HTTPS + Cookie            │  │  │  CORS   │→│ Request  │→│ Optional  │  │     │
                            │  │  │         │  │    ID    │  │   Auth    │  │     │
                            │  │  └─────────┘  └──────────┘  └─────┬─────┘  │     │
                            │  │                                    │        │     │
                            │  │                    ┌───────────────┴──────┐ │     │
                            │  │                    │    Route Handler     │ │     │
                            │  │                    │ (per-route middleware│ │     │
                            │  │                    │  + business logic)   │ │     │
                            │  │                    └──┬───┬───┬───┬──────┘ │     │
                            │  │                       │   │   │   │        │     │
                            │  │              ┌────────┘   │   │   └──────┐ │     │
                            │  │              ▼            ▼   ▼          ▼ │     │
                            │  │         ┌────────┐  ┌────┐ ┌──────┐ ┌───┐ │     │
                            │  │         │   D1   │  │ KV │ │  DO  │ │ Q │ │     │
                            │  │         │(SQLite)│  │    │ │(HSM) │ │   │ │     │
                            │  │         └────────┘  └────┘ └──────┘ └─┬─┘ │     │
                            │  │                                       │   │     │
                            │  │    ┌──────────────────────────────────┘   │     │
                            │  │    │  Queue Consumer (same Worker)        │     │
                            │  │    │  ┌──────────────┐ ┌──────────────┐   │     │
                            │  │    │  │ github-webhooks│ │devsage-notif │   │     │
                            │  │    │  └──────────────┘ └──────────────┘   │     │
                            │  │    │                                      │     │
                            │  │    │  Cron (0 * * * *) ──────────────────►│     │
                            │  │    │  • Deadline transitions              │     │
                            │  │    │  • Reminder notifications            │     │
                            │  │    │  • Audit hash backfill               │     │
                            │  └────┴──────────────────────────────────────┘     │
                            └──────────────────────────────────────────────────────┘

  Legend:
    D1  = Cloudflare D1 (SQLite database, ~38 tables)
    KV  = Cloudflare KV (rate limiting, OAuth state, role cache)
    DO  = Durable Object: HackathonStateMachine (lifecycle + submission locks)
    Q   = Cloudflare Queues (github-webhooks, devsage-notifications)
    HSM = HackathonStateMachine
```

**Request flow:**

```
Client → HTTPS → Worker fetch()
  → corsMiddleware          (set CORS headers)
  → requestIdMiddleware     (generate X-Request-Id)
  → optionalAuth            (extract JWT from cookie, resolve user + roles)
  → [errorHandler wraps everything via app.onError]
  → Route match
    → [hackathonContext]    (resolve :slug → hackathon record)
    → [authMiddleware]      (require authenticated user)
    → [requireRole()]       (check hackathon role hierarchy)
    → [requirePlatformAdmin](check platform_admins table)
    → [rateLimitMiddleware] (per-tier rate limiting via KV)
    → [kvCache()]           (KV-based response cache for public GETs)
    → Handler function
      → D1 queries / DO calls / Queue enqueue
      → successResponse() / errorResponse()
  → Response with envelope
```

---

## 3. Entrypoint

**File:** `apps/api/src/index.ts`

### Exports

The Worker exports three handlers as required by Cloudflare:

```typescript
export default {
  fetch: app.fetch,       // HTTP request handler (Hono)
  queue: queueHandler,    // Queue message consumer
  scheduled: cronHandler  // Cron trigger handler
}
```

### Durable Object Re-export

Wrangler requires DO classes to be exported from the entrypoint:

```typescript
export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js'
```

> **Critical:** If a DO class is not re-exported from `src/index.ts`, `wrangler deploy` will fail silently or throw a binding error.

### Global Middleware (applied to all routes)

```typescript
const app = new Hono<AppEnv>()
app.use('*', corsMiddleware)
app.use('*', requestIdMiddleware)
app.use('*', optionalAuth)
app.onError(errorHandler)
```

### Health Check Routes

```
GET /         → "DevSage API running"
GET /health   → { ok: true, timestamp: "<ISO-8601>" }
```

### Route Mounting Order

```typescript
// Auth & webhooks (no /api/v1 prefix)
app.route('/auth', auth)
app.route('/webhooks', webhooks)

// API v1 routes
app.route('/api/v1/hackathons', hackathons)
// Nested hackathon sub-routes (mounted under /api/v1/hackathons/:slug/...)
app.route('/api/v1/hackathons/:slug/teams', teams)
app.route('/api/v1/hackathons/:slug/teams', teamRepos)      // team repo endpoints
app.route('/api/v1/hackathons/:slug/submissions', submissions)
app.route('/api/v1/hackathons/:slug/judging', judging)
app.route('/api/v1/hackathons/:slug/rounds', rounds)
app.route('/api/v1/hackathons/:slug/organizers', organizers)
app.route('/api/v1/hackathons/:slug/audit', audit)
app.route('/api/v1/hackathons/:slug/announcements', announcements)

// Non-hackathon-scoped routes
app.route('/api/v1/workspaces', workspaces)
app.route('/api/v1/admin', admin)
app.route('/api/v1/notifications', notifications)
app.route('/api/v1/invites', invites)
app.route('/api/v1/judge', judgePortal)
app.route('/api/v1/hackathon-requests', hackathonRequests)
```

---

## 4. Middleware Chain

### Global Middleware (runs on every request, in order)

#### 4.1 CORS — `src/middleware/cors.ts`

| Property | Value |
|----------|-------|
| **When** | Every request (global) |
| **What** | Configures Cross-Origin Resource Sharing headers |
| **Allowed origins** | Dynamic from `getAllowedOrigins()`: `FRONTEND_URL`, `PLATFORM_URL`, `ADMIN_URL`, `JUDGE_URL` + wildcard patterns (`*.pages.dev`, `*.workers.dev`) |
| **Methods** | GET, POST, PUT, PATCH, DELETE, OPTIONS |
| **Allowed headers** | Content-Type, Authorization, If-None-Match |
| **Exposed headers** | ETag, X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After |
| **Credentials** | `true` (cookies sent cross-origin) |
| **Max age** | 86400s (24 hours) |
| **Context set** | None (headers only) |

#### 4.2 Request ID — `src/middleware/request-id.ts`

| Property | Value |
|----------|-------|
| **When** | Every request (global) |
| **What** | Generates a UUID for request tracing |
| **Implementation** | `crypto.randomUUID()` |
| **Context set** | `c.set('requestId', uuid)` |
| **Response header** | `X-Request-Id: <uuid>` |

#### 4.3 Optional Auth — `src/middleware/auth.ts`

| Property | Value |
|----------|-------|
| **When** | Every request (global) |
| **What** | Extracts and validates JWT; resolves user with all roles |
| **Token sources** | 1) `access_token` cookie 2) `Authorization: Bearer <token>` header |
| **On success** | Queries DB for full user profile + resolves workspace roles, hackathon roles, platform admin status |
| **On failure** | Sets `c.set('user', null)` — does NOT reject the request |
| **Context set** | `user: { id, email, name, avatar_url, github_username, created_at, workspaceRoles, hackathonRoles, platformAdmin }` or `null` |

**Role resolution in optionalAuth:**

```
For each user, the middleware queries:
  workspace_members   → workspaceRoles[workspace_id] = role
  organizer_roles     → hackathonRoles[hackathon_slug][] = role
  judges              → hackathonRoles[hackathon_slug][] = 'judge'
  team_members        → hackathonRoles[hackathon_slug][] = team role
  platform_admins     → platformAdmin = true/false
```

#### 4.4 Error Handler — `src/middleware/error-handler.ts`

| Property | Value |
|----------|-------|
| **When** | On uncaught errors (global via `app.onError`) |
| **What** | Catches unhandled exceptions, logs with requestId, returns structured error |
| **Dev mode** | When `NODE_ENV === 'development'` or `JWT_SECRET` starts with `'dev'`: includes `error.message` + `error.stack` |
| **Prod mode** | Generic error message only |
| **Response** | `500 { ok: false, error: { code: 'INTERNAL_ERROR', message: '...', requestId } }` |

### Per-Route Middleware

#### 4.5 Auth Required — `src/middleware/auth.ts`

| Property | Value |
|----------|-------|
| **When** | Applied to protected routes |
| **What** | Requires `c.get('user')` to be non-null |
| **On failure** | `401 { ok: false, error: { code: 'AUTH_REQUIRED' } }` |

#### 4.6 Hackathon Context — `src/middleware/hackathon.ts`

| Property | Value |
|----------|-------|
| **When** | Routes under `/api/v1/hackathons/:slug/...` |
| **What** | Extracts `:slug` param, queries hackathon from D1 |
| **On missing slug** | `400` |
| **On not found** | `404` |
| **Context set** | `hackathon: { id, workspace_id, slug, status }` |

#### 4.7 Role Check — `src/middleware/role.ts`

**`requireRole(minRole)`**

| Property | Value |
|----------|-------|
| **When** | Routes needing minimum hackathon role |
| **What** | Resolves user's highest role for the hackathon, checks against hierarchy |
| **Role hierarchy** | `organizer(1) > co_organizer(2) > judge(3) > team_lead(4) > team_member(5) > anonymous(6)` |
| **Resolution** | Single UNION ALL query with priority ordering; cached in KV (60s TTL) |
| **On failure** | `403 { ok: false, error: { code: 'FORBIDDEN' } }` |
| **Context set** | `role` (the resolved role) |

**`requireExactRole(...roles)`**

Same as above but requires the role to exactly match one of the specified roles (no hierarchy).

**Role resolution priority (UNION ALL query):**

```
1. organizer_roles (role = 'organizer')       → priority 1
2. organizer_roles (role = 'co_organizer')    → priority 2
3. judges (status = 'accepted')               → priority 3
4. team_members (role = 'leader')             → priority 4
5. team_members (role = 'member')             → priority 5
6. workspace_members (role = 'owner'/'admin') → priority 6/7
7. Fallback                                   → anonymous
```

#### 4.8 Platform Admin — `src/middleware/platform-admin.ts`

| Property | Value |
|----------|-------|
| **When** | Admin routes (`/api/v1/admin/*`) |
| **What** | Checks `platform_admins` table for user_id |
| **Requires** | Authenticated user (401 if not) |
| **On failure** | `403` |
| **Context set** | None |

#### 4.9 Rate Limiter — `src/middleware/rate-limit.ts`

| Tier | Limit | Applied to |
|------|-------|-----------|
| `auth` | 10/min | `/auth/*` routes |
| `api` | 100/min | General API routes |
| `webhook` | 200/min | `/webhooks/*` |
| `admin` | 50/min | `/api/v1/admin/*` |

| Property | Value |
|----------|-------|
| **Identifier** | Authenticated user ID → `cf-connecting-ip` header → `'unknown'` |
| **Storage** | KV key: `rl:{tier}:{identifier}` |
| **On exceeded** | `429` with `Retry-After` header |
| **Headers set** | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` |
| **Write pattern** | Fire-and-forget via `executionCtx.waitUntil` |

#### 4.10 KV Cache — `src/middleware/cache.ts`

| Property | Value |
|----------|-------|
| **When** | Public GET endpoints (leaderboard, hackathon list) |
| **What** | Caches JSON responses in KV with configurable TTL |
| **Skip condition** | Non-GET requests, authenticated requests (has `access_token` cookie or Bearer header) |
| **Cache key** | `cache:{full_URL}` |
| **Headers set** | `X-Cache: HIT\|MISS`, `Cache-Control` |
| **Write pattern** | Fire-and-forget via `executionCtx.waitUntil` |

---

## 5. Route Architecture

### Base URL

```
Production:  https://api.devsage.org
Local dev:   http://localhost:8787
```

### URL Structure

```
/auth/*                                          — Authentication (no /api/v1 prefix)
/webhooks/*                                      — GitHub webhooks (no /api/v1 prefix)
/api/v1/hackathons                               — Hackathon CRUD
/api/v1/hackathons/:slug/teams                   — Teams within a hackathon
/api/v1/hackathons/:slug/submissions             — Submissions
/api/v1/hackathons/:slug/judging                 — Judging, rubric, scores
/api/v1/hackathons/:slug/rounds                  — Rounds & elimination
/api/v1/hackathons/:slug/organizers              — Organizer management
/api/v1/hackathons/:slug/audit                   — Audit trail
/api/v1/hackathons/:slug/announcements           — Announcements
/api/v1/workspaces                               — Workspace management
/api/v1/admin                                    — Platform admin
/api/v1/notifications                            — User notifications
/api/v1/invites                                  — Team & judge invites
/api/v1/judge                                    — Judge portal
/api/v1/hackathon-requests                       — Hackathon creation requests
```

### Complete Route Reference

#### Auth (`/auth/*`) — Rate limited: 10/min

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/auth/register` | — | Sign up (email, password, name) |
| POST | `/auth/login` | — | Login (checks app-specific access) |
| GET | `/auth/google` | — | Initiate Google OAuth |
| GET | `/auth/callback/google` | — | Google OAuth callback |
| GET | `/auth/github` | — | Initiate GitHub OAuth |
| GET | `/auth/callback/github` | — | GitHub OAuth callback |
| POST | `/auth/refresh` | — | Rotate refresh token |
| POST | `/auth/logout` | ✓ | Revoke token family |
| GET | `/auth/me` | ✓ | Current user + roles |
| GET | `/auth/sessions` | ✓ | List active sessions |
| DELETE | `/auth/sessions/:familyId` | ✓ | Revoke specific session |
| DELETE | `/auth/sessions` | ✓ | Revoke all sessions |
| POST | `/auth/delete-account` | ✓ | Initiate account deletion |
| POST | `/auth/delete-account/confirm` | ✓ | Confirm with token |
| POST | `/auth/forgot-password` | — | Send password reset OTP (30-min TTL) |
| POST | `/auth/reset-password` | — | Reset password with token |
| POST | `/auth/change-password` | ✓ | Change password (requires current) |
| POST | `/auth/send-verification` | ✓ | Send email verification OTP |
| POST | `/auth/verify-email` | ✓ | Verify email (5 attempts, 10-min TTL) |

#### Webhooks (`/webhooks/*`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/webhooks/github` | HMAC | GitHub webhook receiver (signature verified) |

#### Hackathons (`/api/v1/hackathons`)

| Method | Path | Auth | Role | Description |
|--------|------|:----:|:----:|-------------|
| POST | `/` | ✓ | — | Create hackathon (workspace owner/admin) |
| POST | `/workspaces/:workspaceId/hackathons` | ✓ | — | Create hackathon (alternate) |
| GET | `/` | — | — | List hackathons (public, filterable) |
| GET | `/:slug` | — | — | Get hackathon by slug (ETag) |
| PATCH | `/:slug` | ✓ | co_organizer | Update hackathon |
| POST | `/:slug/transition` | ✓ | organizer | State transition via DO |
| GET | `/:slug/state` | ✓ | co_organizer | Get DO state + D1 status |
| DELETE | `/:slug` | ✓ | organizer | Delete (draft only) |

#### Teams (`/api/v1/hackathons/:slug/teams`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/me` | ✓ | Current user's team |
| POST | `/` | ✓ | Create team |
| GET | `/` | — | List teams |
| GET | `/:teamId` | — | Get team |
| GET | `/:teamId/members` | — | Get team members |
| POST | `/join` | ✓ | Join via invite code |
| PATCH | `/:teamId` | ✓ | Update team (leader/organizer) |
| DELETE | `/:teamId/members/:userId` | ✓ | Remove member |
| POST | `/:teamId/leave` | ✓ | Leave team |
| POST | `/:teamId/transfer` | ✓ | Transfer leadership |
| POST | `/:teamId/dissolve` | ✓ | Dissolve team |
| POST | `/seed` | ✓ | Bulk seed (co_organizer) |

#### Team Repos (`/api/v1/hackathons/:slug/teams`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/:teamId/repo` | ✓ | Link GitHub repo (team leader) |
| GET | `/:teamId/repo` | — | Get linked repo |
| DELETE | `/:teamId/repo` | ✓ | Unlink repo |

#### Submissions (`/api/v1/hackathons/:slug/submissions`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/github/repos` | ✓ | List user's GitHub repos |
| POST | `/github/analyze` | ✓ | Analyze repo (tech stack) |
| POST | `/github/ai-review` | ✓ | AI review via Gemini |
| GET | `/` | — | List submissions (filterable) |
| GET | `/ai-leaderboard` | — | AI score leaderboard |
| GET | `/team/:teamId/current` | — | Team's current submission |
| GET | `/:submissionId` | — | Get submission |
| POST | `/` | ✓ | Create/update submission |

#### Judging (`/api/v1/hackathons/:slug/judging`)

| Method | Path | Auth | Role | Description |
|--------|------|:----:|:----:|-------------|
| POST | `/rubric` | ✓ | co_organizer | Create rubric criterion |
| GET | `/rubric` | — | — | List rubric |
| PATCH | `/rubric/:criterionId` | ✓ | co_organizer | Update criterion |
| DELETE | `/rubric/:criterionId` | ✓ | co_organizer | Delete criterion |
| POST | `/judges` | ✓ | co_organizer | Add judge |
| POST | `/judges/bulk` | ✓ | co_organizer | Bulk invite (≤50) |
| GET | `/judges` | — | — | List judges |
| DELETE | `/judges/:judgeId` | ✓ | co_organizer | Remove judge |
| POST | `/judges/create-account` | ✓ | co_organizer | Create judge account |
| POST | `/judges/:judgeId/tracks` | ✓ | co_organizer | Assign to track |
| POST | `/judges/:judgeId/accept` | ✓ | co_organizer | Accept pending judge |
| POST | `/assign` | ✓ | co_organizer | Auto-assign round-robin |
| GET | `/judges/:judgeId/assignments` | ✓ | — | Judge assignments |
| GET | `/my-assignments` | ✓ | — | Current user's assignments |
| GET | `/my-scores` | ✓ | — | Current user's scores |
| POST | `/submissions/:id/scores` | ✓ | judge | Submit scores |
| GET | `/submissions/:id/scores` | ✓ | judge | Get scores |
| GET | `/leaderboard` | — | — | Leaderboard (ETag, filterable) |
| POST | `/assignments/:id/coi` | ✓ | judge | Declare conflict of interest |
| GET | `/coi` | ✓ | co_organizer | List COI declarations |
| POST | `/assignments/:id/reassign` | ✓ | co_organizer | Reassign conflicted |
| POST | `/results/publish` | ✓ | organizer | Publish final results |

#### Rounds (`/api/v1/hackathons/:slug/rounds`)

| Method | Path | Auth | Role | Description |
|--------|------|:----:|:----:|-------------|
| POST | `/` | ✓ | co_organizer | Create round |
| GET | `/` | — | — | List rounds |
| PATCH | `/:roundId` | ✓ | co_organizer | Update round |
| PATCH | `/:roundId/initialize` | ✓ | co_organizer | Initialize round |
| DELETE | `/:roundId` | ✓ | co_organizer | Delete round |
| GET | `/:roundId/results` | — | — | Round results |
| POST | `/:roundId/advance` | ✓ | co_organizer | Mark advancing teams |
| POST | `/:roundId/publish` | ✓ | co_organizer | Publish round results |

#### Organizers (`/api/v1/hackathons/:slug/organizers`)

| Method | Path | Auth | Role | Description |
|--------|------|:----:|:----:|-------------|
| GET | `/` | ✓ | co_organizer | List organizers |
| POST | `/` | ✓ | organizer | Add organizer |
| DELETE | `/:roleId` | ✓ | organizer | Remove organizer |

#### Announcements (`/api/v1/hackathons/:slug/announcements`)

| Method | Path | Auth | Role | Description |
|--------|------|:----:|:----:|-------------|
| GET | `/` | — | — | List announcements |
| POST | `/` | ✓ | co_organizer | Create announcement |
| PATCH | `/:announcementId` | ✓ | co_organizer | Update announcement |
| DELETE | `/:announcementId` | ✓ | co_organizer | Delete announcement |

#### Audit (`/api/v1/hackathons/:slug/audit`)

| Method | Path | Auth | Role | Description |
|--------|------|:----:|:----:|-------------|
| GET | `/` | ✓ | co_organizer | Query audit events (cursor pagination) |

#### Workspaces (`/api/v1/workspaces`)

| Method | Path | Auth | Role | Description |
|--------|------|:----:|:----:|-------------|
| POST | `/` | ✓ | platformAdmin | Create workspace |
| GET | `/` | ✓ | — | List user's workspaces |
| GET | `/:id` | ✓ | — | Get workspace (+ members, hackathons) |
| PATCH | `/:id` | ✓ | owner/admin | Update workspace |
| GET | `/:id/members` | ✓ | — | List members |
| POST | `/:id/invites` | ✓ | owner/admin | Invite member |
| DELETE | `/:id/members/:userId` | ✓ | owner | Remove member |
| GET | `/invites/token/:token` | — | — | Get invite details |
| POST | `/invites/token/:token/accept` | ✓ | — | Accept invite |
| POST | `/invites/token/:token/decline` | ✓ | — | Decline invite |

#### Admin (`/api/v1/admin`) — All routes require `platformAdmin`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users |
| GET | `/hackathons` | List all hackathons |
| POST | `/admins` | Add platform admin |
| DELETE | `/admins/:userId` | Remove platform admin |
| GET | `/admins` | List platform admins |
| POST | `/audit/backfill` | Trigger audit hash backfill |
| GET | `/stats` | System statistics |
| GET | `/hackathons/:id` | Hackathon detail |
| GET | `/hackathons/:id/rounds` | List rounds |
| PATCH | `/hackathons/:id/rounds/:roundId/initialize` | Initialize round |
| GET | `/invites` | List platform invites |
| POST | `/invites` | Create platform invite |
| DELETE | `/invites/:id` | Revoke invite |
| GET | `/workspaces` | List all workspaces |
| POST | `/workspaces` | Create workspace |
| GET | `/workspaces/:id` | Get workspace detail |

#### Notifications (`/api/v1/notifications`) — All require auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List notifications (filterable by hackathon_id) |
| GET | `/unread-count` | Unread count |
| PATCH | `/:id/read` | Mark as read |
| PATCH | `/read-all` | Mark all as read |

#### Invites (`/api/v1/invites`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/team/:token` | ✓ | Accept team invite |
| GET | `/judge/:id/details` | — | Judge invite details |
| POST | `/judge/:id` | ✓ | Accept judge invite |
| POST | `/judge/:id/decline` | — | Decline judge invite |
| GET | `/judge/token/:token` | — | Judge invite by token |
| POST | `/judge/token/:token/accept` | — | Accept by token |
| POST | `/judge/token/:token/decline` | — | Decline by token |

#### Judge Portal (`/api/v1/judge`) — All require auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hackathons` | Hackathons where user is accepted judge |

#### Hackathon Requests (`/api/v1/hackathon-requests`)

| Method | Path | Auth | Role | Description |
|--------|------|:----:|:----:|-------------|
| POST | `/` | ✓ | — | Create request |
| GET | `/` | ✓ | — | List own requests |
| GET | `/:id` | ✓ | — | Get specific request |
| GET | `/admin/all` | ✓ | platformAdmin | List all requests |
| PATCH | `/admin/:id` | ✓ | platformAdmin | Update request status |
| PUT | `/:id/resubmit` | ✓ | — | Resubmit after changes_requested |
| GET | `/admin/stats` | ✓ | platformAdmin | Stats by status |

---

## 6. Response Conventions

### Standard Envelope

**All** API responses use a consistent JSON envelope defined in `src/lib/response.ts`.

#### Success Response

```json
{
  "ok": true,
  "data": { ... },
  "meta": { ... }          // optional
}
```

#### Error Response

```json
{
  "ok": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Hackathon not found",
    "details": { ... }     // optional, dev mode only for 500s
  }
}
```

### Helper Functions

| Function | Default Status | Usage |
|----------|:-------------:|-------|
| `successResponse(c, data, status?, meta?)` | 200 | Standard success |
| `errorResponse(c, status, code, message, details?)` | — | Error response |
| `paginatedResponse(c, data, total, limit, offset)` | 200 | Offset-based pagination |
| `cursorPaginatedResponse(c, data, nextCursor, hasMore)` | 200 | Cursor-based pagination |

### Pagination

**Offset-based (default)** — used for most list endpoints:

```
GET /api/v1/hackathons?limit=20&offset=0

Response meta:
{
  "total": 142,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```

| Parameter | Default | Range |
|-----------|:-------:|:-----:|
| `limit` | 20 | 1–100 |
| `offset` | 0 | ≥ 0 |

**Cursor-based** — used for append-only data (audit logs, commit history, notifications):

```
GET /api/v1/hackathons/:slug/audit?limit=50&cursor=<opaque>

Response meta:
{
  "next_cursor": "eyJpZCI6...",
  "has_more": true
}
```

### ETag Caching

Select endpoints return `ETag` headers (SHA-256 of response body, first 32 hex chars). Clients send `If-None-Match` to receive `304 Not Modified`.

Used on: hackathon detail (`GET /:slug`), leaderboard.

### Status Codes

| Code | Meaning | When |
|:----:|---------|------|
| 200 | OK | Successful read or update |
| 201 | Created | Successful resource creation |
| 304 | Not Modified | ETag match |
| 400 | Bad Request | Missing/invalid parameters |
| 401 | Unauthorized | No valid token |
| 403 | Forbidden | Insufficient role/permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | State transition conflict, duplicate resource |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception |

---

## 7. Error Handling

### Global Error Handler

The `errorHandler` in `src/middleware/error-handler.ts` catches all uncaught exceptions:

```typescript
app.onError(errorHandler)
```

**Behavior:**
- Logs error with `requestId` prefix for traceability
- **Development mode** (NODE_ENV=development or JWT_SECRET starts with 'dev'): includes `error.message` and `error.stack` in response
- **Production mode**: returns generic error message only

### Error Code Catalog

| Code | HTTP | Description |
|------|:----:|-------------|
| `AUTH_REQUIRED` | 401 | No authentication token provided |
| `INVALID_TOKEN` | 401 | JWT verification failed or expired |
| `FORBIDDEN` | 403 | Insufficient role for this operation |
| `NOT_PLATFORM_ADMIN` | 403 | User is not a platform admin |
| `RESOURCE_NOT_FOUND` | 404 | Requested entity does not exist |
| `HACKATHON_NOT_FOUND` | 404 | Hackathon slug not found |
| `TEAM_NOT_FOUND` | 404 | Team does not exist |
| `ALREADY_EXISTS` | 409 | Resource already exists (duplicate) |
| `INVALID_TRANSITION` | 409 | State machine transition not allowed |
| `VERSION_CONFLICT` | 409 | Optimistic locking version mismatch |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `MISSING_FIELD` | 400 | Required field not provided |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

### Per-Route Error Patterns

Routes follow a consistent pattern:

```typescript
// 1. Validate input
if (!body.name) return errorResponse(c, 400, 'MISSING_FIELD', 'name is required')

// 2. Check existence
const record = await db.prepare('SELECT ...').bind(id).first()
if (!record) return errorResponse(c, 404, 'RESOURCE_NOT_FOUND', 'Not found')

// 3. Check permissions (via middleware or inline)
if (record.user_id !== user.id) return errorResponse(c, 403, 'FORBIDDEN', '...')

// 4. Perform operation
await db.prepare('INSERT ...').bind(...).run()

// 5. Audit
await insertAuditEvent(db, { ... })

// 6. Return
return successResponse(c, result, 201)
```

---

## 8. Database Access Pattern

### Runtime: Raw SQL via D1

The API uses **raw SQL** through the D1 `prepare/bind/first/all/run` API. Drizzle ORM schemas exist in `packages/db/` for migration generation, but are **not used at runtime** in route handlers.

```typescript
// Single row
const user = await db.prepare(
  'SELECT id, email, name FROM users WHERE id = ?'
).bind(userId).first()

// Multiple rows
const { results } = await db.prepare(
  'SELECT * FROM hackathons WHERE status = ? LIMIT ? OFFSET ?'
).bind('active', limit, offset).all()

// Insert
await db.prepare(
  'INSERT INTO teams (id, hackathon_id, name) VALUES (?, ?, ?)'
).bind(crypto.randomUUID(), hackathonId, name).run()

// Count
const { total } = await db.prepare(
  'SELECT COUNT(*) as total FROM teams WHERE hackathon_id = ?'
).bind(hackathonId).first()
```

### Batch Operations

D1 supports batched queries for transactional guarantees:

```typescript
await db.batch([
  db.prepare('INSERT INTO ...').bind(...),
  db.prepare('UPDATE ...').bind(...),
  db.prepare('DELETE ...').bind(...)
])
```

> **D1 limitation:** Maximum 100 bound parameters per statement. Chunking is used for large inserts (e.g., commit log ingestion).

### Key Patterns

| Pattern | Usage |
|---------|-------|
| `db.prepare().bind().first()` | Single row lookup |
| `db.prepare().bind().all()` | Multi-row query (returns `{ results }`) |
| `db.prepare().bind().run()` | Mutations (INSERT/UPDATE/DELETE, returns `{ meta }`) |
| `db.batch([...])` | Atomic multi-statement operations |
| `INSERT OR IGNORE` | Idempotent inserts (dedup) |
| `INSERT OR REPLACE` | Upsert pattern |

### ID Generation

All primary keys use UUIDs generated via `crypto.randomUUID()` (Workers-native, no external library).

---

## 9. Environment & Bindings

### Type Definition

Defined in `apps/api/src/types/env.ts` as `AppEnv` (Hono generic):

```typescript
type AppEnv = {
  Bindings: {
    // Cloudflare resources
    DB: D1Database
    KV: KVNamespace
    HACKATHON_SM: DurableObjectNamespace    // HackathonStateMachine
    WEBHOOK_QUEUE: Queue                     // github-webhooks
    NOTIFICATION_QUEUE: Queue                // devsage-notifications

    // Secrets
    JWT_SECRET: string
    GITHUB_WEBHOOK_SECRET: string
    GITHUB_CLIENT_ID: string
    GITHUB_CLIENT_SECRET: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    GEMINI_API_KEY: string
    SMTP_URL: string
    SMTP_USERNAME: string
    SMTP_PASSWORD: string
    EMAIL_FROM: string

    // URL configuration
    API_URL: string
    FRONTEND_URL: string
    PLATFORM_URL: string
    ADMIN_URL: string
    JUDGE_URL: string
    ALLOWED_ORIGIN_PATTERNS: string          // comma-separated glob patterns
  }
  Variables: {
    user: UserContext | null
    requestId: string
    hackathon: { id: string; workspace_id: string; slug: string; status: string }
    role: HackathonRole
  }
}
```

### Wrangler Configuration (`wrangler.jsonc`)

| Binding | Type | Details |
|---------|------|---------|
| `DB` | D1 | Database `devsage-db`, migrations at `../../packages/db/migrations` |
| `KV` | KV Namespace | Rate limiting, OAuth state, role cache, installation tokens |
| `HACKATHON_SM` | Durable Object | Class `HackathonStateMachine`, SQLite-backed (`new_sqlite_classes`) |
| `WEBHOOK_QUEUE` | Queue | `github-webhooks` (max batch 10, 3 retries) |
| `NOTIFICATION_QUEUE` | Queue | `devsage-notifications` (max batch 10, 3 retries) |

**Other configuration:**
- **Compatibility date:** 2024-12-30
- **Compatibility flags:** `nodejs_compat`
- **Cron triggers:** `0 * * * *` (hourly)
- **DO migrations:** v1 → v2 (renamed from separate Lifecycle/Submission DOs to unified HackathonStateMachine)

### Secrets Management

| Environment | Method |
|------------|--------|
| Local dev | `apps/api/.dev.vars` (gitignored) |
| Production | `wrangler secret put KEY` or `wrangler secret bulk .env.production` |
| Tests | Miniflare bindings in `vitest.config.ts` |

**Required secrets:** `JWT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `SMTP_URL`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_FROM`

---

## 10. Durable Objects

### HackathonStateMachine

**File:** `apps/api/src/durable-objects/hackathon-state-machine.ts`

A SQLite-backed Durable Object managing hackathon lifecycle and submission concurrency.

#### State Machine

```
  draft ──► active ──► judging ──► completed ──► archived
                                        ▲            │
                                        └────────────┘
                                      (un-archive for
                                       score corrections)
```

**Forward-only transitions** (except `archived → completed`).

#### Internal SQLite Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `lifecycle_state` | `hackathon_id` (PK), `status`, `version`, `updated_at` | Current state + optimistic locking version |
| `submission_locks` | `submission_key` (PK), `submission_id`, `locked_at` | Exactly-once submission acceptance |
| `team_submissions` | `team_id` (PK), `count` | Per-team submission counter |

#### HTTP Endpoints (internal, called via DO stub)

| Path | Method | Description |
|------|--------|-------------|
| `/initialize` | POST | Set initial state (idempotent). Sets alarm if `active` with future deadline |
| `/transition` | POST | State transition with optimistic locking. `version=-1` bypasses for cron/alarm |
| `/state` | GET | Read current state (`{ hackathon_id, status, version, updated_at }`) |
| `/accept-submission` | POST | Atomic submission lock. Returns `{ accepted: bool, reason? }` |

#### Optimistic Locking

```
Client sends: { target_status: "judging", version: 3 }
DO checks:    current version == 3?
  YES → transition, increment to version 4
  NO  → 409 VERSION_CONFLICT
```

#### Alarm Handler

When a hackathon transitions to `active` with a submission deadline, the DO sets a Cloudflare alarm:

```
deadline reached → alarm fires → auto-transition active → judging → sync D1 → enqueue notification
```

#### Usage from Route Handlers

```typescript
import { getHackathonDOStub } from '../lib/do-client.js'

const stub = getHackathonDOStub(c.env.HACKATHON_SM, hackathonId)
const res = await stub.fetch('http://do/transition', {
  method: 'POST',
  body: JSON.stringify({ target_status: 'judging', version: currentVersion })
})
```

---

## 11. Queue System

### Architecture

Two queues, both consumed by the **same Worker** (producer and consumer in one deployment):

```
Route handler ──enqueue──► WEBHOOK_QUEUE ──consume──► Queue handlers (same Worker)
                        ──► NOTIFICATION_QUEUE ──────►
```

**Configuration:** Max batch size 10, max retries 3.

### Queue Dispatcher (`src/queue/index.ts`)

Routes messages by queue name:

```
github-webhooks      → push-handler / tag-create-handler / tag-delete-handler / installation-handler
devsage-notifications → notification-handler
```

### GitHub Webhook Handlers

| Handler | Event Types | What It Does |
|---------|------------|--------------|
| `push-handler.ts` | `push` | Logs commits to `commit_log` (chunked for 100-param limit), detects force pushes |
| `tag-create-handler.ts` | `tag_created` | Pattern-matches tag → locks submission via DO → inserts submission record → audits |
| `tag-delete-handler.ts` | `tag_deleted` | Marks submission as `tag_deleted`, clears `is_final` |
| `installation-handler.ts` | `github_installation`, `repos_added`, `repos_removed` | Activates/deactivates GitHub bot on team repos |

### Notification Handler (`src/queue/notification-handler.ts`)

Processes notification messages with:

1. **Idempotency** — dedup via `idempotency_key` hash
2. **Recipient resolution** — queries DB for target users based on notification type
3. **Fan-out** — per recipient: insert `in_app_notifications` + send email
4. **Delivery tracking** — logs to `notification_deliveries` table

**Supported notification types (24):**

```
submission.received, submission.validated, submission.tag_deleted
deadline_reminder, force_push_detected, team_joined
judge.invited, hackathon.judging_started, results.published
hackathon.request.submitted, .under_review, .approved, .rejected,
  .changes_requested, .building, .ready
... and more
```

---

## 12. Cron Jobs

**Schedule:** `0 * * * *` (hourly)

**Handler:** `src/cron/index.ts`

Three tasks run sequentially (each with independent error handling):

### 12.1 Check Submission Deadlines

Finds active hackathons whose latest round deadline has passed → triggers `active → judging` transition via DO → syncs D1 → enqueues notification.

### 12.2 Send Deadline Reminders

Scans active rounds with approaching deadlines:
- **24-hour reminder:** deadline 23–24 hours away
- **1-hour reminder:** deadline 0–1 hour away

Enqueues `deadline_reminder` notification with `hours_remaining` metadata.

### 12.3 Backfill Audit Hashes

Retroactively computes SHA-256 hash chain for audit events missing hashes. Batch size: 100.

---

## 13. Service Layer

**Location:** `apps/api/src/services/`

All services follow the **fail-open pattern**: 10-second timeout via AbortController, log warnings, never throw.

| Service | File | Exports | Pattern |
|---------|------|---------|---------|
| **Email** | `email.ts` | `sendEmail()` | Returns `false` on failure, never throws. Falls back 587→465 |
| **SMTP** | `smtp.ts` | `sendSmtp()`, `parseSmtpUrl()` | Raw SMTP over Workers TCP sockets. Supports STARTTLS (587) and direct TLS (465). RFC 2822 dot-stuffing |
| **GitHub** | `github.ts` | `getInstallationToken()`, `postCommitStatus()`, `getTagSha()` | 10s timeout. Token cached in KV. Handles annotated tag references |
| **Judging** | `judging-service.ts` | `assignSubmissionsRoundRobin()`, `computeLeaderboard()` | Round-robin distribution avoiding duplicates. Two-level leaderboard: per-judge sums → cross-judge averages |

---

## 14. Authentication Architecture

### Dual-Token Cookie Model

```
┌────────────┐    POST /auth/login     ┌──────────────┐
│   Client   │ ──────────────────────► │  API Worker   │
│ (browser)  │ ◄────────────────────── │              │
│            │  Set-Cookie:            │  Verify creds │
│            │   access_token (15m)    │  Sign JWT     │
│            │   refresh_token (30d)   │  Store refresh│
└────────────┘                         └──────────────┘
```

### Access Token (JWT)

| Property | Value |
|----------|-------|
| Algorithm | HMAC-SHA256 via `crypto.subtle` |
| Expiry | 15 minutes |
| Storage | HttpOnly cookie (`access_token`), path `/` |
| Payload | `{ sub, ghid, ghu, fam, iat, exp }` |

### Refresh Token

| Property | Value |
|----------|-------|
| Format | 32 random bytes (hex string) |
| Expiry | 30 days |
| Storage | HttpOnly cookie (`refresh_token`), path `/auth/refresh` |
| DB storage | SHA-256 hash only (never plaintext) |
| Rotation | New token issued on each refresh; old token revoked |
| Family tracking | Token families for replay detection |
| Grace period | 2 seconds (handles concurrent refresh requests) |

### Password Hashing

| Property | Value |
|----------|-------|
| Algorithm | PBKDF2-HMAC-SHA-256 |
| Iterations | 100,000 |
| Salt | 16 random bytes |
| Format | `base64(salt):base64(hash)` |
| Verification | Timing-safe via dual HMAC comparison |

### OAuth Flows

| Provider | Scopes | State Storage |
|----------|--------|--------------|
| Google | `openid email profile` | KV (10-min TTL, one-time use) |
| GitHub | `read:user user:email` | KV (10-min TTL, one-time use) |

### Cookie Configuration

| Cookie | HttpOnly | Secure | SameSite | Path | Max-Age |
|--------|:--------:|:------:|:--------:|------|:-------:|
| `access_token` | ✓ | HTTPS only | Lax | `/` | 15 min |
| `refresh_token` | ✓ | HTTPS only | Lax | `/auth/refresh` | 30 days |

---

## 15. Testing Architecture

### Framework

- **Runner:** Vitest
- **Pool:** `@cloudflare/vitest-pool-workers` — runs tests inside the actual Workers runtime with real D1, KV, and DO bindings
- **Mode:** `singleWorker: true`, `isolatedStorage: false`

### Configuration (`vitest.config.ts`)

```typescript
{
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        singleWorker: true,
        isolatedStorage: false,
        miniflare: {
          bindings: {
            JWT_SECRET: 'dev-secret-key-min-32-chars-long!!',
            GITHUB_WEBHOOK_SECRET: '...',
            FRONTEND_URL: 'http://localhost:5173',
            // ... all required secrets for testing
          }
        }
      }
    }
  }
}
```

### Test Helpers (`src/__tests__/helpers.ts`)

| Helper | Purpose |
|--------|---------|
| `ensureSchema()` | Creates all 30+ tables (called in `beforeAll`) |
| `resetDb()` | Truncates all tables (called in `beforeEach`) |
| `authCookie(userId, overrides?)` | Generates Bearer token with optional role/admin overrides |
| `insertUser()` | Insert test user |
| `insertHackathon()` | Insert test hackathon |
| `insertTeam()` / `insertTeamMember()` | Insert team fixtures |
| `insertJudge()` / `insertRubricCriterion()` | Insert judging fixtures |
| `insertSubmission()` / `insertRound()` | Insert submission/round fixtures |
| `seedFullScenario()` | Creates complete test environment (users, workspace, hackathon, rounds, teams, judges) |

### Test Pattern

```typescript
import { env, SELF } from 'cloudflare:test'
import { ensureSchema, resetDb, authCookie, insertUser, SEED } from './helpers'

describe('resource routes', () => {
  beforeAll(async () => { await ensureSchema() })
  beforeEach(async () => { await resetDb() })

  it('GET /api/v1/resource — unauthenticated → 401', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/resource')
    expect(res.status).toBe(401)
    const body = await res.json() as ApiResponse
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('GET /api/v1/resource — success', async () => {
    await insertUser(SEED.admin.id, SEED.admin.email, SEED.admin.name)
    const res = await SELF.fetch('http://localhost/api/v1/resource', {
      headers: { Authorization: await authCookie(SEED.admin.id) }
    })
    expect(res.status).toBe(200)
    const body = await res.json() as ApiResponse
    expect(body.ok).toBe(true)
  })
})
```

### Test Files (25 suites)

```
admin.test.ts              hackathons.test.ts        platform-middleware.test.ts
audit.test.ts              invites.test.ts           queue-handlers.test.ts
cors.test.ts               judging.test.ts           response.test.ts
cron.test.ts               lifecycle-do.test.ts      role.test.ts
e2e-lifecycle.test.ts      notification-handler.test.ts  rounds.test.ts
github.test.ts             notifications.test.ts     submissions.test.ts
hackathon-state-machine.test.ts  organizers.test.ts  team-repos.test.ts
                           teams.test.ts             webhooks.test.ts
                           workspaces.test.ts
```

### Running Tests

```bash
pnpm --filter @devsage/api test                    # All API tests
pnpm --filter @devsage/api exec vitest run src/__tests__/hackathons.test.ts  # Single file
```

---

## 16. Deployment

### Wrangler Configuration

- **Config file:** `apps/api/wrangler.jsonc` (never `.toml`)
- **Never run wrangler from repo root** — always from `apps/api/` or via pnpm filter

### Deploy Commands

```bash
pnpm deploy:api              # Deploy Worker (runs wrangler deploy)
pnpm deploy:api:secrets      # Upload secrets from .env.production
```

### Build Pipeline (`turbo.json`)

```json
{
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev":       { "dependsOn": ["^build"], "persistent": true, "cache": false },
    "test":      { "dependsOn": ["^build"] },
    "lint":      {},
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

### Environment Management

| Environment | API URL | Secrets Source |
|------------|---------|---------------|
| Local dev | `http://localhost:8787` | `apps/api/.dev.vars` |
| Production | `https://api.devsage.org` | `wrangler secret put` |
| Tests | N/A (Workers pool) | Miniflare bindings in vitest config |

---

## 17. Conventions

### ESM Strict

All barrel re-exports use explicit `.js` extensions:

```typescript
// ✅ Correct
export { successResponse } from './lib/response.js'

// ❌ Wrong
export { successResponse } from './lib/response'
```

### Console Usage

```typescript
// ❌ Banned (warn-level lint)
console.log('debug info')

// ✅ Allowed
console.warn('Non-critical issue detected')
console.error('Operation failed:', error)
```

### Timestamps

All timestamps are **UTC ISO-8601**:

```typescript
new Date().toISOString()  // "2025-07-15T12:00:00.000Z"
```

DB default: `sql\`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))\``

### UUID Generation

```typescript
crypto.randomUUID()  // Workers-native, no external library
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Route files | Kebab-case | `hackathon-requests.ts` |
| DB tables | Snake_case | `organizer_roles` |
| DB columns | Snake_case | `hackathon_id` |
| Zod schemas | camelCase with prefix | `createHackathonSchema` |
| Type exports | PascalCase | `HackathonResponse` |
| API paths | Kebab-case | `/api/v1/hackathon-requests` |
| Error codes | SCREAMING_SNAKE | `RESOURCE_NOT_FOUND` |

### Audit Trail

Every mutation logs an audit event via `insertAuditEvent()`:

- **Hash chain integrity:** `SHA-256(id : prev_hash : hackathon_id)`
- **Actor types:** `user`, `system`, `bot`, `cron`
- **Sequence:** Global counter per hackathon (genesis event has `prev_hash = null`)

### Invite Codes

8-character codes from a base58-like alphabet (excludes `0`, `1`, `I`, `O`, `l` to avoid confusion).

### KV Cache TTLs

| Key Pattern | TTL | Purpose |
|------------|:---:|---------|
| `role:{userId}:{hackathonId}` | 60s | Resolved role cache |
| `oauth-state:{state}` | 600s | OAuth state (one-time use) |
| `rl:{tier}:{identifier}` | 60s | Rate limit counters |
| `inst-token:{installationId}` | 3000s | GitHub installation tokens |
| `cache:*` | 30–3600s | Response cache (configurable) |

---

## 18. Known Issues & Future Architecture Plans

### Critical Debt

| Issue | Severity | Location | Description |
|-------|:--------:|----------|-------------|
| Insecure OTP generation | **CRITICAL** | `auth.ts` | Uses `Math.random()` instead of CSPRNG for OTP codes |
| No input validation | HIGH | All routes | No Zod validation on any route handler — all body parsing is manual |
| Expensive auth middleware | HIGH | `auth.ts` | 6 DB queries per request in `optionalAuth` |
| No password max length | MEDIUM | `password.ts` | PBKDF2 DoS vector — no upper bound on password length |
| Account deletion no cascade | HIGH | `auth.ts` | GDPR risk — related records not cleaned up |
| Queue column mismatch | HIGH | `push-handler.ts` | Queries nonexistent `github_owner`/`github_repo` columns |
| Duplicate state constants | MEDIUM | `constants.ts` + DO | `VALID_TRANSITIONS` defined in two places — divergence risk |

### Migration Path: Raw SQL → Drizzle ORM

Currently, all route handlers use raw D1 SQL. The Drizzle schemas in `packages/db/` are used only for migration generation.

**Planned approach:**
1. Create a thin query layer in `packages/db/` exporting typed queries
2. Migrate route handlers one resource at a time (hackathons first)
3. Gain: type-safe queries, compile-time schema validation, reduced SQL injection surface

### Migration Path: Adding Request Validation

No routes currently validate request bodies with Zod. The schemas exist in `@devsage/shared` but aren't wired in.

**Planned approach:**
1. Create a Hono middleware wrapping `zValidator` from `@hono/zod-validator`
2. Wire schemas to route handlers incrementally
3. Gain: automatic 400 errors with structured validation messages, TypeScript inference of request bodies

### Migration Path: Service Layer Extraction

Business logic is currently embedded in route handlers. Extracting to a service layer would improve testability and reuse.

**Planned approach:**
1. Create service modules in `src/services/` for each domain (hackathons, teams, judging)
2. Services accept D1 binding + params, return typed results
3. Route handlers become thin: validate → call service → respond
4. Gain: unit-testable business logic, reusable across routes and cron/queue handlers

### Other Future Plans

- **Rate limiting coverage:** Currently only applied to `auth` tier; extend to API and admin tiers
- **Cache middleware auth check:** KV cache doesn't properly skip authenticated requests in all cases
- **Hackathon templates:** Round/rubric copying is incomplete when creating from a template
- **Email verification persistence:** Currently KV-only; should be backed by DB for reliability
- **GitHub App JWT signing:** `getInstallationToken()` is a stub — needs full implementation
