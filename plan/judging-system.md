# Judging & Scoring System — Cross-Functional Feature Document

> **Last updated:** 2025-07-18
> **Packages:** `apps/api` · `apps/judge` · `packages/db` · `packages/shared`
> **Key files:** `apps/api/src/routes/judging.ts` · `apps/api/src/routes/judge-portal.ts` · `apps/api/src/services/judging-service.ts` · `apps/judge/src/pages/judge-scoring.tsx`

---

## 1. Overview

The Judging & Scoring system enables hackathon organizers to define evaluation rubrics, invite judges, auto-assign submissions, collect scores, and publish ranked results. It spans the full stack:

| Layer | Package | Responsibility |
|-------|---------|---------------|
| Database | `packages/db` | 6 tables: `judges`, `judge_assignments`, `judge_tracks`, `scores`, `rubric_criteria`, `round_results` |
| Validation | `packages/shared` | Zod schemas for invites, assignments, scores, track assignments |
| API | `apps/api` | 22+ endpoints across `judging.ts` (organizer + judge) and `judge-portal.ts` (judge dashboard) |
| Frontend | `apps/judge` | Standalone React SPA at `judge.devsage.org` — invite acceptance, scoring UI, leaderboard |

### Actors

| Actor | Actions |
|-------|---------|
| **Organizer / Co-organizer** | Create rubric, invite judges, trigger auto-assignment, manage COI, publish results |
| **Judge** | Accept invite, view assignments, score submissions, declare conflicts of interest |
| **System** | Auto-assign via round-robin, cache leaderboard, send invite emails via queue |

---

## 2. Judging Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Rubric    │────▶│  2. Invite   │────▶│  3. Accept   │────▶│  4. Transition│
│  Creation     │     │  Judges      │     │  Invite      │     │  to Judging   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  8. Publish   │◀────│  7. Leader-  │◀────│  6. Score    │◀───────────┘
│  Results      │     │  board       │     │  Submissions │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 ▲
                                          ┌──────────────┐
                                          │  5. Auto-    │
                                          │  Assign      │
                                          └──────────────┘
