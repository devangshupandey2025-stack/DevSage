# Performance Optimization

Priority: HIGH — auth middleware affects every authenticated request.

## Auth Middleware: 6 DB Queries per Request

**File**: `src/middleware/auth.ts`
**Problem**: Every authenticated request runs 6 sequential DB queries to hydrate user context (user, workspace memberships, organizer roles, platform admin check, etc.). At ~50ms each, that's ~300ms just for auth.

### Fix: Combine Queries with DB.batch()

D1 latency is ~50ms per round-trip. The fix is not caching — it's reducing round-trips. `DB.batch()` executes multiple statements in a **single** round-trip (~50ms total instead of 6 × 50ms).

```typescript
async function hydrateUserContext(env: AppEnv['Bindings'], userId: string) {
  const [userResult, workspaceResult, hackathonResult, platformAdminResult] = await env.DB.batch([
    // 1. User record
    env.DB.prepare('SELECT id, email, name, image, status FROM users WHERE id = ?').bind(userId),
    // 2. Workspace memberships + roles
    env.DB.prepare(`
      SELECT wm.workspace_id, wm.role, w.slug as workspace_slug
      FROM workspace_members wm
      JOIN workspaces w ON wm.workspace_id = w.id
      WHERE wm.user_id = ? AND w.deleted_at IS NULL
    `).bind(userId),
    // 3. Hackathon roles (organizer, co_organizer, judge, team member)
    env.DB.prepare(`
      SELECT 'organizer' as source, ho.hackathon_id, ho.role, h.slug
      FROM hackathon_organizers ho
      JOIN hackathons h ON ho.hackathon_id = h.id
      WHERE ho.user_id = ?
      UNION ALL
      SELECT 'judge' as source, j.hackathon_id, 'judge' as role, h.slug
      FROM judges j
      JOIN hackathons h ON j.hackathon_id = h.id
      WHERE j.user_id = ? AND j.status = 'accepted'
      UNION ALL
      SELECT 'team' as source, t.hackathon_id, tm.role as role, h.slug
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      JOIN hackathons h ON t.hackathon_id = h.id
      WHERE tm.user_id = ? AND t.status = 'active'
    `).bind(userId, userId, userId),
    // 4. Platform admin check
    env.DB.prepare('SELECT 1 FROM platform_admins WHERE user_id = ?').bind(userId),
  ]);

  return {
    user: userResult.results[0],
    workspaceRoles: buildWorkspaceRoleMap(workspaceResult.results),
    hackathonRoles: buildHackathonRoleMap(hackathonResult.results),
    isPlatformAdmin: platformAdminResult.results.length > 0,
  };
}
```

**Result**: 1 round-trip (~50ms) instead of 6 sequential round-trips (~300ms). No cache invalidation complexity, no staleness window, no KV write costs.

### Why NOT KV Cache

KV is a poor fit for auth context:
- **Write limits**: Free plan has 1,000 writes/day. Every role change, login, and cache miss burns a write. A moderately active platform would exhaust this quickly.
- **Staleness**: Even a 60-second TTL means cached roles could be wrong for a full minute after permission changes. This is a security concern for role checks.
- **Invalidation complexity**: 10+ endpoints would need invalidation calls. Missing one = stale permissions.
- **D1 is fast enough**: A single batched round-trip at ~50ms is perfectly acceptable for auth middleware.

### Selective Hydration (Optional Optimization)

Not every route needs the full context. Add route-level hints:

```typescript
// Routes that only need user identity (no roles)
app.use('/auth/*', optionalAuth({ hydrate: 'user-only' }));

// Routes that need hackathon roles
app.use('/api/v1/hackathons/*', optionalAuth({ hydrate: 'full' }));

// Admin routes that need platform admin check
app.use('/api/v1/admin/*', optionalAuth({ hydrate: 'admin' }));
```

For `user-only`: 1 query (just the user record). For `full`: the batched 4-query approach. This reduces average auth overhead further since most routes don't need every role.

## CryptoKey Re-Import on Every JWT Operation

**File**: `src/lib/jwt.ts`
**Problem**: `crypto.subtle.importKey()` is called on every `signJWT()` and `verifyJWT()`. Takes ~1-2ms each.

