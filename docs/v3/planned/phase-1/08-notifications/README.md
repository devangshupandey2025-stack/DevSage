# 08 — Notifications

> Queue-based notification system with email and in-app channels.

## Architecture

```
Event occurs (submission, phase transition, etc.)
  → Enqueue to NOTIFICATION_QUEUE: { type, hackathon_id, ... }
  → notification-handler consumes:
    1. Resolve recipients
    2. Render per-channel content
    3. Deliver (email via Resend API, in-app via D1 insert)
    4. Record delivery
```

## Channels (Phase 1)

| Channel | Delivery | Storage |
|---------|----------|---------|
| Email | Resend API | `notification_deliveries` |
| In-App | D1 insert | `in_app_notifications` |

Push notifications, Slack, and Discord are Phase 2.

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-event-mapping.md](./01-event-mapping.md) | Event types → notification types, recipients |
| [02-email-channel.md](./02-email-channel.md) | Resend email integration, templates |
| [03-in-app-channel.md](./03-in-app-channel.md) | In-app notifications, read/unread |
| [04-deadline-reminders.md](./04-deadline-reminders.md) | Cron-triggered reminders |
| [05-idempotency.md](./05-idempotency.md) | Dedup and delivery guarantees |

### Free Tier Volume Budget

Cloudflare Queues free tier: 10,000 operations/day. Each message = 3 operations (write + read + delete) = **~3,333 messages/day**.

| Event | Recipients | Messages | Daily Estimate |
|-------|------------|----------|----------------|
| hackathon.activated | All participants (~50) | 50 (1 per recipient) | ~50 |
| team.invite_created | 1 invitee | 1 | ~20 |
| submission.received | Team members (~4) | 4 | ~40 |
| deadline.reminder | All participants (~50) | 50 | ~100 |
| judging.completed | All participants (~50) | 50 | ~50 |
| **Total estimate** | | | **~260 msgs/day** |

**Strategy to stay under limit:**
1. **Fan-out inside consumer**: Enqueue ONE message per event with recipient list, not one per recipient
2. **In-app notifications bypass queue**: Write directly to D1 in the producer (skip queue overhead)
3. **Only email notifications go through the queue** (email is the slow external call)

## Dependencies

- `apps/api/src/queue/notification-handler.ts`
- `apps/api/src/queue/notification-logic.ts`
- `apps/api/src/services/email.ts`
- `apps/api/src/routes/notifications.ts`
- `packages/db/src/schema/in-app-notifications.ts`
- `packages/db/src/schema/notification-deliveries.ts`
- `packages/db/src/schema/notification-idempotency.ts`
- **NOTIFICATION_QUEUE** binding (queue: `devsage-notifications`, batch: 10, retries: 3)
