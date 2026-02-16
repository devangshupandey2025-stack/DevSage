# 08 — Notifications

> Queue-based notification system with email and in-app channels.

## Architecture

```
Event occurs (submission, phase transition, etc.)
  → Enqueue to NOTIFICATION_QUEUE: { type, hackathon_id, ... }
  → notification-handler consumes:
    1. Resolve recipients
    2. Render per-channel content
    3. Deliver (email via SMTP, in-app via D1 insert)
    4. Record delivery
```

## Channels (Phase 1)

| Channel | Delivery | Storage |
|---------|----------|---------|
| Email | SMTP relay | `notification_deliveries` |
| In-App | D1 insert | `in_app_notifications` |

Push notifications, Slack, and Discord are Phase 2.

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-event-mapping.md](./01-event-mapping.md) | Event types → notification types, recipients |
| [02-email-channel.md](./02-email-channel.md) | SMTP integration, templates |
| [03-in-app-channel.md](./03-in-app-channel.md) | In-app notifications, read/unread |
| [04-deadline-reminders.md](./04-deadline-reminders.md) | Cron-triggered reminders |
| [05-idempotency.md](./05-idempotency.md) | Dedup and delivery guarantees |

## Dependencies

- `apps/api/src/queue/notification-handler.ts`
- `apps/api/src/queue/notification-logic.ts`
- `apps/api/src/services/smtp.ts`
- `apps/api/src/routes/notifications.ts`
- `packages/db/src/schema/in-app-notifications.ts`
- `packages/db/src/schema/notification-deliveries.ts`
- `packages/db/src/schema/notification-idempotency.ts`
- **NOTIFICATION_QUEUE** binding (queue: `devsage-notifications`, batch: 10, retries: 3)
