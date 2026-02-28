# Event Lead(s) — Hackathon Organizer User Flow

> Role: `organizer` (per-hackathon) | Display name: "Event Lead" | Scope: Per-hackathon | App: `platform.devsage.org`

---

## Who

Student coordinators who run hackathons day-to-day. Invited by Workspace Owners or Admins onto specific hackathons. Multiple Event Leads on a hackathon have equal permissions.

> **Note on naming:** The UI displays this role as "Event Lead." The database stores it as `organizer` in the per-hackathon role system.

---

## Flow

### 1. Onboarding

1. Receive invite from Workspace Admin for a specific hackathon
2. Click invite link → land on `platform.devsage.org`
3. Sign up or log in (Google OAuth or email/password)
4. Accept hackathon invite → now has access to that hackathon

### 2. Configuration (Draft Phase)

1. Log into Platform, select the hackathon
2. Configure operational details:
   - **Rounds** — define round names, numbers, and submission deadlines
   - **Rubric** — weighted scoring criteria per round (e.g., Innovation ×2.0, Execution ×1.5). Can differ between rounds
   - **Judges** — two methods:
     - **Email invite** — send invite link, judge signs up with their own password
     - **Create account** — create judge account with temporary credentials, judge must reset password on first login
   - **Settings** — registration mode, email domain restrictions, submission tag pattern, repo requirements, resubmission policy, timezone
   - **Theming** — adjust hackathon logo, colors, and copy (initial branding set by Platform Admin; Event Leads can tweak after handoff)
   - **Announcements** — pre-event communications

### 3. Participant Seeding (Private Hackathons)

For private hackathons, Event Lead uploads participant data. Two modes:

| Mode | Data | What Happens |
|------|------|--------------|
| **A: Full Structure** | Name, Email, Team Name, Role (lead/member) | Teams pre-created. Leaders invited first, then members |
| **B: Leaders Only** | Name, Email, Role (lead) | Leaders invited. They confirm/create teams, invite members |

### 4. Activation

1. Transition hackathon: **`draft → active`** (see State Machine below for guard conditions)
2. Submission deadline alarm is set in the Durable Object
3. Participants can now register, form teams, link GitHub repos, push submissions

### 5. Active Monitoring

During the active phase:

- **Teams** — view all teams, drill into details, enforce team size limits
- **Submissions** — review incoming git-tag-based submissions (auto-created via GitHub webhooks). Monitor submission pipeline health (see Webhook Pipeline below)
- **Activity** — audit log of all events (see Audit Log below)
- **Analytics** — real-time stats and metrics
- **Announcements** — post updates to participants (see Announcements below)
- **Leaderboard** — track standings

Can also:
- Change deadlines while hackathon is in draft or active
- Modify operational settings (not round structure once active — see guard conditions)

### 6. Judging Phase

1. Transition: **`active → judging`** (manual or auto via deadline alarm) — this opens the judging window for the current round
2. Assign judges to submissions (see Judge Assignment below)
3. Judges score against rubric on `judge.devsage.org`
4. Monitor scoring progress — dashboard shows scored/total per judge, flags incomplete judges
5. Handle incomplete scoring (see Incomplete Judging below)

Judging windows are tight 1-2 hour periods. The window opens when the hackathon enters `judging` state and closes when the Event Lead transitions out or the configured duration elapses.

### 7. Multi-Round Management

For hackathons with multiple rounds, the hackathon oscillates between `active` and `judging` states:

```
draft → active (R1 submissions) → judging (R1 scoring) → active (R2 submissions) → judging (R2 scoring) → ... → completed
```

Per round:
1. Hackathon is in `active` — current round's submission window is open
2. Transition to `judging` — closes submissions, opens scoring window
3. After scoring completes, publish round results — scores and rankings visible to all
4. **Optionally eliminate teams:**
   - Event Lead selects which teams advance (based on scores, cutoff, or manual selection)
   - Eliminated teams retain read-only access (leaderboard, announcements) but can't submit
