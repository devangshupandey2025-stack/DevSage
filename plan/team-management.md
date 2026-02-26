# Teams, Repos & Submissions — Cross-Functional Feature Document

> **Status:** Living document · **Last updated:** 2026-02-15
> **Packages touched:** `packages/db`, `packages/shared`, `apps/api`, `apps/web`

---

## 1. Overview

Teams are the primary organizational unit for hackathon participants. A participant creates or joins exactly **one team per hackathon**. Teams link a GitHub repository, build their project, and submit via the API. Submissions are validated and scored (optionally by AI), then reviewed by judges during the judging phase.

**End-to-end flow:**

```
Create team → Invite members → Link GitHub repo → Build → Submit → Validate → Judge
```

**Key invariants:**

- One team per user per hackathon (enforced at DB + API level).
- Team size bounded by `min_team_size` / `max_team_size` (hackathon settings).
- Total teams bounded by `max_teams` (hackathon setting, nullable = unlimited).
- Only the team leader (or organizers) can perform destructive operations.
- Submissions mark the latest as "current" (`is_current = 1`); prior submissions are retained.

---

## 2. Team Lifecycle

```
┌──────────┐   create    ┌──────────┐  all slots   ┌─────────┐  submit   ┌───────────┐
│          │ ──────────▶  │          │  filled      │         │ ────────▶ │           │
│  (none)  │              │ forming  │ ───────────▶ │  ready  │           │ submitted │
│          │              │          │              │         │           │           │
└──────────┘              └────┬─────┘              └────┬────┘           └───────────┘
                               │                        │
                               │ dissolve               │ dissolve
                               ▼                        ▼
                          ┌───────────┐           ┌───────────┐
                          │ dissolved │           │ dissolved │
                          └───────────┘           └───────────┘
```

**Team statuses** (from `teamStatusSchema`):

| Status | Meaning |
|--------|---------|
| `forming` | Team exists, accepting members. Default on creation. |
| `ready` | Team meets minimum size; eligible to submit. |
| `submitted` | Team has at least one current submission. |
| `dissolved` | Team was dissolved by leader or organizer. |

### Lifecycle steps

1. **Participant creates team** — hackathon must be `active` or `draft`. Creator becomes `leader`. Status = `forming`. 6-char invite code auto-generated.
2. **Members join** — via invite code (public) or email invite token (seeded). Each join checks `max_team_size`.
3. **Team links GitHub repo** — leader provides a `github.com` URL. One repo per team.
4. **Team submits** — any member can submit. Submission stores repo URL, tag name, commit SHA, optional demo/video URLs.
5. **Submission validated** — status transitions through `pending_validation → validated | failed_validation`.
6. **Judging phase** — judges score the team's current (final) submission.

---

## 3. Data Model

### 3.1 `teams`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | text | NO | — | PK, UUID |
| `hackathon_id` | text | NO | — | FK → `hackathons.id` (cascade delete) |
| `name` | text | NO | — | 1–100 chars |
| `invite_code` | text | NO | — | UNIQUE, 8 chars, crypto-random |
| `track_id` | text | YES | NULL | FK → `hackathon_tracks.id` (set null) |
| `status` | text | NO | `'forming'` | Enum: `forming \| ready \| submitted \| dissolved` |
| `created_at` | text | NO | `NOW()` | UTC ISO-8601 |
| `updated_at` | text | NO | `NOW()` | UTC ISO-8601 |

**Indexes:**
- `idx_teams_hackathon` — on `hackathon_id`
- `idx_teams_invite_code` — on `invite_code`

**Relationships:**
- Belongs to one `hackathon`.
- Optionally assigned to one `hackathon_track`.
- Has many `team_members`, `team_repos`, `team_invites`, `submissions`.

---

