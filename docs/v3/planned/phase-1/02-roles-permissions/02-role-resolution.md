# Role Resolution

> `apps/api/src/middleware/role.ts` — Per-request role resolution from database state.

## resolveRole()

Called by `requireRole()` middleware. Uses a **single SQL query** with `UNION ALL` to check all role sources in one round-trip, ordered by priority. The first match wins.

**Why single query:** The original design used 4 sequential D1 queries (organizer_roles → judges → team_members → workspace_members). At ~10-50ms per D1 round-trip, that's 40-200ms overhead on every authenticated request. Since D1 is SQLite, a single query with UNION ALL is cheap and eliminates the serial latency.

### SQL Query

```sql
-- Single round-trip role resolution, ordered by priority (lowest number = highest role)
SELECT role, priority FROM (
  -- Priority 1-2: Direct hackathon organizer roles
  SELECT
    or_role.role AS role,
    CASE or_role.role WHEN 'organizer' THEN 1 WHEN 'co_organizer' THEN 2 ELSE 2 END AS priority
  FROM organizer_roles or_role
  WHERE or_role.hackathon_id = ?1 AND or_role.user_id = ?2

  UNION ALL

  -- Priority 3: Accepted judge
  SELECT 'judge' AS role, 3 AS priority
  FROM judges j
  WHERE j.hackathon_id = ?1 AND j.user_id = ?2 AND j.invite_status = 'accepted'

  UNION ALL

  -- Priority 4-5: Team membership
  SELECT
    tm.role AS role,
    CASE tm.role WHEN 'team_lead' THEN 4 WHEN 'team_member' THEN 5 ELSE 5 END AS priority
  FROM team_members tm
  JOIN teams t ON tm.team_id = t.id
  WHERE t.hackathon_id = ?1 AND tm.user_id = ?2

  UNION ALL

  -- Priority 6-7 (cascaded): Workspace membership → hackathon role
  -- Workspace-cascaded roles always have lower priority than direct hackathon role assignments.
  SELECT
    CASE WHEN wm.role IN ('owner', 'admin') THEN 'organizer' ELSE 'co_organizer' END AS role,
    CASE WHEN wm.role IN ('owner', 'admin') THEN 6 ELSE 7 END AS priority
  FROM workspace_members wm
  JOIN hackathons h ON wm.workspace_id = h.workspace_id
  WHERE h.id = ?1 AND wm.user_id = ?2
)
ORDER BY priority ASC
LIMIT 1;
```

### TypeScript Implementation

```ts
async function resolveRole(db: D1Database, userId: string, hackathonId: string): Promise<HackathonRole> {
  const result = await db.prepare(`
    SELECT role, priority FROM (
      SELECT or_role.role AS role,
        CASE or_role.role WHEN 'organizer' THEN 1 WHEN 'co_organizer' THEN 2 ELSE 2 END AS priority
      FROM organizer_roles or_role
      WHERE or_role.hackathon_id = ?1 AND or_role.user_id = ?2
      UNION ALL
      SELECT 'judge' AS role, 3 AS priority
      FROM judges j
      WHERE j.hackathon_id = ?1 AND j.user_id = ?2 AND j.invite_status = 'accepted'
      UNION ALL
      SELECT tm.role AS role,
        CASE tm.role WHEN 'team_lead' THEN 4 WHEN 'team_member' THEN 5 ELSE 5 END AS priority
      FROM team_members tm JOIN teams t ON tm.team_id = t.id
      WHERE t.hackathon_id = ?1 AND tm.user_id = ?2
      UNION ALL
      -- Workspace-cascaded roles always have lower priority than direct hackathon role assignments.
      SELECT CASE WHEN wm.role IN ('owner', 'admin') THEN 'organizer' ELSE 'co_organizer' END AS role,
        CASE WHEN wm.role IN ('owner', 'admin') THEN 6 ELSE 7 END AS priority
      FROM workspace_members wm JOIN hackathons h ON wm.workspace_id = h.workspace_id
      WHERE h.id = ?1 AND wm.user_id = ?2
    )
    ORDER BY priority ASC
    LIMIT 1
  `).bind(hackathonId, userId).first<{ role: HackathonRole; priority: number }>();

  return result?.role ?? 'anonymous';
}
```

