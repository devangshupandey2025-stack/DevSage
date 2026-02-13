# 02 — Hackathon Lifecycle

> Every hackathon progresses through a 7-state forward-only state machine, enforced by a Durable Object with single-writer consistency. No backward transitions, no skipping states.

**Related docs:** [Submissions](./04-submissions.md) | [Judging](./05-judging.md) | [Infrastructure](./12-infrastructure.md)

---

## State Machine

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> registration_open : Organizer publishes
    registration_open --> registration_closed : Registration deadline (auto/manual)
    registration_closed --> active : Organizer starts hackathon
    active --> judging : Submission deadline passes (auto via Cron/DO alarm)
    judging --> completed : All judges scored OR organizer finalizes
    completed --> archived : Organizer archives (read-only)

    note right of draft
        Requires: title, description,
        deadlines, >= 1 rubric criterion
    end note

    note right of active
        Submissions accepted.
        Commits tracked.
        Force pushes flagged.
    end note

    note right of judging
        Submissions locked.
        Judges score assignments.
        AI reviews generated.
    end note
```

---

## States & Allowed Actions

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| `draft` | Initial creation. Not visible to public. | Edit config, set rubric, invite organizers, delete |
| `registration_open` | Participants can register teams and join. | Create/join teams. Organizer can edit non-critical fields |
| `registration_closed` | Registration ended. Teams are finalized. | No new teams. Organizer prepares for start |
| `active` | Hackathon is running. Submissions accepted. | Push code, submit via tag, connect repos |
| `judging` | Submission deadline passed. Judges score. | Score submissions, generate AI reviews |
| `completed` | All judging finished. Results visible. | View leaderboard, download results |
| `archived` | Read-only historical record. | View only. Data preserved indefinitely |

---

## Transition Rules

```mermaid
flowchart TD
    A["draft → registration_open"] --> A1["Preconditions:<br/>- title set<br/>- description set<br/>- deadlines set<br/>- >= 1 rubric criterion"]

    B["registration_open → registration_closed"] --> B1["Trigger:<br/>- DO alarm at registration_closes<br/>- OR manual organizer action"]

    C["registration_closed → active"] --> C1["Trigger:<br/>- Manual organizer action<br/>Preconditions:<br/>- >= 1 registered team"]

    D["active → judging"] --> D1["Trigger:<br/>- DO alarm at submission_deadline<br/>- OR Cron hourly check<br/>Preconditions:<br/>- submission_deadline has passed"]

    E["judging → completed"] --> E1["Trigger:<br/>- All assigned judges submitted scores<br/>- OR organizer forces finalization"]

    F["completed → archived"] --> F1["Trigger:<br/>- Manual organizer action<br/>Effect:<br/>- Data becomes read-only"]
```

### Valid Transitions (Source of Truth)

```typescript
const HACKATHON_STATUS_TRANSITIONS = {
  draft:               ['registration_open'],
  registration_open:   ['registration_closed'],
  registration_closed: ['active'],
  active:              ['judging'],
  judging:             ['completed'],
  completed:           ['archived'],
  archived:            [],  // Terminal state
};
```

**Enforcement**: Attempting any transition not in this map returns `INVALID_TRANSITION` error. No backward transitions, no state skipping.

---

## Durable Object: HackathonStateMachine

One DO instance per hackathon, addressed by hackathon ID. This is the **single source of truth** for:

1. Current phase/status
2. Submission locking (exactly-once acceptance)
3. Deadline enforcement via alarms
4. Phase transition validation

### Internal State (SQLite-backed)

```mermaid
erDiagram
    lifecycle_state {
        TEXT hackathon_id PK
        TEXT status
        TEXT config "JSON: deadlines, limits, flags"
        INT version "Optimistic concurrency"
        TEXT transitioned_at
    }

    submission_locks {
        TEXT team_id
        TEXT tag_name
        TEXT submission_id
        TEXT commit_sha
        TEXT webhook_delivery_id UK
        TEXT locked_at
    }

    team_submissions {
        TEXT team_id PK
        INT submission_count
    }
```

### DO HTTP Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/initialize` | Set initial config (deadlines, limits, tag pattern) |
| POST | `/transition` | Transition to target status (with optimistic concurrency `expectedVersion`) |
| GET | `/state` | Fetch current state |
| POST | `/accept-submission` | Lock a submission (exactly-once semantics) |
| GET | `/can-accept-submissions` | Check if submissions are currently accepted |

### Alarm Schedule

The DO uses Cloudflare's alarm API for deadline enforcement:

```mermaid
gantt
    title Hackathon Timeline & DO Alarms
    dateFormat YYYY-MM-DD

    section Alarms
    Registration closes  :milestone, a1, 2026-03-01, 0d
    Submission deadline   :milestone, a2, 2026-03-15, 0d
    Judging ends          :milestone, a3, 2026-03-22, 0d

    section Phases
    Draft                 :done, p1, 2026-02-01, 2026-02-15
    Registration Open     :active, p2, 2026-02-15, 2026-03-01
    Registration Closed   :p3, 2026-03-01, 2026-03-02
    Active                :p4, 2026-03-02, 2026-03-15
    Judging               :p5, 2026-03-15, 2026-03-22
    Completed             :p6, 2026-03-22, 2026-03-25
```

