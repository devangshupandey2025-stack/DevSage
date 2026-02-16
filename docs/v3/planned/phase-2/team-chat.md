# Team Chat

> In-team messaging for hackathon participants.

## Overview

Simple real-time messaging within a team. Uses the `team_messages` table (already in schema) and the WebSocketGateway DO for delivery.

## Existing Table

```sql
-- packages/db/src/schema/team-messages.ts (already exists)
CREATE TABLE team_messages (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

## Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/hackathons/:slug/teams/:teamId/messages` | ✅ | team_member | List messages (paginated) |
| POST | `/hackathons/:slug/teams/:teamId/messages` | ✅ | team_member | Send message |

## Real-time Delivery

When a message is sent:

1. Insert into `team_messages` table
2. Broadcast via WebSocketGateway DO to team members:

```ts
const doId = env.WEBSOCKET_GW.idFromName(hackathonId);
const stub = env.WEBSOCKET_GW.get(doId);
await stub.fetch(new Request('http://do/broadcast', {
  method: 'POST',
  body: JSON.stringify({
    type: 'team.message',
    data: { team_id, message_id, user_id, content, created_at },
    recipients: teamMemberIds,  // only team members receive it
  }),
}));
```

## Message Limits

- Max message length: 2000 characters
- No file attachments (use GitHub for code sharing)
- No message editing or deletion (append-only)
- Messages retained for hackathon lifetime

## Prerequisites

- Team management (Phase 1)
- WebSocketGateway DO (Phase 2 — real-time-websocket.md)
- Frontend chat UI component in platform app

## Fallback Without WebSocket

If WebSocket isn't available yet, team chat works with polling:
- GET `/messages?since=<last_message_id>` every 5 seconds
- Less ideal but functional

## Notes

- Schema table already exists — only need routes and UI
- Only team members can read/write messages (enforced by `requireRole('team_member')`)
- No rich text — plain text only
- No threading — flat message list sorted by `created_at`
