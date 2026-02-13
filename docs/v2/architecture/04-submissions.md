# 04 — Submissions & Locking

> Teams submit by pushing a Git tag matching a configurable pattern. A Durable Object guarantees exactly-once acceptance per team via single-writer locking. No forms, no uploads, no manual intervention.

**Related docs:** [Hackathon Lifecycle](./02-hackathon-lifecycle.md) | [Webhooks & GitHub](./07-webhooks-integrations.md) | [Judging](./05-judging.md)

---

## Submission Flow (End-to-End)

```mermaid
sequenceDiagram
    participant D as Developer
    participant GH as GitHub
    participant WH as Webhook Handler
    participant Q as WEBHOOK_QUEUE
    participant TC as Tag Create Handler
    participant DO as HackathonStateMachine DO
    participant D1 as D1 Database

    D->>GH: git tag submission_v1 && git push --tags
    GH->>WH: POST /webhooks/github<br/>(create event, ref_type=tag)
    WH->>WH: Verify HMAC signature
    WH->>WH: normalizeGitHubEvent()
    WH->>Q: Enqueue tag_created event
    WH-->>GH: 202 Accepted

    Q->>TC: Consume message
    TC->>D1: Find team by repo_full_name
    TC->>D1: Get hackathon config (tag pattern)
    TC->>TC: matchSubmissionTag("submission_v1", "submission_v%")

    alt Tag matches pattern
        TC->>D1: Check idempotency (webhook_delivery_id)
        TC->>DO: POST /accept-submission
        DO->>DO: Validate: hackathon in 'active' phase?
        DO->>DO: Validate: before deadline? (or late allowed?)
        DO->>DO: Validate: max submissions not exceeded?
        DO->>DO: Validate: webhook_delivery_id not duplicate?

        alt All checks pass
            DO->>DO: Lock submission in SQLite state
            DO-->>TC: { accepted: true }
            TC->>D1: INSERT submission (status: 'received')
            TC->>GH: POST commit status ✅ "Submission received"
            TC->>Q: Enqueue submission_received notification
        else Validation failed
            DO-->>TC: { accepted: false, reason: "..." }
            TC->>D1: INSERT submission (status: 'invalid')
            TC->>GH: POST commit status ❌ "Rejected: reason"
        end
    else Tag doesn't match pattern
        TC->>TC: Ignore (not a submission tag)
    end
```

---

## Exactly-Once Locking

The Durable Object guarantees that even if GitHub delivers the same webhook 3 times concurrently, only one submission is accepted:

```mermaid
flowchart TD
    A["Tag create webhook arrives<br/>(possibly 3x concurrently)"] --> B["Queue consumer<br/>deserializes event"]
    B --> C{"webhook_delivery_id<br/>already in submissions?"}
    C -->|YES| D["Return (idempotent no-op)"]
    C -->|NO| E["Call DO.acceptSubmission()"]
    E --> F{"DO validates<br/>(single-threaded)"}

    F --> F1["Is hackathon in 'active' phase?"]
    F --> F2["Is it before deadline?<br/>(or late allowed?)"]
    F --> F3["Has team exceeded<br/>max submissions?"]
    F --> F4["Is webhook_delivery_id<br/>already locked?"]

    F1 & F2 & F3 & F4 --> G{"All checks pass?"}
    G -->|YES| H["Lock in DO SQLite state<br/>Write to D1 as 'received'"]
    G -->|NO| I["Return rejected + reason<br/>Write to D1 as 'invalid'"]

    style D fill:#888,color:#fff
    style H fill:#2d8a4e,color:#fff
    style I fill:#cf222e,color:#fff
```

**Why Durable Objects?** The DO's single-threaded execution model prevents all race conditions. Even with concurrent webhook deliveries, submissions are serialized through one DO instance per hackathon.

---

## Submission States

```mermaid
stateDiagram-v2
    [*] --> received : Tag accepted by DO
    [*] --> invalid : Validation failed

    received --> validated : Validation passes
    received --> invalid : Validation fails

    validated --> locked : Marked as final
    locked --> under_review : Judge assigned
    under_review --> scored : All criteria scored
    scored --> [*]

    invalid --> [*]
    received --> invalidated : Force push detected
    validated --> invalidated : Force push detected
    invalidated --> [*]
```

| Status | Description |
|--------|-------------|
| `received` | Tag accepted by DO, written to D1 |
| `validated` | Additional validation passed (README check, etc.) |
| `invalid` | Failed validation (deadline, max submissions, pattern mismatch) |
| `locked` | Marked as team's final submission |
| `under_review` | Assigned to judge(s) |
| `scored` | All assigned judges have scored |
| `invalidated` | Retroactively invalidated (force push detected) |

---

## Tag Pattern Matching

Teams submit by pushing a Git tag that matches the hackathon's `submission_tag_pattern`:

