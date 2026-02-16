# Deadline Enforcement

> Hard submission deadlines enforced by Durable Object and cron triggers.

## Enforcement Points

### 1. DO Check (Real-time)

Every `POST /accept-submission` checks the deadline:

```ts
if (state.submission_deadline && new Date(state.submission_deadline) < new Date()) {
  return { accepted: false, reason: 'deadline_passed' };
}
```

### 2. DO Alarm (Auto-transition)

Alarm fires at deadline time → transitions hackathon from `active` to `judging`:
- All pending submissions finalized
- No new submissions accepted
- Notification sent to participants

### 3. Cron (Backup)

Hourly cron catches any missed alarms (see [07-automated-transitions.md](../03-hackathon-lifecycle/07-automated-transitions.md)).

## Late Submission Handling

Tags pushed after the deadline are silently rejected:

```
Tag received → DO check → deadline_passed → reject
  → Post commit status: "❌ Submission rejected: deadline passed"
  → No D1 row created
  → Log in audit trail
```

No grace period by default. Organizers can:
1. Extend the deadline (updates DO state + D1)
2. Manually accept a late submission via admin override

## Admin Override

### `POST /api/v1/hackathons/:slug/submissions/:id/override`

```
Auth: organizer only
```

```ts
const overrideSchema = z.object({
  action: z.enum(['accept', 'reject', 'mark_late']),
  reason: z.string().max(500),
});
```

Creates an audit event with the override reason.

## Timeline

```
│  Hackathon Active Period  │
├───────────────────────────┤
│                           │ ← submission_deadline
│                           │
│  Tags accepted ✅          │ Tags rejected ❌
│                           │
│                  -24h ──→ │ Reminder notification
│                  -1h  ──→ │ Reminder notification
│                           │
│                           │ ← DO alarm fires
│                           │   → active → judging
│                           │   → all submissions locked
```

## Per-Round Deadlines

When rounds are configured, each round can have its own deadline:

```ts
// Round-specific deadline takes precedence
const deadline = currentRound?.submission_deadline ?? hackathon.submission_deadline;
```

Submissions after a round's deadline are rejected for that round, but may be accepted for a later round if one exists.

## Implementation Notes

- Deadline is stored in both D1 (for reads) and DO state (for enforcement)
- Extending deadline: update D1 row + call `POST /update-config` on DO + reschedule alarm
- All timestamps are UTC ISO-8601
- Clock skew: DO uses its own clock — within Cloudflare, this is NTP-synced
