# 05 — State Machines

All business logic state transitions. Forward-only unless explicitly noted.

---

## Hackathon Lifecycle

The core state machine. Managed by the `HackathonStateMachine` Durable Object.

```
draft → active → judging → completed → archived
                                    ↑         |
                                    └─────────┘
                                   (un-archive)
```

| From | To | Trigger | What Happens |
|------|----|---------|-------------|
| `draft` | `active` | Event Lead clicks "Activate" | DO alarm set for submission deadline; participants can register, form teams, submit |
| `active` | `judging` | Event Lead clicks "Start Judging" OR deadline alarm fires | Submissions locked; judges can score |
| `judging` | `completed` | Event Lead clicks "Complete" | Scores finalized; results publishable |
| `completed` | `archived` | Event Lead clicks "Archive" | Read-only state |
| `archived` | `completed` | Event Lead clicks "Un-archive" | **Only backward transition.** For score corrections |

### Transition Rules
- Requires **organizer** role minimum
- Uses **optimistic locking** via version number (prevents concurrent transitions)
- DO and D1 are synced — if they diverge, `/state` endpoint reports it
- `draft` hackathons can be deleted; others cannot
- Transition is atomic in the DO, then synced to D1

### Durable Object State
The DO stores 3 SQLite tables internally:
1. `lifecycle_state` — current status + version
2. `submission_locks` — exactly-once submission acceptance per tag (INSERT OR IGNORE)
3. `team_submissions` — submission counts per team

---

## Hackathon Request Pipeline

Workspace Managers submit requests; Platform Admins review them.

```
submitted → under_review → approved → building → ready
                        → rejected
                        → changes_requested → (resubmit) → submitted
```

| From | To | Who | What Happens |
|------|----|-----|-------------|
| — | `submitted` | Workspace Manager | Creates request record |
| `submitted` | `under_review` | Platform Admin | Admin starts reviewing |
| `under_review` | `approved` | Platform Admin | Approved, awaiting deployment |
| `under_review` | `rejected` | Platform Admin | Rejected with reason |
| `under_review` | `changes_requested` | Platform Admin | Sent back with notes |
| `approved` | `building` | Platform Admin | Frontend being deployed |
| `building` | `ready` | Platform Admin | **Auto-creates hackathon in `draft` state.** DO initialized, audit logged |
| `changes_requested` | `submitted` | Workspace Manager | Resubmits with changes |

Each transition appends to `statusHistory` JSON array: `{status, timestamp, notes}`.

---

## Round States

Each round progresses independently within a hackathon.

```
upcoming → active → judging → completed
```

| From | To | Trigger |
|------|----|---------|
| `upcoming` | `active` | Hackathon enters `active` state; round deadline in future |
| `active` | `judging` | Submission deadline passes or manual transition |
| `judging` | `completed` | Results published |

### Round Types
| Type | After Judging |
|------|--------------|
| `elimination` | Event Lead selects advancing teams. Remaining are eliminated. |
| `scoring_only` | All teams scored and ranked. Everyone proceeds. |

A hackathon can mix round types: Round 1 (scoring_only) → Round 2 (elimination) → Round 3 (scoring_only).

---

## Team States

```
forming → ready → submitted → dissolved
```

| From | To | Trigger |
|------|----|---------|
| `forming` | `ready` | Team meets min_team_size |
| `ready` | `submitted` | Team submits (tag detected) |
| `submitted` | `dissolved` | Team disbanded (after elimination) |
| `forming` | `dissolved` | Team disbanded before completion |

### Team Rules
- One team per participant per hackathon
- Team Leader cannot leave
- Members cannot leave mid-hackathon (once active)
- Only eliminated teams can be dissolved during a hackathon

---

## Submission States

```
pending_validation → validated
                   → failed_validation
                   → tag_deleted
```

| From | To | Trigger |
|------|----|---------|
| — | `pending_validation` | Git tag webhook received, DO lock acquired |
| `pending_validation` | `validated` | Tag pattern matches, commit valid |
| `pending_validation` | `failed_validation` | Tag pattern mismatch or validation error |
| any | `tag_deleted` | Git tag deleted webhook received |

### Submission Rules
- Exactly-once via DO lock (INSERT OR IGNORE on delivery_id)
- `isCurrent = 1` marks the active submission per team per round
- If `allowResubmission = true`, new submission replaces previous as current
- Late submissions accepted but flagged (submitted_at > deadline)

---

## Judge Invite States

```
pending → accepted
        → declined
```

### Judge Assignment States

```
assigned → completed
         → conflict
```

| From | To | Trigger |
|------|----|---------|
| `assigned` | `completed` | Judge submits scores for this assignment |
| `assigned` | `conflict` | Judge declares COI |
| `conflict` | (reassigned) | Event Lead reassigns to different judge |

---

## Workspace Invite States

```
pending → accepted
        → declined
        → expired
        → revoked
```

## Team Invite States

```
pending → accepted
        → declined
        → expired
```

---

## Notification Types (20+)

Processed by the `devsage-notifications` queue:

| Type | Recipient | Channel |
|------|-----------|---------|
| `judge.invited` | Judge | Email + In-App |
| `submission.received` | Team + Organizers | In-App |
| `submission.validated` | Team | In-App |
| `submission.tag_deleted` | Team + Organizers | In-App |
| `force_push_detected` | Organizers | In-App |
| `team_joined` | Team Leader | In-App |
| `deadline_reminder` | All participants | In-App |
| `hackathon.judging_started` | Judges + Participants | Email + In-App |
| `results.published` | All participants | Email + In-App |
| `hackathon.request.submitted` | Platform Admins | In-App |
| `hackathon.request.under_review` | Requester | In-App |
| `hackathon.request.approved` | Requester | Email + In-App |
| `hackathon.request.rejected` | Requester | Email + In-App |
| `hackathon.request.changes_requested` | Requester | Email + In-App |
| `hackathon.request.building` | Requester | In-App |
| `hackathon.request.ready` | Requester | Email + In-App |

All notifications use idempotency keys to prevent duplicates.
