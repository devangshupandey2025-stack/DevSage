# Participants — User Flow

> Roles: Team Leader, Team Member | Scope: Per-hackathon | App: `{hack}.{ws}.devsage.org` (branded site)

---

## Who

CS students participating in hackathons. Interact **exclusively on the per-hackathon branded site**, not on `devsage.org` or `platform.devsage.org`.

| Sub-Role | Who | Permissions |
|----------|-----|-------------|
| Team Leader | Participant who creates/is assigned a team | Manage team, invite members, link repo, submit |
| Team Member | Participant who joins a team | Push code, view submissions, view results |

---

## Entry Points

| Hackathon Type | Discovery | Registration |
|----------------|-----------|--------------|
| **Private** | Invite email from Event Lead | Invite-only (Excel upload) |
| **Public** | Listed on `devsage.org` (links to branded site) | Open registration on branded site |

> Private hackathons never appear on `devsage.org` unless the hackathon is over. Public hackathons are listed; clicking redirects to the branded site.

---

## Flow A: Private Hackathon

### 1. Invite Seeding (by Event Lead)

Three modes depending on the Excel structure uploaded by the Event Lead:

**Mode A — Full Structure** (teams + roles pre-defined):
- Columns: Name, Email, Team Name, Role Type (`lead`/`member`)
- Teams are pre-created. Leaders invited first.
- Leader clicks invite → GitHub OAuth → confirms pre-assigned team
- System then sends invites to members in that team
- Members click invite → GitHub OAuth → auto-join

**Mode B — Leaders Only** (teams formed by leaders):
- Columns: Name, Email, Role Type (`lead`)
- Leaders invited, sign up via GitHub OAuth
- Leader confirms pre-assigned team (if name in Excel) or creates own team
- Leader invites members via platform invite (email) or team code
- No restriction on who can be invited

**Mode C — Participants Only** (fully self-organized):
- Columns: Name, Email
- Everyone gets a generic participant invite
- Self-organize: anyone can create a team (becomes leader) or join via team code
- Same team formation as public hackathons, but behind an invite gate

### 2. Member Joining (All Modes)

1. Receive invite (email or team code)
2. Click link / enter code → branded site → GitHub OAuth
3. Join team → becomes Team Member
4. Cannot join if already on a team in this hackathon (`ALREADY_ON_TEAM`)

---

## Flow B: Public Hackathon

### 1. Discovery

1. Find the hackathon on `devsage.org/hackathons`
2. Click → redirected to the branded hackathon site

### 2. Registration

1. Register on the branded site via **GitHub OAuth**
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

1. Create a **git tag** matching the round's submission tag pattern (e.g., `round1_v1`)
2. GitHub webhook fires → tag-create-handler processes it:
   - Validates tag pattern against current round
   - Checks hackathon is in `active` state
   - Durable Object locks submission (exactly-once guarantee)
   - Submission record created in D1
   - Previous submission marked as not final (if resubmission allowed)
3. Submission appears on participant dashboard with status
4. **Late submissions** are accepted but flagged

### 7. Multi-Round Cycle

Each hackathon can have multiple rounds, each with its own deadline and tag pattern. Rounds can be one of two types:

**Per round:**
1. Submit by creating a tag matching that round's pattern
2. Wait for judging
3. Round results published — scores and rankings visible to all participants

**After an elimination round:**
4. Event Lead selects which teams advance
5. **Eliminated teams** — can still view (leaderboard, announcements), can't submit. Team can be disbanded after elimination.
6. **Advancing teams** — enter next round's submission window

**After a scoring-only round:**
4. All teams are scored and ranked — no teams are eliminated
5. Intermediate leaderboard updated
6. All teams proceed to the next round's submission window

A hackathon can mix round types (e.g., scoring-only → elimination → scoring-only).

### 8. Results & Post-Hackathon

1. Final results published after last round
2. Leaderboard visible to all participants
3. Hackathon transitions: `judging → completed`
4. Once completed/archived, private hackathons may appear on `devsage.org` as showcases

---

## Business Rules

| Rule | Detail |
|------|--------|
| Team Leader cannot leave | Leader is locked to the team for the hackathon duration |
| Members cannot leave mid-hackathon | Once joined, participants stay on their team |
| Teams disbanded only after elimination | Active/scoring-only teams cannot be disbanded. Only teams eliminated in an elimination round can be disbanded |
| Repos must be private | During the hackathon, linked repos must be private |
| One team per participant | Cannot join a second team in the same hackathon |
| Late submissions accepted but flagged | Recorded but marked late |
| Resubmission per round | If allowed, new tag replaces previous as final for that round |
| Eliminated teams can view | Retain read access to dashboard, leaderboard, announcements |
| Round results visible to all | After judging, scores and rankings for that round are visible to all participants regardless of round type |

---

## Participant Dashboard (Branded Site)

| Section | What It Shows |
|---------|---------------|
| **Team** | Team name, members, invite code, team lead |
| **Repo** | Linked GitHub repo, connection status |
| **Submissions** | All submissions with tag, SHA, timestamp, status, which is final |
| **Current Round** | Active round info, deadline countdown, tag pattern to use |
| **Rounds** | All rounds with type (elimination/scoring-only), status (upcoming/active/judged), scores and rankings per round |
| **Leaderboard** | Cumulative rankings (when published by Event Lead). Updated after each round |
| **Announcements** | Event Lead messages and updates |
