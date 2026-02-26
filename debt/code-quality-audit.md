# DevSage Backend — Code Quality & Patterns Audit

**Date:** 2025-07-24  
**Scope:** `apps/api/src/`, `packages/shared/`, `packages/db/`  
**Branch:** `main`  
**Metrics:** 84 TypeScript files · 14,578 lines · 17 route files · 24 test files

---

## 1. Executive Summary

**Grade: C+**

The DevSage API is a functional, feature-complete hackathon management backend with solid fundamentals in a few areas — cryptographic audit logging, cookie-based auth with refresh-token rotation, and a well-structured middleware chain. The `lib/` layer is clean and well-factored.

However, the codebase suffers from three critical structural problems that compound each other:

1. **Zero runtime validation** — 26 Zod schemas exist in `packages/shared` but are never imported anywhere. All request bodies are trusted via `as` type assertions. Any malformed input silently passes through.
2. **Drizzle ORM is dead code** — 46 Drizzle schema files (863 lines) exist in `packages/db` but are never imported by the API. All 321 database operations use raw `db.prepare()` SQL strings with hand-rolled dynamic query builders.
3. **Fat controllers everywhere** — Route handlers contain all business logic inline (validation, SQL, response formatting). Only 2 of 17 route files import from a service layer.

The codebase works *in spite of* these issues because it's a young project with a single developer. But these patterns will not survive a second contributor or a production incident.

---

## 2. Architecture Anti-Patterns

### 2.1 Fat Controllers (No Service Layer)

Every route file is a monolithic handler that does everything: parse input, validate, query DB, format response, log audit.

**Evidence:**
- **321 direct `c.env.DB` calls** across route files (avg 19 per file)
- **Only 2 of 17 route files** import from a service:
  - `auth.ts` → `sendEmail()` from `services/email.js`
  - `judging.ts` → `assignSubmissionsRoundRobin()`, `computeLeaderboard()` from `services/judging-service.js`
- The remaining 15 route files contain 100% inline business logic
- `auth.ts` (826 lines, 19 endpoints) handles login, register, OAuth, password reset, email verification, account deletion, and session management — all in one file

**Impact:** Untestable business logic. Unit testing any validation or DB logic requires a full HTTP roundtrip through the Workers runtime.

### 2.2 Copy-Paste Duplication

Identical patterns are duplicated across every route file instead of being extracted into shared utilities.

| Duplicated Pattern | Occurrences | Files Affected |
|---|---|---|
| `const now = new Date().toISOString()` | **31** | All 17 route files |
| `const id = crypto.randomUUID()` | **15** | 12 route files |
| `Math.min(parseInt(c.req.query('limit') ?? '20'), 100)` | **10** | 8 route files |
| `insertAuditEvent(c.env.DB, {...})` | **47** | 15 route files |
| Dynamic SQL `UPDATE` builder (`updates.push`, `values.push`) | **31** field pushes | 6 route files |
| Manual `if (!body.field) return errorResponse(...)` validation | **57** uses of `'VALIDATION_ERROR'` | All route files |
| `c.executionCtx.waitUntil(...)` for fire-and-forget | **48** | 14 route files |

