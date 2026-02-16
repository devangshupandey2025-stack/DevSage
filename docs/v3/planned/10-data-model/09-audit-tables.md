# Audit Tables

> Tamper-evident audit log with hash chain integrity for all platform mutations.

## Tables

### audit_events

Append-only audit trail. Every mutation (API, system, bot, cron) inserts an event. Hash chain ensures integrity — each event's hash includes the previous event's hash.

```sql
CREATE TABLE audit_events (
  id          TEXT PRIMARY KEY,
  sequence    INTEGER NOT NULL,           -- monotonic per-hackathon counter
  hackathon_id TEXT REFERENCES hackathons(id) ON DELETE SET NULL,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('user','system','bot','cron')),
  event_type  TEXT NOT NULL,              -- e.g. 'hackathon.created', 'team.joined', 'submission.validated'
  entity_type TEXT NOT NULL,              -- e.g. 'hackathon', 'team', 'submission'
  entity_id   TEXT NOT NULL,
  metadata    TEXT,                       -- JSON: additional context (IP, user-agent, etc.)
  changes     TEXT,                       -- JSON: { before: {}, after: {} } diff
  hash        TEXT NOT NULL,              -- SHA-256 of (sequence + event_type + entity + prev_hash)
  prev_hash   TEXT,                       -- hash of previous event in chain (NULL for first)
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_audit_hackathon_seq ON audit_events(hackathon_id, sequence);
CREATE INDEX idx_audit_entity        ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_event_type    ON audit_events(event_type);
CREATE INDEX idx_audit_actor         ON audit_events(actor_id);
```

## Schema Files

- `packages/db/src/schema/audit-events.ts`

## Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_audit_hackathon_seq` | `(hackathon_id, sequence)` | Ordered audit feed for a hackathon (cursor pagination) |
| `idx_audit_entity` | `(entity_type, entity_id)` | "Show me everything that happened to this team/submission" |
| `idx_audit_event_type` | `(event_type)` | Filter by action (e.g. all `submission.validated` events) |
| `idx_audit_actor` | `(actor_id)` | "What did this user do?" |

## Notes

- Hash chain: `hash = SHA-256(sequence || event_type || entity_type || entity_id || prev_hash)`. Computed by `insertAuditEvent()` in `api/src/lib/audit.ts`.
- `sequence` is per-hackathon monotonic. System-wide events (no `hackathon_id`) use a global sequence.
- `actor_type` distinguishes human actions from automated ones:
  - `user` — authenticated API request
  - `system` — internal platform operation
  - `bot` — GitHub App webhook-driven action
  - `cron` — hourly cron trigger (deadline checks, reminders)
- `changes` captures before/after state for reversibility auditing. Not all events have changes (e.g. `hackathon.created` has only `after`).
- Audit events are append-only — never updated or deleted.
- Cursor pagination uses `(hackathon_id, sequence)` for efficient ordered retrieval.
