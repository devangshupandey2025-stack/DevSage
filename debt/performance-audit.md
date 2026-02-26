# DevSage Backend Performance Audit

**Date:** 2025-07-24  
**Scope:** `apps/api/`, `packages/db/`  
**Branch:** `main`

---

## 1. Executive Summary

DevSage's backend is architecturally sound for an edge-native platform — Cloudflare Workers, D1, Durable Objects, and Queues are the right primitives. However, several performance bottlenecks exist that will compound as hackathon scale grows:

- **Auth middleware runs 6 DB queries on every authenticated request** with zero caching — the single biggest latency contributor.
- **N+1 query patterns** in judging score submission, team seeding, and installation webhook handling add unnecessary round-trips to D1.
- **Serial execution** in cron jobs, queue message processing, and notification fan-out wastes wall-clock time when tasks are independent.
- **CryptoKey re-import on every JWT sign/verify** adds ~1-2ms of unnecessary overhead per request.
- **Missing database indexes** on invitation status columns, `submissions.submitted_at`, and timestamp sort columns cause full table scans.

The good news: most fixes are surgical — `Promise.all()`, `DB.batch()`, KV caching, and a migration with `CREATE INDEX` statements. No architectural rewrites needed.

**Overall risk:** Medium-High at scale (100+ concurrent hackathons, 1000+ judges). Low risk at current scale.

---

## 2. Database Performance

### 2.1 Missing Indexes

The schema has ~130 indexes across 48 tables — solid coverage overall. But several high-frequency query paths hit unindexed columns.

| Table | Missing Index | Query Pattern | Impact | Priority |
|-------|---------------|---------------|--------|----------|
| `submissions` | `submitted_at` | Leaderboard sorting, deadline checks | Full scan on every leaderboard query | 🔴 High |
| `platform_invites` | `status, expires_at` | Pending invite lookups | Full scan for `WHERE status = 'pending'` | 🔴 High |
| `workspace_invites` | `status, expires_at` | Pending invite lookups | Full scan for `WHERE status = 'pending'` | 🔴 High |
| `team_invites` | `status, expires_at` | Pending invite lookups | Full scan for `WHERE status = 'pending'` | 🔴 High |
| `teams` | `hackathon_id, status` | Team listing with status filter | Index on `hackathon_id` alone, status unindexed | 🟡 Medium |
| `users` | `created_at` | Admin dashboard user listing | Full scan for `ORDER BY created_at` | 🟡 Medium |
| `scores` | `scored_at` | Judge productivity tracking | Full scan for time-range queries | 🟡 Medium |
| `rubric_criteria` | `hackathon_id, track_id, round` | Criteria lookup per track/round | Unique index exists but no covering index for lookups | 🟡 Medium |
| `hackathon_rounds` | `hackathon_id, started_at` | Round timeline queries | No index for time-based round filtering | 🟡 Medium |

**Recommended migration:**

```sql
CREATE INDEX idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX idx_platform_invites_status ON platform_invites(status, expires_at);
CREATE INDEX idx_workspace_invites_status ON workspace_invites(status, expires_at);
CREATE INDEX idx_team_invites_status ON team_invites(status, expires_at);
CREATE INDEX idx_teams_hackathon_status ON teams(hackathon_id, status);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_scores_scored_at ON scores(scored_at DESC);
CREATE INDEX idx_rubric_criteria_track ON rubric_criteria(hackathon_id, track_id, round);
CREATE INDEX idx_hackathon_rounds_started ON hackathon_rounds(hackathon_id, started_at);
```

### 2.2 N+1 Queries

#### 🔴 Score Submission Loop — `apps/api/src/routes/judging.ts:444-455`

Each score in a submission is upserted individually inside a `for` loop. A judge scoring 10 criteria = 10 sequential D1 round-trips.

```typescript
// CURRENT: N sequential queries
for (const s of body.scores) {
  await c.env.DB.prepare(`INSERT INTO scores ... ON CONFLICT ... DO UPDATE ...`).bind(...).run();
}
```

