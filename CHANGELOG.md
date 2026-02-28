# CHANGELOG — Backend API Hardening (2026-02-28)

This document covers all backend API changes made during the production hardening effort. It is organized for frontend developers to quickly identify breaking changes, new endpoints, and modified response shapes.

---

## Breaking Changes (Frontend Must Fix)

### 1. CSRF Protection Added (Global)

**All mutating requests** (`POST`, `PUT`, `PATCH`, `DELETE`) now require an `Origin` header matching the allowed frontend origins. Browsers send this automatically with `fetch()` + `credentials: 'include'`.

**Action**: Ensure all `fetch()` calls to the API include `credentials: 'include'` and are made from allowed origins. No code change needed if already using `credentials: 'include'`.

### 2. Rate Limiting Added (Global)

All endpoints are now rate-limited per IP via KV:

| Tier | Path | Limit |
|------|------|-------|
| `auth` | `/auth/*` | 10 req/min |
| `api` | `/api/v1/*` | 100 req/min |
| `webhook` | `/webhooks/*` | 200 req/min |
| `admin` | `/api/v1/admin/*` | 50 req/min |

**On limit exceeded**: Returns `429 Too Many Requests` with `{ ok: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "..." } }` and `Retry-After` header.

**Action**: Handle 429 responses gracefully (show user message, back off).

### 3. Submission Schema Changes

The `submissions` table now has additional columns. The `POST` submission response includes new fields:

| New Field | Type | Notes |
|-----------|------|-------|
| `title` | `string \| null` | Submission title |
| `description` | `string \| null` | Submission description |
| `demo_url` | `string \| null` | Demo link |
| `video_url` | `string \| null` | Video link |
| `repo_url` | `string \| null` | Repository URL |
| `is_final` | `boolean (0/1)` | Whether this is the final submission |

**Action**: Update submission forms to send `title`, `description`, `demo_url`, `video_url` if applicable. Update display to show these fields.

### 4. Scoring Time Window Enforcement (GAP-004)

Judges can now only submit scores when the round's scoring window is open.

**New error responses from `POST /api/v1/hackathons/:slug/judging/submissions/:submissionId/scores`**:
- `403 SCORING_NOT_OPEN` — "Scoring has not opened yet for this round"
- `403 SCORING_CLOSED` — "Scoring window has closed for this round"

**Action**: Handle these 403 responses in the judge portal. Show appropriate messages.

### 5. `POST /assign` and `POST /results/publish` Now Require JSON Body

Previously these endpoints silently accepted malformed JSON. Now they return `400 INVALID_JSON` if the body isn't valid JSON.

**Before**: `POST /api/v1/hackathons/:slug/judging/assign` accepted no body
**After**: Must send `{}` or `{ "round_id": "..." }` as valid JSON

**Action**: Ensure body is `JSON.stringify({})` at minimum for these endpoints.

---

## New Endpoints

### Template CRUD — `/api/v1/templates`

All require authentication.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/templates` | List templates (paginated, filterable) |
| `POST` | `/api/v1/templates` | Create template |
| `GET` | `/api/v1/templates/:templateId` | Get single template |
| `PATCH` | `/api/v1/templates/:templateId` | Update template |
| `DELETE` | `/api/v1/templates/:templateId` | Delete template |

**Query params for GET /**: `limit`, `offset`, `workspace_id`, `public_only=true`

**POST body**:
```json
{
  "name": "string (required)",
  "description": "string",
  "settings": {},
  "tracks": [],
  "rounds": [],
  "rubric": [],
  "workspace_id": "uuid",
  "is_public": true
}
```

**Response**: Template object with JSON fields parsed (settings, tracks, rounds, rubric are objects/arrays, not strings).

### TOTP 2FA — `/auth/2fa`

All require authentication.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/2fa/enroll` | Start 2FA enrollment, returns `secret` + `otpauth_uri` |
| `POST` | `/auth/2fa/verify` | Verify TOTP code to activate 2FA, returns backup codes |
| `POST` | `/auth/2fa/validate` | Validate TOTP during login |
| `POST` | `/auth/2fa/recover` | Use backup code to recover access |
| `DELETE` | `/auth/2fa` | Disable 2FA (requires TOTP code) |

**Enrollment flow**:
1. `POST /auth/2fa/enroll` → `{ secret, otpauth_uri }` (show QR code from `otpauth_uri`)
2. User scans QR, enters 6-digit code
3. `POST /auth/2fa/verify` with `{ code: "123456" }` → `{ enabled: true, backup_codes: [...] }`

**Validation** (during login): `POST /auth/2fa/validate` with `{ code: "123456" }`

**Recovery**: `POST /auth/2fa/recover` with `{ backup_code: "ABCD1234" }` (single-use)

### Workspace Operations

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/api/v1/workspaces/:workspaceId` | Soft-delete workspace (owner only, no active hackathons) |
| `POST` | `/api/v1/workspaces/:workspaceId/transfer` | Transfer ownership to another member |

**Transfer body**: `{ "new_owner_id": "uuid" }`

### Notification Preferences

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/notifications/preferences?hackathon_id=...` | Get notification preferences |
| `PUT` | `/api/v1/notifications/preferences` | Update notification preferences |

**PUT body**:
```json
{
  "hackathon_id": "uuid (required)",
  "email_enabled": true,
  "in_app_enabled": true
}
```

### Judge Guidelines (GAP-005)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/hackathons/:slug/judging/guidelines` | Get judge guidelines |
| `PATCH` | `/api/v1/hackathons/:slug/judging/guidelines` | Update guidelines (co_organizer+) |