5. **Optionally disqualify teams** — for rule violations (see Disqualification below)
6. Transition back to `active` — next round's submission window opens
7. Repeat until final round, then transition to `completed`

A hackathon can mix scored-only rounds (no elimination) with elimination rounds.

### 8. Completion

1. Transition: **`judging → completed`**
2. Publish final results — leaderboard becomes visible to participants
3. Optionally **archive** later (`completed → archived`)
4. Can **un-archive** if needed (`archived → completed`) for score corrections

---

## Permissions

| Action | Access |
|--------|--------|
| Configure hackathon | ✅ Primary responsibility |
| Manage rounds & rubric | ✅ Primary responsibility |
| Invite judges (invite link or create account) | ✅ Primary responsibility |
| Transition hackathon state | ✅ Primary responsibility |
| Monitor teams & submissions | ✅ Primary responsibility |
| Assign judges to submissions | ✅ Primary responsibility |
| Publish results | ✅ Primary responsibility |
| Eliminate teams after any round | ✅ Primary responsibility |
| View hackathon analytics | ✅ |
| Post announcements | ✅ |
| Upload participant data (private) | ✅ |
| Change deadlines (draft/active) | ✅ |
| Configure hackathon theming | ✅ |
| Billing & plan | ❌ |
| Invite workspace owners/admins | ❌ |
| Submit hackathon request | ❌ |
| Invite other event leads | ❌ |

---

## Key Constraints

- Scoped to specific hackathon(s) they're invited to, not the entire workspace
- Cannot manage workspace-level settings (billing, managers)
- Cannot approve or submit hackathon requests

---

## Hackathon State Machine

Single source of truth for hackathon lifecycle. Managed by the Durable Object.

### States

| State | Description |
|-------|-------------|
| `draft` | Configuration phase. Not visible to participants. Event Leads set up rounds, rubric, judges, settings, theming |
| `active` | Live. Participants register, form teams, submit. Current round's submission window is open |
| `judging` | Scoring window open for current round. Submissions locked. Judges score on `judge.devsage.org` |
| `completed` | All rounds finished. Final results published. Read-only for all roles |
| `archived` | Long-term storage. Same as completed but hidden from default listings |

### Transitions

| From | To | Trigger | Guard Conditions |
|------|----|---------|-----------------|
| `draft` | `active` | Event Lead (manual) | At least 1 round defined. Rubric has at least 1 criterion. At least 1 judge invited |
| `active` | `judging` | Event Lead (manual) or deadline alarm (auto) | Current round exists. At least 1 submission received for current round |
| `judging` | `active` | Event Lead (manual) | All assigned submissions scored OR Event Lead explicitly overrides (incomplete scores accepted). Round results published. More rounds remaining |
| `judging` | `completed` | Event Lead (manual) | Final round. All assigned submissions scored OR Event Lead overrides. Final results published |
| `completed` | `archived` | Event Lead or Workspace Owner/Admin (manual) | None |
| `archived` | `completed` | Event Lead or Workspace Owner/Admin (manual) | None — used for score corrections |

### Disallowed Transitions

- **`active → draft`** — not allowed. If config is wrong, Event Lead edits settings in-place while active (deadlines, tag pattern, etc.) or contacts Platform Admin for intervention
- **`judging → active` (same round)** — not allowed as a "restart scoring." Transition to active always advances to the next round. To fix scoring issues, Event Lead extends the judging window or reassigns submissions
- **`completed → active/judging`** — not allowed. Use `archived → completed` for corrections, or Platform Admin intervention for exceptional cases
- Any backward jump skipping states — not allowed

### What Event Leads Can Edit Per State

