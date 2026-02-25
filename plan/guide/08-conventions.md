# 08 — Conventions (Read First)

These rules apply to every file, every endpoint, every component. No exceptions.

---

## Response Envelope

Every API response uses this exact shape:

```
Success: { ok: true, data: T, meta?: { total, limit, offset, has_more } }
Error:   { ok: false, error: { code: string, message: string, details?: any } }
```

- `ok` is always a boolean at the top level
- `data` is the payload (object, array, or primitive)
- `meta` appears only on paginated endpoints
- `error.code` is a SCREAMING_SNAKE constant (e.g., `NOT_FOUND`, `ALREADY_ON_TEAM`)
- `error.message` is a human-readable sentence
- Never return bare arrays or bare objects — always wrap in envelope

## HTTP Status Codes

| Code | When |
|------|------|
| 200 | Successful read, update, or action |
| 201 | Resource created (POST that creates) |
| 304 | Not Modified (ETag match on GET) |
| 400 | Validation error, bad input |
| 401 | Not authenticated (missing/expired token) |
| 403 | Authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate slug, already on team, etc.) |
| 429 | Rate limited |
| 500 | Unhandled error (never intentional) |

## Pagination

Two patterns. Choose based on data characteristics:

### Offset-Based (default — most endpoints)
```
Request:  ?limit=20&offset=0
Response: meta: { total: 142, limit: 20, offset: 0, has_more: true }
```
- `limit`: 1–100, default 20
- `offset`: ≥0, default 0
- `has_more`: boolean (offset + limit < total)
- Use for: teams, submissions, hackathons, users, workspaces, announcements

### Cursor-Based (append-only data)
```
Request:  ?limit=20&cursor=<opaque_id>
Response: meta: { limit: 20, next_cursor: "<id>", has_more: true }
```
- Use for: audit events, commit log, notifications

## Timestamps

- All timestamps are UTC ISO-8601: `2026-02-25T05:07:21.823Z`
- Generated via `new Date().toISOString()`
- Column names use `_at` suffix: `created_at`, `updated_at`, `submitted_at`
- Never use Unix timestamps, relative times, or local times

## IDs

- All IDs are UUIDv4: `crypto.randomUUID()`
- Invite codes are 8-char alphanumeric (no 0, 1, I, O, l for readability)
- Slugs are lowercase alphanumeric + hyphens: `/^[a-z0-9-]+$/`

## Error Codes

Standard codes used across all endpoints:

| Code | Meaning |
|------|---------|
| `VALIDATION_ERROR` | Request body/query failed Zod validation |
| `NOT_FOUND` | Resource doesn't exist |
| `UNAUTHORIZED` | No valid auth token |
| `FORBIDDEN` | Insufficient role/permissions |
| `CONFLICT` | Duplicate resource (slug, email, membership) |
| `ALREADY_ON_TEAM` | User already has a team in this hackathon |
| `INVALID_TRANSITION` | State machine transition not allowed |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Unhandled server error |

## Naming Conventions

### API URLs
- All routes under `/api/v1/` (except `/auth/*` and `/webhooks/*`)
- Resource names are **plural nouns**: `/hackathons`, `/teams`, `/submissions`
- Hackathons addressed by slug: `/api/v1/hackathons/:slug`
- Nested resources: `/api/v1/hackathons/:slug/teams/:teamId/members`
- Actions as sub-paths: `/teams/:teamId/dissolve`, `/hackathons/:slug/transition`
- No verbs in URLs except for actions that aren't CRUD

### Database
- Table names: `snake_case`, plural (`teams`, `audit_events`)
- Column names: `snake_case` (`created_at`, `hackathon_id`)
- Foreign keys: `<entity>_id` pattern (`user_id`, `hackathon_id`)
- Boolean columns: `is_` prefix (`is_current`, `is_initialized`)

### TypeScript
- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Variables/Functions: `camelCase`
- Constants: `SCREAMING_SNAKE` for true constants, `camelCase` for config objects
- Zod schemas: `camelCase` with `Schema` suffix (`createTeamSchema`)

### Frontend
- Pages: `kebab-case.tsx` in `src/pages/`
- Components: `kebab-case.tsx` or `PascalCase.tsx` in `src/components/`
- Path alias: `@/` → `./src/`
- API calls: Always via `apiRequest<T>()` wrapper with `credentials: 'include'`

## Console Logging

- `console.log` is **banned** (lint warning). Never use it.
- `console.warn` — for non-critical issues (failed cache, fallback triggered)
- `console.error` — for actual errors
- In scripts/: `console.log` is acceptable

## ESM & Imports

- All barrel exports use explicit `.js` extension: `export * from './schemas/user.js'`
- No `require()` anywhere. ESM only.
- Unused variables prefixed with `_`: `const _unused = ...`

## Testing

- Framework: Vitest everywhere
- API tests: `@cloudflare/vitest-pool-workers` with real D1/KV/DO bindings
- Frontend tests: jsdom + `@testing-library/react`
- Pattern: Integration-first. Minimal mocking. Test real behavior.
- Location: `src/__tests__/*.test.ts`
- No E2E (Playwright) — intentional decision

## Audit Trail

Every mutation (create, update, delete, transition) logs an audit event:
```typescript
insertAuditEvent(db, {
  hackathon_id,       // nullable (null for workspace-level ops)
  actor_id,           // user who did it
  actor_type,         // 'user' | 'system' | 'bot' | 'cron'
  event_type,         // 'hackathon.created', 'team.joined', etc.
  entity_type,        // 'hackathon', 'team', 'submission', etc.
  entity_id,          // UUID of affected entity
  metadata,           // JSON — extra context
  changes,            // JSON — what changed (before/after)
});
```
Audit events form a hash chain per hackathon for tamper detection.

## Services — Fail-Open Pattern

External service calls (GitHub API, SMTP) follow this pattern:
1. 10-second timeout via `AbortController`
2. On failure: `console.warn`, return fallback value
3. **Never throw** from service functions
4. Caller always gets a result (possibly degraded)