### 3.2 `team_members`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | text | NO | — | PK, UUID |
| `team_id` | text | NO | — | FK → `teams.id` (cascade delete) |
| `user_id` | text | NO | — | FK → `users.id` (cascade delete) |
| `role` | text | NO | — | `'leader'` or `'member'` |
| `joined_at` | text | NO | `NOW()` | UTC ISO-8601 |

**Indexes:**
- `uq_team_members_team_user` — UNIQUE on `(team_id, user_id)`
- `idx_team_members_user` — on `user_id`

**Constraints:**
- A user can appear on at most one team per hackathon (enforced at API level, not DB).
- Exactly one `leader` per team (enforced at API level).

**Roles:**

| Role | Permissions |
|------|-------------|
| `leader` | Update team, remove members, transfer leadership, dissolve team, link/unlink repo |
| `member` | Submit, leave team |

---

### 3.3 `team_repos`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | text | NO | — | PK, UUID |
| `team_id` | text | NO | — | FK → `teams.id` (cascade delete) |
| `hackathon_id` | text | NO | — | FK → `hackathons.id` ⚠️ **no cascade** (debt PKG-016) |
| `provider` | text | NO | — | Always `'github'` currently |
| `repo_full_name` | text | NO | — | e.g. `"octocat/hello-world"` |
| `repo_url` | text | NO | — | Full HTTPS URL |
| `installation_id` | text | YES | NULL | GitHub App installation ID |
| `bot_active` | integer | NO | `0` | 0/1 boolean — bot installed? |
| `is_primary` | integer | NO | `1` | 0/1 boolean — always 1 (single repo per team) |
| `access_token_encrypted` | text | YES | NULL | ⚠️ Encryption method undocumented (debt PKG-051) |
| `created_at` | text | NO | `NOW()` | UTC ISO-8601 |

**Indexes:**
- `team_repos_team_idx` — on `team_id`
- `team_repos_repo_idx` — on `repo_full_name`
- `team_repos_bot_idx` — on `(hackathon_id, bot_active)`

**Constraints:**
- One repo per team (enforced at API level — 409 if already linked).

---

### 3.4 `team_invites`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | text | NO | — | PK, UUID |
| `team_id` | text | NO | — | FK → `teams.id` (cascade delete) |
| `email` | text | NO | — | Invitee email (lowercase, trimmed) |
| `invite_token` | text | NO | — | UNIQUE, crypto-random |
| `status` | text | NO | `'pending'` | Enum: `pending \| accepted \| declined \| expired` |
| `invited_by` | text | YES | NULL | FK → `users.id` (set null on delete) |
| `created_at` | text | NO | `NOW()` | UTC ISO-8601 |
| `expires_at` | text | NO | — | UTC ISO-8601, typically +30 days |

**Indexes:**
- `uq_team_invites_team_email` — UNIQUE on `(team_id, email)`
- `idx_team_invites_email` — on `email`

**Statuses:**

| Status | Meaning |
|--------|---------|
| `pending` | Invite sent, awaiting response |
| `accepted` | User accepted; added to team as `member` |
| `declined` | User explicitly declined |
| `expired` | Past `expires_at` (not auto-updated; checked on redemption) |

---

### 3.5 `submissions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | text | NO | — | PK, UUID |
| `hackathon_id` | text | NO | — | FK → `hackathons.id` (cascade delete) |
| `team_id` | text | NO | — | FK → `teams.id` (cascade delete) |
| `round_id` | text | YES | NULL | FK → `hackathon_rounds.id` (set null) |
| `tag_name` | text | NO | — | Git tag or submission title |
| `commit_sha` | text | NO | — | Git SHA or `'manual'` |
| `submitted_at` | text | NO | — | UTC ISO-8601 |
| `status` | text | NO | `'pending_validation'` | See status table below |
| `validated_at` | text | YES | NULL | When validation completed |
| `validation_results` | text | YES | NULL | JSON string with validation details |
| `delivery_id` | text | YES | NULL | UNIQUE — GitHub webhook delivery ID |
| `is_current` | integer | NO | `1` | 0/1 boolean — latest submission? |
| `created_at` | text | NO | `NOW()` | UTC ISO-8601 |