| Setting | Draft | Active | Judging | Completed |
|---------|-------|--------|---------|-----------|
| Round structure (add/remove/reorder) | ✅ | ❌ | ❌ | ❌ |
| Round deadlines | ✅ | ✅ (current + future) | ❌ | ❌ |
| Rubric criteria & weights | ✅ | ✅ (future rounds) | ❌ | ❌ |
| Judges | ✅ | ✅ | ✅ (reassign only) | ❌ |
| Settings (registration, tag pattern) | ✅ | ✅ | ❌ | ❌ |
| Theming | ✅ | ✅ | ✅ | ✅ |
| Announcements | ✅ | ✅ | ✅ | ✅ |

---

## Round Lifecycle

Rounds do not have independent state machines. Instead, the hackathon's state determines which round is "current," and the hackathon oscillates between `active` and `judging` for each round.

### Round Tracking

Each round has:
- **Number** (1, 2, 3...) — defines order
- **Name** (e.g., "Preliminary", "Semifinal", "Final")
- **Submission deadline** — when submissions close for this round
- **Judging window duration** — how long judges have to score (default: 2 hours)
- **Status** (derived, not stored): `upcoming` | `submissions_open` | `judging` | `scored`

### How Rounds Progress

1. When hackathon enters `active`, round 1 becomes `submissions_open`
2. When hackathon enters `judging`, current round becomes `judging`
3. When Event Lead publishes results and transitions back to `active`, the round becomes `scored` and the next round becomes `submissions_open`
4. Previous round scores are **locked** once published — no further edits

### Single-Round Hackathons

Most hackathons have 1 round: `draft → active → judging → completed`. The multi-round oscillation doesn't apply.

---

## Judge Assignment

### Algorithm Options

| Method | How It Works |
|--------|-------------|
| **Manual** | Event Lead selects which judges review which submissions. Full control |
| **Auto-assign (round-robin)** | System distributes submissions across judges evenly. Respects declared conflicts. Balances by count — each judge gets ±1 of the same number of submissions |

### Rules

- **Minimum judges per submission**: configurable per hackathon (default: 2, minimum: 1)
- **Maximum judges per submission**: no hard limit, but auto-assign targets the configured minimum
- A judge can be assigned to any number of submissions (up to all of them)
- Late-flagged submissions are assigned the same as on-time submissions — the late flag is metadata, not a routing decision
- If a judge declares a conflict post-assignment, the Event Lead is notified and must manually reassign that submission (auto-assign does not re-run automatically)

### Assignment Timing

- Assignments happen after the hackathon enters `judging` state
- Event Lead can assign before the judging window opens (pre-assign) or after
- Assignments can be modified at any time during the judging window

---

## Scoring Aggregation

### Per-Submission Scoring

Each judge scores every assigned submission against all rubric criteria. A single judge's score for one submission:

```
judge_total = Σ (criterion_score × criterion_weight) for all criteria
```

### Multi-Judge Aggregation

When multiple judges score the same submission:

1. **Per-criterion average**: for each criterion, average the scores across all judges who scored it
2. **Weighted sum**: apply rubric weights to the per-criterion averages
3. **Final score** = weighted sum of averaged criteria

```
submission_score = Σ (avg(judge_scores_for_criterion) × criterion_weight)
```

### Outlier Detection

If any judge's total score for a submission differs from the median of all judges' totals by more than **30%** of the scoring range, the submission is flagged for Event Lead review. The Event Lead can:
- Accept all scores as-is
- Exclude the outlier judge's scores for that submission
- Reassign the submission to an additional judge for a tiebreaker

### Edge Cases

- If only 1 judge scores a submission (due to conflicts or incomplete judging), that judge's scores are used directly — no averaging
- If 0 judges score a submission, it appears as "unscored" on the results dashboard and is excluded from rankings until resolved

---

## Incomplete Judging

When the judging window closes and a judge hasn't scored all assigned submissions:

### What Happens

