# Submission Locking

> Exactly-once submission acceptance via Durable Object.

## Why DO Locking?

Without DO:
- Two tag webhooks for the same team arrive simultaneously
- Both pass the "can submit?" check
- Both insert submission rows
- Team has duplicate submissions

With DO:
- Both webhooks call `POST /accept-submission` on the same DO instance
- DO processes requests sequentially (single-writer)
- First request succeeds, second sees the lock already exists
- Exactly one submission accepted

## DO Endpoint: `POST /accept-submission`

```ts
// Request:
{
  team_id: string,
  submission_key: string,  // "{team_id}:{tag_name}" or "{team_id}:{round_id}:{tag_name}"
  round_id?: string
}

// DO processing:
async acceptSubmission(body): Promise<{ accepted: boolean; reason?: string }> {
  // 1. Check status is 'active'
  const state = await this.getState();
  if (state.status !== 'active') {
    return { accepted: false, reason: 'hackathon_not_active' };
  }

  // 2. Check deadline
  if (state.submission_deadline && new Date(state.submission_deadline) < new Date()) {
    return { accepted: false, reason: 'deadline_passed' };
  }

  // 3. Check idempotency (same key = already accepted)
  const existing = await this.sql`
    SELECT submission_key FROM submission_locks WHERE submission_key = ${body.submission_key}
  `;
  if (existing.length > 0) {
    return { accepted: true }; // idempotent — already accepted
  }

  // 4. Check max submissions per team
  const teamCount = await this.sql`
    SELECT count FROM team_submissions WHERE team_id = ${body.team_id}
  `;
  const maxPerTeam = state.config.max_submissions_per_team ?? 1;
  if (teamCount.length > 0 && teamCount[0].count >= maxPerTeam) {
    // Check if resubmission allowed
    if (!state.config.allow_resubmission) {
      return { accepted: false, reason: 'max_submissions_reached' };
    }
    // If resubmission allowed, this replaces the previous one
  }

  // 5. Lock
  await this.sql`
    INSERT INTO submission_locks (submission_key, team_id, locked_at)
    VALUES (${body.submission_key}, ${body.team_id}, ${new Date().toISOString()})
  `;

  // 6. Increment count
  await this.sql`
    INSERT INTO team_submissions (team_id, count) VALUES (${body.team_id}, 1)
    ON CONFLICT(team_id) DO UPDATE SET count = count + 1
  `;

  return { accepted: true };
}
```

## Idempotency

The `submission_key` ensures exactly-once processing:

- Key format: `{team_id}:{tag_name}` (or `{team_id}:{round_id}:{tag_name}`)
- If the same webhook is retried, the same key is used → DO returns `accepted: true` without creating a duplicate
- The `delivery_id` from GitHub provides an additional idempotency layer in D1

## Resubmission

When `allow_resubmission` is true:
- New tags with different names (e.g., `submission-v2`) create new submissions
- The latest submission is marked as `current`, previous ones as `superseded`
- Team submission count tracks total submissions

When `allow_resubmission` is false:
- First accepted submission is final
- Subsequent tags are rejected with `max_submissions_reached`

## Implementation Notes

- The DO lock is separate from the D1 submission row — DO decides, Worker persists
- If the Worker crashes after DO accepts but before D1 insert, the retry will see `accepted: true` from DO and re-insert (idempotent via `delivery_id` unique constraint)
- DO SQLite tables are internal to the DO — not the same as D1 tables
