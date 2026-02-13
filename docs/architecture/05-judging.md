# 05 — Judging & Scoring

> Structured evaluation with configurable rubrics, weighted scoring, round-robin judge assignment, and an optional AI-assisted review layer. Scores are write-once, immutable, and linked to pinned submission snapshots.

**Related docs:** [Submissions](./04-submissions.md) | [Roles & Permissions](./06-roles-permissions.md) | [Audit Trail](./09-audit-trail.md)

---

## Judging Flow (End-to-End)

```mermaid
flowchart TD
    A["Admin configures rubric<br/>(draft or registration phase)"] --> B["Admin invites judges"]
    B --> C["Judges accept/decline invites"]
    C --> D["Hackathon transitions to 'judging'"]
    D --> E["Admin triggers auto-assignment<br/>(round-robin)"]
    E --> F["Judges receive assignments"]
    F --> G["Judge reviews submission<br/>(pinned commit SHA)"]
    G --> H["Judge scores per criterion"]
    H --> I{All judges scored?}
    I -->|No| F
    I -->|Yes| J["Leaderboard computed<br/>(weighted averages)"]
    J --> K["Admin transitions to 'completed'"]
    K --> L["Results visible to all"]
```

---

## 1. Rubric Configuration

Organizers define scoring criteria with weights during the `draft` or `registration_open` phase:

```mermaid
erDiagram
    hackathons ||--o{ rubric_criteria : defines

    rubric_criteria {
        TEXT id PK
        TEXT hackathon_id FK
        TEXT name "e.g., Innovation"
        TEXT description
        INT max_score "default: 10"
        REAL weight "default: 1.0"
        INT sort_order "display order"
    }
```

### Example Rubric

| Criterion | Max Score | Weight | Description |
|-----------|-----------|--------|-------------|
| Innovation | 10 | 2.0 | Originality of the idea and approach |
| Technical Execution | 10 | 1.5 | Code quality, architecture, completeness |
| User Experience | 10 | 1.0 | Design, usability, accessibility |
| Presentation | 10 | 0.5 | README quality, demo clarity |

**Operations:**
- `POST /api/v1/hackathons/:slug/rubric` — Bulk upsert (delete all existing, insert new). Only allowed in `draft` or `registration_open` status.
- `GET /api/v1/hackathons/:slug/rubric` — Public read (visible to judges and participants).

---

## 2. Judge Invitations

```mermaid
sequenceDiagram
    participant A as Admin
    participant W as API Worker
    participant D1 as D1 Database
    participant Q as NOTIFICATION_QUEUE
    participant J as Judge

    A->>W: POST /api/v1/hackathons/:slug/judges<br/>{ userId: "judge-uuid" }
    W->>D1: INSERT judges (invite_status='pending')
    W->>Q: Enqueue judge_invited notification
    W->>D1: INSERT audit_events (judge_invited)
    W-->>A: 201 { ok: true }

    Note over Q,J: Email sent to judge

    J->>W: POST /api/v1/hackathons/:slug/judges/:id/respond<br/>{ accept: true }
    W->>D1: UPDATE judges SET invite_status='accepted'
    W->>D1: INSERT audit_events (judge_responded)
    W-->>J: 200 { ok: true }
```

### Judge Invite States

```mermaid
stateDiagram-v2
    [*] --> pending : Admin invites
    pending --> accepted : Judge accepts
    pending --> declined : Judge declines
```

---

## 3. Round-Robin Assignment

When the admin triggers assignment, judges are distributed across teams:

```mermaid
flowchart TD
    A["Admin: POST .../judges/assign"] --> B["Fetch accepted judges"]
    B --> C["Fetch teams with submissions<br/>(prefer is_final=1)"]
    C --> D["Round-robin: each team gets<br/>min(3, judgeCount) reviewers"]
    D --> E["Batch INSERT judge_assignments"]
    E --> F["Enqueue judge_assignment notifications"]
```

### Assignment Algorithm

```
For each team[i]:
  For j in range(reviewsPerTeam):
    Assign judges[(i + j) % judges.length] to team[i]
```

This ensures:
- Every team gets reviewed by the same number of judges (up to 3)
- Workload is balanced across judges
- No judge reviews the same team twice (`UNIQUE(judge_id, team_id)`)

```mermaid
erDiagram
    judges ||--o{ judge_assignments : assigned_to
    teams ||--o{ judge_assignments : reviewed_by
    submissions ||--o{ judge_assignments : pinned_to

    judge_assignments {
        TEXT id PK
        TEXT judge_id FK
        TEXT team_id FK
        TEXT hackathon_id FK
        TEXT submission_id FK "pinned submission"
        TEXT status "pending|in_progress|completed"
        TEXT assigned_at
    }
```

---

## 4. Scoring

Judges score each criterion for each assigned submission. Scores are **write-once** — once submitted, they cannot be changed.

```mermaid
sequenceDiagram
    participant J as Judge
    participant W as API Worker
    participant SVC as JudgingService
    participant D1 as D1 Database

    J->>W: POST /api/v1/hackathons/:slug/scores<br/>{ submissionId, criteriaId, score, comment }
    W->>SVC: validateScoreSubmission()
    SVC->>SVC: 1. Judge exists and accepted?
    SVC->>SVC: 2. Criteria exists for this hackathon?
    SVC->>SVC: 3. Score in range [0, max_score]?
    SVC->>SVC: 4. Submission exists?
    SVC->>SVC: 5. Judge assigned to this team?
    SVC->>SVC: 6. Not a duplicate score?

    alt All validations pass
        SVC-->>W: Valid
        W->>D1: INSERT scores
        W->>D1: INSERT audit_events (score_submitted)
        W-->>J: 200 { ok: true }
    else Validation failed
        SVC-->>W: Error (specific reason)
        W-->>J: 400/403 { ok: false, error }
    end
```