**Indexes:**
- `idx_submissions_hackathon_current` — on `(hackathon_id, is_current)`
- `idx_submissions_team_round` — on `(team_id, round_id)`

**Submission statuses:**

| Status | Meaning |
|--------|---------|
| `pending_validation` | Submitted, awaiting validation pipeline |
| `validated` | Passed all validation checks |
| `failed_validation` | Failed one or more checks (see `validation_results`) |
| `tag_deleted` | Source git tag was deleted after submission |

> **Note:** The route layer also manages `is_final`, `ai_score`, `analysis_json`, `ai_review_json`, `demo_url`, `video_url`, `repo_full_name`, and `title`/`description` fields — but these are **not in the current DB schema**. The submissions route stores some of these inline (e.g. `tag_name` holds the title, `commit_sha = 'manual'` for web submissions). See §10 for the schema gap.

---

### 3.6 Hackathon Settings (team-relevant)

These columns on the `hackathons` table control team behavior:

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `min_team_size` | integer | `1` | Minimum members to submit |
| `max_team_size` | integer | `5` | Maximum members allowed |
| `max_teams` | integer | NULL | NULL = unlimited |
| `allow_resubmission` | integer | `0` | 0/1 boolean |
| `registration_mode` | text | `'open'` | `'open'` = anyone can create teams |

---

### 3.7 Entity Relationship Diagram

```
hackathons ──┬──< teams ──┬──< team_members ──> users
             │            ├──< team_repos
             │            ├──< team_invites ──> users (invited_by)
             │            └──< submissions ──> hackathon_rounds
             └──< hackathon_tracks ──< teams (track_id)
```

---

## 4. Team CRUD

All team routes are mounted at `/api/v1/hackathons/:slug/teams`.

### 4.1 Create Team

```
POST /api/v1/hackathons/:slug/teams
Auth: Required
```

**Request body** (`createTeamSchema`):
```json
{
  "name": "Team Alpha",        // required, 1–100 chars
  "track_id": "uuid-or-null"   // optional
}
```

**Logic:**
1. Hackathon status must be `active` or `draft` (else 409).
2. User must not already be on a team in this hackathon (else 409).
3. If `max_teams` is set, current team count must be below it (else 409).
4. Generate 8-char invite code via `generateInviteCode()`.
5. Insert team with `status = 'forming'`.
6. Insert creator as `team_member` with `role = 'leader'`.
7. Log audit event.

**Response:** `201` with team object.

### 4.2 Join Team (Invite Code)

```
POST /api/v1/hackathons/:slug/teams/join
Auth: Required
```

**Request body** (`joinTeamSchema`):
```json
{
  "invite_code": "Ab3Cd5Ef"   // exactly 8 chars
}
```

**Logic:**
1. Find team by invite code within the hackathon (else 404).
2. User must not already be on a team (else 409).
3. Current member count must be below `hackathon.max_team_size` (default 5) (else 409).
4. Insert user as `team_member` with `role = 'member'`.
5. Trigger `team_joined` notification.

**Response:** `200` with team object.

### 4.3 Update Team

```
PATCH /api/v1/hackathons/:slug/teams/:teamId
Auth: Required — leader or organizer/co_organizer
```

**Request body** (`updateTeamSchema`):
```json
{
  "name": "New Name",       // optional, 1–100 chars
  "track_id": "uuid|null"   // optional
}
```

Updates `updated_at`. Returns `200`.

### 4.4 Leave Team

```
POST /api/v1/hackathons/:slug/teams/:teamId/leave
Auth: Required — must be a member
```

- Leader **cannot** leave (409) — must transfer leadership first.
- Non-leaders are removed immediately.

### 4.5 Remove Member

```
DELETE /api/v1/hackathons/:slug/teams/:teamId/members/:userId
Auth: Required — leader or organizer/co_organizer
```

