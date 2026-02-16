# Event Mapping

> Which events trigger which notifications, and who receives them.

## Event → Notification Map

| Event Type | Notification | Recipients |
|-----------|-------------|------------|
| `hackathon.activated` | "Hackathon is now active!" | All team members |
| `hackathon.judging_started` | "Judging has begun" | Judges + team leads |
| `hackathon.completed` | "Hackathon completed" | All participants |
| `hackathon.results_published` | "Results are in!" | All participants |
| `submission.captured` | "Submission received" | Team members |
| `submission.validated` | "Submission passed checks" | Team lead |
| `submission.failed_validation` | "Submission failed checks" | Team lead |
| `submission.tag_deleted` | "Submission tag was deleted" | Organizers |
| `team.member_joined` | "New member joined" | Team lead |
| `team.invite_received` | "You're invited to join" | Invitee (email) |
| `judge.invited` | "You're invited to judge" | Judge (email) |
| `judge.assignment_ready` | "Submissions ready for review" | Assigned judge |
| `score.submitted` | "New score received" | Organizer |
| `deadline.reminder_24h` | "24 hours remaining" | All team leads |
| `deadline.reminder_1h` | "1 hour remaining" | All team leads |
| `force_push_detected` | "Force push detected" | Organizers |
| `bot.activated` | "Bot is active on your repo" | Team lead |

## Recipient Resolution

```ts
async function resolveRecipients(
  db: D1Database,
  event: NotificationEvent
): Promise<Recipient[]> {
  switch (event.type) {
    case 'hackathon.activated':
    case 'hackathon.completed':
    case 'hackathon.results_published':
      // All team members in this hackathon
      return db.prepare(`
        SELECT u.id, u.email, u.name FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        JOIN teams t ON tm.team_id = t.id
        WHERE t.hackathon_id = ?
      `).bind(event.hackathon_id).all();

    case 'hackathon.judging_started':
      // Judges + team leads
      const judges = await db.prepare(`
        SELECT u.id, u.email, u.name FROM users u
        JOIN judges j ON u.id = j.user_id
        WHERE j.hackathon_id = ? AND j.invite_status = 'accepted'
      `).bind(event.hackathon_id).all();

      const leads = await db.prepare(`
        SELECT u.id, u.email, u.name FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        JOIN teams t ON tm.team_id = t.id
        WHERE t.hackathon_id = ? AND tm.role = 'team_lead'
      `).bind(event.hackathon_id).all();

      return [...judges.results, ...leads.results];

    case 'submission.captured':
    case 'submission.validated':
      // Team members of the submitting team
      return db.prepare(`
        SELECT u.id, u.email, u.name FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id = ?
      `).bind(event.team_id).all();

    case 'force_push_detected':
    case 'submission.tag_deleted':
      // Organizers only
      return db.prepare(`
        SELECT u.id, u.email, u.name FROM users u
        JOIN organizer_roles o ON u.id = o.user_id
        WHERE o.hackathon_id = ?
      `).bind(event.hackathon_id).all();

    // ... other cases
  }
}
```

## Notification Queue Message Shape

```ts
interface NotificationEvent {
  type: string;          // e.g., 'hackathon.activated'
  hackathon_id: string;
  team_id?: string;
  user_id?: string;      // for direct notifications
  detail?: Record<string, unknown>;
}
```

## Implementation Notes

- Recipients are resolved at delivery time (not at enqueue time) — ensures current state
- A single event can generate multiple notifications (one per recipient per channel)
- Users can configure notification preferences per hackathon (stored in `hackathon_notification_config`)
