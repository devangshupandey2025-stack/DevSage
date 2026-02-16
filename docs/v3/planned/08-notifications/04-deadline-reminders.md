# Deadline Reminders

> Cron-triggered reminders at 24h and 1h before submission deadlines.

## Trigger

The hourly cron (`0 * * * *`) checks for upcoming deadlines:

```ts
async function sendDeadlineReminders(env: Env) {
  const now = new Date();

  // 24-hour window
  const windowStart24 = now.toISOString();
  const windowEnd24 = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // +1h window

  const upcoming24h = await env.DB.prepare(`
    SELECT id, name, submission_deadline FROM hackathons
    WHERE status = 'active'
    AND submission_deadline BETWEEN ? AND ?
  `).bind(
    new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString(), // 23h from now
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()  // 24h from now
  ).all();

  for (const h of upcoming24h.results) {
    const idempotencyKey = `reminder:24h:${h.id}`;
    await env.NOTIFICATION_QUEUE.send({
      type: 'deadline.reminder_24h',
      hackathon_id: h.id,
      idempotency_key: idempotencyKey,
    });
  }

  // 1-hour window (similar)
  const upcoming1h = await env.DB.prepare(`
    SELECT id, name, submission_deadline FROM hackathons
    WHERE status = 'active'
    AND submission_deadline BETWEEN ? AND ?
  `).bind(
    now.toISOString(),
    new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  ).all();

  for (const h of upcoming1h.results) {
    await env.NOTIFICATION_QUEUE.send({
      type: 'deadline.reminder_1h',
      hackathon_id: h.id,
      idempotency_key: `reminder:1h:${h.id}`,
    });
  }
}
```

## Recipients

Deadline reminders go to all **team leads** in the hackathon. Team leads are responsible for ensuring their team submits on time.

## Idempotency

The `idempotency_key` prevents duplicate reminders:
- Key: `reminder:{interval}:{hackathon_id}`
- Checked in `notification_idempotency` table before sending
- See [05-idempotency.md](./05-idempotency.md)

## Per-Round Deadlines

If rounds have individual deadlines, reminders are sent per round:

```ts
const roundDeadlines = await env.DB.prepare(`
  SELECT r.id, r.name, r.submission_deadline, h.id as hackathon_id
  FROM hackathon_rounds r
  JOIN hackathons h ON r.hackathon_id = h.id
  WHERE h.status = 'active'
  AND r.submission_deadline BETWEEN ? AND ?
`).bind(windowStart, windowEnd).all();
```

## Implementation Notes

- Cron runs hourly so reminders have ~1 hour precision
- A hackathon with a deadline at 3:30 PM gets its 24h reminder between 3:00-4:00 PM the day before
- Idempotency ensures re-running the cron doesn't duplicate notifications
