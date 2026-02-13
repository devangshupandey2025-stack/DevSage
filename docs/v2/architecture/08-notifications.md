# 08 — Notification System

> Queue-based email notifications via custom SMTP. 9 event types with per-type recipient resolution. Idempotent delivery, fail-open, serialized sending.

**Related docs:** [Webhooks](./07-webhooks-integrations.md) | [Audit Trail](./09-audit-trail.md) | [Infrastructure](./12-infrastructure.md)

---

## Architecture

```mermaid
flowchart TD
    subgraph Producers
        R["Route handlers"]
        QH["Queue handlers"]
        CR["Cron handler"]
    end

    R & QH & CR -->|"enqueue"| Q["NOTIFICATION_QUEUE<br/>(devsage-notifications)"]

    Q --> C["Notification Consumer"]
    C --> ID{"Idempotency check<br/>(audit_events)"}
    ID -->|"Already sent"| SKIP["Skip (no-op)"]
    ID -->|"Not sent"| RES["Resolve recipients"]
    RES --> RENDER["Render email template"]
    RENDER --> SEND["Send via SMTP<br/>(serialized, 10s timeout)"]
    SEND --> AUDIT["Log to audit_events"]
```

---

## Notification Types

| Type | Trigger | Recipients | Priority |
|------|---------|------------|----------|
| `submission_received` | Tag accepted by DO | All team members | Normal |
| `submission_invalid` | Tag rejected by DO | Team leader only | Normal |
| `force_push_alert` | Force push detected | All moderator+ organizers | High |
| `phase_transition` | Hackathon state change | All hackathon participants | Normal |
| `judge_invited` | Admin invites judge | Invited judge | Normal |
| `judge_assignment` | Auto-assignment run | Assigned judge | Normal |
| `scores_finalized` | Judging completed | All team members | Normal |
| `deadline_reminder` | Cron (T-24h or T-1h) | Team leaders without final submission | Normal |
| `organizer_invited` | Platform admin invites | Invite email address | Normal |

---

## Processing Flow

```mermaid
sequenceDiagram
    participant P as Producer
    participant Q as NOTIFICATION_QUEUE
    participant N as Notification Handler
    participant D1 as D1 Database
    participant SMTP as SMTP Service

    P->>Q: enqueue { type, hackathonId, ... }
    Q->>N: Consume message

    N->>D1: Idempotency check:<br/>SELECT FROM audit_events<br/>WHERE action = 'notification.sent'<br/>AND entity_id = idempotencyKey
    alt Already sent
        N->>N: Skip (idempotent no-op)
    else Not sent
        N->>D1: resolveRecipients(type, payload)
        D1-->>N: [{ email, name }]

        loop For each recipient
            N->>N: renderEmailTemplate(type, data)
            N->>SMTP: sendEmail(to, subject, body)
            alt Success
                SMTP-->>N: { success: true }
                N->>D1: INSERT audit_events<br/>(action: 'notification.sent')
            else Failure
                SMTP-->>N: { success: false, error }
                N->>D1: INSERT audit_events<br/>(action: 'notification.failed')
            end
        end
    end
```

---

## Recipient Resolution

Each notification type has specific rules for determining recipients:

```mermaid
flowchart TD
    A["Notification message"] --> B{Type?}

    B -->|submission_received<br/>scores_finalized| C["All team members<br/>(team_members JOIN users)"]
    B -->|submission_invalid| D["Team leader only<br/>(team_members WHERE role='leader')"]
    B -->|force_push_alert| E["All moderator+ organizers<br/>(organizer_roles WHERE role IN<br/>owner, admin, moderator)"]
    B -->|phase_transition| F["All hackathon participants<br/>(all team members across all teams)"]
    B -->|judge_invited<br/>judge_assignment| G["Single judge<br/>(judges JOIN users)"]
    B -->|deadline_reminder| H["Team leaders without<br/>final submission"]
    B -->|organizer_invited| I["Direct email address<br/>(from invite record)"]
```

