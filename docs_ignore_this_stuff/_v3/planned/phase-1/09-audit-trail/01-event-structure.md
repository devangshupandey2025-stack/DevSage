# Audit Event Structure

> `apps/api/src/lib/audit.ts` — Event schema, actor model, and hash chain.

## Event Shape

```ts
interface AuditEvent {
  id: string;              // UUID
  hackathon_id: string | null; // null for platform-level events
  actor_id: string | null; // user UUID or null for system
  actor_type: 'user' | 'system' | 'bot' | 'cron';
  event_type: string;      // e.g., 'hackathon.created', 'score.submitted'
  entity_type: string;     // e.g., 'hackathon', 'team', 'submission', 'score'
  entity_id: string;       // UUID of the affected entity
  metadata: string | null; // JSON: additional context
  changes: string | null;  // JSON: { field: { old, new } } for updates
  hash: string | null;     // SHA-256 hash (backfilled async, NULL until computed)
  prev_hash: string | null; // hash of previous event (backfilled async)
  created_at: string;      // ISO-8601
}
```

**Note:** `hash` and `prev_hash` are nullable — they are backfilled asynchronously after insert. See [03-ingestion.md](./03-ingestion.md) for the two-phase approach. Ordering is guaranteed by SQLite's implicit `rowid`.

## Actor Types

| Type | When | actor_id |
|------|------|----------|
| `user` | User-initiated action | User UUID |
| `system` | Automated system action | null |
| `bot` | GitHub webhook-triggered | null |
| `cron` | Scheduled job | null |

## Hash Chain (Async Backfill)

Hash chain is computed **asynchronously** after the event is inserted — never in the hot path. Each event's hash is computed from its fields plus the previous event's hash:

```ts
async function computeHash(event: AuditEventInput, prevHash: string): Promise<string> {
  const data = [
    event.id,
    event.hackathon_id ?? '',
    event.actor_id ?? '',
    event.actor_type,
    event.event_type,
    event.entity_type,
    event.entity_id,
    event.metadata ?? '',
    event.created_at,
    prevHash,
  ].join('|');

  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Genesis event** uses `prev_hash = '0'.repeat(64)`.

The hash chain ensures:
- Events cannot be modified after creation (hash would change)
- Events cannot be deleted without breaking the chain
- Tampering is detectable by verifying chain integrity

## Changes Field

For update operations, the `changes` field captures before/after:

```json
{
  "status": { "old": "draft", "new": "active" },
  "submission_deadline": { "old": null, "new": "2026-02-20T23:59:59Z" }
}
```

## DB Table

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
  hash TEXT,         -- NULL until async backfill
  prev_hash TEXT,    -- NULL until async backfill
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- rowid (implicit) provides insertion order — no explicit sequence column needed
CREATE INDEX idx_audit_hackathon_row ON audit_events(hackathon_id, rowid);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_type ON audit_events(event_type);
CREATE INDEX idx_audit_unhashed ON audit_events(hash) WHERE hash IS NULL;
```

**Key design decisions:**
- `sequence` column removed — SQLite's implicit `rowid` provides guaranteed insertion order without contention
- `hash` and `prev_hash` are nullable — backfilled asynchronously via `waitUntil()` or cron
- Partial index `idx_audit_unhashed` makes the backfill query fast
- See [03-ingestion.md](./03-ingestion.md) for the two-phase ingestion approach
