# Audit Ingestion

> `apps/api/src/lib/audit.ts` — `insertAuditEvent()` implementation.

## Architecture: Two-Phase Ingestion

Audit ingestion uses a **two-phase approach** to avoid serialization bottlenecks:

1. **Synchronous insert** — The audit row is written to D1 immediately during the request, using an auto-incrementing sequence number. No hash chain computation happens here. This ensures the audit event is captured atomically with the mutation.

2. **Asynchronous hash chain** — A lightweight `waitUntil()` task (or periodic cron) backfills the `hash` and `prev_hash` columns for un-hashed rows. This decouples tamper-evidence from request latency.

```
Mutation → insertAuditEvent() → D1 insert (no hash, fast) → return
                                      ↓
                              waitUntil: backfillAuditHashes() → compute + update hash chain
```

**Why two-phase:** The original design computed the hash chain synchronously — requiring a read of the previous event's hash before every insert. Under concurrent writes (e.g., 10 judges scoring simultaneously), this becomes a serial bottleneck and risks sequence collisions. The two-phase approach keeps inserts fast and non-blocking while still providing tamper evidence.

## Function

```ts
async function insertAuditEvent(
  db: D1Database,
  event: {
    hackathon_id?: string | null;
    actor_id?: string | null;
    actor_type: 'user' | 'system' | 'bot' | 'cron';
    event_type: string;
    entity_type: string;
    entity_id: string;
    metadata?: Record<string, unknown>;
    changes?: Record<string, { old: unknown; new: unknown }>;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Single INSERT — no read required, no hash computation
  // sequence is auto-assigned via D1 autoincrement trigger
  await db.prepare(`
    INSERT INTO audit_events (id, hackathon_id, actor_id, actor_type, event_type, entity_type, entity_id, metadata, changes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    event.hackathon_id ?? null,
    event.actor_id ?? null,
    event.actor_type,
    event.event_type,
    event.entity_type,
    event.entity_id,
    event.metadata ? JSON.stringify(event.metadata) : null,
    event.changes ? JSON.stringify(event.changes) : null,
    createdAt,
  ).run();
}
```

## Hash Chain Backfill

Runs via `waitUntil()` after the response is sent, or via the hourly cron trigger. Processes un-hashed events in sequence order:

```ts
async function backfillAuditHashes(db: D1Database): Promise<number> {
  // 1. Find all un-hashed events, grouped by hackathon
  const unhashed = await db.prepare(`
    SELECT id, hackathon_id, actor_id, event_type, entity_type, entity_id, created_at, rowid
    FROM audit_events
    WHERE hash IS NULL
    ORDER BY hackathon_id, rowid ASC
  `).all();

  if (!unhashed.results.length) return 0;

  // 2. Group by hackathon for chain continuity
  const grouped = new Map<string | null, typeof unhashed.results>();
  for (const row of unhashed.results) {
    const key = row.hackathon_id ?? '__global__';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  // 3. Process each hackathon's chain
  for (const [hackathonId, events] of grouped) {
    // Single query to get the last hash for this chain
    const hid = hackathonId === '__global__' ? null : hackathonId;
    const prev = hid
      ? await db.prepare('SELECT hash FROM audit_events WHERE hackathon_id = ? AND hash IS NOT NULL ORDER BY rowid DESC LIMIT 1').bind(hid).first()
      : await db.prepare('SELECT hash FROM audit_events WHERE hackathon_id IS NULL AND hash IS NOT NULL ORDER BY rowid DESC LIMIT 1').first();

    let prevHash = prev?.hash as string | null ?? null;

    // Compute hashes in memory, then batch UPDATE
    const updates = [];
    for (const event of events) {
      const payload = JSON.stringify({ prev_hash: prevHash, ...event });
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      const hash = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
      updates.push(
        db.prepare('UPDATE audit_events SET hash = ?, prev_hash = ? WHERE id = ?').bind(hash, prevHash, event.id)
      );
      prevHash = hash;
    }

    // Batch all updates for this hackathon chain
    if (updates.length > 0) {
      await db.batch(updates);
    }
  }

  return unhashed.results.length;
}
```

> **Performance:** Groups events by hackathon to maintain chain continuity. Uses a single SELECT per chain + batched UPDATEs, reducing from 2N queries to N+K (K = number of chains).

### Triggering Backfill

```ts
// In route handlers — after insertAuditEvent():
c.executionCtx.waitUntil(backfillAuditHashes(c.env.DB));

// In cron handler — catch up any missed events:
async function scheduled(event: ScheduledEvent, env: Env) {
  let processed = 0;
  do {
    processed = await backfillAuditHashes(env.DB);
  } while (processed > 0);
}
```

## Updated Table Schema

```sql
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT REFERENCES hackathons(id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'bot', 'cron')),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata TEXT,     -- JSON
  changes TEXT,      -- JSON
  hash TEXT,         -- NULL until backfilled
  prev_hash TEXT,    -- NULL until backfilled
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- rowid is implicit in SQLite and provides insertion order
CREATE INDEX idx_audit_hackathon_row ON audit_events(hackathon_id, rowid);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_type ON audit_events(event_type);
CREATE INDEX idx_audit_unhashed ON audit_events(hash) WHERE hash IS NULL;
```

**Key change:** `hash` and `prev_hash` are now nullable (NULL until backfilled). The `sequence` column is removed — SQLite's implicit `rowid` provides guaranteed insertion ordering without contention.

## Usage in Route Handlers

```ts
// After a state transition:
await insertAuditEvent(db, {
  hackathon_id: hackathonId,
  actor_id: userId,
  actor_type: 'user',
  event_type: 'hackathon.transitioned',
  entity_type: 'hackathon',
  entity_id: hackathonId,
  changes: {
    status: { old: 'draft', new: 'active' },
  },
});

// Trigger async hash backfill (non-blocking)
c.executionCtx.waitUntil(backfillAuditHashes(c.env.DB));

// System event (no actor):
await insertAuditEvent(db, {
  hackathon_id: hackathonId,
  actor_type: 'cron',
  event_type: 'cron.deadline_transition',
  entity_type: 'hackathon',
  entity_id: hackathonId,
});
```

## Implementation Notes

- `insertAuditEvent()` is a single D1 INSERT — no reads, no hash computation, no contention
- The audit insert is synchronous with the mutation — if it fails, the mutation should also fail
- Hash chain is backfilled asynchronously via `waitUntil()` or cron — never blocks the response
- `rowid` provides total insertion order without explicit sequence management
- The `idx_audit_unhashed` partial index makes backfill queries fast
- Under normal operation, `waitUntil()` backfills within milliseconds of the insert
- Cron acts as a safety net for any events that didn't get backfilled (Worker crashed, etc.)
- Hash chain integrity can be verified via `GET /api/v1/hackathons/:slug/audit/verify`