```

### Step-by-step

1. **Rubric Creation** — Organizer defines criteria (name, description, max_score, weight, sort_order) via `POST /api/v1/hackathons/:slug/judging/rubric`. Criteria can be scoped to a specific track and round.

2. **Invite Judges** — Organizer sends invites via `POST .../judging/judges` (single) or `POST .../judging/judges/bulk` (up to 50). Each invite generates a cryptographically secure 64-char hex token and enqueues a `judge.invited` notification email. Alternatively, organizers can create judge accounts directly with `POST .../judging/judges/create-account` (sets `password_must_change` flag).

3. **Accept Invite** — Judge clicks the link `judge.devsage.org/invite/judge/{token}`. New users create an account (name + password) on acceptance; existing users accept directly. Status transitions from `pending` → `accepted`. Auth cookies are set on acceptance.

4. **Hackathon Transitions to Judging** — The hackathon state machine moves to the `judging` state (`draft → active → judging`). This is a prerequisite for scoring.

5. **Auto-Assignment** — Organizer triggers `POST .../judging/assign`. The system runs a round-robin algorithm distributing final submissions across accepted judges (see §6).

6. **Scoring** — Judges submit scores per submission via the judge portal. Each score is validated against the rubric's `max_score`. Scores are upserted (idempotent). Assignment status moves to `scored`.

7. **Leaderboard** — Real-time rankings computed via two-level weighted aggregation (see §8). Cached in KV with ETag support; auto-invalidated on new scores.

8. **Publish Results** — Organizer calls `POST .../judging/results/publish`. Final rankings are batch-upserted into `round_results` with status `published`.

---

## 3. Data Model

### 3.1 Judges Table (`judges`)

Represents a judge's relationship to a specific hackathon. One record per judge per hackathon.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `id` | text | — | NO | PK (UUID) |
| `hackathon_id` | text | — | NO | FK → `hackathons.id` (cascade) |
| `user_id` | text | — | YES | FK → `users.id` (set null). NULL before invite acceptance for email-only invites |
| `email` | text | — | NO | Judge's email |
| `invite_status` | text | `'pending'` | NO | `pending` · `accepted` · `declined` |
| `invite_token` | text | — | NO | UNIQUE. 64-char hex (32 random bytes) |
| `invited_by` | text | — | YES | FK → `users.id` (set null) |
| `created_at` | text | `NOW()` | NO | ISO-8601 |
| `accepted_at` | text | — | YES | Set on acceptance |

**Indexes:**
- `UNIQUE(hackathon_id, user_id)` — one judge record per user per hackathon
- `idx_judges_user` on `user_id`

### 3.2 Judge Assignments (`judge_assignments`)

Maps a judge to a team's submission for a specific round. Created by auto-assignment or manual reassignment.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `id` | text | — | NO | PK (UUID) |
| `hackathon_id` | text | — | NO | FK → `hackathons.id` (cascade) |
| `judge_id` | text | — | NO | FK → `judges.id` (cascade) |
| `team_id` | text | — | NO | FK → `teams.id` (cascade) |
| `submission_id` | text | — | YES | FK → `submissions.id` |
| `round` | integer | `1` | NO | Which judging round |
| `status` | text | `'pending'` | NO | `pending` · `scored` · `skipped` |
| `assigned_at` | text | — | NO | ISO-8601 |
| `completed_at` | text | — | YES | Set when scored |

**Indexes:**
- `UNIQUE(judge_id, team_id, round)` — prevents duplicate assignments
- `idx_judge_assignments_hackathon_round` on `(hackathon_id, round, status)`
- `idx_judge_assignments_judge` on `(judge_id, status)`

### 3.3 Scores (`scores`)

Individual score entries — one per judge × criteria × submission × round.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `id` | text | — | NO | PK (UUID) |
| `submission_id` | text | — | NO | FK → `submissions.id` |
| `judge_id` | text | — | NO | FK → `judges.id` |
| `criteria_id` | text | — | NO | FK → `rubric_criteria.id` |
| `assignment_id` | text | — | NO | FK → `judge_assignments.id` |
| `score` | integer | — | NO | 0 to `rubric_criteria.max_score` |
| `comment` | text | — | YES | Optional judge feedback (max 1000 chars) |
| `round` | integer | `1` | NO | Which judging round |
| `scored_at` | text | — | NO | ISO-8601 |

**Indexes:**
- `UNIQUE(submission_id, judge_id, criteria_id, round)` — one score per judge per criteria per round
- `idx_scores_submission` on `submission_id`
- `idx_scores_judge` on `judge_id`

### 3.4 Rubric Criteria (`rubric_criteria`)

Defines the evaluation rubric for a hackathon. Each criterion has a weight and max score.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `id` | text | — | NO | PK (UUID) |
| `hackathon_id` | text | — | NO | FK → `hackathons.id` (cascade) |
| `track_id` | text | — | YES | Scopes criterion to a specific track (NULL = global) |
| `round` | integer | `1` | NO | Which round this criterion applies to |
| `name` | text | — | NO | e.g., "Innovation", "Technical Complexity" |
| `description` | text | `''` | NO | Guidance for judges |
| `max_score` | integer | `10` | NO | Upper bound for scoring |
| `weight` | real | `1` | NO | Relative importance (used in leaderboard calculation) |
| `sort_order` | integer | `0` | NO | Display order in UI |
| `created_at` | text | `NOW()` | NO | ISO-8601 |

**Indexes:**
- `UNIQUE(hackathon_id, name, track_id, round)` — no duplicate criteria names per scope
- `idx_rubric_round` on `(hackathon_id, round)`

### 3.5 Round Results (`round_results`)

Published final rankings per round. Written by the `results/publish` endpoint.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `id` | text | — | NO | PK (UUID) |
| `hackathon_id` | text | — | NO | FK → `hackathons.id` (cascade) |
| `round_id` | text | — | NO | FK → `hackathon_rounds.id` (cascade) |
| `team_id` | text | — | NO | FK → `teams.id` (cascade) |
| `status` | text | — | NO | `published` |
| `rank` | integer | — | YES | 1-indexed final rank |
| `total_score` | real | — | YES | Weighted average score (0–100 scale) |
| `decided_by` | text | — | YES | FK → `users.id` — organizer who published |
| `created_at` | text | `NOW()` | NO | ISO-8601 |

**Indexes:**
- `UNIQUE(round_id, team_id)` — one result per team per round
- `idx round_results_hackathon_status` on `(hackathon_id, status)`
- `idx round_results_team` on `team_id`

### 3.6 Judge Tracks (`judge_tracks`)

Associates judges with specific hackathon tracks for focused scoring.

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `id` | text | — | NO | PK (UUID) |
| `judge_id` | text | — | NO | FK → `judges.id` (cascade) |
| `track_id` | text | — | NO | FK → `hackathon_tracks.id` (cascade) |

**Indexes:**
- `UNIQUE(judge_id, track_id)`

### Entity Relationship Diagram

```
hackathons ─────────┬──────────────┬──────────────────┬─────────────────┐
                    │              │                  │                 │
                    ▼              ▼                  ▼                 ▼
              rubric_criteria    judges          judge_assignments   round_results
                    │              │    ╲              │                 │
                    │              │     ╲             │                 │
                    │              ▼      ╲           ▼                 │
                    │        judge_tracks   ╲──▶  scores ◀──────────────┘
                    │                              │                    │
                    └──────────────────────────────┘                    │
                                                                       │
