# Webhook Tables

> GitHub webhook delivery tracking and pending App installation resolution.

## Tables

### webhook_deliveries

Idempotent record of every GitHub webhook received. Used for replay protection and debugging.

```sql
CREATE TABLE webhook_deliveries (
  id                  TEXT PRIMARY KEY,
  github_delivery_id  TEXT NOT NULL UNIQUE,    -- X-GitHub-Delivery header
  event_type          TEXT NOT NULL,           -- e.g. 'push', 'create', 'installation'
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','processed','failed','ignored')),
  error_message       TEXT,
  received_at         TEXT NOT NULL,
  processed_at        TEXT
);

CREATE INDEX idx_webhook_deliveries_event  ON webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
```

### pending_installations

Temporary records for GitHub App installations that haven't been matched to a team yet. Created when a team initiates repo linking and cleared once the installation webhook arrives.

```sql
CREATE TABLE pending_installations (
  id            TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  github_owner  TEXT NOT NULL,
  github_repo   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_pending_installations_repo ON pending_installations(github_owner, github_repo);
```

## Schema Files

- `packages/db/src/schema/webhook-deliveries.ts`
- `packages/db/src/schema/pending-installations.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `webhook_deliveries.github_delivery_id` | webhook_deliveries | `(github_delivery_id)` | Idempotency check (UNIQUE) |
| `idx_webhook_deliveries_event` | webhook_deliveries | `(event_type)` | Filter deliveries by event |
| `idx_webhook_deliveries_status` | webhook_deliveries | `(status)` | Retry failed deliveries |
| `idx_pending_installations_repo` | pending_installations | `(github_owner, github_repo)` | Match incoming installation to team |

## Notes

- Webhook processing flow: receive → HMAC verify → insert as `queued` → enqueue to `WEBHOOK_QUEUE` → consumer updates to `processed` or `failed`.
- `pending_installations` rows are short-lived — cleaned up after matching or after a TTL (e.g. 1 hour).
- `ignored` status is used for webhook events the platform doesn't act on (e.g. `star`, `fork`).
