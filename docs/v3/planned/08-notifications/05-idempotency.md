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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Clean up old keys periodically (7-day retention)
```

### Check Before Sending

```ts
async function handleNotification(event: NotificationEvent, env: Env) {
  // 1. Compute idempotency key
  const key = event.idempotency_key ?? `${event.type}:${event.hackathon_id}:${event.team_id ?? ''}:${event.delivery_id ?? ''}`;

  // 2. Check if already processed
  const existing = await env.DB.prepare(`
    SELECT id FROM notification_idempotency WHERE idempotency_key = ?
  `).bind(key).first();

  if (existing) return; // already sent

  // 3. Insert key (claim it)
  try {
    await env.DB.prepare(`
      INSERT INTO notification_idempotency (id, idempotency_key, created_at)
      VALUES (?, ?, datetime('now'))
    `).bind(crypto.randomUUID(), key).run();
  } catch {
    return; // unique constraint violation = another worker already claimed it
  }

  // 4. Resolve recipients and send
  const recipients = await resolveRecipients(env.DB, event);

  for (const recipient of recipients) {
    // Send email
    await sendEmail(env, {
      to: recipient.email,
      ...renderEmailTemplate(event),
    });

    // Create in-app notification
    await createInAppNotification(env.DB, recipient.id, event);

    // Record delivery
    await recordDelivery(env.DB, event.type, 'email', recipient);
  }
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
// In queue consumer:
try {
  await handleNotification(message.body, env);
  message.ack();
} catch (error) {
  console.error(`Notification failed: ${error}`);
  message.retry(); // up to 3 times
}
```
