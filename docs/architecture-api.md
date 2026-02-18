# Architecture — API Backend

**Generated:** 2026-02-18  
**Package:** `@devsage/api`  
**Runtime:** Cloudflare Workers  
**Framework:** Hono 4.6.14  
**Deploy:** `api.devsage.org` (Workers)

---

## Executive Summary

The API is a single Cloudflare Worker handling HTTP requests (Hono), queue consumption (GitHub webhooks + notifications), cron triggers (hourly deadline checks), and Durable Object coordination (hackathon state machine). It uses D1 for persistence, KV for rate limiting and OAuth state, and Queues for async event processing.

---

## Architecture Pattern

**Edge-native serverless** with middleware pipeline:

```
Request → CORS → RequestID → OptionalAuth → ErrorHandler → [Route Middleware] → Handler
                                                             ↓
                                                    hackathonContext
                                                    authMiddleware
                                                    requireRole()
                                                    requirePlatformAdmin
                                                    rateLimitMiddleware
```

---

## Worker Exports

```typescript
export default {
  fetch: app.fetch,          // HTTP handler (Hono)
  queue: queueHandler,       // Queue consumer (webhooks + notifications)
  scheduled: cronHandler,    // Cron trigger (hourly)
};

export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';
```

---

## Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 Database | Primary data store (devsage-db) |
| `KV` | KV Namespace | Rate limiting, OAuth state (10-min TTL) |
| `HACKATHON_SM` | Durable Object | HackathonStateMachine (SQLite-backed) |
| `WEBHOOK_QUEUE` | Queue Producer | GitHub webhook events |
| `NOTIFICATION_QUEUE` | Queue Producer | Notification delivery |

---

## Authentication & Authorization

### Dual-Token Strategy
- **Access Token:** 15-min JWT (HS256 via `crypto.subtle`), HttpOnly cookie
- **Refresh Token:** 30-day opaque token, family-based rotation with replay detection (2s grace period)
- **OAuth:** Manual Google + GitHub OAuth 2.0 (NOT `@hono/oauth-providers`)

### JWT Payload
```typescript
{ sub: userId, ghid: githubId, ghu: githubUsername, fam: familyId, iat, exp }
```

### Role Hierarchy (6 tiers, resolved per-request per-hackathon)
1. `organizer` — Full control
2. `co_organizer` — Management without ownership
3. `judge` — Scoring access
4. `team_lead` — Team management
5. `team_member` — Participation
6. `anonymous` — Public access

Role resolution uses a single UNION query with KV caching (60s TTL).

---

## Durable Objects

### HackathonStateMachine
- **Storage:** SQLite-backed (`new_sqlite_classes`)
- **State Machine:** `draft → active → judging → completed → archived`
- **Forward-only** transitions (except `archived → completed` for un-archive)
- **Features:** Submission locking during transitions, deadline alarms
- **Access:** Worker mediates all D1 writes (DO does NOT access D1 directly)

---

## Queue Architecture

### github-webhooks Queue
| Handler | Event | Purpose |
|---------|-------|---------|
| `push-handler` | Push events | Commit log recording, force-push detection |
| `tag-create-handler` | Tag creation | Automatic submission creation |
| `tag-delete-handler` | Tag deletion | Submission cleanup |
| `installation-handler` | App installation | Bot activation for team repos |

### devsage-notifications Queue
| Handler | Channel | Purpose |
|---------|---------|---------|
| `notification-handler` | Email + In-App | Notification delivery with idempotency |
| `notification-logic` | — | Recipient resolution per notification type |

Both queues: max_batch_size=10, max_retries=3

---

## Cron Triggers

| Schedule | Purpose |
|----------|---------|
| `0 * * * *` (hourly) | Check submission deadlines, send reminder notifications |

---

## Services (External Integrations)

All services use fail-open pattern: 10s timeout via AbortController, log warning, never throw.

| Service | File | Purpose |
|---------|------|---------|
| Email | `services/email.ts` | SMTP notification delivery |
| GitHub | `services/github.ts` | GitHub API client |
| Judging | `services/judging-service.ts` | Score calculation, weighted rubric |

---

## Middleware Reference

| Middleware | File | Purpose |
|-----------|------|---------|
| `corsMiddleware` | `cors.ts` | Dynamic origin validation |
| `requestIdMiddleware` | `request-id.ts` | UUID per request |
| `optionalAuth` | `auth.ts` | Non-blocking JWT extraction |
| `authMiddleware` | `auth.ts` | Strict auth guard (401) |
| `errorHandler` | `error-handler.ts` | Global error → envelope |
| `hackathonContext` | `hackathon.ts` | Slug → hackathon resolution |
| `requireRole(min)` | `role.ts` | Hierarchy-based RBAC |
| `requireExactRole(role)` | `role.ts` | Exact role match |
| `requirePlatformAdmin` | `platform-admin.ts` | Platform admin guard |
| `rateLimitMiddleware(tier)` | `rate-limit.ts` | KV-backed rate limiting |

---

## Audit System

- Every mutation logs via `insertAuditEvent()`
- SHA-256 hash chain integrity per hackathon
- Actor types: `user`, `system`, `bot`, `cron`
- Backfill capability via admin endpoint

---

## Response Conventions

```typescript
// Success
successResponse(c, data, meta?)    → { ok: true, data, meta }
paginatedResponse(c, items, total) → { ok: true, data: items, meta: { total, limit, offset, has_more } }

// Error
errorResponse(c, status, code, message) → { ok: false, error: { code, message } }
```

---

## Key Anti-Patterns (Avoid)

- `@hono/oauth-providers` — broken on Workers
- Direct D1 access inside DOs — Worker mediates
- `console.log` — use `console.warn`/`console.error`
- External JWT libraries — use `crypto.subtle`
- Storing roles in JWT — resolve per-request
- Backward state transitions (except archived→completed)