- Cannot remove yourself (use leave or transfer instead).

### 4.6 Transfer Leadership

```
POST /api/v1/hackathons/:slug/teams/:teamId/transfer
Auth: Required — current leader only
```

**Request body** (`transferLeadershipSchema`):
```json
{
  "new_leader_id": "uuid"
}
```

- Target must be an existing member of the team.
- Current leader demoted to `member`, target promoted to `leader` (atomic batch).

### 4.7 Dissolve Team

```
POST /api/v1/hackathons/:slug/teams/:teamId/dissolve
Auth: Required — leader or organizer/co_organizer
```

- Deletes all `team_members`, then deletes the team.
- Cascading FKs also remove `team_repos`, `team_invites`, `submissions`.

### 4.8 Read Operations

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| `GET` | `/me` | Yes | Current user's team + members in hackathon |
| `GET` | `/` | No | Paginated list of all teams |
| `GET` | `/:teamId` | No | Single team |
| `GET` | `/:teamId/members` | No | Team's members with user profiles |

---

## 5. Team Constraints

### Size constraints

| Setting | Column | Default | Enforced at |
|---------|--------|---------|-------------|
| Min team size | `hackathons.min_team_size` | 1 | ⚠️ **Not enforced** in submission pipeline (see §10) |
| Max team size | `hackathons.max_team_size` | 5 | Join endpoint (409 if full) |
| Max teams | `hackathons.max_teams` | NULL (∞) | Create endpoint (409 if limit reached) |

### Membership constraints

- **One team per user per hackathon** — enforced on create and join (409 if violated).
- **Exactly one leader per team** — leader cannot leave without transferring first.
- No DB-level unique constraint on `(user_id, hackathon_id)` across `team_members` — enforced purely at the API layer via query.

### Hackathon state constraints

- Teams can only be created when hackathon is `active` or `draft`.
- No explicit check on join (only create).

---

## 6. GitHub Integration

### 6.1 Linking a Repository

```
POST /api/v1/hackathons/:slug/teams/:teamId/repo
Auth: Required — team leader only
```

**Request body** (`linkRepoSchema`):
```json
{
  "github_repo_url": "https://github.com/octocat/hello-world"
}
```

**Validation:** URL must match `^https://github\.com/[^/]+/[^/]+/?$`

**Logic:**
1. Parse `owner` and `repo` from URL.
2. Check team doesn't already have a linked repo (else 409).
3. Insert into `team_repos` with `provider = 'github'`, `bot_active = 0`, `is_primary = 1`.
4. Create `pending_installations` record for GitHub App bot activation.
5. Non-critical failures (bot setup) handled gracefully — linking still succeeds.

### 6.2 Get Linked Repository

```
GET /api/v1/hackathons/:slug/teams/:teamId/repo
Auth: None
```

Returns the repo record or 404.

### 6.3 Unlink Repository

```
DELETE /api/v1/hackathons/:slug/teams/:teamId/repo
Auth: Required — team leader only
```

Deletes `team_repos` record + cleans up `pending_installations`.

### 6.4 GitHub App Installation Flow

1. Team leader links repo URL.
2. `pending_installations` record created.
3. Organizer (or participant) installs the DevSage GitHub App on the repo.
4. GitHub sends `installation` webhook → API matches to `pending_installations`.
5. `team_repos.installation_id` set, `bot_active = 1`.
6. Bot can now track commits, tags, and activity.

### 6.5 Commit Tracking

- When bot is active (`bot_active = 1`), push webhooks are received.
- Commits are normalized via `normalizeGitHubEvent()` in `lib/webhook-normalize.ts`.
- Commits stored for activity tracking and audit.

### 6.6 Repository Analysis

```
POST /api/v1/hackathons/:slug/submissions/github/analyze
Auth: Required
```

**Request body:**
```json
{
  "owner": "octocat",
  "repo": "hello-world"
}
```