1. **Submitted scores are locked** — whatever the judge submitted is final
2. **Unscored submissions are flagged** — Event Lead sees a list of submissions with fewer than the minimum required judge scores
3. The Event Lead has three options:
   - **Extend the window** — reopen the judging window (sets a new close time). All judges can continue scoring (including revising already-submitted scores)
   - **Reassign** — assign the unscored submissions to a different judge. The new judge scores during the extended window
   - **Accept partial coverage** — proceed with fewer judge scores than configured minimum. The submission's final score is computed from whatever scores exist

### Prevention

- Dashboard shows real-time scoring progress per judge (completed / assigned)
- Event Lead can send reminder notifications to judges who haven't started or are behind

---

## Disqualification

### Flow

1. Event Lead navigates to team detail on the Platform
2. Selects "Disqualify" action
3. **Reason required** — free text (e.g., "Plagiarism detected", "Violated code of conduct")
4. Confirmation dialog — action is significant
5. On confirm:
   - Team status set to `disqualified`
   - Team can no longer submit for any round
   - Team retains read-only access (dashboard, leaderboard, announcements)
   - Existing submissions remain in the system but are excluded from rankings
   - Audit event logged with reason and who disqualified
6. **Reversible** — Event Lead can reverse a disqualification (also audited, reason required)

### Visibility

- Disqualified teams see a banner on their dashboard explaining the status
- Other participants do not see which teams were disqualified — the team simply doesn't appear in rankings
- Event Lead and Workspace Owners/Admins can see all disqualified teams and reasons

---

## Announcements

### Data Model

An announcement contains:

| Field | Type | Required |
|-------|------|----------|
| Title | Text (max 200 chars) | Yes |
| Body | Rich text (Markdown) | Yes |
| Target | `all` / `round:<n>` / `team:<id>` | Yes (default: `all`) |
| Pinned | Boolean | No (default: false) |
| Created by | User ID (Event Lead) | Auto |
| Created at | UTC timestamp | Auto |
| Updated at | UTC timestamp | Auto (on edit) |

### Behavior

- **Broadcast** (`all`) — visible to all participants in the hackathon
- **Round-targeted** (`round:<n>`) — visible only to teams still active in that round (not eliminated)
- **Team-targeted** (`team:<id>`) — visible only to that team (for private communications)
- Announcements can be **edited** or **deleted** after posting (both audited)
- Displayed in reverse chronological order. Pinned announcements always appear at the top
- No attachments — link to external resources if needed

### Notifications

When an announcement is posted, participants receive an in-app notification. Email notifications are sent only for announcements marked as "email-worthy" by the Event Lead (checkbox on post).

---

## Team Size Enforcement

### Configuration

Event Lead sets per-hackathon:
- **Minimum team size** (default: 1, i.e., solo allowed)
- **Maximum team size** (default: 5)

### Enforcement Points

| Action | Check |
|--------|-------|
| Join team (invite or code) | Rejected if team is at max size. Error: `TEAM_FULL` |
| Submit (tag push) | If team is below minimum size, submission is **accepted but flagged** as "undersized team." Event Lead decides whether to allow it in scoring |
| Create team | Always allowed (team of 1). No minimum enforced at creation |

### Edge Case

If a member leaves and the team drops below minimum mid-hackathon, no automatic action is taken. The team continues but any new submission is flagged.

---

## Webhook Pipeline

### Happy Path

1. Participant pushes a git tag matching the submission pattern
2. GitHub sends `create` event (ref type: tag) to `api.devsage.org/webhooks/github`
3. API validates webhook signature (HMAC SHA-256)
4. Queue handler processes the event:
   - Validates tag pattern matches configured submission pattern
   - Checks hackathon is in `active` state and current round is accepting submissions
   - Durable Object locks submission (exactly-once via idempotency key: `{hackathon_id}:{team_id}:{round}:{tag}`)
   - Submission record created in D1
5. Participant sees submission on their dashboard (status: `received`)