**PATCH body**: `{ "guidelines": "markdown string up to 10000 chars" }`

### Announcement Notification Dispatch

`POST /api/v1/hackathons/:slug/announcements` now dispatches a notification to all hackathon participants via the notification queue. No API change needed — this is automatic.

---

## Modified Endpoints (Non-Breaking)

### Hackathon Creation — Template Application Fixed (API-002)

When creating a hackathon with `template_id`, the template's **rounds and rubric** are now actually applied to the new hackathon. Previously they were silently discarded.

**Before**: Only `settings`, `tracks`, `prizes` copied from template
**After**: `settings`, `tracks`, `prizes`, `rounds` (as `hackathon_rounds` rows), and `rubric` (as `rubric_criteria` rows) are all copied

### Hackathon State Transition — Better Error Handling

`POST /api/v1/hackathons/:slug/transition` now returns `503 DO_UNAVAILABLE` if the Durable Object is unreachable, instead of crashing with an unhandled exception.

### Leaderboard — Cache-Control Headers

`GET /api/v1/hackathons/:slug/judging/leaderboard` now sets `Cache-Control` headers:
- `max-age=15, stale-while-revalidate=60`

### Hackathon Detail — Cache-Control + ETag

`GET /api/v1/hackathons/:slug` now sets:
- `Cache-Control: public, max-age=10, stale-while-revalidate=30`
- `ETag` header for conditional requests

### Round Updates — New Fields

`PATCH /api/v1/hackathons/:slug/rounds/:roundId` now accepts:
- `scoring_opens_at` (ISO datetime string or null)
- `scoring_closes_at` (ISO datetime string or null)

### Judge List — Now Paginated

`GET /api/v1/hackathons/:slug/judging/judges` now supports `limit` and `offset` query params (default: 50, max: 100).

### Pagination — Hardened

All paginated endpoints now safely handle malformed `limit`/`offset` query params. Invalid values (NaN, negative numbers) fall back to defaults instead of causing errors.

---

## Security Fixes (No Frontend Changes Needed)

These are backend-only hardening — no API contract changes:

| Fix | Description |
|-----|-------------|
| **SEC-003** | Legacy Bearer auth now verifies JWT claims against DB |
| **SEC-006** | Registration returns identical response for existing/new emails (no enumeration) |
| **SEC-007** | SMTP credentials no longer logged in error messages |
| **SEC-011** | PBKDF2 iterations increased from 100k to 600k (OWASP 2024) |
| **SEC-014** | Error handler dev-mode detection fixed (no longer leaks stack traces) |
| **SEC-015** | GitHub OAuth only uses verified email addresses |
| **TOCTOU** | Rate limiter, password reset, and OAuth state are now atomic |
| **Modulo bias** | Invite code generation uses rejection sampling |
| **Auth caching** | Auth context cached in KV for 60s (reduces DB queries per request from 6 to 1) |
| **CryptoKey** | JWT signing key cached (no re-import per request) |
| **Audit chain** | Hash includes event content for tamper detection |

---

## New Database Migrations

Two new migration files that must be applied:

### `0002_indexes_and_columns.sql`
- Performance indexes on 12 tables
- `hackathon_rounds`: adds `scoring_opens_at`, `scoring_closes_at` columns
- `hackathons`: adds `judge_guidelines` column
- `hackathon_templates`: adds `updated_at`, `is_public` columns

### `0003_phase5_features.sql`
- `submissions`: adds 10 new columns (title, description, demo_url, video_url, repo_url, repo_full_name, ai_score, analysis_json, ai_review_json, is_final)
- Creates `user_totp_secrets` and `backup_codes` tables for 2FA
- `users`: adds `totp_enabled` column
- `workspaces`: adds `deleted_at` column for soft-delete
- Additional performance indexes

**These migrations are applied automatically** by wrangler during `pnpm dev` (local) and deploy (production).

---

## Performance Improvements

| Area | Before | After |
|------|--------|-------|
| Auth middleware | 6 DB queries per request | 1 DB query + KV cache (60s TTL) |
| JWT key import | ~1-2ms per verify | Cached globally |
| Score submission | Sequential per-criterion INSERT | Batch upsert (ON CONFLICT) in groups of 20 |
| Judge assignment | Sequential per-submission INSERT | Batched in groups of 20 |
| Notification emails | Sequential send | Parallel via Promise.allSettled |
| Cron tasks | Sequential execution | Parallel via Promise.allSettled |
| Audit sequence | Global MAX(sequence) scan | Still global but runs in waitUntil() |

---

## Constants Reference

All magic numbers have been centralized in `apps/api/src/lib/constants.ts`:

```typescript
RATE_LIMITS: { auth: 10/min, api: 100/min, webhook: 200/min, admin: 50/min }
PAGINATION: { DEFAULT_LIMIT: 20, MAX_LIMIT: 100, MAX_SEED_TEAMS: 100, ... }
TIMING: { ACCESS_TOKEN_EXPIRY: 15min, REFRESH_TOKEN_EXPIRY: 30d, OTP_TTL: 10min, ... }
PASSWORD: { MIN: 8, MAX: 128, PBKDF2_ITERATIONS: 600k }
HTTP_CACHE: { HACKATHON_DETAIL: 10s/30s SWR, LEADERBOARD: 15s/60s SWR }
KV_TTL: { ROLE_CACHE: 60s, LEADERBOARD_JUDGING: 60s, LEADERBOARD_COMPLETED: 3600s }
```

---

## Test Status

- **223 tests passing**, 0 failures, 1 skipped
- **24 test files** covering all routes
- Type-check clean (`tsc --noEmit` passes)
