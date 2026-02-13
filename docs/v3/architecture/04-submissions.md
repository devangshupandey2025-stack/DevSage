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

## v3 Planned Enhancements

### Multi-Artifact Submissions

Extend submissions beyond Git tags to support multiple artifact types. Each submission becomes a container that holds one or more artifacts: the Git tag (primary, required), a demo video (uploaded to R2), a pitch deck (PDF uploaded to R2), and a live demo URL. Artifacts are added incrementally via `POST /api/v1/hackathons/:slug/submissions/:id/artifacts`. The DO validates that the primary Git tag artifact exists before allowing finalization.

```mermaid
flowchart TD
    A["Team pushes git tag<br/>(primary artifact)"] --> B["Submission created<br/>via webhook pipeline"]
    B --> C["Team adds artifacts<br/>via dashboard"]
    C --> D["Upload demo video<br/>(R2, max 200MB)"]
    C --> E["Upload pitch deck<br/>(R2, PDF, max 50MB)"]
    C --> F["Set live demo URL<br/>(validated, HTTPS only)"]
    D & E & F --> G["All artifacts attached<br/>to submission record"]
    G --> H["Team leader finalizes<br/>submission"]

    subgraph Artifact Storage
        I["R2 bucket: devsage-submissions"]
        J["Key pattern: {hackathonId}/{teamId}/{artifactType}/{filename}"]
    end

    D --> I
    E --> I
    I --> J
```

| Artifact Type | Storage | Max Size | Format | Required |
|--------------|---------|----------|--------|----------|
| `git_tag` | GitHub (commit SHA pinned) | N/A | Git tag | Yes |
| `demo_video` | R2 | 200 MB | MP4, WebM | No |
| `pitch_deck` | R2 | 50 MB | PDF | No |
| `live_url` | D1 (URL string) | N/A | HTTPS URL | No |
| `screenshot` | R2 | 10 MB | PNG, JPG, WebP | No |

New table: `submission_artifacts` (id, submission_id, type, r2_key, url, filename, size_bytes, mime_type, uploaded_at).

### Submission Preview

Auto-generate a rich preview for each submission that judges can view without cloning the repo. The preview includes: rendered README (fetched from GitHub at the pinned commit SHA), repository statistics (commit count, contributor count, language breakdown), a contributor graph (commits per team member), and file tree snapshot. Previews are generated asynchronously via `PREVIEW_QUEUE` after submission acceptance and cached in KV with the commit SHA as the cache key.

| Component | Source | Cache |
|-----------|--------|-------|
| README render | GitHub API: `GET /repos/:owner/:repo/readme?ref=<sha>` | KV, keyed by `preview:{sha}:readme` |
| Repo stats | GitHub API: `GET /repos/:owner/:repo` + `/contributors` | KV, keyed by `preview:{sha}:stats` |
| Language breakdown | GitHub API: `GET /repos/:owner/:repo/languages` | KV, keyed by `preview:{sha}:langs` |
| Contributor graph | Computed from commit history (already tracked) | KV, keyed by `preview:{sha}:contributors` |
| File tree | GitHub API: `GET /repos/:owner/:repo/git/trees/<sha>?recursive=1` | KV, keyed by `preview:{sha}:tree` |

### Automated Validation Pipeline

Run configurable validation checks on each submission before it reaches judges. Organizers define validation rules during hackathon setup. The pipeline runs asynchronously via `VALIDATION_QUEUE` after submission acceptance. Each check produces a pass/fail result with a message. Failed checks do not reject the submission but flag it with warnings visible to judges.

| Check | Implementation | Default |
|-------|---------------|---------|
| README exists | GitHub API: check for README.md at pinned SHA | Enabled |
| Minimum commits | Count commits on default branch since hackathon start | >= 5 commits |
| CI passing | GitHub API: check commit status / check runs | Disabled (opt-in) |
| Minimum contributors | Count distinct commit authors | >= 2 (for teams > 1) |
| License file exists | GitHub API: check for LICENSE at pinned SHA | Disabled |
| Custom regex check | Match file contents against organizer-defined pattern | Disabled |