### Failure Handling

| Failure | Behavior |
|---------|----------|
| Webhook signature invalid | Rejected immediately. No record created. Not retried |
| D1 write fails | Queue message is retried (Cloudflare Queues built-in retry with backoff, max 3 attempts). If all retries fail, message goes to dead-letter queue |
| Durable Object unavailable | Queue retry handles this — DO will recover. If persistent, dead-letter |
| Duplicate webhook delivery | Idempotency key in DO prevents duplicate submissions. Second delivery is a no-op |
| Tag doesn't match pattern | Silently ignored — not every tag is a submission |
| Hackathon not in `active` state | Submission rejected. Error stored. Participant sees "submission rejected: hackathon not accepting submissions" |

### Dead-Letter Queue

Messages that exhaust all retries land in a dead-letter queue. Platform Admins can:
- View dead-letter messages on the Admin Dashboard
- Replay individual messages after fixing the underlying issue
- Discard messages that are no longer relevant

### Participant Feedback

Submission status on the participant dashboard:

| Status | Meaning |
|--------|---------|
| `received` | Webhook received, submission recorded |
| `processing` | Webhook received, still in queue (visible if processing takes > 5 seconds) |
| `rejected` | Submission invalid (wrong pattern, wrong state, undersized team) — reason shown |
| `failed` | Pipeline error — participant should re-push the tag. If persistent, contact Event Lead |

### Repo Health Monitoring

The platform monitors repo connectivity:
- **GitHub App installed**: checked on team dashboard load. If uninstalled, warning banner: "GitHub App disconnected — submissions will not be recorded"
- **Repo visibility**: checked via GitHub API periodically (on dashboard load, not polling). If public, warning banner: "Repo is public — should be private during hackathon"
- These are **warnings, not blocks** — the platform doesn't force-private a repo or force-install the app

---

## Timezone Handling

