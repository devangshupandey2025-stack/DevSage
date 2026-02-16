# DevSage API Documentation

Edge-native hackathon platform API built with [Hono](https://hono.dev/) on Cloudflare Workers. Uses D1 (SQLite) for the database, Durable Objects for stateful coordination, and Queues for async processing.

## Base URL

| Environment | URL |
|-------------|-----|
| Production  | `https://api.devsage.org` |
| Development | `http://localhost:8787` |

All routes are prefixed with `/api/v1/`.

## Authentication

Authentication uses email/password. Register or login to receive JWT tokens set as **HttpOnly cookies** — no Bearer tokens.

| Cookie | Lifetime | Purpose |
|--------|----------|---------|
| `access_token` | 15 minutes | Authenticates API requests |
| `refresh_token` | 30 days | Rotated on each use to obtain a new access token |

All authenticated requests must include the cookie (sent automatically by the browser). When the access token expires, the client should call the refresh endpoint to obtain a new one.

## Response Format

Every response follows a standard envelope.

**Success:**

```json
{
  "ok": true,
  "data": { "id": "abc-123", "name": "My Hackathon" },
  "meta": {}
}
```

**Error:**

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Hackathon not found"
  }
}
```

**Paginated:**

```json
{
  "ok": true,
  "data": [],
  "meta": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

Pagination defaults: `limit` 20 (max 100), `offset` 0.

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Request body or params failed validation |
| `CONFLICT` | 409 | Resource already exists or state conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Rate Limiting

Requests are rate-limited per-IP and per-user via Cloudflare KV. When the limit is exceeded the API returns HTTP **429 Too Many Requests**.

## Roles

Six per-hackathon roles are resolved **per-request** (not stored in the JWT):

```
organizer > co_organizer > judge > leader > member > anonymous
```

**Platform admin** is a separate layer used for the admin panel (`shikdd.devsage.org`) and checked via the `platform_admins` table.

## Middleware Chain

Requests pass through the following middleware in order:

```
CORS → Request ID → Rate Limiter → Error Handler → Auth (optionalAuth) → Route-specific (hackathonContext, requireRole, …)
```

## API Modules

| Module | File | Description |
|--------|------|-------------|
| [Auth](auth.md) | `routes/auth.ts` | Register, login, logout, token refresh, OAuth callbacks |
| [Workspaces](workspaces.md) | `routes/workspaces.ts` | Workspace CRUD and membership |
| [Hackathons](hackathons.md) | `routes/hackathons.ts` | Hackathon CRUD and state transitions |
| [Teams](teams.md) | `routes/teams.ts` | Team creation, membership, lifecycle |
| [Submissions](submissions.md) | `routes/submissions.ts` | View and list submissions |
| [Judging](judging.md) | `routes/judging.ts` | Rubric management, judge invites, scoring, leaderboard |
| [Rounds](rounds.md) | `routes/rounds.ts` | Round management |
| [Organizers](organizers.md) | `routes/organizers.ts` | Organizer role assignment |
| [Invites](invites.md) | `routes/invites.ts` | Accept team and judge invitations |
| [Notifications](notifications.md) | `routes/notifications.ts` | In-app notification listing and read status |
| [Admin](admin.md) | `routes/admin.ts` | Platform administration (platform_admin only) |
| [Webhooks](webhooks.md) | `routes/webhooks.ts` | GitHub webhook ingestion and verification |
| [Audit](audit.md) | `routes/audit.ts` | Audit trail queries |

## Hackathon State Machine

Hackathons follow a five-state lifecycle. Transitions are **forward-only**, with one exception for score corrections.

```
draft → active → judging → completed → archived
                                  ↑           │
                                  └───────────┘
                              (un-archive only)
```

| Transition | Trigger |
|------------|---------|
| `draft → active` | Organizer publishes the hackathon |
| `active → judging` | Submission deadline passes or organizer advances |
| `judging → completed` | Scoring finalized by organizer |
| `completed → archived` | Organizer archives the hackathon |
| `archived → completed` | Un-archive to allow score corrections |
