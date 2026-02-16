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

When the alarm fires:

```ts
async alarm(): Promise<void> {
  const state = await this.getState();

  if (state.status === 'active') {
    // Auto-transition to judging
    await this.executeTransition('judging');

    // Notify the Worker to handle side effects
    // (DO can't directly access D1 or Queues — needs to coordinate with Worker)
  }
}
```

**Limitation:** DO alarms can't directly enqueue notifications or update D1. The Worker must poll or the DO must signal.

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
    AND submission_deadline <= datetime('now')
  `).all();

  for (const hackathon of overdue.results) {
    // 2. Trigger transition via DO
    const stub = env.HACKATHON_SM.get(
      env.HACKATHON_SM.idFromName(hackathon.id)
    );
    await stub.fetch('/transition', {
      method: 'POST',
      body: JSON.stringify({ target_status: 'judging', version: -1 }), // -1 = force
    });

    // 3. Update D1
    await env.DB.prepare(`
      UPDATE hackathons SET status = 'judging', updated_at = datetime('now')
      WHERE id = ?
    `).bind(hackathon.id).run();

    // 4. Enqueue notifications
    await env.NOTIFICATION_QUEUE.send({
      type: 'hackathon.judging_started',
      hackathon_id: hackathon.id,
    });
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
    AND submission_deadline BETWEEN datetime('now') AND ?
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
- Both mechanisms use the same DO transition endpoint (idempotent)
- Deadline reminders use idempotency keys to avoid duplicate notifications
- The cron's `version: -1` bypasses optimistic locking (force transition)