The dynamic SQL `UPDATE` builder is the worst offender — the exact same pattern appears in `hackathons.ts`, `teams.ts`, `workspaces.ts`, `announcements.ts`, `judging.ts`, and `rounds.ts`:
```typescript
const updates: string[] = [];
const values: unknown[] = [];
if (body.name) { updates.push('name = ?'); values.push(body.name); }
// ... 5-15 more fields ...
await c.env.DB.prepare(`UPDATE X SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
```

### 2.3 Type Safety Theater — `as` Cast Census

**65 type assertions** across `apps/api/src/` (excluding test files). The API trusts that runtime data matches the asserted types with zero validation.

| File | `as` Casts | Worst Example |
|---|---|---|
| `hackathons.ts` | **24** | Lines 17-47: Every field from `c.req.json()` is cast: `raw.title as string`, `raw.max_team_size as number` |
| `hackathon-requests.ts` | **9** | Line 182: `(existing.title as string).toLowerCase()` — DB column cast blindly |
| `submissions.ts` | **6** | Lines 193-200: `(analysis.detected_frameworks as string[])?.join(', ')` — AI payload trusted |
| `notification-logic.ts` | **7** | Lines 17-120: Queue message payloads cast blindly with `as string \| undefined` |
| `hackathon-state-machine.ts` | **3** | Line 153: `(state.version as number) + 1` — arithmetic on unvalidated DB value |

**`hackathons.ts:14-48` is the canonical example of this anti-pattern:**
```typescript
const raw = await c.req.json<Record<string, unknown>>();
const body = {
  title: raw.title as string,          // Could be number, null, undefined
  slug: raw.slug as string,            // Could be anything
  max_team_size: (raw.max_team_size ?? raw.maxTeamSize) as number | undefined,  // Could be "abc"
  // ... 20 more blind casts
};
```
This is the *exact* problem `packages/shared` was built to solve — yet none of its 26 Zod schemas are ever imported.

### 2.4 Dead Abstractions

Two entire packages are maintained but never used:

**`packages/shared` (26 schemas, 512 lines) — 0 imports:**
```bash
$ grep -rn "from '@devsage/shared'" apps/ packages/  # Only hits README/docs
```
Every schema (`createHackathonSchema`, `teamResponseSchema`, `userResponseSchema`, etc.) is orphaned. The API uses inline `if (!body.field)` checks instead.

**`packages/db` (46 Drizzle schemas, 863 lines) — 0 imports:**
```bash
$ grep -rn "from '@devsage/db'" apps/api/src/  # Zero results
```
The API uses raw `db.prepare()` for all 321 database operations. Drizzle ORM's query builder (`eq()`, `and()`, `select()`, `insert()`) is never called. The only file that even references Drizzle syntax is `submissions.ts` (1 match: an `sql` template tag that's actually D1 native syntax, not Drizzle).

**Combined dead code: 1,375 lines (863 + 512) of maintained but unused TypeScript.**

---

## 3. TypeScript Quality

### 3.1 Type Assertion Catalog

**Total `as` casts in API src (including tests): 65**

Breakdown by category:
- **Request body casts** (`as string`, `as number`): 38 — input from users, zero validation
- **DB result casts** (`as string`, `as number`): 14 — column types not inferred
- **Queue message casts** (`as string | undefined`): 8 — inter-service contract not typed
- **Test casts** (`as unknown as`): 5 — acceptable for test doubles

### 3.2 `any` Usage

Only **2 instances** of explicit `any`:
- `apps/api/src/middleware/error-handler.ts:12` — `const body: any = {...}` (the global error handler)
- `apps/api/src/__tests__/helpers.ts:8` — `const env = rawEnv as any` (test setup)

This is actually a good score — the project avoids explicit `any` while achieving the same effect via `as string` casts. The real type safety issue is the casts, not `any`.

### 3.3 tsconfig Strictness

```json
// packages/config/tsconfig.base.json
{
  "strict": true,           // ✅ All strict checks enabled
  "target": "ES2022",       // ✅ Modern target
  "module": "NodeNext",     // ✅ Proper ESM
  "skipLibCheck": true,     // ⚠️  Skips type-checking .d.ts files
  "checkJs": false          // ⚠️  JS files not checked
}
```

`strict: true` is enabled, but it's undermined by 65 `as` casts that bypass the type checker entirely. The config is correct; the application code doesn't honor it.

### 3.4 Missing Type Definitions

- **DB row types**: All `db.prepare().first<T>()` calls use inline type parameters like `first<{ id: string }>()` instead of shared interfaces. There are no reusable row-type definitions.
- **Request body types**: `c.req.json<Record<string, unknown>>()` is the most common pattern — effectively `any` with extra steps.
- **Queue message types**: `queue-utils.ts` defines discriminated unions, but handlers still cast with `as string`.

---

## 4. Error Handling

### 4.1 Consistency

The project uses a consistent response envelope via `lib/response.ts`:
```typescript
// Success: { ok: true, data: T, meta?: {...} }
// Error:   { ok: false, error: { code: string, message: string } }
```

**15 of 17** route files use `successResponse()`/`errorResponse()` consistently. Two exceptions:
- `webhooks.ts` uses raw `c.json({ error: 'Missing headers' }, 400)` — breaks the envelope contract
- `hackathons.ts:265,279` uses `c.json(initResult, doRes.status as 400 | 500)` — passes through DO responses directly

### 4.2 Error Code Inconsistency

Error codes are ad-hoc strings with no central enum:

| Intended Meaning | Codes Used |
|---|---|
| Validation failure | `'VALIDATION_ERROR'` (57×), `'VALIDATION'` (2× in submissions.ts) |
| Already exists | `'ALREADY_ADMIN'`, `'DUPLICATE'`, `'SLUG_TAKEN'`, `'ALREADY_ON_TEAM'`, `'JUDGE_ALREADY_INVITED'`, `'JUDGE_ALREADY_EXISTS'`, `'ALREADY_ORGANIZER'`, `'REPO_ALREADY_LINKED'`, `'ALREADY_SCORED'` |
| Not found | `'NOT_FOUND'` (35×, consistent) |
| Unauthorized | `'FORBIDDEN'` (13×), `'AUTH_REQUIRED'` (3×), `'AUTH_MISCONFIGURED'` (4×) |

The `'VALIDATION_ERROR'` vs `'VALIDATION'` split is a bug — `submissions.ts` uses the shorter form while every other file uses the longer form.

### 4.3 Silent Error Swallowing

**10 silent `catch` blocks** across route files:

| File | Line | Catch Pattern | Risk |
|---|---|---|---|
| `auth.ts` | 809 | `catch { /* ignore if column doesn't exist */ }` | Schema migration failure hidden |
| `hackathon-requests.ts` | 73, 226, 314 | `catch (_) { /* notification failure should not block */ }` | Notification system silently broken |
| `submissions.ts` | 135, 150 | `catch { /* skip */ }` | GitHub API analysis failures hidden |
| `submissions.ts` | 348-349 | `catch { /* skip */ }` | Corrupted JSON in DB hidden |
| `judging.ts` | 339, 641 | `.catch(() => ({}))` | Body parse failure treated as empty |

The `hackathon-requests.ts` catches are *intentionally* fail-open (documented), but the `submissions.ts` catches hide real bugs — corrupted `analysis_json` in the DB would never be detected.

### 4.4 Global Error Handler

`middleware/error-handler.ts` catches all unhandled errors and returns `{ ok: false, error: { code: 'INTERNAL_ERROR', message } }`. In development (detected via `JWT_SECRET.startsWith('dev')`), it includes the stack trace. In production, it returns a generic message.

**Issue:** Uses `const body: any` — the one place in the codebase where `any` is used in production code.

### 4.5 Missing Error Handling

- No error handling on `insertAuditEvent()` — 47 calls, all fire-and-forget via `waitUntil()`. If audit logging fails, the mutation succeeds but the audit trail has a gap.
- No error handling on `db.prepare().run()` in most routes — if a SQL statement fails (constraint violation, syntax error), it bubbles up to the global error handler as `INTERNAL_ERROR` instead of a meaningful error.

---

## 5. Code Organization

### 5.1 File Naming Conventions

**Consistent:** All files use `kebab-case.ts` naming. No violations found.

### 5.2 Import Patterns

- **Barrel exports:** `packages/shared/src/index.ts` re-exports all 26 schemas with `.js` extensions (ESM strict) ✅
- **Route imports:** Each route file imports from `../lib/`, `../middleware/`, `../types/` — consistent and clean ✅
- **No circular imports detected** ✅

### 5.3 Module Boundaries

**Violated:**
- `packages/shared` is declared as a dependency of `apps/api`, `apps/web`, `apps/platform`, `apps/admin` in their `package.json` files — but none of them actually import from it. The boundary exists on paper but not in code.
- `packages/db` is declared as a dependency of `apps/api` — but is never imported. The API writes raw SQL.

**Respected:**
- No cross-app imports between web/platform/admin ✅
- No frontend app imports from `@devsage/db` ✅
- Middleware chain order is correct in `src/index.ts` ✅

### 5.4 File Sizes

| File | Lines | Verdict |
|---|---|---|
| `__tests__/helpers.ts` | **866** | Test infrastructure — acceptable but should be split |
| `routes/auth.ts` | **826** | 19 endpoints in one file — needs splitting (OAuth, password, session) |
| `__tests__/e2e-lifecycle.test.ts` | **716** | Sequential integration test — acceptable |
| `routes/judging.ts` | **701** | 52 endpoint-level matches (rubric, scoring, leaderboard, COI) — needs splitting |
| `routes/teams.ts` | **605** | Includes 150-line bulk seeding handler — should be a service |
| `routes/submissions.ts` | **465** | Includes inline GitHub API analysis — should be a service |
| `queue/notification-handler.ts` | **345** | Complex switch-case — borderline |

**5 files exceed 500 lines** — all are route handlers that should delegate to services.

### 5.5 Rate Limiter Not Wired

`middleware/rate-limit.ts` exists and is fully implemented, but is **never mounted** in the middleware chain in `src/index.ts`. The global middleware chain is:
```typescript
app.use('*', corsMiddleware);
app.use('*', requestIdMiddleware);
app.use('*', optionalAuth);
app.onError(errorHandler);
// rateLimitMiddleware is imported nowhere
```

---

## 6. Testing Quality

### 6.1 Overview

- **24 test files**, 5,830 lines of test code
- **Test ratio:** 0.84 test lines per source line (healthy for integration tests)
- **Framework:** Vitest with `@cloudflare/vitest-pool-workers` (real Workers runtime)
- **Pre-existing failures:** ~25 tests fail on `main` branch

### 6.2 Test Isolation

- `ensureSchema()` in `beforeAll` creates tables if not present ✅
- `resetDb()` in `beforeEach` truncates all tables ✅
- `singleWorker: true` + `isolatedStorage: false` in vitest config — tests share a Worker process and storage
- `e2e-lifecycle.test.ts` uses ordered sequential steps with shared state — **fragile**: if step 5 fails, steps 6-23 all fail

### 6.3 Test Helper Quality

`__tests__/helpers.ts` (866 lines) contains:
- `ensureSchema()` with **34 `CREATE TABLE` statements** — manually duplicated from `packages/db` schemas. If a schema changes in `packages/db`, tests won't break until the SQL diverges at runtime.
- 7 seed users (srijan, admin, organizer, co_organizer, judge, lead, participant) with hardcoded UUIDs
- `authCookie()` generates JWT tokens for test auth
- `insertUser()`, `insertWorkspace()`, `insertHackathon()`, etc. — full factory functions

**Schema Drift Risk:** The test helpers define 34 tables via raw `CREATE TABLE` SQL, while `packages/db` defines 46 tables via Drizzle. These are independent definitions that can silently diverge.

### 6.4 Missing Test Coverage

**4 route files have no test file:**
| Route File | Lines | Reason |
|---|---|---|
| `auth.ts` | 826 | Most complex file, zero dedicated tests |
| `announcements.ts` | 113 | No test file |
| `hackathon-requests.ts` | 344 | No test file |
| `judge-portal.ts` | 73 | No test file |

The `auth.ts` gap is the most critical — 826 lines covering login, registration, OAuth, password reset, email verification, and session management with zero test coverage.

### 6.5 Test Naming

Tests use descriptive names ✅:
```typescript
it('should return 401 for unauthenticated requests', ...)
it('should auto-add creator as organizer', ...)
it('should return 409 for duplicate slug', ...)
```

---

## 7. Naming Conventions

### 7.1 Mixed Casing in API Contract

The API accepts *both* camelCase and snake_case for the same fields, then normalizes internally:

```typescript
// hackathons.ts:28-41
rules_md: (raw.rules_md ?? raw.rulesMd) as string | undefined,
starts_at: (raw.starts_at ?? raw.startsAt) as string | undefined,
max_team_size: (raw.max_team_size ?? raw.maxTeamSize) as number | undefined,
```

This dual-casing convention means:
- The API surface is ambiguous (which casing is "correct"?)
- Every field needs two property accesses via `??`
- Type safety is impossible (both forms are `unknown`)
- The 24 `as` casts in `hackathons.ts` are a direct result of this pattern

### 7.2 URL Parameters

Mixed conventions in route parameters:
- `admin.ts`: `:userId`, `:hackathonId` (camelCase) ✅
- `teams.ts`: `:teamId` (camelCase) ✅
- Consistent — all route params use camelCase ✅

### 7.3 DB Column Names

All columns use `snake_case` — consistent with SQLite conventions ✅.

### 7.4 Error Code Naming

Ad-hoc string codes with no consistent pattern:
- `'VALIDATION_ERROR'` vs `'VALIDATION'` — same meaning, two codes
- `'ALREADY_ADMIN'` vs `'DUPLICATE'` vs `'SLUG_TAKEN'` — same HTTP 409, different code styles
- `'AUTH_REQUIRED'` vs `'FORBIDDEN'` — overlapping semantics

Should be a centralized enum exported from `packages/shared`.

---

## 8. Documentation

### 8.1 Code Comments

- **258 inline comments** across route files — mostly section headers (`// ─── Create team ───`) and brief explanations
- **3 JSDoc blocks** in routes, **1** in lib — almost zero API documentation
- Comments are present but provide context-level ("what"), not contract-level ("why", "params", "returns")