teams ──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
              submissions
```

**Key relationships:**
- `judges` → `judge_assignments` → `scores` (a judge is assigned teams, then scores each)
- `rubric_criteria` → `scores` (each score is against a specific criterion)
- `judge_assignments` → `scores` (scores reference the assignment they belong to)
- `judges` → `judge_tracks` (optional track specialization)
- Leaderboard aggregation: `scores` × `rubric_criteria` → weighted average → `round_results`

---

## 4. Judge Invites

### 4.1 Invite Creation

**Endpoints:**
- `POST /api/v1/hackathons/:slug/judging/judges` — single invite (requires `co_organizer+`)
- `POST /api/v1/hackathons/:slug/judging/judges/bulk` — bulk invite up to 50 emails
- `POST /api/v1/hackathons/:slug/judging/judges/create-account` — create account with temp password

**Token generation:**
```
32 random bytes via crypto.getRandomValues() → 64-char hex string
```

**Invite record is inserted into `judges` table with:**
- `invite_status = 'pending'` (or `'accepted'` if self-invite)
- `invite_token` = generated token
- `user_id` = resolved if email matches existing user, else NULL

**Self-invite optimization:** If an organizer invites themselves, the invite is auto-accepted (no email sent).

**Duplicate handling:** If a judge is already invited (UNIQUE constraint hit), the system re-sends the invite email to the existing record.

### 4.2 Email Notification

Invite emails are sent asynchronously via the `NOTIFICATION_QUEUE`:
- **Event type:** `judge.invited`
- **Subject:** "You're invited to judge {hackathonName}"
- **Link:** `{JUDGE_URL}/invite/judge/{inviteToken}` (e.g., `judge.devsage.org/invite/judge/abc123...`)
- **Template:** Dark-themed branded HTML email with accept button

### 4.3 Invite States

```
pending ──▶ accepted
   │
   └──────▶ declined
```

| State | Meaning |
|-------|---------|
| `pending` | Invite sent, awaiting judge action |
| `accepted` | Judge accepted; `user_id` linked, `accepted_at` set |
| `declined` | Judge declined; no further action |

### 4.4 Accept Flow

**Endpoint:** `POST /api/v1/invites/judge/token/:token/accept`

**Two paths:**

| Scenario | What happens |
|----------|-------------|
| **Existing user** (email matches a `users` record) | Links `user_id` to judge record. Sets `invite_status = 'accepted'`. Issues auth cookies. |
| **New user** (email-only invite) | Requires `name` + `password` (min 8 chars) in request body. Creates new user account. Links to judge record. Issues auth cookies. |

Both paths:
- Set `accepted_at` timestamp
- Log audit event: `judge.invite_accepted`
- Return `{ accepted: true, hackathon_id, user_created: boolean }`
- Set HttpOnly auth cookies (access + refresh tokens) so the judge is logged in immediately

### 4.5 Direct Account Creation

**Endpoint:** `POST /api/v1/hackathons/:slug/judging/judges/create-account`

Organizers can create a judge account with a temporary password:
- Creates user with `password_must_change = 1`
- Judge is forced to change password on first login
- Auto-accepts the invite

---

## 5. Rubric System

### 5.1 CRUD Operations

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/judging/rubric` | POST | co_organizer+ | Create criterion |
| `/judging/rubric` | GET | public | List all criteria (sorted by `sort_order`) |
| `/judging/rubric/:criterionId` | PATCH | co_organizer+ | Update criterion fields |
| `/judging/rubric/:criterionId` | DELETE | co_organizer+ | Delete criterion |

