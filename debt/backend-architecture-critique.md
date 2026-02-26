# Backend Architecture Critique — DevSage API

**Date:** 2025-07-17
**Scope:** `apps/api/`, `packages/db/`, `packages/shared/`
**Branch:** main
**Verdict:** Functional but structurally fragile. Ships features fast but accrues silent debt in every layer.

---

## 1. Executive Summary

DevSage's backend is a working Cloudflare Workers API that serves 80+ endpoints across 17 route files (5,065 lines), with 9 middleware handlers, 4 services, 7 queue handlers, a single Durable Object, and a cron scheduler. The auth system is correctly implemented with custom HMAC SHA-256 via `crypto.subtle`, cookie-based JWT with refresh token rotation, and proper PBKDF2 password hashing. The test suite is genuinely impressive for a project this young — 24 test files, 223 test cases, and an 866-line test helper module with factory functions. The response envelope pattern (`successResponse`/`errorResponse`) is used consistently across 336 call sites. Credit where due: this is a lot of working code.

But underneath the feature velocity is a codebase that has quietly abandoned its own architecture. The Drizzle ORM schemas in `packages/db/` (46 files, 47 tables) are **never imported at runtime** — not once, in any app. The 262 raw SQL `.prepare()` calls scattered across the route layer use `as string` type casts (39 total) and hand-written SQL strings, making the Drizzle layer pure dead weight. The Zod schemas in `packages/shared/` (26 files) are similarly orphaned — zero imports from any application. Two entire packages in the monorepo exist only as documentation artifacts that nobody reads. The ORM and validation layers that were supposed to provide type safety and input validation are scaffolding around an empty building.

The deeper concern is what's missing, not what's broken. There is **no request validation** on any endpoint — every route `await c.req.json()` into an untyped `Record<string, unknown>` and manually checks fields with `if (!field)` guards. The rate limiter has a classic TOCTOU race condition. Queue handlers reference database columns (`github_owner`, `github_repo`) that don't exist in the schema. The Durable Object's `UPDATE lifecycle_state` statements omit WHERE clauses (safe today because each DO has one row, but a single bug away from corruption). These aren't theoretical risks — they're the kind of issues that surface at 3 AM during a hackathon when load spikes and edge cases multiply.

---

## 2. The Raw SQL Problem

### The Numbers

| File | `.prepare()` Calls | Lines |
|------|-------------------|-------|
| `routes/judging.ts` | 38 | 701 |
| `routes/teams.ts` | 37 | 605 |
| `routes/admin.ts` | 30 | 292 |
| `routes/auth.ts` | 25 | 826 |
| `routes/workspaces.ts` | 23 | 317 |
| `routes/rounds.ts` | 20 | 269 |
| `routes/hackathon-requests.ts` | 19 | 344 |
| `routes/hackathons.ts` | 15 | 346 |
| `routes/invites.ts` | 15 | 278 |
| `routes/submissions.ts` | 12 | 465 |
| `routes/team-repos.ts` | 10 | 125 |
| Others (6 files) | 18 | 422 |
| **TOTAL** | **262** | **5,065** |

### The Core Issue

`packages/db/` contains 46 schema files defining 47 Drizzle ORM tables. **Zero of them are imported at runtime by any app.** The API exclusively uses raw SQL:

