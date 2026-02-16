# Automated Transitions

> Cron triggers and DO alarms for deadline enforcement.

## Two Mechanisms

### 1. DO Alarms (Primary)

Set when a hackathon transitions `draft → active`:

```ts
// In HackathonStateMachine.transition():
if (targetStatus === 'active' && state.submission_deadline) {
  const deadline = new Date(state.submission_deadline).getTime();
  await this.ctx.storage.setAlarm(deadline);
}
```

When the alarm fires, the DO handles the transition AND side effects directly via `this.env` bindings:

```ts
async alarm(): Promise<void> {
  const state = await this.getState();

  if (state.status !== 'active') return; // Already transitioned (cron beat us)

  // 1. Transition DO state
  await this.executeTransition('judging');

  // 2. Sync D1 (DOs CAN access env bindings via this.env)
  await this.env.DB.prepare(`
    UPDATE hackathons SET status = 'judging', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).bind(state.hackathon_id).run();

  // 3. Enqueue notifications
  await this.env.NOTIFICATION_QUEUE.send({
    type: 'hackathon.judging_started',
    hackathon_id: state.hackathon_id,
  });
}
```

**Note:** DOs *can* access `this.env` bindings (D1, KV, Queues). They use raw D1 prepared statements (not Drizzle ORM). See [02-durable-object.md](./02-durable-object.md#alarm-handling) for the full implementation.

### 2. Cron Trigger (Backup)

Runs hourly (`0 * * * *`) as a safety net:

```ts
// apps/api/src/index.ts → scheduled() handler
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  // 1. Find hackathons with passed deadlines still in 'active' state
  const overdue = await env.DB.prepare(`
    SELECT id, submission_deadline FROM hackathons
    WHERE status = 'active'
    AND submission_deadline IS NOT NULL
    AND submission_deadline <= strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).all();

  // Cron handler — safety net only.
  // D1 sync and notification enqueue happen inside the DO's transition/alarm handler.
  // The cron only invokes the DO — it does NOT perform side effects directly.
  for (const hackathon of overdue.results) {
    const stub = env.HACKATHON_SM.getByName(hackathon.id);
    try {
      await stub.transition('judging', -1); // -1 = force (bypass version check)
    } catch (err) {
      console.error(JSON.stringify({ event: 'cron_transition_failed', hackathon_id: hackathon.id, error: String(err) }));
    }
  }

  // 5. Check for deadline reminders (24h, 1h before)
  await sendDeadlineReminders(env);
}
```

### Deadline Reminders

The cron also sends reminders before deadlines:

```ts
async function sendDeadlineReminders(env: Env) {
  const now = new Date();

  // 24-hour reminder
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const upcoming24h = await env.DB.prepare(`
    SELECT id FROM hackathons
    WHERE status = 'active'
    AND submission_deadline BETWEEN strftime('%Y-%m-%dT%H:%M:%fZ','now') AND ?
  `).bind(in24h).all();

  for (const h of upcoming24h.results) {
    await env.NOTIFICATION_QUEUE.send({
      type: 'deadline.reminder_24h',
      hackathon_id: h.id,
    });
  }

  // 1-hour reminder (similar query with 1h window)
}
```

## Why Both?

| Mechanism | Precision | Reliability | Use Case |
|-----------|-----------|-------------|----------|
| DO Alarm | Exact (to the second) | May miss if DO evicted | Primary deadline enforcement |
| Cron | Hourly granularity | Always runs | Backup catch-all, reminders |

The cron is idempotent — if the DO alarm already transitioned the hackathon, the cron's query finds no overdue hackathons.

## Implementation Notes

- Cron handler runs at `0 * * * *` (top of every hour)
- Both mechanisms call the same DO `transition()` RPC method (idempotent)
- Deadline reminders use idempotency keys to avoid duplicate notifications
- The cron passes `version: -1` to bypass optimistic locking (force transition) — see [02-durable-object.md](./02-durable-object.md#transitiontargetstatus-version) for how `-1` is handled