### 5.2 Criterion Fields

Each rubric criterion defines:
- **name** — Human-readable label (e.g., "Innovation", "Technical Complexity", "Presentation")
- **description** — Guidance text for judges
- **max_score** — Upper bound (default: 10). Judges score from 0 to this value
- **weight** — Relative importance (default: 1.0). Used in weighted average calculations
- **sort_order** — Display ordering in the judge UI
- **round** — Which judging round this criterion applies to (default: 1)
- **track_id** — Optional. Scopes criterion to a specific track (NULL = applies globally)

### 5.3 Weight-Based Scoring

Scores are normalized and weighted during leaderboard computation:

```
Per-criterion contribution = (score / max_score) × weight × 100
Per-judge total           = SUM of all criterion contributions
Team final score          = AVG of per-judge totals
```

**Example:** Criterion "Innovation" with max_score=10, weight=2.0. A judge gives score 8.
- Contribution: (8/10) × 2.0 × 100 = 160 points toward this judge's total.

### 5.4 Track-Scoped vs Global Criteria

- **Global criteria** (`track_id = NULL`): Apply to all submissions regardless of track
- **Track-scoped criteria** (`track_id` set): Only apply to submissions in that track
- The unique constraint `(hackathon_id, name, track_id, round)` allows the same criterion name in different tracks

### 5.5 Multi-Round Rubrics

Criteria are round-scoped via the `round` column. Different rounds can have different rubrics:
- Round 1: "Innovation" (weight 1), "Feasibility" (weight 1)
- Round 2: "Demo Quality" (weight 2), "Technical Depth" (weight 2)

---

## 6. Auto-Assignment

### 6.1 Algorithm: Round-Robin

**Trigger:** `POST /api/v1/hackathons/:slug/judging/assign` (requires `co_organizer+`)

**Implementation:** `assignSubmissionsRoundRobin()` in `apps/api/src/services/judging-service.ts`

```
1. Fetch all accepted judges for the hackathon
2. Fetch all final submissions (is_final = 1), optionally filtered by round
3. Build a set of existing assignments ("judge_id:team_id:round") to prevent duplicates
4. For each submission (index i):
     → Assign to judges[i % total_judges]
5. Batch INSERT new judge_assignments with status = 'pending'
   (INSERT OR IGNORE to skip existing duplicates)
6. Return { assigned: count }
```

### 6.2 Characteristics

| Property | Detail |
|----------|--------|
| **Distribution** | Even — each judge gets ≈ `total_submissions / total_judges` assignments |
| **Idempotent** | Safe to run multiple times; duplicates are ignored |
| **Round-specific** | Can filter by round when multi-round judging is used |
| **Track-aware** | Not currently — assignments are not filtered by judge's track specialization |

### 6.3 Assignment States

```
pending ──▶ scored       (judge submits scores)
   │
   └──────▶ skipped      (COI declared / reassigned)
```

| State | Meaning |
|-------|---------|
| `pending` | Awaiting judge scoring |
| `scored` | Judge has submitted scores for all criteria |
| `skipped` | Reassigned due to conflict of interest or manual action |

### 6.4 Conflict of Interest (COI)

**Declare COI:** `POST /api/v1/hackathons/:slug/judging/assignments/:assignmentId/coi`
- Judge provides a reason
- Blocked if the judge has already scored this assignment
- Assignment is flagged

**List COI:** `GET /api/v1/hackathons/:slug/judging/coi` (co_organizer+)

**Reassign:** `POST /api/v1/hackathons/:slug/judging/assignments/:assignmentId/reassign` (co_organizer+)
- Creates a new assignment for a different judge
- Marks the original assignment as `reassigned`

---

## 7. Scoring

### 7.1 Score Submission

**Endpoint:** `POST /api/v1/hackathons/:slug/judging/submissions/:submissionId/scores`
**Role:** `judge` (must be an accepted judge assigned to this submission)

**Request body:**
```json
{
  "scores": [
    {
      "criteria_id": "uuid",
      "score": 8,
      "comment": "Strong innovation",
      "assignment_id": "uuid",
      "round": 1
    }
  ]
}
```

