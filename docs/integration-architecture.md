# Integration Architecture — DevSage

**Generated:** 2026-02-18  
**Type:** Monorepo with shared packages  
**Parts:** 4 apps + 3 packages

---

## Integration Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE EDGE                              │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  devsage.org │  │ platform.    │  │ shikdd.      │                │
│  │  (Web App)   │  │ devsage.org  │  │ devsage.org  │                │
│  │  Workers     │  │ (Platform)   │  │ (Admin)      │                │
│  │  Static      │  │ Workers      │  │ Workers      │                │
│  │  Assets      │  │ Static       │  │ Static       │                │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │
│         │                 │                 │                         │
│         │    REST API     │    REST API     │    REST API             │
│         │  (HttpOnly      │  (HttpOnly      │  (HttpOnly              │
│         │   cookies)      │   cookies)      │   cookies)              │
│         ▼                 ▼                 ▼                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    api.devsage.org                            │    │
│  │                  (Cloudflare Worker)                          │    │
│  │                                                              │    │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────────────┐  │    │
│  │  │  Hono  │  │ Queue  │  │  Cron  │  │  Durable Objects │  │    │
│  │  │  HTTP  │  │Consumer│  │Handler │  │  (State Machine) │  │    │
│  │  └───┬────┘  └───┬────┘  └───┬────┘  └──────────────────┘  │    │
│  │      │           │           │                               │    │
│  │      ▼           ▼           ▼                               │    │
│  │  ┌──────────────────────────────────────────────────┐       │    │
│  │  │                  D1 Database                      │       │    │
│  │  │               (36 SQLite tables)                  │       │    │
│  │  └──────────────────────────────────────────────────┘       │    │
│  │      │                                                       │    │
│  │      ├──── KV Namespace (rate limiting, OAuth state)        │    │
│  │      └──── Queues (github-webhooks, notifications)          │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                          │                                           │
└──────────────────────────┼───────────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────┐
                │   GitHub API     │
                │   (Webhooks,     │
                │    OAuth,        │
                │    Repos)        │
                └──────────────────┘
```

---

## Integration Points

### 1. Frontend → API (REST over HTTPS)

| From | To | Protocol | Auth | Description |
|------|----|----------|------|-------------|
| Web | API | REST (fetch) | HttpOnly cookies | Participant operations |
| Platform | API | REST (fetch) | HttpOnly cookies | Organizer/Judge operations |
| Admin | API | REST (fetch) | HttpOnly cookies | Platform admin operations |

**Pattern:** Each frontend uses `apiRequest<T>()` wrapper that:
1. Sends requests with `credentials: 'include'` (cookies)
2. On 401 → auto-calls `/auth/refresh` → retries original request
3. Uses `VITE_API_ORIGIN` in production, Vite proxy in development

**Dev Proxy:** Vite proxies `/api/v1`, `/auth`, `/hackathons`, `/webhooks` → `http://localhost:8787`

### 2. API → D1 Database

| Integration | Pattern | Details |
|-------------|---------|---------|
| Drizzle ORM | Direct D1 binding | All CRUD via Drizzle query builder |
| Migrations | `drizzle-kit generate` | SQL migrations in `packages/db/migrations/` |
| Client | `createDb(c.env.DB)` | D1 client factory from `@devsage/db` |

### 3. API → Durable Objects

| Integration | Pattern | Details |
|-------------|---------|---------|
| Worker → DO | `do-client.ts` wrapper | Named by hackathon ID |
| State transitions | RPC methods | `transition()`, `getState()` |
| Alarms | DO internal | Deadline monitoring |

### 4. API → Queues

| Producer | Queue | Consumer | Events |
|----------|-------|----------|--------|
| Webhook route | `github-webhooks` | push, tag-create, tag-delete, installation handlers | GitHub webhook events |
| Various routes | `devsage-notifications` | notification-handler | Email + in-app notifications |

### 5. GitHub → API (Webhooks)

| From | To | Protocol | Auth | Events |
|------|----|----------|------|--------|
| GitHub | `/webhooks/github` | POST with HMAC | Signature verification | push, create (tag), delete, installation |

**Flow:** GitHub → HMAC verify → normalize payload → enqueue → async processing

### 6. API → External Services

| Service | Integration | Pattern |
|---------|-------------|---------|
| GitHub API | REST (PAT/App token) | Fail-open, 10s timeout |
| SMTP | Email delivery | Fail-open, 10s timeout |
| Google OAuth | OAuth 2.0 | Manual flow, KV state storage |
| GitHub OAuth | OAuth 2.0 | Manual flow, KV state storage |

---

## Shared Package Dependencies

```
@devsage/shared (Zod schemas, types)
    ↑          ↑          ↑          ↑
    │          │          │          │
  api        web      platform    admin

@devsage/db (Drizzle schema, D1 client)
    ↑
    │
   api

@devsage/config (tsconfig, ESLint)
    ↑          ↑
    │          │
  shared      db
```

**Contract enforcement:** Zod schemas in `@devsage/shared` define the API contract. Both the API (validation) and frontends (type inference) import from the same package, ensuring type consistency.

---

## Cookie Architecture

| Cookie | Domain | Purpose | Expiry |
|--------|--------|---------|--------|
| `access_token` | Per-subdomain | JWT (HS256) | 15 minutes |
| `refresh_token` | Per-subdomain | Opaque rotation token | 30 days |

**Important:** Cookies are per-subdomain (NOT `.devsage.org` wildcard) to prevent cross-domain leakage between apps.

---

## CORS Configuration

The API dynamically validates origins against:
- `https://devsage.org`
- `https://platform.devsage.org`
- `https://shikdd.devsage.org`
- `https://*.hackathon.devsage.org` (participant sites)
- `https://*.pages.dev` (Cloudflare Pages previews)
- `http://localhost:*` (development)

---

## Data Flow: Submission Lifecycle

```
1. Team links GitHub repo          → POST /teams/:id/repo
2. Team pushes code                → GitHub webhook → push-handler (commit log)
3. Team creates git tag            → GitHub webhook → tag-create-handler
4. Submission created              → Stored in D1, notification queued
5. Organizer assigns judges        → POST /judging/assign
6. Judge scores submission         → POST /judging/submissions/:id/scores
7. Organizer publishes results     → POST /judging/results/publish
```