| Pattern | Example Tags | Match? |
|---------|-------------|--------|
| `submission_v%` | `submission_v1`, `submission_v2`, `submission_v10` | Yes |
| `submission_v%` | `release_v1`, `submission_`, `submission_vX` | No |
| `final_%` | `final_v1`, `final_submission` | Yes |

The `%` wildcard matches any sequence of characters (SQL LIKE semantics). The version number is extracted from the matched portion.

---

## Submission Versioning

Teams can submit multiple versions (if `max_submissions_per_team` allows):

```mermaid
flowchart LR
    A["submission_v1<br/>(version: 1)"] --> B["submission_v2<br/>(version: 2)"]
    B --> C["submission_v3<br/>(version: 3, is_final: true)"]

    style C fill:#2d8a4e,color:#fff
```

- Each tag creates a new submission record with an incrementing `version`
- Only one submission can be `is_final = true` per team
- Team leader manually marks a submission as final via `POST .../submissions/:id/finalize`
- If no submission is manually finalized, the latest is used for judging

---

## Late Submission Handling

```mermaid
flowchart TD
    A["Tag pushed after deadline"] --> B{allow_late_submissions?}
    B -->|true| C["Accept with is_late = true"]
    B -->|false| D["Reject: SUBMISSION_DEADLINE_PASSED"]
    C --> E["Visible to judges<br/>with 'late' badge"]
```

Late submissions are tracked with `is_late = true` and `submitted_at` (from GitHub event timestamp, not server receive time) for fairness.

---

## Deadline Enforcement

```mermaid
flowchart TD
    A["Submission arrives"] --> B["Check DO state"]
    B --> C{Hackathon status?}
    C -->|"Not 'active'"| D["Reject: HACKATHON_NOT_ACTIVE"]
    C -->|"'active'"| E{"Current time vs<br/>submission_deadline?"}
    E -->|Before| F["Accept normally"]
    E -->|After| G{allow_late_submissions?}
    G -->|true| H["Accept as late"]
    G -->|false| I["Reject: DEADLINE_PASSED"]
```

**Two enforcement layers:**
1. **DO alarm** — fires at exact deadline, transitions hackathon to `judging` state
2. **Cron trigger** — hourly safety net that catches any missed transitions

---

## Idempotency

Multiple layers prevent duplicate submission processing:

| Layer | Mechanism | Key |
|-------|-----------|-----|
| D1 | `UNIQUE(webhook_delivery_id)` on submissions | GitHub delivery ID |
| D1 | `UNIQUE(team_id, tag_name)` on submissions | Team + tag combo |
| DO | `UNIQUE(webhook_delivery_id)` in submission_locks | GitHub delivery ID |
| Handler | Pre-check query before DO call | `SELECT ... WHERE webhook_delivery_id = ?` |

---

## Commit Status Posting

After processing a submission, the API posts a commit status back to GitHub:

| Outcome | Status | Description |
|---------|--------|-------------|
| Accepted | `success` | "Submission submission_v1 received by DevSage" |
| Rejected | `failure` | "Submission rejected: Deadline passed" |
| Processing | `pending` | "Submission being processed..." |

This appears as a check on the tagged commit in GitHub's UI.

---

## Data Model

```mermaid
erDiagram
    teams ||--o{ submissions : submits
    hackathons ||--o{ submissions : contains
    submissions ||--o{ scores : receives
    submissions ||--o{ ai_reviews : reviewed_by

    submissions {
        TEXT id PK
        TEXT team_id FK
        TEXT hackathon_id FK
        TEXT tag_name "e.g., submission_v1"
        TEXT commit_sha "pinned at acceptance"
        TEXT commit_message
        TEXT commit_author
        TEXT branch "default: main"
        TEXT submitted_at "from GitHub event"
        TEXT received_at "server receive time"
        INT is_late "0 or 1"
        INT is_final "0 or 1"
        INT version "1, 2, 3..."
        TEXT status "received|validated|invalid|locked|..."
        TEXT validation_errors "JSON array"
        TEXT locked_at
        TEXT webhook_delivery_id UK "idempotency key"
    }
```

---

## File References

| File | Purpose |
|------|---------|
| `apps/api/src/routes/submissions.ts` | Submission query routes |
| `apps/api/src/queue/tag-create-handler.ts` | Core submission processing pipeline |
| `apps/api/src/durable-objects/hackathon-state-machine.ts` | Exactly-once locking via `acceptSubmission()` |
| `apps/api/src/lib/submission-tag.ts` | `matchSubmissionTag()` pattern matching |
| `apps/api/src/services/github.ts` | `postCommitStatus()` — fail-open |
| `packages/shared/src/schemas/submission.ts` | `SubmissionSchema` |
| `packages/db/src/schema/submissions.ts` | Submissions table definition |
| `apps/web/src/pages/team-management.tsx` | Submission status UI |