### 7.2 Validation Rules

- Judge must have `invite_status = 'accepted'`
- Judge must be assigned to the submission (`judge_assignments` record exists)
- `score` must be ≥ 0 and ≤ `rubric_criteria.max_score`
- `comment` is optional, max 1000 characters
- `round` defaults to 1 if not specified

### 7.3 Upsert Behavior

Scores use `ON CONFLICT(submission_id, judge_id, criteria_id, round)` — judges can re-submit to update their scores. This makes scoring idempotent.

### 7.4 Side Effects

On successful score submission:
1. Assignment `status` updated to `scored`
2. Assignment `completed_at` set
3. Leaderboard cache invalidated (`leaderboard:{hackathon_id}` key deleted from KV)
4. Subsequent leaderboard requests recompute with fresh data

### 7.5 Score Retrieval

| Endpoint | Who | Returns |
|----------|-----|---------|
| `GET .../judging/submissions/:id/scores` | judge | All scores for a specific submission |
| `GET .../judging/my-scores` | judge | All scores submitted by the current judge (limit 200) |

---

## 8. Leaderboard

### 8.1 Computation Algorithm

**Implementation:** `computeLeaderboard()` in `apps/api/src/services/judging-service.ts`

**Two-level weighted aggregation:**

```sql
-- Level 1: Per-judge total (inner query)
SELECT judge_id, team_id,
       SUM(score / max_score * weight * 100) AS judge_total
FROM scores
JOIN rubric_criteria ON scores.criteria_id = rubric_criteria.id
GROUP BY judge_id, team_id

-- Level 2: Cross-judge average (outer query)  
SELECT team_id,
       AVG(judge_total) AS total_score,
       COUNT(DISTINCT judge_id) AS judges_scored
FROM per_judge_totals
GROUP BY team_id
ORDER BY total_score DESC
```

**Scoring formula:**
```
Per-criterion:    (score / max_score) × weight × 100
Per-judge total:  SUM of all per-criterion values
Team final score: AVG of all per-judge totals → rounded to 2 decimals
```

### 8.2 Ranking

- Teams are sorted by `total_score` DESC
- Rank is assigned 1-indexed (rank 1 = highest score)
- **No tie-breaking logic currently implemented** — tied teams receive sequential ranks

### 8.3 Filtering

The leaderboard endpoint supports optional query parameters:
- `?round_id=...` — filter scores by round
- `?track_id=...` — filter teams by track

### 8.4 Caching Strategy

| Hackathon State | Cache TTL | HTTP Cache |
|-----------------|-----------|------------|
| `judging` | 60 seconds | `max-age=15, stale-while-revalidate=60` |
| `completed` | 3600 seconds (1 hour) | Same headers |

**Cache key format:** `leaderboard:{hackathon_id}:{round_id ?? 'all'}:{track_id ?? 'all'}`

**Invalidation:** Cache is deleted from KV whenever a judge submits new scores. Subsequent requests trigger a fresh computation.

**ETag support:** Responses include an ETag header. Clients can send `If-None-Match` to receive `304 Not Modified` if the leaderboard hasn't changed.

### 8.5 Results Publication

**Endpoint:** `POST /api/v1/hackathons/:slug/judging/results/publish` (requires `organizer`)