**Fix:** Use `DB.batch()` to send all upserts atomically in one round-trip.

```typescript
// FIX: 1 batched round-trip
const statements = body.scores.map(s =>
  c.env.DB.prepare(`INSERT INTO scores ... ON CONFLICT ... DO UPDATE ...`).bind(...)
);
await c.env.DB.batch(statements);
```

**Impact:** 🔴 High — this is the hottest write path during judging phase.

#### 🔴 Team Seed Loop — `apps/api/src/routes/teams.ts:496-541`

Seeding teams via the bulk endpoint runs a nested loop: each team = 1 INSERT, each leader invite = 1 INSERT, each member = 1 INSERT. Seeding 100 teams with 5 members = **600+ sequential queries**.

```typescript
// CURRENT: O(teams × members) sequential queries
for (const entry of body.teams.slice(0, 100)) {
  await c.env.DB.prepare('INSERT INTO teams ...').bind(...).run();
  if (entry.leader_email) {
    await c.env.DB.prepare('INSERT INTO team_invites ...').bind(...).run();
  }
  for (const memberEmail of entry.member_emails) {
    await c.env.DB.prepare('INSERT INTO team_invites ...').bind(...).run();
  }
}
```

**Fix:** Collect all statements, batch in chunks of 20 (D1's 100-parameter limit).

**Impact:** 🔴 High — blocks the API thread for seconds during hackathon setup.

#### 🟡 Participant Seed Loop — `apps/api/src/routes/teams.ts:556-570`

Similar to above: 500 participants = 500 sequential INSERTs. Should batch.

**Impact:** 🟡 Medium — only used during setup, not in hot path.

#### 🟡 Installation Webhook Loop — `apps/api/src/queue/installation-handler.ts:21-61`

For each repository in a GitHub App installation event, runs 3-4 sequential DB queries (pending lookup, team_repos update, pending delete, audit insert).

**Fix:** Batch repo lookups in a single `WHERE repo_full_name IN (...)` query, then batch updates.

**Impact:** 🟡 Medium — triggered on GitHub App install events only.

#### 🟡 Audit Hash Backfill — `apps/api/src/lib/audit.ts:62-95`

`backfillAuditHashes()` fetches unhashed events, then for each event: 1 query to get previous hash + 1 crypto digest + 1 UPDATE. This is O(n) queries for n events.

```typescript
// CURRENT: 2 DB queries per unhashed event
for (const event of unhashed.results) {
  const prev = await db.prepare('SELECT hash ... WHERE sequence < ?').bind(...).first();
  // ... compute hash ...
  await db.prepare('UPDATE audit_events SET hash = ? WHERE id = ?').bind(...).run();
}
```

**Fix:** Pre-fetch all previous hashes in one query keyed by `hackathon_id`, compute all hashes in memory, then batch-UPDATE.

**Impact:** 🟡 Medium — runs in cron (hourly), limited to 100 events per run.

### 2.3 Unbounded Queries

| Location | Query | Risk |
|----------|-------|------|
| `admin.ts:186-194` | `SELECT w.*, (SELECT COUNT(*) FROM workspace_members ...), (SELECT COUNT(*) FROM hackathons ...)` | Correlated subqueries scan full tables per workspace |
| `judge-portal.ts:24-52` | Correlated `COUNT(*)` subqueries for `judge_assignments` per judge | Scans all assignments per judge row |
| `cron/index.ts:35-42` | `SELECT DISTINCT h.id FROM hackathons ... WHERE h.status = 'active'` | No LIMIT — loads all active hackathons into memory |
| `cron/index.ts:86-92` | `SELECT h.id, hr.submission_deadline FROM hackathons h JOIN hackathon_rounds hr ...` | No LIMIT — loads all active rounds |
| `queue/notification-logic.ts:51-59` | `SELECT DISTINCT u.id, u.email FROM users u WHERE u.id IN (UNION of 3 subqueries)` | Scans all participants in a hackathon |

**Fix for admin.ts:** Replace correlated subqueries with `LEFT JOIN ... GROUP BY`:
```sql
SELECT w.*, COUNT(DISTINCT wm.id) as member_count, COUNT(DISTINCT h.id) as hackathon_count
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN hackathons h ON h.workspace_id = w.id
GROUP BY w.id
```

**Impact:** 🟡 Medium — admin routes are low-traffic but can be slow for platform admins.

### 2.4 Full Table Scans

The cron job queries (`checkSubmissionDeadlines`, `sendDeadlineReminders`) join `hackathons` and `hackathon_rounds` on `status = 'active'`. The `hackathons.status` column has an index (`idx_hackathons_status`), and `hackathon_rounds` has `hackathon_rounds_status_idx(hackathon_id, status)` — these should be well-indexed.

However, the `hackathon_rounds.submission_deadline` comparison (`<= ?`) doesn't have a dedicated index. For active hackathons with many rounds, this could cause a partial scan within the round rows.

**Impact:** 🟢 Low — few active hackathons at any time.

---

## 3. API Route Performance

### 3.1 Auth Middleware — The Biggest Bottleneck

**File:** `apps/api/src/middleware/auth.ts`

The `optionalAuth` middleware runs on **every request** with a cookie-based token. For authenticated users, it executes:

1. **JWT verify** — `verifyJWT()` (lines 24) — crypto.subtle HMAC + key import
2. **User lookup** — `SELECT ... FROM users WHERE id = ?` (line 54-66) — 1 D1 query
3. **5 parallel role queries** via `Promise.all()` (lines 73-99):
   - `platform_admins` lookup
   - `workspace_members` lookup
   - `organizer_roles JOIN hackathons`
   - `judges JOIN hackathons`
   - `team_members JOIN teams JOIN hackathons`

**Total: 1 JWT verify + 6 D1 queries per authenticated request.**

The `Promise.all()` on the 5 role queries is good (parallel), but there's **no KV caching**. Every single request re-fetches all roles from D1.

**Fix:** Cache the assembled user object in KV with a 60-second TTL (matching the role cache in `role.ts`). Invalidate on role changes.

```typescript
const cacheKey = `user:${payload.sub}`;
const cached = await c.env.KV.get(cacheKey, 'json');
if (cached) {
  c.set('user', cached);
  return next();
}
// ... existing queries ...
c.executionCtx.waitUntil(
  c.env.KV.put(cacheKey, JSON.stringify(userObj), { expirationTtl: 60 })
);
```

**Impact:** 🔴 High — eliminates 6 D1 queries on ~95% of requests (KV hit rate).

### 3.2 Rate Limiting — Blocking KV Read

**File:** `apps/api/src/middleware/rate-limit.ts`

Line 25: `const current = await c.env.KV.get(key)` is a **blocking read** on every request. The write is fire-and-forget via `waitUntil()` (good), but the read blocks.

Additionally, the counter pattern has a race condition: two concurrent requests can both read `count=99`, both pass the `count >= 100` check, and both increment — allowing burst over the limit.

**Fix:** For Workers, consider using the Cache API or Durable Objects for atomic rate limiting. Alternatively, accept the race condition as "good enough" for rate limiting (it is for most use cases).

**Impact:** 🟡 Medium — KV reads are fast (~1-5ms from edge) but add up.

### 3.3 Hackathon Context Middleware — Uncached D1 Lookup

**File:** `apps/api/src/middleware/hackathon.ts`

Every hackathon-scoped route runs `SELECT id, workspace_id, slug, status FROM hackathons WHERE slug = ?` — a D1 query per request with no caching. Hackathon slugs are immutable after creation.

**Fix:** KV cache with 5-minute TTL, keyed by slug. Invalidate on status transitions.

**Impact:** 🟡 Medium — eliminates 1 D1 query per hackathon-scoped request.

### 3.4 Per-Route Analysis

#### Judging Routes — `apps/api/src/routes/judging.ts`

- **Score submission (POST):** N+1 loop (see §2.2) + audit event + KV cache delete. Most expensive write path.
- **Leaderboard (GET):** Complex aggregation query with GROUP BY across scores, submissions, and teams. The `judging-service.ts` leaderboard computation loads ALL scores for a hackathon, groups in SQL, then returns. No pagination on the leaderboard query itself.
- **Assignment generation:** `judging-service.ts:33-62` fetches all existing assignments into a `Set`, then loops through submissions doing individual INSERTs. Should use `INSERT OR IGNORE` in a batch.

#### Teams Routes — `apps/api/src/routes/teams.ts`

- **POST / (create team):** 3 sequential queries (existing team check, team count, max teams) that could be parallelized with `Promise.all()`. Lines 71-93.
- **POST /join:** 4 sequential queries (team by invite code, existing membership, member count, team size limit). Only the first is blocking; queries 2-4 can parallelize. Lines 206-214.

#### Hackathons Routes — `apps/api/src/routes/hackathons.ts`

- **POST / (create hackathon):** 2 sequential queries (workspace membership check, slug uniqueness) that are independent. Lines 50-64.

#### Admin Routes — `apps/api/src/routes/admin.ts`

- **GET /workspaces:** Correlated COUNT subqueries (see §2.3).
- **GET /workspaces/:id:** Already parallelized with `Promise.all()` — good pattern to follow elsewhere. Lines 262-282.

### 3.5 Middleware Chain Overhead Summary

Every authenticated request to a hackathon-scoped route runs this chain:

| Step | Middleware | Blocking I/O | Latency |
|------|-----------|--------------|---------|
| 1 | CORS | None (in-memory origin check) | ~0ms |
| 2 | Request ID | None (`crypto.randomUUID()`) | ~0ms |
| 3 | Rate Limit | 1 KV read | ~1-5ms |
| 4 | Error Handler | None | ~0ms |
| 5 | `optionalAuth` | 1 JWT verify + 6 D1 queries | ~15-40ms |
| 6 | `hackathonContext` | 1 D1 query | ~3-8ms |
| 7 | `requireRole()` | 1 KV read (cached) or 1 D1 query | ~1-8ms |
| **Total** | | **8-9 I/O operations** | **~20-60ms overhead** |

With auth caching, this drops to **2-3 I/O operations** and **~5-15ms overhead**.

---

## 4. Caching Strategy

### 4.1 Current State

**File:** `apps/api/src/middleware/cache.ts`

The `kvCache()` middleware is minimal but functional:
- ✅ Only caches GET requests
- ✅ Skips authenticated requests (prevents data leakage)
- ✅ Fire-and-forget KV write via `waitUntil()`
- ✅ `cacheControl()` helper supports `stale-while-revalidate` header

**Gaps:**
- ❌ **No cache invalidation strategy.** KV entries expire by TTL only. When a score is submitted, the leaderboard cache (`leaderboard:{hackathonId}`) is deleted (good), but there's no pattern for other entities (teams, submissions, hackathon details).
- ❌ **No cache warming.** Cold starts after TTL expiry always hit D1.
- ❌ **No stale-while-revalidate at the KV layer.** The `cacheControl()` function sets the HTTP header for CDN/browser caching, but KV itself doesn't serve stale data while refreshing.
- ❌ **Cache key doesn't include query params correctly.** `c.req.url` includes the full URL with query params, which is correct for differentiation, but means `?limit=10` and `?limit=20` are separate cache entries with no shared invalidation.

### 4.2 KV-Based Rate Limiting

**Current pattern:** Read count from KV → check limit → fire-and-forget write incremented count.

**Issues:**
1. Race condition on concurrent requests (two reads before either write lands).
2. KV is eventually consistent — writes may not be visible for up to 60 seconds in other regions.

**Alternative:** For Workers, the recommended pattern for precise rate limiting is Durable Objects (single-threaded, strongly consistent). For "good enough" rate limiting, KV with TTL is acceptable. The current implementation is fine for the use case.

**Impact:** 🟢 Low — rate limiting doesn't need to be precise.

---

## 5. Cloudflare Workers Specific

### 5.1 Cold Start

Workers have near-zero cold start (~0-5ms) compared to Lambda. However:
- **CryptoKey import** in `jwt.ts:22-29` (`getKey()`) creates a new `CryptoKey` on every `signJWT()`/`verifyJWT()` call. This is ~1-2ms of wasted work.
- **Fix:** Cache the `CryptoKey` at module scope (keyed by secret string, since secrets don't change per-isolate):

```typescript
let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

async function getKey(secret: string): Promise<CryptoKey> {
  if (cachedKey && cachedSecret === secret) return cachedKey;
  cachedKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), ALGORITHM, false, ['sign', 'verify']);
  cachedSecret = secret;
  return cachedKey;
}
```

**Impact:** 🟡 Medium — saves ~1-2ms per request, compounds across all authenticated requests.

### 5.2 Worker Bundle Size

Not analyzed in this audit. Recommend running `wrangler deploy --dry-run --outdir=dist` and checking bundle size. Hono + Drizzle + Zod should be well within Workers' 10MB compressed limit.

### 5.3 D1 Latency Patterns

D1 is SQLite at the edge with a primary (writer) region and read replicas. Key considerations:
- **Writes** always go to the primary region — latency depends on user distance from primary.
- **Reads** can be served from replicas — lower latency, but eventual consistency.
- **`DB.batch()`** sends multiple statements in a single round-trip — critical for reducing write latency.
- **Correlated subqueries** (found in `admin.ts`, `judge-portal.ts`) execute within D1 itself, so they don't add network round-trips, but they do increase query execution time.

**Pattern to follow:** `apps/api/src/routes/admin.ts:262-282` uses `Promise.all()` with 3 parallel queries — this is the gold standard for independent reads.

### 5.4 Durable Object Performance

**File:** `apps/api/src/durable-objects/hackathon-state-machine.ts`

The DO is well-designed:
- ✅ Lazy table initialization with `initialized` flag (line 19, 26)
- ✅ Synchronous SQLite reads (no async overhead for simple state checks)
- ✅ `INSERT OR IGNORE` for submission deduplication (line 218-221)
- ✅ Atomic counter via `ON CONFLICT DO UPDATE` (line 232-234)
- ✅ Alarm-based deadline transitions (line 243-274)

**Concerns:**
- The `alarm()` handler at line 265-267 writes to D1 (`UPDATE hackathons SET status = ?`). This is an anti-pattern per project conventions ("Worker mediates all D1 writes"), but it's pragmatic for alarm-triggered transitions where no Worker request context exists. Low risk.
- Each DO fetch involves an RPC call from the Worker to the DO — ~1-5ms overhead. This is unavoidable and acceptable.

**Impact:** 🟢 Low — DO is lightweight and well-optimized.

---

## 6. Queue Processing

### 6.1 Sequential Message Processing

**File:** `apps/api/src/queue/index.ts:30-46`

Messages within a batch are processed sequentially:

```typescript
for (const message of batch.messages) {
  try {
    // ... await handler ...
    message.ack();
  } catch (err) {
    message.retry();
  }
}
```

Cloudflare Workers Queues delivers messages in batches. Independent messages (e.g., different webhook events for different hackathons) could be processed in parallel with `Promise.allSettled()`.

**Fix:**
```typescript
await Promise.allSettled(
  batch.messages.map(async (message) => {
    try {
      await dispatchWebhookMessage(body, env);
      message.ack();
    } catch (err) {
      message.retry();
    }
  })
);
```

**Impact:** 🟡 Medium — reduces batch processing wall-clock time proportionally to batch size.

### 6.2 Sequential Email Fan-Out

**File:** `apps/api/src/queue/notification-handler.ts:54-99`

For each recipient in a notification, the handler:
1. INSERTs an `in_app_notifications` row (1 D1 write)
2. Sends an email via SMTP (network-bound, ~100-500ms per email)
3. INSERTs a `notification_deliveries` row (1 D1 write)

All done sequentially in a `for` loop. For a hackathon with 100 participants, `hackathon.judging_started` notification = **100 sequential email sends + 200 D1 writes**.

**Fix:**
1. Batch all `in_app_notifications` INSERTs with `DB.batch()`.
2. Send emails in parallel with `Promise.allSettled()` (with concurrency limit of ~10).
3. Batch all `notification_deliveries` INSERTs.

**Impact:** 🔴 High — notification fan-out is the slowest queue operation. Parallel emails alone could reduce wall-clock time from ~50s to ~5s for 100 recipients.

### 6.3 No Dead-Letter Queue

When `message.retry()` is called and retries are exhausted, the message is silently dropped. There's no dead-letter queue (DLQ) configured.

**Fix:** Configure `max_retries` and a DLQ in `wrangler.jsonc`:
```jsonc
"queues": {
  "consumers": [{
    "queue": "github-webhooks",
    "max_retries": 3,
    "dead_letter_queue": "devsage-dlq"
  }]
}
```

**Impact:** 🟡 Medium — prevents silent data loss for failed webhooks and notifications.

### 6.4 No Batch Processing

Queue handlers process one logical event per message. For high-throughput events (e.g., push events with many commits), there's no aggregation. The `push-handler.ts` already chunks commits to work around D1's 100-parameter limit, which is good, but the chunking happens per-message rather than across messages.

**Impact:** 🟢 Low — current throughput doesn't warrant batch aggregation.

---

## 7. Cron Job Efficiency

### 7.1 Serial Task Execution

**File:** `apps/api/src/cron/index.ts:22-28`

Three independent tasks are executed sequentially:

```typescript
const tasks = [
  { name: 'checkSubmissionDeadlines', fn: () => checkSubmissionDeadlines(env) },
  { name: 'sendDeadlineReminders',    fn: () => sendDeadlineReminders(env) },
  { name: 'backfillAuditHashes',      fn: () => backfillAuditHashes(env.DB, 100) },
];

for (const task of tasks) {
  await task.fn();  // Sequential!
}
```

All three tasks are independent — they don't share state or depend on each other's results.

**Fix:**
```typescript
await Promise.allSettled(tasks.map(t =>
  t.fn().catch(err =>
    console.error(`Cron task ${t.name} failed:`, err instanceof Error ? err.message : err)
  )
));
```

**Impact:** 🟡 Medium — reduces cron wall-clock time by ~60% (3 tasks in parallel vs. serial).

### 7.2 Per-Hackathon Serial Processing

**File:** `apps/api/src/cron/index.ts:46-79`

Within `checkSubmissionDeadlines()`, each expired hackathon is processed sequentially: DO fetch → D1 update → audit insert → queue send. These hackathons are independent.

**Fix:** Process expired hackathons in parallel (with concurrency limit):
```typescript
await Promise.allSettled(expired.results.map(h => processExpiredHackathon(h, env)));
```

**Impact:** 🟡 Medium — only matters when multiple hackathons expire in the same hour.

### 7.3 Audit Insert Overhead in Cron

Each `insertAuditEvent()` call (line 62-69) performs 3 operations: `SELECT MAX(sequence)`, `SELECT hash ... ORDER BY sequence DESC LIMIT 1`, and `INSERT`. That's 3 D1 round-trips per audit event in the cron path.

**Fix:** For cron-generated audit events, consider batch-inserting without hash chain (let `backfillAuditHashes` fill them in on the next run). This is already the backfill pattern — just skip the hash computation in the hot path.

**Impact:** 🟡 Medium — saves 2 D1 queries per cron audit event.

---

## 8. Recommendations

### Priority 1 — High Impact, Low Effort

| # | Fix | Location | Estimated Savings | Effort |
|---|-----|----------|-------------------|--------|
| 1 | **Cache user+roles in KV (60s TTL) in `optionalAuth`** | `middleware/auth.ts` | -6 D1 queries/request (~95% hit rate) | 1-2 hours |
| 2 | **Batch score upserts with `DB.batch()`** | `routes/judging.ts:444-455` | -N D1 round-trips per score submission | 30 min |
| 3 | **Batch team seed INSERTs** | `routes/teams.ts:496-570` | -600 D1 queries → ~30 batched calls | 1 hour |
| 4 | **Cache CryptoKey in `getKey()`** | `lib/jwt.ts:22-30` | -1-2ms per JWT sign/verify | 15 min |
| 5 | **Add missing indexes** (migration) | `packages/db/` | Eliminates full table scans on invites, submissions | 1 hour |

### Priority 2 — Medium Impact, Low-Medium Effort

| # | Fix | Location | Estimated Savings | Effort |
|---|-----|----------|-------------------|--------|
| 6 | **Parallelize cron tasks** | `cron/index.ts:22-28` | ~60% faster cron execution | 15 min |
| 7 | **Parallelize queue message processing** | `queue/index.ts:30-46` | Proportional to batch size | 30 min |
| 8 | **Parallelize notification email fan-out** | `queue/notification-handler.ts:54-99` | ~90% faster for large recipient lists | 1 hour |
| 9 | **Cache hackathon lookup by slug in KV** | `middleware/hackathon.ts` | -1 D1 query per hackathon-scoped request | 30 min |
| 10 | **`Promise.all()` for independent queries in teams.ts** | `routes/teams.ts:71-93, 206-214` | -2-3 sequential queries per team operation | 30 min |

### Priority 3 — Medium Impact, Medium Effort

| # | Fix | Location | Estimated Savings | Effort |
|---|-----|----------|-------------------|--------|
| 11 | **Replace correlated subqueries in admin routes** | `routes/admin.ts:186-194` | Eliminates N×2 subquery scans | 1 hour |
| 12 | **Batch assignment generation** | `judging-service.ts:33-62` | Eliminates Set construction + N INSERTs → batch | 2 hours |
| 13 | **Configure dead-letter queue** | `wrangler.jsonc` | Prevents silent message loss | 30 min |
| 14 | **Batch audit backfill queries** | `lib/audit.ts:62-95` | -N queries → pre-fetch + batch update | 2 hours |
| 15 | **Add `stale-while-revalidate` to KV cache** | `middleware/cache.ts` | Serve stale cache while refreshing | 2 hours |

### Priority 4 — Nice to Have

| # | Fix | Location | Notes |
|---|-----|----------|-------|
| 16 | Paginate leaderboard query | `judging-service.ts` | Only needed at very large scale |
| 17 | Add LIMIT to cron hackathon queries | `cron/index.ts` | Safety net, unlikely to matter |
| 18 | Batch installation webhook DB queries | `queue/installation-handler.ts` | Low frequency event |
| 19 | Audit worker bundle size | `apps/api/` | `wrangler deploy --dry-run --outdir=dist` |
| 20 | Consider DO-based rate limiting | `middleware/rate-limit.ts` | Only if race condition becomes a problem |

---

### Implementation Order

```
Week 1: Items 1, 4, 5, 6 (auth caching, CryptoKey cache, indexes, cron parallel)
Week 2: Items 2, 3, 7, 8 (batch writes, queue parallelization)
Week 3: Items 9, 10, 11, 13 (hackathon cache, query parallelization, DLQ)
Week 4: Items 12, 14, 15 (judging service, audit optimization, SWR cache)
```

**Expected outcome after Week 1:** ~50% reduction in median API latency for authenticated requests. After all 4 weeks: predictable sub-50ms middleware overhead regardless of user role count.