### Score Validation (6-Step)

| Step | Check | Error Code |
|------|-------|------------|
| 1 | Judge exists and `invite_status = accepted` | `JUDGE_NOT_FOUND` |
| 2 | Criterion belongs to this hackathon | `CRITERIA_NOT_FOUND` |
| 3 | `0 <= score <= max_score` for this criterion | `SCORE_OUT_OF_RANGE` |
| 4 | Submission exists and belongs to hackathon | `SUBMISSION_NOT_FOUND` |
| 5 | Judge is assigned to the submission's team | `NOT_ASSIGNED` |
| 6 | No existing score for this (judge, submission, criterion) | `DUPLICATE_SCORE` |

### Score Immutability

The `UNIQUE(submission_id, judge_id, criteria_id)` constraint enforces one score per judge per criterion per submission. There is no update endpoint — scores are final.

---

## 5. Leaderboard

```mermaid
flowchart TD
    A["GET .../leaderboard"] --> B["Query: weighted score calculation"]
    B --> C["SUM(score × weight) / SUM(max_score × weight) × 100"]
    C --> D["Group by team, order descending"]
    D --> E["Return ranked results"]
```

### Weighted Score Formula

```sql
SELECT
  t.id, t.name,
  ROUND(
    SUM(s.score * rc.weight) / SUM(rc.max_score * rc.weight) * 100,
    2
  ) AS weighted_percentage,
  COUNT(DISTINCT s.judge_id) AS judges_completed
FROM scores s
  JOIN rubric_criteria rc ON s.criteria_id = rc.id
  JOIN submissions sub ON s.submission_id = sub.id
  JOIN teams t ON sub.team_id = t.id
WHERE sub.hackathon_id = ?
  AND sub.is_final = 1
GROUP BY t.id
ORDER BY weighted_percentage DESC
```

### Visibility Rules

| Viewer Role | Before `completed` | After `completed` |
|-------------|--------------------|--------------------|
| Participant | Own team's scores only | Full leaderboard |
| Judge | Own scores only | Full leaderboard |
| Admin+ | Full leaderboard | Full leaderboard |
| Anonymous | Nothing | Public leaderboard |

---

## 6. AI-Assisted Reviews

Optional, advisory-only layer. Never replaces or overrides judge scores.

```mermaid
flowchart TD
    A["Submission finalized"] --> B["Generate AI review<br/>(provider-agnostic)"]
    B --> C{AI provider available?}
    C -->|Yes| D["Analyze:<br/>- Commit history metadata<br/>- Diff statistics<br/>- README quality<br/>- Contributor attribution"]
    D --> E["Store review:<br/>- summary<br/>- strengths (JSON)<br/>- concerns (JSON)<br/>- raw_response"]
    C -->|No| F["Skip (fail-open)<br/>Judges proceed without AI"]
```

### AI Review Properties

| Property | Value |
|----------|-------|
| Provider | OpenAI-compatible endpoint (swappable) |
| Model | Configurable (default: `gpt-4o-mini`) |
| Timeout | 25 seconds (fail-open) |
| Reproducibility | Prompt hash stored for audit |
| Pinning | Tied to exact commit SHA |
| Caching | Same prompt + commit = cached response |
| Temperature | 0.3 (low variance for consistency) |

---

## Data Model

```mermaid
erDiagram
    hackathons ||--o{ judges : invites
    hackathons ||--o{ rubric_criteria : defines
    judges ||--o{ judge_assignments : assigned_to
    judge_assignments }o--|| teams : reviews
    judge_assignments }o--o| submissions : pinned_to
    submissions ||--o{ scores : receives
    rubric_criteria ||--o{ scores : scored_on
    judges ||--o{ scores : scored_by
    submissions ||--o{ ai_reviews : reviewed_by

    scores {
        TEXT id PK
        TEXT submission_id FK
        TEXT judge_id FK
        TEXT criteria_id FK
        INT score "0 to max_score"
        TEXT comment
        TEXT scored_at
    }

    ai_reviews {
        TEXT id PK
        TEXT submission_id FK
        TEXT commit_sha "pinned"
        TEXT provider
        TEXT model
        TEXT prompt_hash "SHA256"
        TEXT summary
        TEXT strengths "JSON array"
        TEXT concerns "JSON array"
        TEXT raw_response
        INT tokens_used
        TEXT created_at
    }
```

---

## File References

| File | Purpose |
|------|---------|
| `apps/api/src/routes/judging.ts` | All judging endpoints (587 LOC) |
| `apps/api/src/services/judging-service.ts` | Business logic: assignment, validation, leaderboard |
| `packages/shared/src/schemas/judge.ts` | `JudgeSchema`, `InviteJudgeRequestSchema` |
| `packages/shared/src/schemas/rubric.ts` | `RubricCriteriaSchema`, `BulkRubricRequestSchema` |
| `packages/shared/src/schemas/score.ts` | `ScoreSchema`, `SubmitScoreRequestSchema` |
| `packages/shared/src/schemas/judge-assignment.ts` | `JudgeAssignmentSchema` |
| `packages/shared/src/schemas/ai-review.ts` | `AiReviewSchema` |
| `packages/db/src/schema/judges.ts` | Judges table |
| `packages/db/src/schema/rubric-criteria.ts` | Rubric criteria table |
| `packages/db/src/schema/scores.ts` | Scores table |
| `packages/db/src/schema/judge-assignments.ts` | Assignment table |
| `packages/db/src/schema/ai-reviews.ts` | AI reviews table |
| `apps/web/src/pages/judge-dashboard.tsx` | Judge scoring UI |
| `apps/web/src/pages/leaderboard.tsx` | Leaderboard display |
