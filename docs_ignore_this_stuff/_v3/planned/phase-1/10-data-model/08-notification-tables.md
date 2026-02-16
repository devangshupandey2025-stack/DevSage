# Notification Tables

> In-app notifications, email delivery tracking, idempotency, and per-user preferences.

## Tables

### in_app_notifications

Notifications displayed in the platform UI. Marked as read by the user.

```sql
CREATE TABLE in_app_notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hackathon_id  TEXT REFERENCES hackathons(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,            -- e.g. 'team_invite', 'submission_validated', 'judging_started'
  title         TEXT NOT NULL,
  body          TEXT,
  link          TEXT,                     -- relative URL to navigate to
  read_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_notifications_user_read ON in_app_notifications(user_id, read_at);
CREATE INDEX idx_notifications_hackathon ON in_app_notifications(hackathon_id);
```

### notification_deliveries

Tracks delivery attempts across all channels (email, in-app). Used for retry and debugging.

```sql
CREATE TABLE notification_deliveries (
  id                TEXT PRIMARY KEY,
  notification_type TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('email', 'in_app')),
  recipient_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  recipient_email   TEXT,
  status            TEXT NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent','failed','bounced')),
  error_message     TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_notification_deliveries_recipient ON notification_deliveries(recipient_id);
CREATE INDEX idx_notification_deliveries_status    ON notification_deliveries(status);
```

### notification_idempotency

Prevents duplicate notifications from queue retries or race conditions.

```sql
CREATE TABLE notification_idempotency (
  id              TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,   -- e.g. 'team_invite:{team_id}:{email}'
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

### hackathon_notification_config

Per-user, per-hackathon notification preferences.

```sql
CREATE TABLE hackathon_notification_config (
  id              TEXT PRIMARY KEY,
  hackathon_id    TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled   INTEGER NOT NULL DEFAULT 1,   -- SQLite boolean
  in_app_enabled  INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (hackathon_id, user_id)
);
```

## Schema Files

- `packages/db/src/schema/in-app-notifications.ts`
- `packages/db/src/schema/notification-deliveries.ts`
- `packages/db/src/schema/notification-idempotency.ts`
- `packages/db/src/schema/hackathon-notification-config.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_notifications_user_read` | in_app_notifications | `(user_id, read_at)` | Unread count + notification feed |
| `idx_notifications_hackathon` | in_app_notifications | `(hackathon_id)` | Notifications scoped to a hackathon |
| `idx_notification_deliveries_recipient` | notification_deliveries | `(recipient_id)` | Delivery history for a user |
| `idx_notification_deliveries_status` | notification_deliveries | `(status)` | Retry failed deliveries |
| `notification_idempotency.idempotency_key` | notification_idempotency | `(idempotency_key)` | Dedup check (UNIQUE) |
| `UNIQUE(hackathon_id, user_id)` | hackathon_notification_config | composite | One config per user per hackathon |

## Notes

- The queue consumer in `notification-handler.ts` checks idempotency before sending, then records delivery.
- `read_at` is `NULL` for unread notifications. Query `WHERE user_id = ? AND read_at IS NULL` for the unread badge.
- Notification preferences default to all enabled; rows are created only when a user changes settings.