New table: `validation_results` (id, submission_id, check_name, status, message, checked_at).

### Submission Diff Viewer

Allow judges and team leaders to compare submission versions side-by-side. The diff viewer shows the Git diff between two tagged commits (e.g., `submission_v1` vs `submission_v2`), including file changes, additions, deletions, and a summary of what changed. The diff is fetched via the GitHub API (`GET /repos/:owner/:repo/compare/:base...:head`) and rendered in the frontend with syntax highlighting. Diffs are cached in KV to avoid repeated API calls.

| Property | Value |
|----------|-------|
| API | `GET /api/v1/hackathons/:slug/submissions/:id/diff?compareWith=:otherId` |
| GitHub API | `GET /repos/:owner/:repo/compare/:sha1...:sha2` |
| Cache | KV, keyed by `diff:{sha1}:{sha2}`, 24-hour TTL |
| Frontend | Side-by-side diff view with syntax highlighting (Monaco or custom) |
| Access | Team members (own submissions), judges (assigned submissions), admin+ (all) |

### Post-Deadline Grace Period with Penalty Scoring

Introduce a configurable grace period after the submission deadline during which teams can still submit, but with an automatic score penalty. The organizer sets `grace_period_minutes` and `grace_penalty_percent` on the hackathon configuration. Submissions received during the grace period are accepted with `is_grace_period = true` and the penalty percentage is applied to the final weighted score during leaderboard computation.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `grace_period_minutes` | INT | 0 (disabled) | Minutes after deadline that submissions are still accepted |
| `grace_penalty_percent` | REAL | 10.0 | Percentage deducted from final score for grace period submissions |
| `is_grace_period` | BOOL | false | Set on submission if received during grace window |

Leaderboard adjustment:
```sql
-- Grace period penalty applied during leaderboard computation
CASE WHEN sub.is_grace_period = 1
  THEN weighted_percentage * (1 - h.grace_penalty_percent / 100.0)
  ELSE weighted_percentage
END AS final_percentage
```

### Branch-Based Submissions

Offer branch-based submissions as an alternative to tag-based for hackathons where participants are less familiar with Git tags. The organizer configures `submission_mode` as either `tag` (default, current behavior) or `branch`. In branch mode, the team designates a submission branch (default: `main`), and the system captures the HEAD commit SHA at the submission deadline. The DO locks the commit SHA at deadline time rather than on tag push.

| Mode | Trigger | Commit Pinning | Versioning |
|------|---------|---------------|------------|
| `tag` (default) | Team pushes matching tag | SHA from tag event | Multiple tags = multiple versions |
| `branch` | Deadline passes | HEAD of designated branch at deadline | Single version (latest commit) |

```mermaid
flowchart TD
    A["Submission deadline fires<br/>(DO alarm)"] --> B{submission_mode?}
    B -->|tag| C["Lock existing tag-based<br/>submissions (current behavior)"]
    B -->|branch| D["For each team with<br/>a linked repo:"]
    D --> E["GitHub API: GET /repos/:owner/:repo/branches/:branch"]
    E --> F["Capture HEAD commit SHA"]
    F --> G["Create submission record<br/>with pinned SHA"]
    G --> H["POST commit status<br/>to GitHub"]
```

### Planned Feature Summary

| Feature | Priority | Complexity | New Tables / Columns | Key Dependencies |
|---------|----------|------------|---------------------|------------------|
| Multi-artifact submissions | High | High | `submission_artifacts` | R2 upload endpoints, presigned URLs |
| Submission preview | High | Medium | None (KV cache) | GitHub API, PREVIEW_QUEUE |
| Automated validation | Medium | Medium | `validation_results`, `validation_rules` | VALIDATION_QUEUE, GitHub API |
| Grace period scoring | Medium | Low | `hackathons.grace_period_minutes`, `hackathons.grace_penalty_percent`, `submissions.is_grace_period` | Leaderboard query adjustment |
| Diff viewer | Medium | Medium | None (KV cache) | GitHub compare API, frontend diff renderer |
| Branch-based submissions | Low | High | `hackathons.submission_mode`, `teams.submission_branch` | DO alarm-based capture, GitHub branch API |

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