**Returns** structural analysis:
- Project type (Node.js, Python, Java, Go, Rust, C/C++).
- File extensions (top 8).
- Framework detection (React, Vue, Next.js, Express, Hono, FastAPI, Django, Flask, PyTorch, TensorFlow, etc.).
- Dependencies (first 25 from `package.json` or `requirements.txt`).
- CI/CD presence, tests, Docker, README.
- Entry files (`index`, `main`, `app`, `server`).

**Ignored directories:** `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `.venv`, `.idea`, `.next`, `vendor`, `target`.

---

## 7. Submission System

### 7.1 How Submissions Work

Any team member can submit. The system supports two submission modes:

1. **Manual submission** (current) — user provides repo URL, title, description, and optional links via the API. `commit_sha = 'manual'`.
2. **Tag-based submission** (via webhooks) — GitHub push event with a matching tag creates a submission automatically. `commit_sha` = actual SHA.

### 7.2 Create / Update Submission

```
POST /api/v1/hackathons/:slug/submissions
Auth: Required — must be on a team
```

**Request body:**
```json
{
  "title": "Final Submission",        // required — stored as tag_name
  "description": "Our project...",    // optional
  "repo_url": "https://github.com/...", // required
  "demo_url": "https://...",          // optional
  "video_url": "https://...",         // optional
  "round_id": "uuid",                // optional — targets a specific round
  "analysis_json": "{...}",          // optional — repo analysis JSON string
  "ai_review_json": "{...}",         // optional — AI review JSON string
  "ai_score": 85                     // optional — AI score (1–100)
}
```

**Logic:**
1. User must be on a team (else 403).
2. Team must not be `eliminated` (else 403).
3. If hackathon has initialized rounds:
   - `round_id` must reference an initialized round (else 404/410).
   - If omitted, defaults to the first initialized round.
4. All existing submissions for the team are marked `is_current = 0` (superseded).
5. New submission inserted with `is_current = 1`, `status = 'pending_validation'`.
6. `repo_full_name` extracted from URL.
7. `submitted_at = NOW()`.

### 7.3 Tag Pattern Matching

For webhook-triggered submissions, the tag name is matched against patterns like `submission_v*`. When a matching tag push is received:

1. Webhook handler identifies the hackathon + team from the repo.
2. Tag name and commit SHA captured.
3. Submission created with `status = 'pending_validation'`.
4. If the tag is later deleted, status transitions to `tag_deleted`.

### 7.4 Submission Validation

After creation, submissions enter the validation pipeline:

```
pending_validation ──▶ validated        (all checks pass)
                   ──▶ failed_validation (one+ checks fail)
