# Notification System

Priority: **PHASE 2** — judging features depend on this. Moved up from Phase 3.

## Source Docs
- `role-event-lead.md` — Announcements, broadcast notifications, targeted announcements, email dispatch
- `role-participant.md` — Round results, elimination notifications
- `role-judge.md` — Scoring window opens/closes, reminders

## Current State

**Working**:
- In-app notification CRUD (create, read, mark-read, read-all)
- Notification preferences endpoints (get, update)
- Announcement → notification dispatch (queue-based)
- Email composition and SMTP dispatch
- Idempotency via `notification_idempotency` table

**Missing**:
- Preference enforcement (GAP-012) — preferences saved but never checked before sending
- Email templates — inline HTML, no template system
- Eliminated team notifications (GAP-007)
- Scoring window notifications (judge alerts)
- Targeted announcements (round-specific, team-specific)
- Judge reminder trigger
- Batched email sending (serial fan-out hits CPU limit)
- 15-minute closing reminder (cron runs hourly)

## Implementation Plan

### 1. Preference Enforcement — GAP-012

**File**: `src/queue/notification-handler.ts`

Before sending any notification, check user preferences:
```typescript
async function shouldNotify(env: AppEnv['Bindings'], userId: string, hackathonId: string, channel: 'email' | 'in_app'): Promise<boolean> {
  const config = await env.DB.prepare(
    'SELECT email_enabled, in_app_enabled FROM hackathon_notification_config WHERE user_id = ? AND hackathon_id = ?'
  ).bind(userId, hackathonId).first();

  if (!config) return true; // Default: all enabled
  return channel === 'email' ? config.email_enabled : config.in_app_enabled;
}
```

Add this check before:
- Email dispatch in `notification-handler.ts`
- In-app notification insert

### 2. Email Template System

**Current**: Inline HTML strings in `services/email.ts`.

**Target**: Structured templates with variable substitution.

```
src/services/email-templates/
  base.ts              — HTML wrapper (header, footer, styles)
  announcement.ts      — Hackathon announcement
  invite-judge.ts      — Judge invitation
  invite-team.ts       — Team invitation
  invite-workspace.ts  — Workspace invitation
  round-results.ts     — Round completion
  elimination.ts       — Team eliminated
  scoring-open.ts      — Scoring window opened
  scoring-reminder.ts  — Scoring window closing soon
  judge-reminder.ts    — Manual reminder from organizer
  deadline-reminder.ts — Submission deadline approaching
```

Each template exports:
```typescript
export function renderAnnouncementEmail(vars: {
  hackathonName: string;
  title: string;
  content: string;
  actionUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `[${vars.hackathonName}] ${vars.title}`,
    html: baseTemplate(/* ... */),
    text: `${vars.title}\n\n${vars.content}\n\nView: ${vars.actionUrl}`,
  };
}
```

### 3. Targeted Announcements

**From `role-event-lead.md`**: Announcements can target `all`, `round:<n>`, or `team:<id>`.

**Schema change** (migration 0004):
```sql
ALTER TABLE announcements ADD COLUMN target_type TEXT NOT NULL DEFAULT 'all';
-- Values: 'all', 'round', 'team'
ALTER TABLE announcements ADD COLUMN target_id TEXT;
-- For 'round': round_id. For 'team': team_id. For 'all': NULL.
```

**Fan-out logic** in notification handler:
```typescript
async function getAnnouncementRecipients(env, hackathonId, targetType, targetId) {
  if (targetType === 'all') {
    return env.DB.prepare('SELECT DISTINCT tm.user_id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE t.hackathon_id = ? AND t.status != ?')
      .bind(hackathonId, 'disqualified').all();
  }
  if (targetType === 'round') {
    return env.DB.prepare('SELECT DISTINCT rr.team_id, tm.user_id FROM round_results rr JOIN team_members tm ON rr.team_id = tm.team_id WHERE rr.round_id = ? AND rr.status = ?')
      .bind(targetId, 'eligible').all();
  }
  if (targetType === 'team') {
    return env.DB.prepare('SELECT user_id FROM team_members WHERE team_id = ?')
      .bind(targetId).all();
  }
}
```

### 4. Event-Driven Notification Triggers

Map events to notifications (from plan docs):