### 8.2 JSDoc Usage

Essentially none. No function has documented parameters, return types, or throws declarations. The `lib/` utilities (JWT, audit, password) would benefit most from JSDoc.

### 8.3 README Completeness

- Root `README.md` exists ✅
- `packages/shared/README.md` with usage examples ✅
- `docs/` directory with architecture docs ✅
- No API endpoint documentation (no OpenAPI/Swagger spec) ❌

### 8.4 Architecture Docs

The `docs/` directory and `CLAUDE.md`/`AGENTS.md` files are comprehensive. The project is better documented at the architecture level than at the code level.

---

## 9. Dependency Management

### 9.1 Dead Dependencies

- **`drizzle-orm` (v0.45.0)** in `packages/db` — installed, schemas defined, never queried
- **`drizzle-kit` (v0.31.9)** in `packages/db` devDeps — used only for migration generation, but migrations are also never applied via Drizzle (they're applied via `wrangler d1 migrations apply`)
- **`@devsage/shared`** — listed as dependency in 4 packages, imported by 0

### 9.2 Unused Shared Schemas

All 26 schemas in `packages/shared/src/schemas/` are exported but never consumed:
```
constants.ts, api.ts, user.ts, hackathon.ts, workspace.ts,
workspace-member.ts, team.ts, team-member.ts, team-invite.ts, team-repo.ts,
team-message.ts, submission.ts, rubric.ts, judge.ts, judge-assignment.ts,
judge-track.ts, score.ts, organizer-role.ts, hackathon-round.ts,
hackathon-template.ts, hackathon-sponsor.ts, round-result.ts, audit-event.ts,
in-app-notification.ts, commit-log.ts, force-push.ts
```

### 9.3 Test Schema Duplication

The 34 `CREATE TABLE` statements in `helpers.ts` are an independent, manually-maintained copy of what should come from `packages/db`. This means:
- Schema changes must be made in two places
- No mechanism to detect drift between them
- The test tables may already be out of sync with the 46 Drizzle tables

---

## 10. Top 20 Code Smells

### Smell #1: Blind Type Assertion Cascade
**File:** `apps/api/src/routes/hackathons.ts:14-48`  
24 consecutive `as` casts on unvalidated user input from `c.req.json()`. A request with `{ title: 42, slug: null }` would silently pass validation and corrupt the database.

### Smell #2: 826-Line God Route
**File:** `apps/api/src/routes/auth.ts` (826 lines, 19 endpoints)  
Handles login, register, OAuth Google, OAuth GitHub, password reset, email verification, session refresh, account deletion, profile update, and password change — all in one file with zero service delegation.

### Smell #3: Dead ORM Layer
**Files:** `packages/db/src/schema/*.ts` (46 files, 863 lines)  
Drizzle ORM schemas are defined, maintained, and built — but the API uses raw SQL for all 321 database operations. Two parallel schema definitions exist: Drizzle tables and raw SQL in test helpers.

### Smell #4: Dead Validation Layer
**Files:** `packages/shared/src/schemas/*.ts` (26 files, 512 lines)  
Zod schemas are defined and exported but imported by zero packages. The API uses `if (!body.field)` for validation instead.

### Smell #5: Dynamic SQL UPDATE Builder × 6
**Files:** `hackathons.ts`, `teams.ts`, `workspaces.ts`, `announcements.ts`, `judging.ts`, `rounds.ts`  
The same `updates.push('field = ?'); values.push(body.field)` pattern is copy-pasted across 6 files with 31 field pushes total. Should be a `buildUpdateQuery()` utility.

### Smell #6: Rate Limiter Written But Never Mounted
**File:** `apps/api/src/middleware/rate-limit.ts` — fully implemented with 4 tiers  
**File:** `apps/api/src/index.ts` — rate limiter is not in the middleware chain  
The API has zero rate limiting in production.

### Smell #7: `VALIDATION_ERROR` vs `VALIDATION` Inconsistency
**Files:** All routes use `'VALIDATION_ERROR'` (57×) except `submissions.ts` which uses `'VALIDATION'` (2×)  
Two different error codes for the same concept. API consumers must handle both.

### Smell #8: No Tests for Most Complex File
**File:** `apps/api/src/routes/auth.ts` (826 lines)  
No dedicated test file exists (`apps/api/src/__tests__/auth.test.ts` is missing). The most complex, security-critical code in the project has zero test coverage.

### Smell #9: Silent JSON Parse Failures
**File:** `apps/api/src/routes/submissions.ts:348-349`  
```typescript
try { if (submission.analysis_json) result.analysis = JSON.parse(submission.analysis_json as string); } catch { /* skip */ }
try { if (submission.ai_review_json) result.ai_review = JSON.parse(submission.ai_review_json as string); } catch { /* skip */ }
```
Corrupted data in DB is silently swallowed. No logging, no alerting.

### Smell #10: Pagination Logic Duplicated 10×
**Files:** 8 route files with identical pagination parsing  
```typescript
const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
const offset = parseInt(c.req.query('offset') ?? '0');
```
Should be a single `parsePagination(c)` utility.

### Smell #11: Template Literal SQL with String Interpolation
**File:** `apps/api/src/routes/announcements.ts:94`  
```typescript
await c.env.DB.prepare(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`)
```
While the column names come from server-side logic (not user input), this pattern constructs SQL from runtime strings. 7 files use this pattern. A typo in a column name would produce a runtime SQL error instead of a compile-time type error.

### Smell #12: 5 DB Queries Per Request for Role Resolution
**File:** `apps/api/src/middleware/auth.ts` (lines 73-99 of optionalAuth)  
Every authenticated request triggers `Promise.all([...5 queries...])` to resolve roles across organizer_roles, judges, team_members, workspace_members, and platform_admins. No caching layer.

### Smell #13: Test Schema Drift Risk
**File:** `apps/api/src/__tests__/helpers.ts` — 34 `CREATE TABLE` statements  
**File:** `packages/db/src/schema/` — 46 Drizzle table definitions  
These are independent definitions. The test helpers define 34 tables; the DB package defines 46. At least 12 tables exist in the schema but not in tests.

### Smell #14: Inline GitHub API Integration
**File:** `apps/api/src/routes/submissions.ts:60-177`  
A 117-line handler that directly calls the GitHub API, parses repository contents, detects frameworks by scanning `package.json`/`requirements.txt`, and formats results — all inline in a route handler. Should be in `services/github.ts`.

### Smell #15: Webhook Response Breaks Envelope
**File:** `apps/api/src/routes/webhooks.ts:15,22,32,48`  
```typescript
return c.json({ error: 'Missing headers' }, 400);     // Missing ok: false wrapper
return c.json({ error: 'Invalid signature' }, 401);    // Missing error.code
return c.json({ received: true, action: 'queued' });   // Missing ok: true wrapper
```
These responses don't follow the `{ ok, data/error }` envelope used by all other routes.

### Smell #16: `any` in Global Error Handler
**File:** `apps/api/src/middleware/error-handler.ts:12`  
```typescript
const body: any = { ok: false, error: { code: 'INTERNAL_ERROR', ... } };
```
The error handler — the last line of defense — uses `any`. Should be a properly typed error response interface.

### Smell #17: Dual-Casing API Contract
**File:** `apps/api/src/routes/hackathons.ts:28-41`  
The API accepts both `rules_md` and `rulesMd`, `starts_at` and `startsAt`, etc. Each field uses `(raw.snake_case ?? raw.camelCase) as type`. This doubles the API surface and makes it undocumentable.

### Smell #18: Bulk Seeding in Route Handler (150 Lines)
**File:** `apps/api/src/routes/teams.ts:465-605`  
A 140-line handler for bulk team seeding with 3 modes, nested loops, and sequential DB operations in a `for` loop. This is a complex business operation that belongs in a service with unit tests.

### Smell #19: Inconsistent 409 Error Codes
**Files:** Multiple route files  
At least 9 different error codes for HTTP 409 Conflict: `ALREADY_ADMIN`, `DUPLICATE`, `SLUG_TAKEN`, `ALREADY_ON_TEAM`, `JUDGE_ALREADY_INVITED`, `JUDGE_ALREADY_EXISTS`, `ALREADY_ORGANIZER`, `REPO_ALREADY_LINKED`, `ALREADY_SCORED`. Some describe the entity (`SLUG_TAKEN`), some describe the action (`ALREADY_SCORED`). No naming convention.

### Smell #20: No OpenAPI Spec
**Impact:** All API routes, request/response shapes, error codes, and auth requirements are only documented in code. There's no machine-readable API spec. Combined with the lack of Zod validation (which could auto-generate OpenAPI), the API contract is entirely implicit.

---

## Appendix: Quantitative Summary

| Metric | Value |
|---|---|
| Total API source files | 84 |
| Total API source lines | 14,578 |
| Route files | 17 (5,065 lines) |
| Test files | 24 (5,830 lines) |
| `as` type assertions (non-test) | ~60 |
| `any` usage (non-test) | 2 |
| Direct DB calls in routes | 321 |
| Service layer imports in routes | 2 of 17 files |
| Zod schema imports | 0 |
| Drizzle query builder imports | 0 |
| Dead code (shared + db schemas) | ~1,375 lines |
| Silent `catch` blocks | 10 |
| Error codes without central enum | 30+ unique strings |
| Route files without tests | 4 (including auth.ts) |
| Duplicate pagination parsing | 10 instances |
| Duplicate timestamp generation | 31 instances |
| Duplicate UUID generation | 15 instances |
| Files over 500 lines | 5 route files + 1 test helper |