When an alarm fires:
1. Check which deadline passed
2. Auto-transition to the next state if preconditions met
3. Schedule the next upcoming alarm
4. Write transition audit event

### Optimistic Concurrency

State transitions use version-based optimistic concurrency:

```sql
UPDATE lifecycle_state
SET status = ?, version = version + 1, transitioned_at = ?
WHERE hackathon_id = ? AND version = ?
-- If rowsWritten = 0 → concurrent modification detected → retry
```

---

## CRUD Operations

### Create Hackathon

```mermaid
sequenceDiagram
    participant C as Client
    participant W as API Worker
    participant D1 as D1 Database
    participant DO as HackathonStateMachine

    C->>W: POST /api/v1/hackathons<br/>{ slug, title, description, dates... }
    W->>W: Validate via CreateHackathonRequestSchema
    W->>W: Generate slug if not provided
    W->>D1: INSERT INTO hackathons (status='draft')
    W->>D1: INSERT INTO organizer_roles (role='owner')
    W->>DO: POST /initialize (config)
    DO-->>W: OK
    W->>D1: INSERT audit_events (hackathon_created)
    W-->>C: 201 { ok: true, data: hackathon }
```

### Transition Phase

```mermaid
sequenceDiagram
    participant C as Client
    participant W as API Worker
    participant DO as HackathonStateMachine
    participant D1 as D1 Database

    C->>W: PATCH /api/v1/hackathons/:slug/status<br/>{ status: "registration_open" }
    W->>W: Verify role >= admin
    W->>DO: POST /transition { targetStatus, expectedVersion }
    DO->>DO: Validate transition is allowed
    DO->>DO: Check preconditions
    DO->>DO: Update state (optimistic concurrency)
    DO->>DO: Schedule next alarm
    DO-->>W: { success: true, newStatus }
    W->>D1: UPDATE hackathons SET status = ?
    W->>D1: INSERT audit_events (phase_transitioned)
    W-->>C: 200 { ok: true, data: { status } }
```

---

## Automated Transitions

### Cron Trigger (Hourly)

```mermaid
flowchart TD
    A["Cron fires (0 * * * *)"] --> B["Query: hackathons WHERE status = 'active'<br/>AND submission_deadline in [now, now+24h]"]
    B --> C{Any approaching?}
    C -->|No| D[Done]
    C -->|Yes| E["For each hackathon:"]
    E --> F{Deadline passed?}
    F -->|Yes| G["Transition active → judging<br/>(via DO)"]
    F -->|No| H{Within reminder window?}
    H -->|Yes| I["Enqueue deadline_reminder<br/>(if not already sent)"]
    H -->|No| D
    G --> J["Audit: phase_transitioned (actor: cron)"]
    I --> K["Audit: deadline_reminder_sent (actor: cron)"]
```

### DO Alarm (Precise)

The DO alarm fires at the exact deadline timestamp for immediate transitions. The hourly cron acts as a safety net in case the DO alarm fails.

---

## Hackathon Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `slug` | TEXT | auto-generated | URL-safe identifier |
| `title` | TEXT | required | Display name |
| `description` | TEXT | — | Markdown description |
| `rules_md` | TEXT | — | Competition rules (Markdown) |
| `registration_opens` | ISO-8601 | required | When registration starts |
| `registration_closes` | ISO-8601 | required | When registration ends |
| `submission_deadline` | ISO-8601 | required | Final submission cutoff |
| `judging_starts` | ISO-8601 | — | When judging opens |
| `judging_ends` | ISO-8601 | — | When judging closes |
| `min_team_size` | INT | 1 | Minimum members per team |
| `max_team_size` | INT | 5 | Maximum members per team |
| `max_teams` | INT | unlimited | Cap on total teams |
| `submission_tag_pattern` | TEXT | `submission_v%` | Git tag pattern for submissions |
| `max_submissions_per_team` | INT | unlimited | Submission version limit |
| `allow_late_submissions` | BOOL | false | Accept tags after deadline |
| `primary_color` | TEXT | `#6366f1` | Theme color |
| `logo_r2_key` | TEXT | — | R2 key for logo asset |
| `banner_r2_key` | TEXT | — | R2 key for banner asset |

---

## File References

| File | Purpose |
|------|---------|
| `apps/api/src/routes/hackathons.ts` | CRUD routes + phase transition endpoint |
| `apps/api/src/durable-objects/hackathon-state-machine.ts` | Core DO: state management, submission locking, alarms |
| `packages/shared/src/schemas/hackathon.ts` | Zod schemas for hackathon entity + requests |
| `packages/shared/src/schemas/constants.ts` | `HACKATHON_STATUS_TRANSITIONS` source of truth |
| `packages/db/src/schema/hackathons.ts` | Drizzle table definition |
| `apps/web/src/pages/hackathon-detail.tsx` | Frontend hackathon detail page |
| `apps/web/src/pages/dashboard.tsx` | Dashboard with hackathon list by status |
