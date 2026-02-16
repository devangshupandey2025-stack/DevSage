# Queue System

> Two Cloudflare Queues: `github-webhooks` and `devsage-notifications`.

## Architecture

```
Producer (route handler)
  → WEBHOOK_QUEUE.send(message)
  → Queue buffer (Cloudflare-managed)
  → Consumer: queue() handler in same Worker
  → Dispatch to handler by message type
```

The same Worker is both producer and consumer. There is no separate consumer Worker.

## Queue Configuration

| Queue | Binding | Batch Size | Retries |
|-------|---------|-----------|---------|
| `github-webhooks` | `WEBHOOK_QUEUE` | 10 | 3 |
| `devsage-notifications` | `NOTIFICATION_QUEUE` | 10 | 3 |

## Producer Pattern

```ts
// In webhook route handler
await c.env.WEBHOOK_QUEUE.send({
  type: 'github_push',
  payload: normalizedEvent,
  hackathon_id: hackathon.id,
  received_at: new Date().toISOString(),
});

// In any mutation that triggers notifications
await c.env.NOTIFICATION_QUEUE.send({
  type: 'team_joined',
  hackathon_id,
  actor_id: userId,
  data: { team_id, team_name },
});
```

## Consumer Entry Point

```ts
// apps/api/src/index.ts
export default {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: cronHandler,
};
```

## Queue Dispatcher

```ts
// apps/api/src/queue/index.ts
export async function queueHandler(
  batch: MessageBatch,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const { type, payload } = message.body as QueueMessage;

      if (batch.queue === 'github-webhooks') {
        await handleWebhookMessage(type, payload, env);
      } else if (batch.queue === 'devsage-notifications') {
        await handleNotificationMessage(type, payload, env);
      }

      message.ack();
    } catch (error) {
      console.error(`Queue message failed: ${error}`);
      message.retry();
    }
  }
}
```

## Retry Behavior

- Failed messages retry up to 3 times with exponential backoff (Cloudflare-managed)
- After 3 retries, message is dead-lettered (logged, not re-queued)
- Each retry re-delivers only the failed message, not the entire batch

## Implementation Notes

- `batch.queue` identifies which queue the batch came from (string name, not binding)
- `message.ack()` — message processed successfully, remove from queue
- `message.retry()` — message failed, re-queue for retry
- Never throw from the consumer — catch all errors and `retry()` individually
- Queue messages must be JSON-serializable (no Date objects, use ISO strings)
- Max message size: 128 KB