### Fix: Module-Level Key Cache
1. Cache imported `CryptoKey` in a module-level `Map`
2. Key the cache by a hash of the secret (don't store raw secret as Map key)
3. Import once, reuse for all subsequent sign/verify calls

```typescript
const keyCache = new Map<string, CryptoKey>();

async function getSigningKey(secret: string): Promise<CryptoKey> {
  // Key by first 16 chars — enough for uniqueness, avoids storing full secret
  const cacheKey = secret.substring(0, 16);
  let key = keyCache.get(cacheKey);
  if (!key) {
    key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
    keyCache.set(cacheKey, key);
  }
  return key;
}
```

**Note**: Workers isolates are recycled, so the cache auto-clears. No memory leak risk.

## N+1 Score Inserts in Judging

**File**: `src/routes/judging.ts` (score submission endpoint)
**Problem**: When a judge submits scores for a submission, each criterion score is inserted individually in a loop.

### Fix: Batch INSERT with Chunking
1. Use `env.DB.batch()` for multiple prepared statements in one round-trip
2. D1 limit: 100 bound params per statement. Each score row has ~8 params → max 12 per statement
3. Chunk logic:

```typescript
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Usage: batch insert scores, 12 per statement
const SCORES_PER_BATCH = 12;
const chunks = chunkArray(scores, SCORES_PER_BATCH);
const stmts = chunks.map(chunk =>
  chunk.map(s =>
    env.DB.prepare('INSERT INTO scores (id, submission_id, judge_id, criteria_id, assignment_id, score, comment, round, scored_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, s.submissionId, s.judgeId, s.criteriaId, s.assignmentId, s.score, s.comment, s.round, s.scoredAt)
  )
).flat();
await env.DB.batch(stmts);
```

## 600+ Sequential Inserts on Hackathon Creation

**File**: `src/routes/hackathons.ts`
**Problem**: Creating a hackathon from template inserts rounds, rubric criteria, tracks, sponsors one-by-one.

### Fix: Batch Inserts with D1 Batch API
1. Use `env.DB.batch()` to run multiple statements in a single round-trip
2. Group inserts by table: all rounds in one batch, all criteria in another
3. Respect 100-param limit per individual statement

```typescript
const roundStmts = rounds.map(r =>
  env.DB.prepare('INSERT INTO hackathon_rounds (...) VALUES (?, ?, ?)').bind(...)
);
const criteriaStmts = criteria.map(c =>
  env.DB.prepare('INSERT INTO rubric_criteria (...) VALUES (?, ?, ?, ?)').bind(...)
);
await env.DB.batch([...roundStmts, ...criteriaStmts]);
```

## Unbounded Recipient Query in Notifications

**File**: `src/queue/notification-handler.ts`
**Problem**: Fetching all recipients for an announcement has no LIMIT clause. Large hackathons could return thousands of rows.

### Fix: Fan-Out via Queue sendBatch()
Use Cloudflare Queue's `sendBatch()` to fan out individual email tasks instead of processing serially:

```
1. Queue receives: { type: 'announcement.created', hackathonId, announcementId }
2. Handler queries first 100 recipients (LIMIT 100 OFFSET cursor)
3. For each recipient: create individual message { type: 'send_email', userId, ... }
4. Enqueue all via env.NOTIFICATION_QUEUE.sendBatch(messages) (max 100 per call)
5. If more recipients: re-enqueue dispatcher with cursor = cursor + 100
6. Individual email handlers process one email each (parallel via queue consumers)
```

This avoids the 30-second CPU limit for large hackathons by distributing work across queue messages.

## Database Indexes

**Already applied** (migration 0002): `idx_scores_submission_id`, `idx_judge_assignments_judge_id`, and several others. Check existing migration before adding duplicates.

**Still missing** (add to `packages/db/migrations/0004_audit_fixes.sql`):
```sql
-- Team lookups by hackathon + status (used in leaderboard, listings)
CREATE INDEX IF NOT EXISTS idx_teams_hackathon_status ON teams(hackathon_id, status);

-- Judge assignments by hackathon + round (used in assignment listing)
CREATE INDEX IF NOT EXISTS idx_judge_assignments_hackathon_round ON judge_assignments(hackathon_id, round);

-- Auth batch query: workspace members by user
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Auth batch query: hackathon organizers by user
CREATE INDEX IF NOT EXISTS idx_hackathon_organizers_user ON hackathon_organizers(user_id);

-- Auth batch query: team members by user (for hackathon role resolution)
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
```

**Verify before adding**: Run `PRAGMA index_list(table_name)` on D1 to confirm which indexes exist.

## Audit Insert: Global MAX(sequence)

**File**: `src/lib/audit.ts`
**Problem**: Every audit insert queries `MAX(sequence)` across the entire audit_events table.

### Fix: Use `created_at` Ordering
Since audit events are append-only and use millisecond-precision ISO-8601 timestamps, `created_at` is a natural ordering key.

1. Remove the `MAX(sequence)` query
2. Use `created_at` for cursor-based pagination (already done in `routes/audit.ts`)
3. For hash chain: hash the previous event's `id` (which is already available at insert time) instead of sequence number
4. Add a unique index on `(hackathon_id, created_at)` to guarantee ordering

**Alternative** (if exact sequence is required): Add an `INTEGER PRIMARY KEY AUTOINCREMENT` column. SQLite guarantees monotonic auto-increment. This avoids the `MAX()` query entirely.

## Drizzle Schema Drift

**Problem**: Drizzle ORM `.ts` schema files are out of sync with actual D1 database. Columns added in migrations 0002 and 0003 are not reflected in the schema files:
- `scoring_opens_at`, `scoring_closes_at` on `hackathon_rounds`
- `judge_guidelines` on `hackathons`
- `title`, `description`, `demo_url`, `video_url`, `ai_score`, `analysis_json`, `ai_review_json` on `submissions`
- `deleted_at` on `workspaces`

While Drizzle is unused at runtime (raw SQL only), the schema files serve as documentation. Update them to match reality, or add a comment at the top of each noting "schema files are documentation only — actual D1 schema may differ, see migrations."

## Analytics Query Performance

**Concern**: `GROUP BY strftime(...)` aggregation queries on D1 can be slow for large datasets.

**Fix**: Pre-compute analytics aggregates via cron (hourly). Store results in a `analytics_cache` D1 table:

```sql
CREATE TABLE analytics_cache (
  key TEXT PRIMARY KEY,           -- e.g. 'hackathon:{slug}:overview', 'platform:overview'
  data TEXT NOT NULL,             -- JSON blob
  computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

- Cron computes aggregates and upserts into this table
- API endpoints read from `analytics_cache` (fast single-row lookup, no aggregation)
- No KV needed — D1 reads are already fast at ~50ms
