# Real-time WebSocket

> WebSocketGateway Durable Object for live updates and presence.

## Overview

A new Durable Object (`WebSocketGateway`) that manages WebSocket connections per hackathon. Provides real-time updates for submission status, leaderboard changes, team activity, and user presence.

## Architecture

```
Browser → WebSocket → Worker fetch() → DO.fetch() → WebSocket upgrade
                                                   → Broadcast to connected clients
```

Each hackathon gets one DO instance (keyed by hackathon ID).

## DO Design

```ts
export class WebSocketGateway extends DurableObject {
  // Hibernation API — connections survive DO sleep
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) { ... }
  async webSocketClose(ws: WebSocket) { ... }

  // HTTP endpoint to upgrade
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      // Attach user metadata as tags
      server.serializeAttachment({ userId, role });
      return new Response(null, { status: 101, webSocket: client });
    }
    // HTTP API for server-side broadcasts
    if (request.url.endsWith('/broadcast')) {
      const event = await request.json();
      this.broadcastEvent(event);
      return new Response('ok');
    }
  }

  broadcastEvent(event: WsEvent) {
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(JSON.stringify(event));
    }
  }
}
```

## Event Types

| Event | Trigger | Payload |
|-------|---------|---------|
| `submission.new` | Tag webhook processed | `{ team_id, tag, round }` |
| `leaderboard.updated` | Score submitted | `{ hackathon_id }` |
| `team.activity` | Commit pushed | `{ team_id, commit_count }` |
| `presence.update` | User connects/disconnects | `{ online_count, users }` |
| `hackathon.transition` | State change | `{ from, to }` |

## Server-Side Broadcast

When the API processes an event (e.g., new submission), it sends a broadcast to the DO:

```ts
const doId = env.WEBSOCKET_GW.idFromName(hackathonId);
const stub = env.WEBSOCKET_GW.get(doId);
await stub.fetch(new Request('http://do/broadcast', {
  method: 'POST',
  body: JSON.stringify({ type: 'submission.new', data: { team_id, tag } }),
}));
```

## Prerequisites

- Phase 1 complete (hackathon lifecycle, submissions, judging)
- New wrangler.jsonc binding: `WEBSOCKET_GW` → `WebSocketGateway`
- New `new_sqlite_classes` migration for the DO
- Frontend WebSocket client integration

## Fallback

SSE (Server-Sent Events) as a fallback for environments that don't support WebSocket. The DO can serve an SSE endpoint alongside WebSocket.
