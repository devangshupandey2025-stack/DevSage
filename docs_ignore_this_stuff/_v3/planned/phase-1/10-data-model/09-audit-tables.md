# Audit Tables

> Tamper-evident audit log with hash chain integrity for all platform mutations.

## Tables

### audit_events

Append-only audit trail. Every mutation (API, system, bot, cron) inserts an event. Hash chain is backfilled asynchronously — inserts are fast (no read-before-write), while tamper evidence is computed via `waitUntil()` or cron.

```sql
CREATE TABLE audit_events (
  id          TEXT PRIMARY KEY,
  hackathon_id TEXT REFERENCES hackathons(id) ON DELETE SET NULL,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('user','system','bot','cron')),
  event_type  TEXT NOT NULL,              -- e.g. 'hackathon.created', 'team.joined', 'submission.validated'
  entity_type TEXT NOT NULL,              -- e.g. 'hackathon', 'team', 'submission'
  entity_id   TEXT NOT NULL,
  metadata    TEXT,                       -- JSON: additional context (IP, user-agent, etc.)
  changes     TEXT,                       -- JSON: { field: { old: value, new: value }, ... } per-field diff
  hash        TEXT,                       -- SHA-256 hash (NULL until async backfill)
  prev_hash   TEXT,                       -- hash of previous event (NULL until async backfill)
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- rowid (implicit in SQLite) provides guaranteed insertion order
CREATE INDEX idx_audit_hackathon_row ON audit_events(hackathon_id, rowid);
CREATE INDEX idx_audit_entity        ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_event_type    ON audit_events(event_type);
CREATE INDEX idx_audit_actor         ON audit_events(actor_id);
CREATE INDEX idx_audit_unhashed      ON audit_events(hash) WHERE hash IS NULL;
```

## Schema Files

- `packages/db/src/schema/audit-events.ts`

## Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_audit_hackathon_row` | `(hackathon_id, rowid)` | Ordered audit feed for a hackathon (cursor pagination) |
| `idx_audit_entity` | `(entity_type, entity_id)` | "Show me everything that happened to this team/submission" |
| `idx_audit_event_type` | `(event_type)` | Filter by action (e.g. all `submission.validated` events) |
| `idx_audit_actor` | `(actor_id)` | "What did this user do?" |
| `idx_audit_unhashed` | `(hash) WHERE hash IS NULL` | Fast lookup for un-hashed events during backfill |

## Notes

- **Two-phase ingestion:** Insert is a single fast write (no hash computation). Hash chain is backfilled asynchronously via `waitUntil()` or hourly cron. See [09-audit-trail/03-ingestion.md](../09-audit-trail/03-ingestion.md).
- **No explicit sequence column:** SQLite's implicit `rowid` provides guaranteed insertion order without contention. Cursor pagination uses `(hackathon_id, rowid)`.
- Hash chain: `hash = SHA-256(id || hackathon_id || actor_id || actor_type || event_type || entity_type || entity_id || metadata || created_at || prev_hash)`. Computed by `backfillAuditHashes()`.
- `actor_type` distinguishes human actions from automated ones:
  - `user` — authenticated API request
  - `system` — internal platform operation
  - `bot` — GitHub App webhook-driven action
  - `cron` — hourly cron trigger (deadline checks, reminders)
- `changes` captures per-field diffs: `{ "status": { "old": "draft", "new": "active" }, "submission_deadline": { "old": null, "new": "2026-02-20T..." } }`. Not all events have changes (e.g. `hackathon.created` has only `new` values, `old` is null).
- Audit events are append-only — never updated or deleted (only `hash`/`prev_hash` are backfilled once).
- `hash` and `prev_hash` are nullable — they start as NULL and are filled by the async backfill process.