```

Validation results stored in `validation_results` (JSON). Timestamp stored in `validated_at`.

### 7.5 Resubmission Rules

- **Controlled by** `hackathons.allow_resubmission` (default: `0` = disabled).
- When allowed: new submission supersedes previous (`is_current` flag flipped).
- Prior submissions are **retained** (not deleted) — full history available.
- Only the `is_current = 1` submission is used for judging and leaderboard.

### 7.6 Submission States

| Status | Meaning | Transitions to |
|--------|---------|---------------|
| `pending_validation` | Just submitted, awaiting checks | `validated`, `failed_validation` |
| `validated` | Passed all validation checks | — (terminal for validation) |
| `failed_validation` | Failed one or more checks | — (team can resubmit if allowed) |
| `tag_deleted` | Source git tag removed | — (team can resubmit if allowed) |

### 7.7 AI Review (Optional)

```
POST /api/v1/hackathons/:slug/submissions/github/ai-review
Auth: Required
```

Sends repo analysis to Gemini 2.0 Flash. Returns:

```json
{
  "review": {
    "summary": "2-3 sentence project summary",
    "score": 85,
    "strengths": ["..."],
    "improvements": ["..."],
    "tech_stack_assessment": "...",
    "hackathon_readiness": "..."
  }
}
```

Requires `GEMINI_API_KEY` in Worker bindings.

### 7.8 Read Operations

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| `GET` | `/` | No | Paginated submissions (filterable by `team_id`, `round_id`, `current_only`) |
| `GET` | `/ai-leaderboard` | No | Submissions ranked by `ai_score` DESC |
| `GET` | `/team/:teamId/current` | No | Team's latest `is_current = 1` submission |
| `GET` | `/:submissionId` | No | Full submission with parsed `analysis_json` and `ai_review_json` |

### 7.9 User's GitHub Repos

```
GET /api/v1/hackathons/:slug/submissions/github/repos
Auth: Required
```

Lists the authenticated user's public GitHub repos (requires linked `github_username`). Returns up to 100 repos sorted by `updated_at`.

---

## 8. Invite System

### 8.1 Invite Code (Team-Level)

Every team has an **invite code** generated at creation time.

**Generation** (`generateInviteCode()` in `api/src/lib/utils.ts`):
- **Length:** 8 characters
- **Charset:** `23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz` (52 chars)
- **Excluded:** `0`, `O`, `1`, `I`, `L`, `l` (ambiguous characters)
- **Method:** `crypto.getRandomValues()` — cryptographically random

**Redemption:** `POST /teams/join` with `{ invite_code }`. See §4.2.

**Properties:**
- No expiry — valid as long as team exists and has capacity.
- One code per team (immutable after creation).
- Shared out-of-band (copied from team dashboard).

### 8.2 Email Invites (Token-Based)

Created via the **seed endpoint** or future `POST /teams/:teamId/invite`.

**Token generation:** Crypto-random, stored in `team_invites.invite_token` (UNIQUE).

**Redemption flow:**

```
POST /api/v1/invites/team/:token
Auth: Required
```

1. Look up invite by token.
2. Validate `status = 'pending'` (else 409).
3. Validate `expires_at > NOW()` (else 404).
4. Validate user not already on a team (else 409).
5. Mark invite `status = 'accepted'`.
6. Add user as `team_member` with `role = 'member'` (atomic batch).

**Expiry:** 30 days from creation (set during seed/invite creation).

**Constraints:**
- `UNIQUE(team_id, email)` — no duplicate invites to same email for same team.
- Once accepted or declined, cannot be re-used (409).

### 8.3 Participant Seeding (Bulk)

```
POST /api/v1/hackathons/:slug/teams/seed
Auth: Required — co_organizer or above
```

Three seeding modes:

| Mode | Input | Creates | Limit |
|------|-------|---------|-------|
| `full_structure` | `{ teams: [{ team_name, leader_email?, member_emails? }] }` | Teams + leaders + member invites | 100 teams |
| `leaders_only` | `{ teams: [{ team_name, leader_email }] }` | Teams + leaders | 100 teams |
| `participants_only` | `{ emails: [...] }` | Single "Unassigned Pool" team + email invites | 500 emails |

All invites created with 30-day expiration. Notifications sent via queue. Duplicate emails are skipped and logged in `errors` array. Response includes `truncated` flag if limit exceeded.

---

## 9. Frontend (`apps/web`)

### 9.1 Current State

> ⚠️ **Team UI is not yet implemented.** As of the last audit, `apps/web` has no dedicated team management, submission, or invite pages.

**What exists:**
- `apiRequest()` utility in `src/lib/api.ts` — ready for team API calls.
- Marketing copy on home/about/FAQ pages references team features.
- `hackathon-detail.tsx` shows team size constraints and has a commented-out team creation call.
- Registration button displays "Registration feature coming soon!" alert.
- Generic UI components (Button, Card, Dialog, Tabs) from shadcn/ui — ready for team UIs.

### 9.2 Planned Pages

| Page | Route | Purpose |
|------|-------|---------|
| Team Creation | `/hackathons/:slug/teams/new` | Form: team name, optional track selection |
| Team Dashboard | `/hackathons/:slug/teams/:teamId` | Members list, invite code, linked repo, submissions |
| Join Team | `/hackathons/:slug/join?code=...` | Invite code entry or deep-link redemption |
| Submission Form | `/hackathons/:slug/submit` | Repo selection, analysis, AI review, submit |
| Submission Detail | `/hackathons/:slug/submissions/:id` | View submission status, analysis, AI review |

### 9.3 Key UI Components Needed

- **TeamCard** — team name, member count, status badge, track.
- **MemberList** — avatars, roles, remove/leave actions.
- **InviteCodeCopy** — display + clipboard copy for invite code.
- **RepoLinker** — input for GitHub URL, status indicator for bot.
- **SubmissionForm** — repo picker, analysis trigger, AI review, submit button.
- **SubmissionStatus** — status badge, validation results, resubmit action.

---

## 10. Known Issues & Future Plans

### Active Debt Items

| ID | Severity | Description |
|----|----------|-------------|
| **API-015** | HIGH | Judge invite accept (`POST /invites/judge/token/:token/accept`) has **no auth middleware** — token is sole authentication factor. |
| **API-037** | LOW | `routes/invites.ts` line 49: Missing `joined_at` field on team member insert when accepting invite (inconsistent with `teams.ts` join). |
| **API-041** | MEDIUM | Seed endpoint performs 600+ sequential DB inserts instead of batching — O(n) round-trips to D1. |
| **PKG-016** | MEDIUM | `team_repos.hackathon_id` FK is missing `onDelete: cascade`. Deleting a hackathon orphans team_repos rows. |
| **PKG-032** | MEDIUM | `teamMemberRoleSchema` uses `team_lead`/`team_member` but seed endpoint uses `leader`/`member` — enum mismatch. |
| **PKG-051** | MEDIUM | `team_repos.access_token_encrypted` — encryption method is undocumented and implementation unclear. |
| **WEB-012** | HIGH | Homepage fabricated statistics ("12,000+ teams active", "4.9/5 satisfaction"). |
| **FE-007** | HIGH | Platform dashboard: `hackathons.length * 8` for teams count, "+12%" hardcoded. |

### Schema Gaps

The submissions route (`apps/api/src/routes/submissions.ts`) references fields that are **not in the DB schema** (`packages/db/src/schema/submissions.ts`):

| Field in Route | Status | Notes |
|----------------|--------|-------|
| `title` | ❌ Missing | Stored as `tag_name` (overloaded) |
| `description` | ❌ Missing | Not persisted |
| `demo_url` | ❌ Missing | Passed in request but not in schema |
| `video_url` | ❌ Missing | Passed in request but not in schema |
| `repo_full_name` | ❌ Missing | Extracted from URL but not in schema |
| `ai_score` | ❌ Missing | AI review score not persisted |
| `analysis_json` | ❌ Missing | Repo analysis not persisted |
| `ai_review_json` | ❌ Missing | AI review not persisted |
| `is_final` | ❌ Missing | Route uses `is_final` but DB has `is_current` |

> **Action needed:** Align the DB schema with the route's data requirements. Add missing columns or create a separate `submission_metadata` table.

### Missing Enforcement

- **`min_team_size` not enforced** in the submission pipeline — teams below minimum size can submit.
- **Hackathon state not checked on join** — only checked on create.
- **One-team-per-user** not enforced at DB level — relies solely on API-layer query.

### Planned Features (from TODO.md)

- [ ] Email-based team invite endpoints: `POST /teams/:teamId/invite`, `GET /teams/:teamId/invites`
- [ ] Min team size validation in submission pipeline
- [ ] Team search/discovery endpoint with `?open=true` filter
- [ ] Team elimination notifications + automatic read-only status
- [ ] Frontend: team creation, dashboard, submission UI (see §9.2)
- [ ] Replace hardcoded team member data in platform dashboard

---

## Appendix A: API Route Summary

### Teams (`/api/v1/hackathons/:slug/teams`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/` | ✅ | Any | Create team |
| `GET` | `/` | ❌ | — | List teams (paginated) |
| `GET` | `/me` | ✅ | — | Get my team |
| `POST` | `/join` | ✅ | Any | Join via invite code |
| `GET` | `/:teamId` | ❌ | — | Get team |
| `GET` | `/:teamId/members` | ❌ | — | Get members |
| `PATCH` | `/:teamId` | ✅ | Leader/Org | Update team |
| `DELETE` | `/:teamId/members/:userId` | ✅ | Leader/Org | Remove member |
| `POST` | `/:teamId/leave` | ✅ | Member | Leave team |
| `POST` | `/:teamId/transfer` | ✅ | Leader | Transfer leadership |
| `POST` | `/:teamId/dissolve` | ✅ | Leader/Org | Dissolve team |
| `POST` | `/seed` | ✅ | Co-Org+ | Bulk seed participants |

