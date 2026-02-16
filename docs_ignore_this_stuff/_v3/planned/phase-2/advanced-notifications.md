# Advanced Notifications

> Push notifications, Slack, and Discord integration.

## Overview

Extend the existing notification system (email + in-app) with additional channels: browser push notifications, Slack webhooks, and Discord webhooks.

## Channels

| Channel | Priority | Implementation |
|---------|----------|---------------|
| Email (Phase 1) | Default | SMTP via notification queue |
| In-app (Phase 1) | Always | Database + polling |
| Browser Push | Opt-in | Web Push API + service worker |
| Slack | Opt-in | Incoming webhook URL |
| Discord | Opt-in | Incoming webhook URL |

## Configuration

Organizers configure channels per hackathon:

```sql
-- Extend hackathon_notification_config (Phase 1 table)
ALTER TABLE hackathon_notification_config ADD COLUMN slack_webhook_url TEXT;
ALTER TABLE hackathon_notification_config ADD COLUMN discord_webhook_url TEXT;
ALTER TABLE hackathon_notification_config ADD COLUMN push_enabled INTEGER DEFAULT 0;
```

## Notification Handler Extension

```ts
// apps/api/src/queue/notification-handler.ts
// Add new cases to existing switch:

case 'slack':
  await sendSlackNotification(config.slack_webhook_url, message);
  break;

case 'discord':
  await sendDiscordNotification(config.discord_webhook_url, message);
  break;

case 'push':
  await sendPushNotification(env, recipientId, message);
  break;
```

## Slack Integration

```ts
async function sendSlackNotification(webhookUrl: string, message: NotificationMessage) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message.title,
      blocks: [{
        type: 'section',
        text: { type: 'mrkdwn', text: `*${message.title}*\n${message.body}` },
      }],
    }),
  });
}
```

## Discord Integration

```ts
async function sendDiscordNotification(webhookUrl: string, message: NotificationMessage) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `**${message.title}**\n${message.body}`,
    }),
  });
}
```

## Browser Push

Requires:
- Service worker registration in frontend apps
- Web Push API subscription stored in new `push_subscriptions` table
- VAPID keys as Worker secrets

## Prerequisites

- Notification system (Phase 1)
- For push: service worker, VAPID key secrets
- For Slack/Discord: organizer provides webhook URL

## Notes

- Slack/Discord are fire-and-forget — fail-open pattern (10s timeout, never throw)
- Push notifications require HTTPS (production only)
- All channels use the same notification queue — handler dispatches by channel type
- User preference: users can opt in/out of each channel
