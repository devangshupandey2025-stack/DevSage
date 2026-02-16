# In-App Channel

> In-app notifications stored in D1, delivered via REST API polling.

## Storage

```sql
CREATE TABLE in_app_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hackathon_id TEXT REFERENCES hackathons(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- 'submission.captured', 'team.member_joined', etc.
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                    -- deep link path (e.g., '/hackathons/slug/submissions')
  read_at TEXT,                 -- null = unread
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_in_app_user_unread ON in_app_notifications(user_id, read_at);
```

## Creating In-App Notifications

```ts
// In notification-handler, for each recipient:
await db.insert(inAppNotifications).values({
  id: crypto.randomUUID(),
  user_id: recipient.id,
  hackathon_id: event.hackathon_id,
  type: event.type,
  title: renderTitle(event),
  body: renderBody(event),
  link: renderLink(event),
  created_at: new Date().toISOString(),
});
```

## Endpoints

### `GET /api/v1/notifications`

```
Auth: authMiddleware
Query: ?unread_only=true&hackathon_id=&limit=20&offset=0
```

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "type": "submission.captured",
      "title": "Submission received",
      "body": "Your team submitted submission-v1",
      "link": "/hackathons/spring-hack/submissions",
      "read_at": null,
      "created_at": "2026-02-15T..."
    }
  ],
  "meta": { "total": 15, "unread_count": 3, "limit": 20, "offset": 0, "has_more": false }
}
```

### `POST /api/v1/notifications/:id/read`

Mark a single notification as read.

```ts
await db.update(inAppNotifications)
  .set({ read_at: new Date().toISOString() })
  .where(and(
    eq(inAppNotifications.id, id),
    eq(inAppNotifications.user_id, userId)
  ));
```

### `POST /api/v1/notifications/read-all`

Mark all notifications as read for the authenticated user.

### `GET /api/v1/notifications/unread-count`

Quick count for badge display:

```json
{ "ok": true, "data": { "count": 3 } }
```

## Implementation Notes

- Frontend polls every 30-60 seconds for new notifications (Phase 1)
- Phase 2 adds WebSocket push for instant delivery
- Old notifications auto-cleaned after 90 days (cron job)
- In-app notifications are per-user (not per-team)