### Optional: KV Cache Layer

For read-heavy routes, the resolved role can be cached in KV with a short TTL to avoid even the single-query cost on every request:

```ts
async function resolveRoleCached(
  db: D1Database, kv: KVNamespace,
  userId: string, hackathonId: string
): Promise<HackathonRole> {
  const cacheKey = `role:${userId}:${hackathonId}`;
  const cached = await kv.get(cacheKey);
  if (cached) return cached as HackathonRole;

  const role = await resolveRole(db, userId, hackathonId);

  // Cache for 60 seconds — role changes are rare
  // Role mutations (invite, join, leave) should delete this key
  await kv.put(cacheKey, role, { expirationTtl: 60 });
  return role;
}
```

**Cache invalidation:** Any mutation that changes a user's role (invite judge, join team, leave team, add organizer) must delete the KV key `role:{userId}:{hackathonId}`. This is acceptable because role mutations are infrequent compared to reads.

#### Workspace Membership Changes

When a user is added to or removed from a workspace, all hackathon role caches for that user within the workspace must be invalidated:

```ts
async function invalidateWorkspaceRoleCache(
  kv: KVNamespace,
  userId: string,
  workspaceId: string,
  db: D1Database
) {
  const hackathons = await db.prepare(
    'SELECT id FROM hackathons WHERE workspace_id = ?'
  ).bind(workspaceId).all<{ id: string }>();
  
  await Promise.all(
    hackathons.results.map(h => kv.delete(`role:${userId}:${h.id}`))
  );
}
```

This must be called from workspace membership mutation endpoints (add member, remove member, change role).

### Performance Comparison

| Approach | D1 Round-trips | Latency (est.) | When to Use |
|----------|---------------|----------------|-------------|
| Single UNION ALL query | 1 | ~10-30ms | Default for all requests |
| KV-cached | 0 (cache hit) or 1 | ~2ms / ~10-30ms | High-traffic hackathons |
| 4 sequential queries (old) | 4 | ~40-200ms | **Never — replaced** |

## requireRole() Middleware

```ts
const ROLE_HIERARCHY: HackathonRole[] = [
  'organizer', 'co_organizer', 'judge', 'team_lead', 'team_member', 'anonymous'
];

function requireRole(minRole: HackathonRole): MiddlewareHandler<AuthAppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) return errorResponse(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const hackathonId = c.get('hackathonId'); // set by hackathon middleware
    if (!hackathonId) return errorResponse(c, 400, 'HACKATHON_REQUIRED', 'Hackathon context required');

    const role = await resolveRole(c.env.DB, user.sub, hackathonId);
    c.set('role', role);

    if (!isRoleAtLeast(role, minRole)) {
      return errorResponse(c, 403, 'INSUFFICIENT_ROLE',
        `Requires ${minRole} role, you have ${role}`);
    }

    await next();
  };
}

function isRoleAtLeast(actual: HackathonRole, required: HackathonRole): boolean {
  return ROLE_HIERARCHY.indexOf(actual) <= ROLE_HIERARCHY.indexOf(required);
}
```

## Hackathon Context Middleware

Role resolution requires knowing WHICH hackathon. The hackathon middleware extracts it from the URL:

```ts
// apps/api/src/middleware/hackathon.ts
// Resolves :slug → hackathon ID, sets c.set('hackathonId', id)
```

## Route Usage

```ts
// Organizer only
app.post('/hackathons/:slug/transition', authMiddleware, requireRole('organizer'), handler);

// Organizer + co-organizer
app.post('/hackathons/:slug/teams', authMiddleware, requireRole('co_organizer'), handler);

// Any participant
app.get('/hackathons/:slug/my-team', authMiddleware, requireRole('team_member'), handler);

// Judges and above
app.get('/hackathons/:slug/submissions', authMiddleware, requireRole('judge'), handler);
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `AUTH_REQUIRED` | 401 | No authenticated user |
| `HACKATHON_REQUIRED` | 400 | No hackathon context in request |
| `INSUFFICIENT_ROLE` | 403 | User's role is below the minimum required |
| `HACKATHON_NOT_FOUND` | 404 | Slug doesn't match any hackathon |