```typescript
// apps/api/src/routes/hackathons.ts:90-101
// Hand-written INSERT with 30 columns, no type checking
`INSERT INTO hackathons (id, workspace_id, slug, title, tagline, description, rules_md, status,
  starts_at, judging_starts, judging_ends, min_team_size, max_team_size, max_teams,
  submission_tag_pattern, allow_resubmission, allow_registration_during_active,
  notify_all_on_deadline, show_judge_comments_to_participants, registration_mode,
  allowed_email_domains, require_repo, timezone, template_id, tracks, prizes, settings,
  created_by, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
```

If you add a column to the DB schema, nothing warns you that this INSERT is now missing a field. If you rename a column in a migration, no compiler error fires — you find out at runtime.

### Type Cast Hell

The body normalization in `hackathons.ts:17-43` is a masterclass in what happens without validation:

```typescript
// apps/api/src/routes/hackathons.ts:17-43
const workspaceId = (c.req.param('workspaceId') ?? raw.workspaceId ?? raw.workspace_id) as string;
const body = {
  title: raw.title as string,
  slug: raw.slug as string,
  tagline: raw.tagline as string | undefined,
  description: raw.description as string | undefined,
  max_team_size: (raw.max_team_size ?? raw.maxTeamSize) as number | undefined,
  min_team_size: (raw.min_team_size ?? raw.minTeamSize) as number | undefined,
  allow_resubmission: (raw.allow_resubmission ?? raw.allowResubmission) as number | undefined,
  // ... 14 more `as string` / `as number` casts
};
```

**14 type casts in a single route handler.** The `as` keyword isn't validation — it's a lie to the compiler. If a client sends `{ max_team_size: "five" }`, TypeScript is happy, SQLite is confused, and the bug is silent.

### Distribution of Type Casts

| File | `as string`/`as number` Casts |
|------|------------------------------|
| `routes/hackathons.ts` | 14 |
| `routes/hackathon-requests.ts` | 8 |
| `routes/submissions.ts` | 6 |
| `routes/audit.ts` | 2 |
| **TOTAL** | **30** |

### Complex SQL Without Safety Nets

From `judging.ts:348-356` — a multi-table JOIN with aliasing, hand-written:

```sql
SELECT ja.id, ja.submission_id, ja.team_id, ja.round, ja.status, ja.assigned_at, ja.completed_at,
       s.tag_name, s.commit_sha, t.name as team_name
FROM judge_assignments ja
LEFT JOIN submissions s ON ja.submission_id = s.id
JOIN teams t ON ja.team_id = t.id
WHERE ja.judge_id = ?
ORDER BY ja.assigned_at ASC
```

This is a 7-line SQL string embedded in a TypeScript route handler. A typo in a column name compiles successfully and fails at runtime. There are dozens of queries like this across the codebase.

### What the Drizzle Schemas Could Provide

If the API actually imported and used the Drizzle schemas, every `.prepare()` call above would:
- Get column-level type inference
- Fail at compile time on schema mismatches
- Support typed `.select()`, `.insert()`, `.update()`, `.delete()` builders
- Eliminate every `as string` cast

Instead, `packages/db/` is a 46-file documentation project that generates migrations and nothing else.

---

## 3. Dead Code: `packages/shared`

### Zero Imports

`packages/shared/src/schemas/` contains **26 Zod schema files**, all re-exported from `packages/shared/src/index.ts` (27 export lines). A search for `@devsage/shared` imports across all apps returns **zero results** in any `.ts` or `.tsx` source file.

Every Zod schema in the package — `createHackathonSchema`, `userResponseSchema`, `registerRequestSchema`, `workspaceResponseSchema`, and 22 more — is **100% dead code**. Built on every CI run. Maintained across commits. Never executed.

### Schema-Database Mismatches

The Zod schemas don't even match the Drizzle schemas they're supposed to represent:

#### `user` — 16 missing fields

| Zod (`packages/shared/src/schemas/user.ts:3-9`) | Drizzle (`packages/db/src/schema/users.ts:4-22`) |
|---|---|
| `id`, `email`, `name`, `avatar_url`, `created_at` (5 fields) | `id`, `email`, `name`, `password_hash`, `github_id`, `github_username`, `google_id`, `avatar_url`, `password_must_change`, `email_verified`, `email_bounced`, `suspended`, `suspended_at`, `suspended_reason`, `last_login_at`, `created_at`, `updated_at` (17 fields) |

The Zod schema is missing `updated_at`, `email_verified`, `suspended`, `github_username`, and 12 other columns. It was written as a "response schema" but even then omits `updated_at` which the API actually returns.

#### `workspace` — 3 missing fields, nullability mismatch

| Field | Zod (`workspace.ts:18-28`) | Drizzle (`workspaces.ts:5-16`) |
|-------|---|---|
| `logo_url` | ❌ Missing | `text('logo_url')` |
| `website` | ❌ Missing | `text('website')` |
| `settings` | ❌ Missing | `text('settings').notNull().default('{}')` |
| `created_by` | `z.string().uuid().nullable()` | `text('created_by').notNull()` |

The Zod schema says `created_by` is nullable. The Drizzle schema says `.notNull()`. If anyone ever used the Zod schema for validation, it would accept invalid data.

#### `hackathon` — JSON type confusion

In `packages/shared/src/schemas/hackathon.ts`:
- Lines 27-29: `createHackathonSchema` defines `tracks: z.array(z.unknown()).optional()` and `prizes: z.array(z.unknown()).optional()` — arrays
- Lines 66-68: `hackathonResponseSchema` defines `tracks: z.string()` and `prizes: z.string()` — strings

The create schema expects JSON arrays. The response schema expects serialized strings. These are mutually inconsistent within the same file. Neither is validated at runtime anyway.

### The Real Cost

These 26 files represent ~500 lines of carefully typed Zod schemas that:
- Increase CI build time
- Create a false sense of validation ("we have Zod schemas!")
- Drift further from reality with every migration
- Will require a painful reconciliation when someone tries to wire them in

---

## 4. Middleware Architecture Issues

### TOCTOU Race in Rate Limiting

**File:** `apps/api/src/middleware/rate-limit.ts:26-46`

```typescript
// Line 26: READ the counter
const current = await c.env.KV.get(key);
const count = current ? parseInt(current, 10) : 0;

// Line 29: CHECK the counter
if (count >= config.max) { /* return 429 */ }

// Line 41-46: WRITE the incremented counter (fire-and-forget!)
const newCount = count + 1;
const putPromise = c.env.KV.put(key, String(newCount), {
  expirationTtl: config.windowSeconds,
});
c.executionCtx?.waitUntil(putPromise);  // Non-blocking write
```

Between the `KV.get()` on line 26 and the `KV.put()` on line 43, concurrent requests can all read the same counter value, all pass the check, and all write `count + 1` back. With 10 concurrent requests, the counter advances by 1 instead of 10. The `waitUntil` makes this worse — the write isn't even guaranteed to complete before the next request reads.

**Severity:** Medium. KV's eventual consistency means this is inherently approximate, but the current implementation can't enforce limits under load. The `auth` tier (`max: 10, windowSeconds: 60`) is most vulnerable — a brute-force attack sending 100 concurrent requests would see ~90 of them pass.

**Fix:** Use `KV.put` with atomic compare-and-set, or accept that KV-based rate limiting is inherently approximate and add a secondary defense (e.g., Cloudflare's built-in rate limiting rules).

### Cache Middleware: Auth Detection by String Matching

**File:** `apps/api/src/middleware/cache.ts:15-18`

```typescript
const hasCookie = c.req.header('cookie')?.includes('access_token');
const hasBearer = c.req.header('authorization')?.startsWith('Bearer ');
if (hasCookie || hasBearer) return next();
```

Auth detection uses `String.includes('access_token')` on the raw Cookie header. This is:
- **Case-sensitive** — `Access_Token` would be missed
- **Substring-matching** — a cookie named `my_access_token_extra` would trigger it
- **Not parsing** — doesn't use Hono's `getCookie()` or parse the `Cookie` header properly

If auth detection fails (e.g., a new auth cookie name, a header format change), the `kvCache` middleware at lines 34-41 will cache an authenticated user's JSON response in KV keyed only by URL, and serve that response to every subsequent unauthenticated request for 30 seconds.

This middleware is currently only used on read-heavy public endpoints, which limits the blast radius. But the implementation is a time bomb — one wrong usage and it's a data leak.

### No Request Validation Middleware

**Zero Zod imports. Zero schema validation. Zero `z.parse()` calls. In any middleware file.**

Every route handler does its own ad-hoc validation:

```typescript
// apps/api/src/routes/hackathons.ts:16-18
const raw = await c.req.json<Record<string, unknown>>();
const workspaceId = (... ?? raw.workspaceId ?? raw.workspace_id) as string;
if (!workspaceId) {
  return errorResponse(c, 400, 'VALIDATION_ERROR', 'workspaceId is required');
}
```

This pattern is repeated across all 17 route files. Each handler re-implements its own field checking, missing fields silently become `undefined`, type coercion is done via `as` casts, and there is no centralized error format for validation failures.

Hono has `@hono/zod-validator` — a first-party middleware that parses request bodies against Zod schemas and returns typed results. It's not installed, not used, and the Zod schemas in `packages/shared` that could power it are sitting unused.

### Role Resolution Efficiency

**File:** `apps/api/src/middleware/role.ts:26-50`

The `resolveRole()` function uses a single `UNION ALL` query across 5 tables — this is **well designed**. It also uses KV caching with 60-second TTL (line 23). Credit here: this is one of the better-architected parts of the middleware stack.

However, `requireExactRole()` (line 101) and `requireRole()` (line 64) both independently call `resolveRole()`. If a route uses both (or if hackathon context middleware also resolves roles), the KV cache prevents redundant DB hits, but the code structure doesn't make this guarantee obvious. A comment or memoization would help.

---

## 5. Service Layer Gaps

### What Exists

| File | Lines | Purpose |
|------|-------|---------|
| `services/email.ts` | 97 | SMTP email sending |
| `services/github.ts` | 115 | GitHub API client |
| `services/judging-service.ts` | 135 | Leaderboard + assignment logic |
| `services/smtp.ts` | 273 | SMTP connection management |
| **TOTAL** | **620** | |

Four service files. 620 lines of abstraction for a 5,065-line route layer.

### What's Missing: Fat Controllers

The route handlers are doing **everything** — auth checks, body parsing, validation, business logic, SQL queries, response formatting:

```typescript
// apps/api/src/routes/hackathons.ts — POST / handler (lines 12-131, 120 lines)
// This single handler:
// 1. Parses request body (line 16)
// 2. Manually validates 20+ fields (lines 17-48)
// 3. Checks workspace membership (line 50-55)
// 4. Checks workspace role (line 57-62)
// 5. Checks for duplicate slugs (line 65-70)
// 6. Generates UUID (line 72)
// 7. Builds 30-column INSERT SQL (lines 90-101)
// 8. Executes SQL (line 102)
// 9. Creates hackathon round (lines 104-110)
// 10. Initializes Durable Object (lines 112-125)
// 11. Inserts organizer role (lines 127-129)
// 12. Logs audit event (lines 131)
// 13. Returns response
```

This is a 120-line function that could be decomposed into:
- `HackathonService.create(dto)` — business logic + DB
- `HackathonValidation.parseCreate(body)` — Zod validation
- Route handler: 10 lines gluing them together

**Other fat controllers:**
- `auth.ts`: 826 lines, 25 `.prepare()` calls — login, register, OAuth, refresh, password reset, OTP, account deletion all in one file
- `judging.ts`: 701 lines, 38 `.prepare()` calls — rubric CRUD, judge invitations, scoring, assignment, leaderboard publishing
- `teams.ts`: 605 lines, 37 `.prepare()` calls — team CRUD, member management, invite emails, bulk invites

### No Repository Pattern

Every route handler directly calls `c.env.DB.prepare(SQL).bind(...).run()`. There is no data access abstraction — no repository, no DAO, no query builder wrapper. This means:
- Query logic is duplicated (e.g., "get hackathon by slug" appears in multiple files)
- Testing requires the full D1 binding (no unit testing of business logic)
- Migrating from D1 to another database would require rewriting every route handler

---

## 6. Durable Objects

### Single DO: `HackathonStateMachine`

**File:** `apps/api/src/durable-objects/hackathon-state-machine.ts` (275 lines)

The DO manages the 5-state hackathon lifecycle using SQLite-backed storage (correct pattern for Workers). It defines three internal tables:

```sql
-- Line 28-44
lifecycle_state (hackathon_id TEXT PRIMARY KEY, status TEXT, version INTEGER, updated_at TEXT)
submission_locks (submission_key TEXT PRIMARY KEY, submission_id TEXT, locked_at TEXT)
team_submissions (team_id TEXT PRIMARY KEY, count INTEGER)
```

### UPDATE Without WHERE Clause

**Lines 155-157:**

```typescript
this.ctx.storage.sql.exec(
  'UPDATE lifecycle_state SET status = ?, version = ?, updated_at = ?',
  target_status, newVersion, now
);
```

**Line 259-261 (alarm handler):**

```typescript
this.ctx.storage.sql.exec(
  'UPDATE lifecycle_state SET status = ?, version = ?, updated_at = ?',
  'judging', newVersion, now
);
```

Both UPDATE statements lack a `WHERE hackathon_id = ?` clause. This works **only because** each DO instance is uniquely identified by `idFromName(hackathonId)` and each DO's SQLite storage contains exactly one row in `lifecycle_state`.

But this is a defensive-programming failure. If any code path ever inserts a second row (a bug in `initialize()`, a race condition, a schema migration that doesn't clean up), the UPDATE would corrupt all rows silently. The SELECT queries at lines 123, 181, 205, and 247 all use `LIMIT 1` without WHERE, confirming the single-row assumption is structural, not validated.

**Fix:** Add `WHERE hackathon_id = ?` to both UPDATE statements. Zero performance cost, eliminates a class of corruption bugs.

### Limited Functionality

For a hackathon management platform, a single DO handling only state transitions feels underutilized. Potential DO candidates that would benefit from strong consistency:
- **Team formation** — concurrent join requests to the same team need serialization
- **Submission locking** — the DO has `submission_locks` table but the locking logic is minimal
- **Real-time scoring** — concurrent judge scores for the same submission

---

## 7. Queue & Cron Architecture

### Queue Handlers Reference Nonexistent Columns

**The Drizzle schema** (`packages/db/src/schema/team-repos.ts:6-20`) defines `team_repos` with these columns:

```
id, team_id, hackathon_id, provider, repo_full_name, repo_url,
installation_id, bot_active, is_primary, access_token_encrypted, created_at
```

**No `github_owner` column. No `github_repo` column.**

But the queue handlers query these nonexistent columns:

| File | Line | SQL |
|------|------|-----|
| `queue/push-handler.ts` | 18 | `WHERE github_owner = ? AND github_repo = ?` |
| `queue/tag-create-handler.ts` | 29 | `WHERE tr.github_owner = ? AND tr.github_repo = ?` |
| `queue/tag-delete-handler.ts` | 25-26 | `AND tr.github_owner = ? AND tr.github_repo = ?` |
| `queue/installation-handler.ts` | 26 | `JOIN team_repos tr ON tr.github_owner = ? AND tr.github_repo = ?` |
| `queue/installation-handler.ts` | 67 | `UPDATE team_repos SET bot_active = 0, installation_id = NULL WHERE github_owner = ? AND github_repo = ?` |

**Every GitHub webhook handler in the queue system queries columns that don't exist.** These queries will throw D1 errors at runtime. The entire GitHub webhook → submission pipeline is broken:
- Push events can't find the team repo
- Tag events can't create submissions
- Installation events can't update bot status

The schema has `repo_full_name` (e.g., `"owner/repo"`) but the handlers expect separate `github_owner` and `github_repo` columns. This is either a schema migration that forgot to update the handlers, or handlers written against a planned schema that was never implemented.

### No Dead-Letter Queue

**File:** `apps/api/src/queue/index.ts:35-46`

```typescript
try {
  // ... dispatch message
  message.ack();
} catch (err) {
  console.error(`Queue message failed: ${err instanceof Error ? err.message : err}`);
  message.retry();
}
```

Every failure retries unconditionally. There's no distinction between:
- **Transient errors** (network timeout, D1 rate limit) — should retry with backoff
- **Permanent errors** (column doesn't exist, invalid payload) — should dead-letter

With the nonexistent column issue above, every GitHub webhook message will retry indefinitely until the queue's max retry limit is hit, burning compute on queries guaranteed to fail.

### Cron Error Isolation (Improved)

**File:** `apps/api/src/cron/index.ts:23-28`

```typescript
for (const task of tasks) {
  try {
    await task.fn();
  } catch (err) {
    console.error(`Cron task ${task.name} failed:`, err instanceof Error ? err.message : err);
  }
}
```

Each cron task is wrapped in try-catch — **this is correctly implemented**. One failing task won't block others. However, there's no alerting mechanism beyond `console.error`, no retry for failed tasks, and no idempotency check (the deadline reminder at lines 89-107 could send duplicate notifications if the cron runs twice in the same hour due to clock skew).

---

## 8. Testing Strategy

### The Good

| Metric | Value |
|--------|-------|
| Test files | 24 |
| Total test cases (`it()`) | 223 |
| Test helper module | 866 lines with 20 factory functions |
| Coverage areas | Auth, CRUD, middleware, DO, queue, cron, CORS, roles |

**The test helper module** (`apps/api/src/__tests__/helpers.ts`) is genuinely well-structured:
- Factory functions: `insertUser()`, `insertWorkspace()`, `insertHackathon()`, `insertTeam()`, `insertJudge()`, `insertSubmission()`, etc. (lines 621-811)
- JWT signing via `crypto.subtle` (lines 21-39)
- Seed data constants (lines 42-58)
- `ensureSchema()` (line 91) and `resetDb()` (line 603) for test isolation

### The Bad

**1. Test helpers use raw SQL** — 18 `.prepare()` calls in `helpers.ts`. The factory functions build INSERT statements by hand:

```typescript
// helpers.ts:654 (approximate)
await env.DB.prepare(
  `INSERT INTO hackathons (id, workspace_id, slug, title, status, ...) VALUES (?, ?, ?, ?, ?, ...)`
).bind(params.id, params.workspaceId, params.slug, ...).run();
```

If the schema changes, both the route handlers AND the test helpers need manual updates. No shared abstraction.

**2. Only 1 skipped test:**

- `hackathons.test.ts:244` — `it.skip('POST /api/v1/hackathons/:slug/transition — draft → active')` — state transition test is skipped

**3. Middleware test coverage is poor:**

| Middleware File | Has Dedicated Tests? |
|----------------|---------------------|
| `auth.ts` (156 lines) | ❌ No |
| `cache.ts` (58 lines) | ❌ No |
| `cors.ts` (27 lines) | ✅ `cors.test.ts` (6 tests) |
| `error-handler.ts` (26 lines) | ❌ No |
| `hackathon.ts` (31 lines) | ❌ No |
| `platform-admin.ts` (25 lines) | ✅ `platform-middleware.test.ts` (5 tests) |
| `rate-limit.ts` (52 lines) | ❌ No |
| `request-id.ts` (9 lines) | ❌ No |
| `role.ts` (135 lines) | ✅ `role.test.ts` (11 tests) |

**7 of 9 middleware files have no dedicated tests.** The auth middleware — arguably the most security-critical component — has zero tests. The rate limiter with its TOCTOU race has zero tests.

**4. E2E lifecycle test is the largest suite** (`e2e-lifecycle.test.ts`: 23 tests) — good for integration coverage, but failures here are hard to diagnose because they test the full stack.

---

## 9. Authentication Architecture

### What's Done Right

- **Custom JWT via `crypto.subtle`** (`lib/jwt.ts`) — correct for Workers, no external deps
- **PBKDF2 with 100,000 iterations** (`lib/password.ts`) — solid password hashing
- **Constant-time comparison** (`lib/password.ts:73-82`) — HMAC-based comparison prevents timing attacks
- **Refresh token rotation with family-based replay detection** (`lib/refresh-token.ts`) — revoking one token revokes the entire family
- **OAuth state in KV with 10-min TTL** — prevents replay attacks
- **Password length validation** (`auth.ts:43-44`) — min 8, max 128 characters
- **CSPRNG for OTP** (`auth.ts:736`) — uses `crypto.getRandomValues()`, not `Math.random()`

### Historical Issues (Now Fixed)

These were found and fixed during development — documenting them as evidence of security awareness:

1. **Math.random() for OTP** — replaced with `crypto.getRandomValues()` at `auth.ts:736`
2. **No max password length** — added `MAX_PASSWORD_LENGTH = 128` at `auth.ts:44`
3. **Account deletion cascade** — now properly deletes scores, judge_assignments, and nullifies created_by references (`auth.ts:561-563`)

### Remaining Concerns

**Bearer token path bypasses DB validation** (`middleware/auth.ts:38-50`):

The auth middleware has two paths:
1. Cookie path — extracts JWT, queries DB to verify user exists and isn't suspended
2. Bearer path (backward compat) — extracts JWT, **trusts the payload without DB lookup**

If a JWT is compromised but the user is suspended in the DB, the cookie path correctly blocks access. The Bearer path doesn't check. This is documented as backward compatibility, but it's a security gap.

---

## 10. API Design Issues

### No Request Validation on Any Endpoint

Every endpoint does this:

```typescript
const body = await c.req.json<Record<string, unknown>>();
```

The `<Record<string, unknown>>` generic is a type assertion, not validation. The actual runtime type is `unknown`. Then each handler manually checks individual fields:

```typescript
// Typical pattern in routes/teams.ts, routes/submissions.ts, etc.
if (!body.name) return errorResponse(c, 400, 'VALIDATION_ERROR', 'name is required');
if (!body.hackathon_id) return errorResponse(c, 400, 'VALIDATION_ERROR', 'hackathon_id is required');
```

This means:
- No type coercion (string "5" stays a string when number is expected)
- No format validation (emails, UUIDs, dates are accepted as-is)
- No nested object validation
- Inconsistent error messages across endpoints
- Easy to forget a check when adding fields

### Inconsistent Error Handling

Most routes correctly use `errorResponse()` from `lib/response.ts`. But a few leak raw errors:

- `hackathons.ts:265` — forwards DO response status directly: `return c.json(initResult, initRes.status as 400 | 500)` — the `as 400 | 500` cast is telling
- `webhooks.ts` uses raw `c.json()` (4 call sites) instead of `errorResponse()`

The response envelope (`{ ok, data, meta }` / `{ ok, error: { code, message } }`) is used across **336 helper call sites** vs only **6 raw `c.json()` calls** — this is actually quite consistent. The inconsistencies are minor but exist.

### Missing API Patterns

- **No pagination validation** — `limit` and `offset` query params are parsed but not validated against bounds
- **No request ID correlation** — `requestIdMiddleware` generates IDs but they're not logged alongside errors
- **No API versioning enforcement** — all routes are under `/api/v1/` but there's no middleware ensuring version compatibility
- **No content-type enforcement** — routes accept any content type, not just `application/json`

---

## 11. Recommendations (Priority Order)

### Critical (Blocks Correctness)

1. **Fix queue handler column references** — `push-handler.ts:18`, `tag-create-handler.ts:29`, `tag-delete-handler.ts:25-26`, `installation-handler.ts:26,67`. Change `github_owner`/`github_repo` to parse from `repo_full_name`. The entire GitHub webhook pipeline is currently broken.

2. **Add WHERE clauses to DO UPDATE statements** — `hackathon-state-machine.ts:156,260`. Add `WHERE hackathon_id = ?` to both UPDATEs. Zero cost, eliminates a corruption risk.

3. **Wire up Zod validation middleware** — Install `@hono/zod-validator`. Create a `validateBody(schema)` middleware. Apply to all mutation endpoints. Start with `auth.ts` (login, register, password reset).

### High (Structural Debt)

4. **Migrate from raw SQL to Drizzle query builder** — Start with the 5 highest-traffic route files (`judging.ts`, `teams.ts`, `admin.ts`, `auth.ts`, `workspaces.ts`). This eliminates 153 of 262 `.prepare()` calls and all 30 type casts.

5. **Extract service layer** — Create `HackathonService`, `TeamService`, `JudgingService`, `AuthService`. Move business logic and SQL out of route handlers. Target: route handlers under 30 lines each.

6. **Add dead-letter handling to queue** — Distinguish transient vs permanent errors. After N retries, log the message payload to a DLQ table or KV key for inspection.

7. **Delete or wire `packages/shared`** — Either: (a) import and use the Zod schemas for request validation, or (b) delete the 26 schema files. Dead code that drifts from reality is worse than no code.

### Medium (Quality of Life)

8. **Fix rate limiter race condition** — Either accept KV's approximate nature and document it, or switch to Cloudflare's built-in rate limiting. At minimum, `await` the `KV.put()` instead of fire-and-forget.

9. **Add middleware tests** — Priority: `auth.ts` (156 lines, zero tests), `rate-limit.ts` (52 lines, zero tests), `cache.ts` (58 lines, zero tests).

10. **Fix cache middleware auth detection** — Replace `String.includes('access_token')` with proper cookie parsing via Hono's `getCookie()`. Add user-keyed cache keys for authenticated responses.

11. **Add test factories using Drizzle** — Replace the 18 raw SQL `.prepare()` calls in `helpers.ts` with Drizzle-based factory functions that stay in sync with schema changes.

### Low (Nice to Have)

12. **Reconcile Zod schemas with Drizzle schemas** — If keeping `packages/shared`, generate Zod schemas from Drizzle schemas using `drizzle-zod` to prevent drift.

13. **Add request ID to error logs** — The `requestIdMiddleware` generates IDs but `console.error` calls in routes don't include them. Add structured logging with request ID correlation.

14. **Extract shared queries** — "Get hackathon by slug", "check workspace membership", "resolve user by email" appear in multiple route files. Create a query library or use Drizzle's relational queries.

15. **Add content-type validation** — Middleware that rejects non-JSON requests on mutation endpoints. Prevents accidental form submissions and reduces attack surface.

---

## Appendix: File Reference

### Route Files (17)

| File | Lines | `.prepare()` | `as` Casts | `errorResponse`/`successResponse` |
|------|-------|-------------|-----------|----------------------------------|
| `routes/auth.ts` | 826 | 25 | 0 | 55 |
| `routes/judging.ts` | 701 | 38 | 0 | 51 |
| `routes/teams.ts` | 605 | 37 | 0 | 37 |
| `routes/submissions.ts` | 465 | 12 | 6 | 26 |
| `routes/hackathons.ts` | 346 | 15 | 14 | 16 |
| `routes/hackathon-requests.ts` | 344 | 19 | 8 | 15 |
| `routes/workspaces.ts` | 317 | 23 | 0 | 31 |
| `routes/admin.ts` | 292 | 30 | 0 | 27 |
| `routes/invites.ts` | 278 | 15 | 0 | 25 |
| `routes/rounds.ts` | 269 | 20 | 0 | 17 |
| `routes/team-repos.ts` | 125 | 10 | 0 | 10 |
| `routes/webhooks.ts` | 118 | 1 | 0 | 0 |
| `routes/announcements.ts` | 113 | 6 | 0 | 8 |
| `routes/organizers.ts` | 80 | 4 | 0 | 9 |
| `routes/judge-portal.ts` | 73 | 1 | 0 | 3 |
| `routes/notifications.ts` | 64 | 5 | 0 | 5 |
| `routes/audit.ts` | 49 | 1 | 2 | 1 |

### Middleware Files (9)

| File | Lines | Tests? |
|------|-------|--------|
| `middleware/auth.ts` | 156 | ❌ |
| `middleware/role.ts` | 135 | ✅ (11 tests) |
| `middleware/cache.ts` | 58 | ❌ |
| `middleware/rate-limit.ts` | 52 | ❌ |
| `middleware/hackathon.ts` | 31 | ❌ |
| `middleware/cors.ts` | 27 | ✅ (6 tests) |
| `middleware/error-handler.ts` | 26 | ❌ |
| `middleware/platform-admin.ts` | 25 | ✅ (5 tests) |
| `middleware/request-id.ts` | 9 | ❌ |

### Test Suite (24 files, 223 cases)

| File | Tests |
|------|-------|
| `e2e-lifecycle.test.ts` | 23 |
| `teams.test.ts` | 18 |
| `judging.test.ts` | 17 |
| `hackathons.test.ts` | 16 |
| `admin.test.ts` | 13 |
| `workspaces.test.ts` | 13 |
| `hackathon-state-machine.test.ts` | 11 |
| `role.test.ts` | 11 |
| `response.test.ts` | 9 |
| `rounds.test.ts` | 9 |
| `invites.test.ts` | 8 |
| `notifications.test.ts` | 8 |
| `organizers.test.ts` | 8 |
| `submissions.test.ts` | 8 |
| `team-repos.test.ts` | 8 |
| `webhooks.test.ts` | 7 |
| `queue-handlers.test.ts` | 7 |
| `audit.test.ts` | 6 |
| `cors.test.ts` | 6 |
| `platform-middleware.test.ts` | 5 |
| `cron.test.ts` | 4 |
| `notification-handler.test.ts` | 4 |
| `lifecycle-do.test.ts` | 3 |
| `github.test.ts` | 1 |
