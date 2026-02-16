# Cron Triggers

> `apps/api/src/cron/` — Hourly scheduled handler for deadline enforcement.

## Schedule

```jsonc
// wrangler.jsonc
"triggers": { "crons": ["0 * * * *"] }  // Every hour, on the hour
```

## Entry Point

```ts
// apps/api/src/index.ts
export default {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: cronHandler,
};

// apps/api/src/cron/index.ts
export async function cronHandler(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const db = drizzle(env.DB);

  await checkSubmissionDeadlines(db, env);
  await sendDeadlineReminders(db, env);
}
```

## Tasks

### 1. Check Submission Deadlines

Find active hackathons whose submission deadline has passed → transition to `judging`:

```ts
async function checkSubmissionDeadlines(db: DrizzleD1, env: Env) {
  const now = new Date().toISOString();

  const expired = await db.select()
    .from(hackathons)
    .where(and(
      eq(hackathons.status, 'active'),
      lte(hackathons.submission_deadline, now),
      isNotNull(hackathons.submission_deadline)
    ))
    .all();

  for (const h of expired) {
    // Request transition via DO (version: -1 bypasses optimistic locking for cron/alarm)
    const doId = env.HACKATHON_SM.idFromName(h.id);
    const stub = env.HACKATHON_SM.get(doId);
    await stub.fetch(new Request('http://do/transition', {
      method: 'POST',
      body: JSON.stringify({ target_status: 'judging', version: -1 }),
    }));

    // Sync D1 status to match DO state
    await db.update(hackathons)
      .set({ status: 'judging', updated_at: new Date().toISOString() })
      .where(eq(hackathons.id, h.id))
      .run();

    // Audit (matches insertAuditEvent() signature from 09-audit-trail/03-ingestion.md)
    await insertAuditEvent(env.DB, {
      hackathon_id: h.id,
      actor_type: 'cron',
      event_type: 'cron.deadline_transition',
      entity_type: 'hackathon',
      entity_id: h.id,
      changes: { status: { old: 'active', new: 'judging' } },
    });

    // Enqueue notifications
    await env.NOTIFICATION_QUEUE.send({
      type: 'hackathon.judging_started',
      hackathon_id: h.id,
    });
  }
}
```

### 2. Send Deadline Reminders

Notify teams when deadline is approaching (24h, 1h before):

```ts
async function sendDeadlineReminders(db: DrizzleD1, env: Env) {
  const now = Date.now();

  const active = await db.select()
    .from(hackathons)
    .where(and(
      eq(hackathons.status, 'active'),
      isNotNull(hackathons.submission_deadline)
    ))
    .all();

  for (const h of active) {
    const deadline = new Date(h.submission_deadline!).getTime();
    const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

    // Send 24h reminder (between 23-24h)
    if (hoursRemaining > 23 && hoursRemaining <= 24) {
      await env.NOTIFICATION_QUEUE.send({
        type: 'deadline_reminder',
        hackathon_id: h.id,
        data: { hours_remaining: 24 },
      });
    }

    // Send 1h reminder
    if (hoursRemaining > 0 && hoursRemaining <= 1) {
      await env.NOTIFICATION_QUEUE.send({
        type: 'deadline_reminder',
        hackathon_id: h.id,
        data: { hours_remaining: 1 },
      });
    }
  }
}
```

## Implementation Notes

- Cron runs inside the same Worker as fetch and queue handlers
- `ScheduledEvent.cron` contains the cron pattern string (for future multi-cron support)
- All cron operations use UTC timestamps
- Cron CPU time: 10ms on free plan, 30s on paid plan. With few active hackathons in Phase 1, 10ms is sufficient
- Audit events from cron use `actor_type: 'cron'` (not `user` or `system`)
- Idempotency: DO transition rejects if already in target state, reminder dedup via notification idempotency keys
