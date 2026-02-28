# Participants — User Flow

> Roles: Team Leader (`leader`), Team Member (`member`) | Scope: Per-hackathon | App: `devsage.org`

---

## Who

CS students participating in hackathons. Interact on the participant app at `devsage.org/hackathons/:slug`, which dynamically themes based on hackathon configuration (logo, colors, copy).

| Sub-Role | Who | Permissions |
|----------|-----|-------------|
| Team Leader | Participant who creates/is assigned a team | Manage team, invite members, link repo, submit |
| Team Member | Participant who joins a team | Push code, view submissions, view results |

---

## Entry Points

| Hackathon Type | Discovery | Registration |
|----------------|-----------|--------------|
| **Private** | Invite email from Event Lead | Invite-only (bulk upload) |
| **Public** | Listed on `devsage.org/hackathons` | Open registration |

> Private hackathons are unlisted. Public hackathons appear on the hackathon directory.

---

## Flow A: Private Hackathon

### 1. Participant Seeding (by Event Lead)

Two modes depending on the data uploaded by the Event Lead:

**Mode A — Full Structure** (teams + roles pre-defined):
- Data: Name, Email, Team Name, Role Type (`lead`/`member`)
- Teams are pre-created. Leaders invited first.
- Leader clicks invite → GitHub OAuth → confirms pre-assigned team
- System then sends invites to members in that team
- Members click invite → GitHub OAuth → auto-join

**Mode B — Leaders Only** (teams formed by leaders):
- Data: Name, Email, Role Type (`lead`)
- Leaders invited, sign up via GitHub OAuth
- Leader confirms pre-assigned team (if name provided) or creates own team
- Leader invites members via platform invite (email) or team code
- No restriction on who can be invited

### 2. Member Joining (Both Modes)

1. Receive invite (email or team code)
2. Click link / enter code → GitHub OAuth
3. Join team → becomes Team Member
4. Cannot join if already on a team in this hackathon (`ALREADY_ON_TEAM`)

---

## Flow B: Public Hackathon

### 1. Discovery

1. Find the hackathon on `devsage.org/hackathons`
2. Click → hackathon page with dynamic theming

### 2. Registration

1. Register via **GitHub OAuth**
2. Open registration — no invite needed

### 3. Team Formation

1. Either:
   - **Create a team** → becomes Team Leader (gets team name + invite code)
   - **Join a team** via invite code → becomes Team Member
2. Can't join if already on a team

---

## Hackathon Participation (Both Types)

### 4. Repo Setup (Team Leader)

1. Link a **GitHub repo** to the team
2. Repo must be **private** during the hackathon
3. DevSage GitHub App is installed on the repo → webhooks activated

### 5. Build Phase (All Members)

1. Team pushes code to the linked repo
2. GitHub webhooks capture push events → commit log recorded, force-push detected
3. Activity visible on participant dashboard

### 6. Submission (Team Leader)

1. Create a **git tag** matching the submission tag pattern (e.g., `round1_v1`)
2. GitHub webhook fires → tag-create-handler processes it:
   - Validates tag pattern
   - Checks hackathon is in `active` state
   - Durable Object locks submission (exactly-once guarantee)
   - Submission record created in D1
   - Previous submission marked as not final (if resubmission allowed)
3. Submission appears on participant dashboard with status:
   - `received` — recorded successfully
   - `processing` — in queue (visible if > 5 seconds)
   - `rejected` — invalid (wrong pattern, wrong state, undersized team) with reason
   - `failed` — pipeline error, re-push the tag
4. **Late submissions** are accepted but flagged

### 7. Multi-Round Cycle

Each hackathon can have multiple rounds, each with its own deadline.

**Per round:**
1. Submit by creating a tag matching the submission pattern
2. Wait for judging
3. Round results published — scores and rankings visible to all participants

**After any round, the Event Lead may optionally eliminate teams:**
4. Event Lead selects which teams advance
5. **Eliminated teams** — can still view (leaderboard, announcements), can't submit
6. **Advancing teams** — enter next round's submission window

A hackathon can mix scored-only rounds with elimination rounds.

### 8. Results & Post-Hackathon

1. Final results published after last round
2. Leaderboard visible to all participants
3. Hackathon transitions: `judging → completed`

---

## Business Rules

| Rule | Detail |
|------|--------|
| Team Leader cannot leave | Leader is locked to the team unless they transfer leadership first (see below) |
| One team per participant | Cannot join a second team in the same hackathon |
| Team size limits | Min/max set by Event Lead. Joining rejected if team at max (`TEAM_FULL`). Submissions from undersized teams are accepted but flagged |
| Repos must be private | During the hackathon, linked repos must be private. If the GitHub App is uninstalled or the repo is made public mid-hackathon, webhooks stop firing and new submissions cannot be recorded. The team must reinstall the app / re-private the repo to resume |
| Late submissions accepted but flagged | Recorded but marked late |
| Resubmission per round | If allowed, new tag replaces previous as final for that round |
| Eliminated teams can view | Retain read access to dashboard, leaderboard, announcements |
| Round results visible to all | After judging, scores and rankings are visible to all participants |

### Leadership Transfer

1. Current Team Leader initiates transfer from team settings
2. Selects an existing Team Member as the new leader
3. On confirmation: selected member becomes Team Leader, former leader becomes Team Member
4. Transfer is immediate — no approval needed from the receiving member
5. Only one leader per team at any time

### Team Disbanding

Teams cannot be voluntarily disbanded by participants. Teams are removed from the active pool only through:

- **Elimination** — Event Lead eliminates the team after a round. Team retains read-only access (leaderboard, announcements) but can no longer submit
- **Disqualification** — Event Lead manually disqualifies the team (e.g., rule violation). Same read-only access

In both cases, the team record persists for audit purposes — it is not deleted.

### Resubmission Policy

Configured per-hackathon by the Event Lead. Options:

| Policy | Behavior |
|--------|----------|
| **Allowed** (default) | New tag replaces previous as final submission for that round. Previous submissions are retained but marked not-final |
| **Disabled** | First valid tag is the final submission. Subsequent tags for the same round are rejected |

---

## Participant Dashboard

| Section | What It Shows |
|---------|---------------|
| **Team** | Team name, members, invite code, team lead |
| **Repo** | Linked GitHub repo, connection status (warnings if GitHub App disconnected or repo is public) |
| **Submissions** | All submissions with tag, SHA, timestamp, status, which is final |
| **Current Round** | Active round info, deadline countdown, tag pattern to use |
| **Rounds** | All rounds with status (upcoming/active/judged), scores and rankings per round |
| **Leaderboard** | Cumulative rankings (when published by Event Lead). Updated after each round |
| **Announcements** | Event Lead messages and updates |