- All deadlines stored in **UTC** in the database
- Hackathon has a configured **display timezone** (e.g., `Asia/Kolkata`, `America/New_York`)
- All deadline displays on participant and judge interfaces use the hackathon's display timezone
- Platform app (Event Leads) shows both UTC and display timezone for deadlines
- For online hackathons spanning multiple timezones: the configured display timezone governs. Participants in other timezones see the same deadline (in the hackathon's timezone, not their local one)
- Deadline enforcement is always against UTC — display timezone is cosmetic only

---

## Notification Events

| Event | Channel | Recipient |
|-------|---------|-----------|
| Workspace invite sent | Email | Invited user |
| Hackathon request approved/rejected | Email + in-app | Workspace Owner/Admin who submitted |
| Hackathon invite (Event Lead) | Email | Invited Event Lead |
| Hackathon invite (participant, private) | Email | Invited participant |
| Judge invite | Email | Invited judge |
| Team invite | Email | Invited member |
| Hackathon activated (`draft → active`) | In-app | Event Leads on the hackathon |
| Submission received | In-app | Team members |
| Submission rejected/failed | In-app | Team Leader |
| Judging window opened | Email + in-app | Assigned judges |
| Judging window closing soon (15 min) | In-app | Judges with unscored submissions |
| Round results published | Email + in-app | All participants |
| Team eliminated | In-app | Team members |
| Team disqualified | In-app | Team members |
| Announcement posted (if email-worthy) | Email + in-app | Targeted participants |
| Announcement posted (default) | In-app only | Targeted participants |
| Password reset | Email | Requesting user |
| Judge incomplete scoring alert | In-app | Event Lead |

### Channels

- **Email**: transactional emails via SMTP (provider configured in API env). Templates are plain HTML with hackathon branding
- **In-app**: notification bell on the relevant app (platform, judge, participant). Stored in `notifications` table. Mark-as-read support

---

## Audit Log

### What Is Audited

Every state-changing operation is logged. Key events include:

| Category | Events |
|----------|--------|
| Hackathon lifecycle | State transitions, setting changes, round CRUD, rubric changes |
| Teams | Creation, member join/leave, leader transfer, elimination, disqualification |
| Submissions | Received, rejected, marked final/not-final, late-flagged |
| Judging | Judge assignment, score submission, score revision, conflict declared, window open/close |
| Users | Registration, login, password reset, role changes |
| Invites | Sent, accepted, expired, revoked |
| Announcements | Created, edited, deleted |
| Admin actions | Workspace creation, hackathon request review, intervention, backfill |

### Audit Record Schema

| Field | Description |
|-------|-------------|
| `id` | UUID |
| `hackathon_id` | Nullable — null for platform-level events |
| `actor_id` | User who performed the action |
| `action` | Event type string (e.g., `hackathon.state_transition`, `team.member_joined`) |
| `target_type` | Entity type (hackathon, team, submission, user, etc.) |
| `target_id` | Entity ID |
| `metadata` | JSON — action-specific details (e.g., `{from: "active", to: "judging"}`) |
| `ip_address` | Actor's IP |
| `timestamp` | UTC ISO-8601 |
| `hash` | SHA-256 hash chaining previous record's hash + current record content |
| `previous_hash` | Hash of the previous audit record (forms the chain) |

### Access by Role

| Role | Access |
|------|--------|
| Event Lead | View audit events for their hackathon(s) only |
| Workspace Owner/Admin | View audit events for all hackathons in their workspace |
| Platform Admin | View all audit events platform-wide. Can trigger hash backfill |
| Participants | No direct audit access (they see the effect via dashboard) |
| Judges | No audit access |

---

## Identity Model

Single user record across all apps. One `users` table, multiple auth methods.

### Auth Methods by App

| App | Primary Auth | Secondary Auth |
|-----|-------------|---------------|
| `devsage.org` (participants) | GitHub OAuth | — |
| `platform.devsage.org` (organizers) | Google OAuth | Email/password |
| `judge.devsage.org` (judges) | Email/password | — |
| `shikdd.devsage.org` (admins) | Google OAuth | Email/password |

### Multi-Role Users

A person who fills multiple roles (e.g., Workspace Admin in one hackathon and participant in another) has **one user account** with multiple auth methods linked. The role system is per-hackathon/per-workspace, not per-account.

- First login creates the account with whatever auth method was used
- Additional auth methods can be linked from profile settings (e.g., a participant who later becomes a judge links their email/password)
- The same email address across auth providers resolves to the same user record (email is the unifying key)

### Constraints

- A user cannot hold conflicting roles on the **same** hackathon (e.g., cannot be both a judge and a participant on the same hackathon)
- A user CAN be a participant on hackathon A and a judge on hackathon B
- A Workspace Owner/Admin inherits access to all hackathons in their workspace regardless of per-hackathon role assignments

---

## Hackathon Page Content States

What visitors and participants see at `devsage.org/hackathons/:slug` depends on hackathon state and user auth:

| State | Not Logged In (Visitor) | Logged In (Not Registered) | Registered Participant |
|-------|------------------------|---------------------------|----------------------|
| `draft` | 404 (page not visible) | 404 | 404 |
| `active` | Landing page: title, description, dates, sponsors, register CTA | Same + register button active | Participant dashboard (team, repo, submissions, rounds) |
| `judging` | Landing page: "Judging in progress" | Same | Dashboard (read-only, "judging in progress" banner) |
| `completed` | Results page: leaderboard, winning teams | Same | Dashboard + full results + leaderboard |
| `archived` | Same as completed (or 404 if delisted by Platform Admin) | Same | Same as completed |

- Public hackathons appear in the `devsage.org/hackathons` directory when in `active`, `judging`, or `completed` state
- Private hackathons never appear in the directory regardless of state — accessible only via direct link
- Draft hackathons are never publicly accessible — only Event Leads see them on the Platform app