### Deadline Reminder Recipients

```sql
-- Team leaders who haven't finalized a submission
SELECT u.email, u.display_name
FROM team_members tm
  JOIN teams t ON tm.team_id = t.id
  JOIN users u ON tm.user_id = u.id
WHERE t.hackathon_id = ?
  AND tm.role = 'leader'
  AND t.id NOT IN (
    SELECT team_id FROM submissions
    WHERE hackathon_id = ? AND is_final = 1
  )
```

---

## Email Service (SMTP)

| Property | Value |
|----------|-------|
| Protocol | HTTP-based SMTP API (Workers can't do raw TCP) |
| Timeout | 10 seconds (AbortController) |
| Failure mode | Fail-open: returns `{ success: false, error }`, never throws |
| Rate limit | 500 emails/hour (self-hosted SMTP) |
| Format | Plain text + minimal HTML |

### Sending Pattern

Emails within a batch are sent **serially** (no concurrent SMTP connections):

```mermaid
flowchart LR
    A["Batch of 10<br/>notifications"] --> B["Send email 1"]
    B --> C["Send email 2"]
    C --> D["..."]
    D --> E["Send email 10"]
```

**Reason:** Serialize to respect SMTP rate limits and avoid connection issues.

---

## Deadline Reminders via Cron

```mermaid
flowchart TD
    A["Cron fires<br/>(0 * * * * = hourly)"] --> B["Query active hackathons<br/>with deadline in [now, now+24h]"]
    B --> C{Any found?}
    C -->|No| D["Done"]
    C -->|Yes| E["For each hackathon:"]
    E --> F["Calculate hoursRemaining"]
    F --> G{hoursRemaining <= 1?}
    G -->|Yes| H["reminderType = '1h'"]
    G -->|No| I{hoursRemaining <= 24?}
    I -->|Yes| J["reminderType = '24h'"]
    I -->|No| D
    H & J --> K["Check if already sent<br/>(audit_events)"]
    K --> L{Already sent?}
    L -->|Yes| D
    L -->|No| M["INSERT audit_events<br/>(deadline_reminder_{type})"]
    M --> N["Enqueue deadline_reminder<br/>notification"]
```

### Reminder Schedule

| Reminder | Window | Idempotency Key |
|----------|--------|-----------------|
| T-24h | 23-24 hours before deadline | `deadline_reminder_24h:{hackathonId}` |
| T-1h | 0-1 hours before deadline | `deadline_reminder_1h:{hackathonId}` |

---

## Idempotency

Multiple layers prevent duplicate notifications:

| Layer | Mechanism |
|-------|-----------|
| Cron | Checks audit_events before enqueuing reminders |
| Handler | Checks audit_events before sending (notification.sent + idempotencyKey) |
| Queue | Retry with backoff on failure (ack only after success or dead-letter) |

Idempotency key format: `{type}:{hackathonId}:{entityId}:{timestamp_bucket}`

---

## Queue Configuration

| Property | Value |
|----------|-------|
| Queue name | `devsage-notifications` |
| Binding | `NOTIFICATION_QUEUE` |
| Max batch size | 10 |
| Max retries | 3 |
| Retry backoff | Exponential (base seconds × attempts, max 5 min) |
| Dead letter | Audit event logged on final failure |

---

## File References

| File | Purpose |
|------|---------|
| `apps/api/src/queue/notification-handler.ts` | Notification consumer |
| `apps/api/src/queue/notification-logic.ts` | `resolveRecipients()`, `renderEmailTemplate()` |
| `apps/api/src/services/smtp.ts` | `sendEmail()` — HTTP-based SMTP, fail-open |
| `apps/api/src/queue/index.ts` | Queue dispatcher |
| `apps/api/src/index.ts` | Cron handler (deadline reminders) |