### Team Repos (`/api/v1/hackathons/:slug/teams`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `POST` | `/:teamId/repo` | ✅ | Leader | Link GitHub repo |
| `GET` | `/:teamId/repo` | ❌ | — | Get linked repo |
| `DELETE` | `/:teamId/repo` | ✅ | Leader | Unlink repo |

### Invites (`/api/v1/invites`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/team/:token` | ✅ | Accept team invite (email token) |

### Submissions (`/api/v1/hackathons/:slug/submissions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | ❌ | List submissions (paginated, filterable) |
| `GET` | `/ai-leaderboard` | ❌ | AI score leaderboard |
| `GET` | `/team/:teamId/current` | ❌ | Team's current submission |
| `GET` | `/:submissionId` | ❌ | Get submission detail |
| `POST` | `/` | ✅ | Create/update submission |
| `GET` | `/github/repos` | ✅ | List user's GitHub repos |
| `POST` | `/github/analyze` | ✅ | Analyze repo structure |
| `POST` | `/github/ai-review` | ✅ | AI code review |

## Appendix B: Zod Schema Reference

### `packages/shared/src/schemas/`

| File | Schema | Fields |
|------|--------|--------|
| `team.ts` | `createTeamSchema` | `name` (1–100), `track_id?` (uuid) |
| `team.ts` | `joinTeamSchema` | `invite_code` (exactly 8 chars) |
| `team.ts` | `updateTeamSchema` | `name?` (1–100), `track_id?` (uuid, nullable) |
| `team.ts` | `transferLeadershipSchema` | `new_leader_id` (uuid) |
| `team.ts` | `teamResponseSchema` | `id`, `hackathon_id`, `name`, `invite_code`, `track_id?`, `status`, `created_at`, `updated_at` |
| `team-member.ts` | `teamMemberResponseSchema` | `id`, `user_id`, `role`, `joined_at`, `user?` (name, email, github_username, avatar_url) |
| `team-invite.ts` | `createTeamInviteSchema` | `email` (email) |
| `team-invite.ts` | `bulkTeamInviteSchema` | `emails` (1–50 emails) |
| `team-repo.ts` | `linkRepoSchema` | `github_repo_url` (url, github pattern) |
| `submission.ts` | `submissionResponseSchema` | `id`, `hackathon_id`, `team_id`, `round_id?`, `tag_name`, `commit_sha`, `submitted_at`, `status`, `validated_at?`, `is_current`, `created_at` |
| `constants.ts` | `teamStatusSchema` | `forming \| ready \| submitted \| dissolved` |
| `constants.ts` | `teamMemberRoleSchema` | `leader \| member` |
| `constants.ts` | `teamInviteStatusSchema` | `pending \| accepted \| declined \| expired` |
| `constants.ts` | `submissionStatusSchema` | `pending_validation \| validated \| failed_validation \| tag_deleted` |