1. Computes the final leaderboard
2. Resolves the target round ID (defaults to first round)
3. Batch upserts into `round_results` (chunks of 20 to stay under D1's 100 bound-parameter limit)
4. Each result includes: `rank`, `total_score`, `decided_by` (organizer user ID), `status = 'published'`
5. Uses `ON CONFLICT(round_id, team_id)` for idempotent re-publication
6. Sends notifications and audit events

---

## 9. Judge Portal (`apps/judge`)

### 9.1 Architecture

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| State | TanStack Query v5 + React Context |
| Routing | React Router v7 |
| Animations | Framer Motion |
| Theme | Dark-first, brand color `#CCFF00` (lime) |

### 9.2 Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/login` | LoginPage | Email/password authentication |
| `/invite/judge/:token` | JudgeInviteAcceptPage | Accept invite (new or existing user) |
| `/change-password` | ChangePasswordPage | Forced password change (temp accounts) |
| `/dashboard` | DashboardPage | List hackathons with assignment progress |
| `/hackathons/:slug/score` | JudgeScoringPage | **Primary scoring interface** |
| `/hackathons/:slug/assignments` | JudgeAssignmentsPage | View assignments, declare COI |
| `/hackathons/:slug/leaderboard` | LeaderboardPage | Real-time ranked scores |
| `/profile` | ProfilePage | User profile management |

### 9.3 Authentication Flow

1. **Protected Route** component checks `isAuthenticated` and `isJudge` from auth context
2. Unauthenticated users → redirected to `/login`
3. Non-judge users → shown "Access Denied"
4. Auth context provides: `{ user, isJudge, isAuthenticated, passwordMustChange, hackathonRoles }`
5. API client (`lib/api.ts`) uses `credentials: 'include'` for cookie-based auth
6. On 401 → auto-calls `POST /auth/refresh` → retries original request

### 9.4 Scoring UI Flow

```
Dashboard                    Scoring Page                    Score Form
┌─────────────┐             ┌─────────────────┐             ┌─────────────────┐
│ Hackathon A │──"Start"──▶ │ Pending (3)     │──"Score"──▶ │ Innovation: [8] │
│  ⏳ 3 pending│            │ • Team Alpha    │             │ Technical:  [7] │
│  ✅ 2 done   │            │ • Team Beta     │             │ Design:     [9] │
│             │             │ • Team Gamma    │             │ Comment: [___]  │
│ Hackathon B │             │                 │             │                 │
│  ✅ 5 done   │            │ Completed (2)   │             │ [Submit Scores] │
└─────────────┘             │ • Team Delta    │             └─────────────────┘
                            │ • Team Epsilon  │                     │
                            └─────────────────┘                     │
                                     ▲                              │
                                     └────── success toast ─────────┘
```

**Scoring form details:**
- Displays each rubric criterion with name, description, and max score badge
- Score input validated: `0 ≤ score ≤ max_score`
- Optional comment textarea per criterion (max 1000 chars)
- Sticky sidebar with scoring guide and rubric weight summary
- On submit: `POST .../judging/submissions/:id/scores` → toast notification → return to list

### 9.5 COI Declaration

From the assignments page, judges can declare a conflict of interest:
- Opens a modal with a required reason textarea
- Calls `POST .../judging/assignments/:id/coi`
- Assignment is removed from the judge's list
- Organizer reviews and reassigns to another judge

### 9.6 Dashboard

**Endpoint consumed:** `GET /api/v1/judge/hackathons` (from `judge-portal.ts`)

Displays per-hackathon:
- Title, status, tagline
- Judging deadline
- Progress: pending assignments vs completed assignments
- "Start Scoring" button → navigates to scoring page

---

## 10. API Endpoint Reference

### Organizer Endpoints (`/api/v1/hackathons/:slug/judging/...`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/rubric` | co_organizer+ | Create rubric criterion |
| GET | `/rubric` | public | List rubric criteria |
| PATCH | `/rubric/:criterionId` | co_organizer+ | Update criterion |
| DELETE | `/rubric/:criterionId` | co_organizer+ | Delete criterion |
| POST | `/judges` | co_organizer+ | Invite single judge |
| POST | `/judges/bulk` | co_organizer+ | Bulk invite (max 50) |
| GET | `/judges` | public | List judges with profiles |
| DELETE | `/judges/:judgeId` | co_organizer+ | Remove judge |
| POST | `/judges/create-account` | co_organizer+ | Create judge account |
| POST | `/judges/:judgeId/tracks` | co_organizer+ | Assign judge to track |
| POST | `/judges/:judgeId/accept` | co_organizer+ | Manually accept invite |
| POST | `/assign` | co_organizer+ | Auto-assign submissions |
| GET | `/coi` | co_organizer+ | List COI declarations |
| POST | `/assignments/:id/reassign` | co_organizer+ | Reassign COI |
| POST | `/results/publish` | organizer | Publish final results |

### Judge Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/my-assignments` | auth | Current judge's assignments |
| GET | `/my-scores` | auth | Current judge's submitted scores |
| GET | `/judges/:judgeId/assignments` | auth | Specific judge's assignments |
| POST | `/submissions/:id/scores` | judge | Submit scores |
| GET | `/submissions/:id/scores` | judge | Get scores for submission |
| POST | `/assignments/:id/coi` | judge | Declare conflict of interest |
| GET | `/leaderboard` | public | Ranked leaderboard |

### Judge Portal Endpoints (`/api/v1/judge/...`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/hackathons` | auth | List hackathons where user is accepted judge |

### Invite Endpoints (`/api/v1/invites/judge/...`)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/token/:token` | public | Fetch invite details |
| POST | `/token/:token/accept` | public | Accept invite (+ optional account creation) |
| POST | `/token/:token/decline` | public | Decline invite |

---

## 11. Shared Validation Schemas (`packages/shared`)

Located in `packages/shared/src/schemas/`:

| File | Schema | Fields |
|------|--------|--------|
| `judge.ts` | `inviteJudgeSchema` | `email` (email validated) |
| `judge.ts` | `bulkInviteJudgesSchema` | `emails` (array, 1–50 items, email validated) |
| `judge-assignment.ts` | `judgeAssignmentResponseSchema` | `id`, `hackathon_id`, `judge_id`, `team_id`, `submission_id?`, `round` (default 1), `status` (pending/scored/skipped), `assigned_at`, `completed_at?` |
| `judge-track.ts` | `assignJudgeTrackSchema` | `track_ids` (array of UUIDs, min 1) |
| `score.ts` | `submitScoreSchema` | `scores[]`: `criteria_id`, `score` (min 0), `comment?` (max 1000), `assignment_id`, `round?` |

**Enums (from `constants.ts`):**
- `assignmentStatusSchema` → `'pending' | 'scored' | 'skipped'`
- `judgeInviteStatusSchema` → `'pending' | 'accepted' | 'declined'`

---

## 12. Known Issues & Future Plans

### 12.1 Known Bugs

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| **Judge Portal query references nonexistent columns** | 🔴 Critical | `apps/api/src/routes/judge-portal.ts:33-35` | Queries `start_date`, `end_date`, `judging_deadline` — these columns do not exist on the `hackathons` table. Will crash at runtime. |
| **Template rounds/rubric not applied** | 🟡 Medium | `apps/api/src/routes/hackathons.ts:187` | When creating hackathon from template, rounds and rubric criteria are not copied. Organizers must manually recreate them. |

### 12.2 Missing Features

| Feature | Priority | Description |
|---------|----------|-------------|
| **Judging time windows** | 🔴 High | No `scoring_opens_at`/`scoring_closes_at` fields. Judges can score anytime once hackathon is in `judging` state. Need DB columns, API validation, countdown UI. |
| **Judge guidelines** | 🟡 Medium | No endpoint or UI for organizers to post judging instructions beyond rubric descriptions. Need `judging_guidelines` field, PATCH endpoint, judge portal page. |
| **COI auto-detection** | 🟡 Medium | No workspace/team membership checks during auto-assignment. Judges can be assigned teams they're connected to. |
| **Tie-breaking rules** | 🟡 Medium | Leaderboard assigns sequential ranks to tied teams. No configurable tie-breaking (e.g., by number of judges, specific criterion). |
| **Track-aware auto-assignment** | 🟡 Medium | Round-robin doesn't consider judge track specialization from `judge_tracks`. All judges get all submissions. |
| **Leaderboard pagination** | 🟢 Low | No pagination on judge listing endpoint. |
| **Show judge comments to participants** | 🟢 Low | `show_judge_comments_to_participants` setting exists but is not enforced. |

### 12.3 UI Gaps

| Feature | Description |
|---------|-------------|
| Rubric builder with drag-and-drop | No visual rubric editor in platform app |
| Judge management UI | No judge management page in `apps/platform` |
| Branded email templates | Judge invite emails use basic template |
| Round-specific criteria filtering | Judge UI doesn't filter rubric by round |

### 12.4 Test Coverage

| Area | Status |
|------|--------|
| `apps/judge/` (8 pages, 5+ components) | ❌ **Zero tests** |
| `apps/api/src/routes/judging.ts` (22+ endpoints) | ❌ **No dedicated test file** |
| Full judging pipeline integration test | ❌ **Missing** (invite → accept → assign → score → publish) |

### 12.5 Debt References

- `debt/plan-gaps.md` — GAP-004 (judging time windows), GAP-005 (judge guidelines)
- `debt/COMPREHENSIVE-DEBT-AUDIT.md` — API-042 and related items with line-number references
- `TODO.md` — Gherkin scenarios for judging workflows
