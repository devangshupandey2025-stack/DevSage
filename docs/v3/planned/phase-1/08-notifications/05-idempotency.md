# Notification Idempotency

> Preventing duplicate notifications using deduplication keys.

## Problem

Notifications can be duplicated by:
1. Queue retries (message redelivered after timeout)
2. Cron re-execution (hourly cron sends same reminder twice)
3. Concurrent events (two webhooks triggering the same notification)

## Solution

### Idempotency Table

```sql
CREATE TABLE notification_idempotency (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Clean up old keys periodically (7-day retention)
```

### Check Before Sending

```ts
async function handleNotification(event: NotificationEvent, env: Env) {
  // 1. Atomic idempotency check — no race condition
  const key = `${event.type}:${event.hackathon_id}:${event.entity_id}`;
  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO notification_idempotency (id, idempotency_key, created_at)
    VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).bind(crypto.randomUUID(), key).run();

  if (result.meta.changes === 0) {
    // Key already existed — skip (duplicate notification)
    return;
  }

  // 2. Fan-out: batch D1 inserts for in-app, parallel email sends
  const recipients = await resolveRecipients(event, env);

  // 2a. Batch in-app notifications (D1 insert — fast)
  const inAppRows = recipients.map(r => ({
    id: crypto.randomUUID(),
    userId: r.id,
    type: event.type,
    title: formatTitle(event),
    body: formatBody(event),
    hackathonId: event.hackathon_id,
    read: false,
    createdAt: new Date().toISOString(),
  }));

  const CHUNK_SIZE = 10; // ~10 cols × 10 = 100 params
  for (let i = 0; i < inAppRows.length; i += CHUNK_SIZE) {
    await db.insert(inAppNotifications).values(inAppRows.slice(i, i + CHUNK_SIZE));
  }

  // 2b. Parallel email sends (external API — slow, use Promise.allSettled)
  const emailResults = await Promise.allSettled(
    recipients
      .filter(r => r.emailEnabled)
      .map(r => sendEmail(env, { to: r.email, subject: formatTitle(event), html: formatBody(event) }))
  );
}
```

## Key Generation

| Event | Idempotency Key |
|-------|----------------|
| Webhook-triggered | `{type}:{hackathon_id}:{delivery_id}` |
| Cron reminder | `reminder:{interval}:{hackathon_id}` |
| Phase transition | `{type}:{hackathon_id}:{timestamp_minute}` |
| Team event | `{type}:{team_id}:{user_id}` |

## Cleanup

Old idempotency keys are cleaned up by the daily cron:

```ts
await env.DB.prepare(`
  DELETE FROM notification_idempotency
  WHERE created_at < datetime('now', '-7 days')
`).run();
```

## Queue Retry Behavior

- Queue: `devsage-notifications`
- Batch size: 10
- Max retries: 3
- On max retries exceeded: dead-letter to audit_events

```ts
// Correct Cloudflare Queues consumer pattern
async queue(batch: MessageBatch<NotificationEvent>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await handleNotification(msg.body, env);
      msg.ack();
    } catch (error) {
      console.error(JSON.stringify({ event: 'notification_failed', error: String(error), body: msg.body }));
      msg.retry();
    }
  }
}
```