| Event | Recipients | Channels | Template |
|-------|-----------|----------|----------|
| `announcement.created` | Targeted participants | email + in_app | announcement |
| `round.completed` | All teams | email + in_app | round-results |
| `team.eliminated` | Team members | email + in_app | elimination |
| `scoring.window_opened` | Assigned judges | email + in_app | scoring-open |
| `scoring.window_closing` | Judges with pending assignments | email | scoring-reminder |
| `scoring.window_extended` | Judges with pending assignments | email + in_app | scoring-reminder |
| `judge.reminder` | Specific judges (organizer-triggered) | email | judge-reminder |
| `hackathon.deadline_24h` | All participants | email + in_app | deadline-reminder |
| `hackathon.deadline_1h` | All participants | in_app | deadline-reminder |
| `judge.invited` | Invited judge | email | invite-judge |
| `team.invited` | Invited member | email | invite-team |
| `workspace.invited` | Invited member | email | invite-workspace |
| `hackathon.request.approved` | Requesting admin | email + in_app | request-approved |
| `hackathon.request.rejected` | Requesting admin | email + in_app | request-rejected |

### 5. Batched Email Fan-Out

**Problem**: Current notification handler queries all recipients then sends emails serially. For 500+ participants, this exceeds the 30-second CPU limit.

**Fix**: Use `sendBatch()` for parallel fan-out:

```
1. Queue receives: { type: 'announcement.created', hackathonId, announcementId, cursor: 0 }
2. Handler queries 100 recipients (LIMIT 100 OFFSET cursor)
3. Build individual email messages: { type: 'send_email', userId, templateId, vars }
4. env.NOTIFICATION_QUEUE.sendBatch(messages) — max 100 per call
5. If more recipients: re-enqueue dispatcher with cursor = cursor + 100
6. Individual 'send_email' handlers: check preferences, compose, send (one email each)
```

Each `send_email` message is processed independently — no serial bottleneck.

### 6. Scoring Window Notifications

**From `role-judge.md`**: Judges need alerts when scoring windows open and close.

**Opening notification** — via cron (runs hourly):
```typescript
async function checkScoringWindows(env: AppEnv['Bindings']) {
  const now = new Date().toISOString();
  const oneHourFromNow = new Date(Date.now() + 3600000).toISOString();

  // Find rounds where scoring opens within the next hour
  const rounds = await env.DB.prepare(`
    SELECT hr.id, hr.hackathon_id, hr.name, hr.scoring_opens_at
    FROM hackathon_rounds hr
    WHERE hr.scoring_opens_at > ? AND hr.scoring_opens_at <= ?
    AND hr.status = 'active'
  `).bind(now, oneHourFromNow).all();

  for (const round of rounds.results) {
    await env.NOTIFICATION_QUEUE.send({
      type: 'scoring.window_opening',
      hackathonId: round.hackathon_id,
      roundId: round.id,
    });
  }
}
```

**Closing reminder (15-minute)**: The cron runs hourly, so 15-minute precision is impossible with cron alone.

**Options**:
1. **Durable Object alarm**: When a scoring window is created/updated, set a DO alarm for `scoring_closes_at - 15min`. The alarm triggers the reminder notification. This is the most precise option.
2. **Increase cron frequency to `*/15 * * * *`**: 15-minute cron intervals. Simple but adds overhead.
3. **Accept hourly granularity**: Send "closing within the hour" instead of "15 minutes". Least effort.

**Recommendation**: Use DO alarms (option 1) — they're already used for deadline checks and are precise.

### 7. Judge Reminder (Organizer-Triggered)

**From `role-event-lead.md`**: Event Lead can manually send reminders to judges with pending assignments.

**Endpoint**: `POST /api/v1/hackathons/:slug/judging/remind`
- Body: `{ roundId?: string, judgeIds?: string[] }` — remind specific judges or all with pending
- Queues `judge.reminder` notification for each judge
- Rate limit: max 1 reminder per judge per hour (prevent spam)

## Tests to Add

- [ ] Preference check blocks email when disabled
- [ ] Preference check allows email when enabled (or no config)
- [ ] Fan-out paginates correctly for >100 recipients
- [ ] sendBatch distributes individual email tasks
- [ ] Idempotency prevents duplicate notifications
- [ ] Scoring window opening notification sent at correct time
- [ ] Targeted announcement: round-specific recipients only
- [ ] Targeted announcement: team-specific recipients only
- [ ] Judge reminder rate limited to 1/hour
- [ ] Email templates render valid HTML
