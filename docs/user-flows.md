# DevSage — User Workflows

> Detailed step-by-step workflows for every user role on the DevSage hackathon platform.
> Covers exactly what each user sees, clicks, and does — from first visit to completion.

**Last updated:** 2026-02-27

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [The Four Apps](#the-four-apps)
3. [Participant Workflows](#1-participant-devsageorg)
4. [Organizer Workflows](#2-organizer-platformdevsageorg)
5. [Judge Workflows](#3-judge-judgedevsageorg)
6. [Platform Admin Workflows](#4-platform-admin-shikdddevsageorg)
7. [Cross-Role Interactions](#cross-role-interactions)
8. [Hackathon Lifecycle](#hackathon-lifecycle)
9. [Notification Map](#notification-map)

---

## Platform Overview

DevSage is a GitHub-native hackathon management platform. It handles the full lifecycle of a hackathon — from an organizer requesting an event, through team formation and code submission, to judge scoring and final results publication.

**Four distinct user roles interact across four separate web applications:**

| Role | What They Do | App |
|------|-------------|-----|
| **Participant** | Discovers hackathons, forms teams, links repos, submits projects | `devsage.org` |
| **Organizer** | Creates and manages hackathons, seeds teams, configures judging, publishes results | `platform.devsage.org` |
| **Judge** | Scores submissions against rubric criteria, declares conflicts of interest | `judge.devsage.org` |
| **Platform Admin** | Approves hackathon requests, manages workspaces, oversees the entire platform | `shikdd.devsage.org` |

---

## The Four Apps

```
┌──────────────────────────────────────────────────────────────────────┐
│                        devsage.org (Web)                             │
│  Public website — participants browse and discover hackathons        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ "Register" redirects to ↓
┌──────────────────────────────────────────────────────────────────────┐
│                   platform.devsage.org (Platform)                    │
│  Organizer dashboard — create events, manage teams, run judging      │
│  Also where participants manage their teams and submissions          │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Organizer invites judges ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    judge.devsage.org (Judge)                          │
│  Dedicated scoring portal — judges score assigned submissions        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                   shikdd.devsage.org (Admin)                         │
│  Platform admin panel — approve requests, manage users & workspaces  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Participant (`devsage.org`)

Participants are people who join hackathons to build projects. They form teams, connect GitHub repositories, push code, and submit their work for judging.

### 1.1 Discovering Hackathons

**Where:** `devsage.org` → `/hackathons`

1. The participant visits `devsage.org` and lands on the **home page**.
   - The home page introduces DevSage with a hero section and call-to-action buttons.
   - Key features are highlighted: Hackathon Management, Team Formation, GitHub Integration, Real-time Lifecycle.

2. They click **"Browse Hackathons"** (or navigate to `/hackathons`).

3. The hackathons page shows a **searchable grid** of all hackathons:
   - Each card displays: **title**, **tagline**, **status badge** (Draft / Active / Judging / Completed / Archived), team size range, and dates.
   - A **search bar** at the top filters hackathons by name or tagline in real-time.
   - Cards are arranged in a responsive grid (1 column on mobile, 2 on tablet, 3 on desktop).

4. The participant clicks a hackathon card to view its **detail page** (`/hackathons/:slug`).

### 1.2 Viewing Hackathon Details

**Where:** `devsage.org` → `/hackathons/:slug`

The detail page shows everything a participant needs to decide whether to join:

- **Header section:** Title, tagline, status badge with color coding (green = active, purple = judging, sky = completed).
- **Key info cards:**
  - Registration status (Open / Invite Only / Approval Required)
  - Start date and judging window
  - Team size requirements (e.g., "2–5 members")
  - Maximum teams allowed
- **About the Event:** Full description rendered from markdown.
- **Rules:** The hackathon rules rendered from markdown.
- **Prizes:** Prize information displayed per track (if tracks exist).
- **Tracks:** If the hackathon has multiple competition tracks, they are listed with descriptions.

**Actions available:**
- **"Register Now"** button — takes the participant to the platform app to begin the registration/team-joining flow.
- **"View Rules"** button — scrolls to or expands the rules section.

### 1.3 Creating an Account

**Where:** `platform.devsage.org` → `/login`

To participate, the user must create an account:

1. The participant is redirected to the platform login page.
2. They can register in two ways:
   - **Email/password:** Enter name, email, and password (minimum 8 characters, maximum 128). They will need to verify their email via a 6-digit OTP sent to their inbox (valid for 10 minutes, max 5 attempts).
   - **Google OAuth:** Click "Continue with Google" → redirected to Google → redirected back with account created automatically.
   - **GitHub OAuth:** Click "Continue with GitHub" → redirected to GitHub → redirected back. GitHub username and profile are saved for later repo linking.

3. After successful registration/login, the participant lands on the **platform dashboard**.

### 1.4 Creating a Team

**Where:** `platform.devsage.org` → `/hackathons/:slug`

Once registered and viewing a hackathon (that is in `active` or `draft` status with registration enabled):

1. The participant clicks **"Create Team"**.
2. They fill out:
   - **Team name** (required, 1–100 characters)
   - **Track** (optional — if the hackathon has tracks, they pick one)
3. They submit the form.
4. The system:
   - Creates the team and assigns the participant as **team leader**.
   - Generates an **8-character invite code** (e.g., `A3Bx9K2m`).
   - Checks that max team count hasn't been exceeded.
   - Checks that the participant isn't already on another team in this hackathon.
5. The participant sees their new team page with the **invite code** prominently displayed to share with teammates.

### 1.5 Joining an Existing Team

**Where:** `platform.devsage.org`

Instead of creating a team, a participant can join one:

**Option A — Via invite code:**
1. The participant receives an invite code from a team leader (shared via chat, email, etc.).
2. They navigate to the hackathon and click **"Join Team"**.
3. They paste the **8-character invite code**.
4. The system validates:
   - The invite code exists and belongs to a team in this hackathon.
   - The team hasn't reached its maximum size.
   - The participant isn't already on another team.
5. On success, the participant is added as a **team member**.

**Option B — Via invite link:**
1. The team leader or organizer sends a team invite link (e.g., `/invite/:token`).
2. The participant clicks the link and is redirected to accept the invitation.
3. The system validates the invite token (checks expiration, status).
4. On acceptance, they're added to the team.

### 1.6 Team Management (as Team Leader)

**Where:** `platform.devsage.org` → `/hackathons/:slug/teams/:teamId`

The team leader has management capabilities:

| Action | What Happens |
|--------|-------------|
| **View members** | See all team members with their names, avatars, roles (leader/member), and join dates. |
| **Share invite code** | Copy the 8-character code to invite others. |
| **Remove a member** | Remove any member except themselves. The removed member can join another team. |
| **Transfer leadership** | Promote another member to team leader. The current leader becomes a regular member. |
| **Dissolve the team** | Permanently disband the team. All members are freed to join other teams. |
| **Update team info** | Change the team name or switch tracks (if tracks exist). |

**Regular team members can:**
- View team details and members.
- **Leave the team** (unless they are the leader — leaders must transfer leadership first).

### 1.7 Linking a GitHub Repository

**Where:** `platform.devsage.org` → Team page

If the hackathon requires a repository (`require_repo: true`):

1. The **team leader** clicks **"Link Repository"**.
2. They enter the **GitHub repository URL** (e.g., `https://github.com/myteam/project`).
   - The system parses and validates the URL format.
   - It extracts the owner and repo name.
3. The repository is linked to the team.
4. A GitHub App installation is queued for webhook setup (to track pushes, tags, and force-push events).

Once linked:
- The team's repo is visible on the team page and in submissions.
- Only the team leader can **unlink** the repo.

### 1.8 Submitting a Project

**Where:** `platform.devsage.org` → `/hackathons/:slug` (submissions section)

When the hackathon is in `active` status and the team is ready to submit:

1. The team member navigates to the submission section.
2. They fill out the **submission form**:
   - **Title** (required) — name of the project.
   - **Description** — what the project does.
   - **Repository URL** (required) — the GitHub repo link.
   - **Demo URL** (optional) — link to a live demo.
   - **Video URL** (optional) — link to a demo video.
   - **Round** — which round this submission is for (defaults to the first active round).
3. They can optionally trigger:
   - **Repository analysis** — the system analyzes the repo: detects frameworks, dependencies, Docker setup, CI/CD, tests, README quality.
   - **AI review** — a Gemini AI review scores the repo (1–100) and provides strengths, improvements, tech stack assessment, and hackathon readiness.
4. They click **"Submit"**.
5. The system:
   - Creates the submission record.
   - Marks any previous submission by this team as non-final (`is_current: false`).
   - The new submission becomes the team's **current final submission**.

**Resubmission:** If the hackathon allows resubmission (`allow_resubmission: true`), teams can submit again. The latest submission replaces the previous one as the "final" entry.

**Git tag-based submission (advanced):** Teams can also submit via git tags matching the `submission_tag_pattern` (e.g., `submission_v1`). When a matching tag is pushed:
1. The GitHub webhook receives the push event.
2. The system validates the tag against the pattern.
3. A submission record is created with the commit SHA.
4. The team is notified of successful submission.

### 1.9 Viewing Leaderboard & Results

**Where:** `platform.devsage.org` → `/hackathons/:slug/leaderboard`

Once judging begins or completes:

1. The participant navigates to the **Leaderboard** page.
2. The leaderboard shows:
   - **Rank** — position in the competition.
   - **Team name** — the team's name.
   - **Total score** — weighted aggregate score across all rubric criteria.
   - **Judging progress** — percentage of judges who have scored this team.
3. During `active` status, an **AI leaderboard** may be available showing AI analysis scores (before human judging begins).
4. During `judging` status, scores update in real-time as judges submit.
5. After `completed` status, the final rankings are locked and published.

### 1.10 Receiving Notifications

Participants receive in-app and email notifications for:

| Event | Notification |
|-------|-------------|
| Joined a team | "You joined [team name]" |
| Submission confirmed | "Your submission has been received" |
| New announcement | Organizer posted an update |
| Deadline approaching | Reminder before submission deadline |
| Results published | "Results are in! Check the leaderboard" |
| Removed from team | "You were removed from [team name]" |

Notifications appear in the **notification bell** in the platform header bar. The unread count badge updates in real-time.

---

## 2. Organizer (`platform.devsage.org`)

Organizers are clubs or individuals who create and run hackathons. They manage the entire event lifecycle — from requesting approval to publishing final results.

### 2.1 Getting Started — Workspace Setup

**Where:** `platform.devsage.org`

Before creating hackathons, an organizer needs a workspace:

1. **Receive platform invite** — A platform admin sends an invite to the organizer's email.
2. **Sign up** — The organizer registers via email/password or Google/GitHub OAuth.
3. **Create a workspace** — The organizer creates their organization's workspace:
   - **Name** (required, 1–200 characters) — e.g., "IEEE VIT"
   - **Slug** (required, unique) — e.g., `ieee-vit` (used in URLs)
   - **Type** — `club` (organization/club) or `individual` (solo organizer)
   - **Description** (optional, up to 2,000 characters)
4. The creator automatically becomes the workspace **owner**.

**Workspace roles:**
| Role | Can Do |
|------|--------|
| **Owner** | Everything — manage members, create hackathons, delete workspace. Max 2 owners per workspace. |
| **Admin** | Manage workspace settings, invite members, create hackathons. |
| **Member** | View workspace, participate in hackathons. |

**Inviting co-organizers:**
1. Go to workspace settings.
2. Click **"Invite Member"**.
3. Enter their email and assign a role (admin or member).
4. The system sends an email with a 7-day invite link.
5. The invitee clicks the link, signs up/logs in, and their email must match the invite.

### 2.2 Requesting a New Hackathon

**Where:** `platform.devsage.org` → Dashboard → "Request New Hackathon"

Hackathons aren't created directly — organizers submit a request that a platform admin reviews:

1. The organizer clicks **"Request New Hackathon"** from the dashboard.
2. They fill out the request form:
   - **Workspace** (required) — which workspace this hackathon belongs to.
   - **Title** (required) — name of the hackathon (e.g., "VIT Code Sprint 2026").
   - **Description** — what the hackathon is about.
   - **Start date / End date** — planned event window.
   - **Number of events** — how many hackathons they plan to run.
   - **Expected participants** — estimated headcount.
   - **Team size** — minimum and maximum team sizes.
   - **Additional details** — any extra context for the admin.
3. They click **"Submit Request"**.
4. The request enters `submitted` status.

### 2.3 Tracking the Request

**Where:** `platform.devsage.org` → Dashboard → "My Requests"

The organizer can track their request through a visual status pipeline:

```
Submitted → Under Review → Approved → Building → Ready
                              │
                              ├── Changes Requested → (edit & resubmit) → Submitted
                              │
                              └── Rejected (with reason)
```

The request detail page shows:
- **Current status** with a visual step tracker (completed steps in green, current step pulsing).
- **Admin notes** — feedback from the platform admin.
- **Status history** — timestamped log of every status change.
- **Full request details** — everything they submitted.

**If changes are requested:**
1. The organizer sees the admin's notes explaining what needs to change.
2. They click **"Resubmit"**, edit the request details, and submit again.
3. The request goes back to `submitted` for another admin review.

**When the request reaches `ready`:**
- The system automatically creates the hackathon in `draft` state.
- It appears on the organizer's dashboard, ready for configuration.

### 2.4 The Dashboard

**Where:** `platform.devsage.org` → `/dashboard`

The dashboard is the organizer's command center:

- **Hackathon cards** — each hackathon the organizer manages, showing:
  - Title, slug, and status badge.
  - Quick stats: team count, submission count, judge count.
  - Status-specific action buttons (e.g., "Activate" for drafts, "Start Judging" for active).
- **Status filter tabs** — filter by Draft / Active / Judging / Completed / Archived.
- **Request section** — pending hackathon creation requests.
- **Workspace switcher** — switch between workspaces if they belong to multiple.

### 2.5 Configuring a Hackathon (Draft Stage)

**Where:** `platform.devsage.org` → `/hackathons/:slug/settings`

While in `draft` status, the organizer configures every aspect of the hackathon:

**Basic Settings:**
| Field | Description |
|-------|------------|
| Title | Event name (1–200 chars) |
| Tagline | Short description (up to 300 chars) |
| Description | Full event description (up to 5,000 chars, markdown) |
| Rules | Competition rules (markdown) |
| Timezone | For deadline calculations |

**Dates & Timing:**
| Field | Description |
|-------|------------|
| Starts at | When the hackathon opens for coding |
| Judging starts | When the judging window opens |
| Judging ends | When judges must finish scoring |

**Team Rules:**
| Field | Description |
|-------|------------|
| Min team size | Minimum members per team (1–50) |
| Max team size | Maximum members per team (1–50) |
| Max teams | Cap on total teams (optional) |

**Registration:**
| Field | Description |
|-------|------------|
| Registration mode | `open` (anyone joins), `invite_only` (invite code required), `approval` (organizer approves each) |
| Allow registration during active | Let new teams join after the event starts |
| Allowed email domains | Restrict to specific email domains (e.g., `@vit.ac.in`) |

**Submission Rules:**
| Field | Description |
|-------|------------|
| Require repo | Teams must link a GitHub repository |
| Allow resubmission | Teams can update their submission |
| Submission tag pattern | Git tag pattern for tag-based submissions (e.g., `submission_v%`) |

**Visibility:**
| Field | Description |
|-------|------------|
| Show judge comments to participants | Whether participants can see judge feedback |
| Notify all on deadline | Send deadline reminders to all participants |

**Tracks & Prizes:**
- Add multiple competition tracks (e.g., "Web", "AI/ML", "IoT") with descriptions.
- Add prizes per track or overall.

### 2.6 Setting Up Rounds

**Where:** `platform.devsage.org` → `/hackathons/:slug/rounds`

Hackathons can have multiple judging rounds (e.g., Round 1 screening, Round 2 finals):

1. Click **"Create Round"**.
2. Fill in:
   - **Name** (required) — e.g., "Round 1 - Initial Review"
   - **Round number** (required) — ordering (1, 2, 3...)
   - **Type** — `elimination` (teams are cut) or `scoring_only` (all teams proceed)
   - **Submission deadline** (optional) — per-round deadline
3. Click **"Initialize"** to activate a round:
   - Sets the round status to `active`.
   - Records the `started_at` timestamp.
   - Makes the round available for submissions.
4. After scoring, the organizer can:
   - **Publish results** — computes rankings for the round.
   - **Advance teams** (elimination rounds only) — select which teams move to the next round. Teams not selected are marked `eliminated`.

### 2.7 Building the Judging Rubric

**Where:** `platform.devsage.org` → `/hackathons/:slug/judging`

Before judges can score, the organizer defines the rubric:

1. Navigate to the **Judging** page.
2. Click **"Add Criterion"**.
3. For each criterion, fill in:
   - **Name** (required) — e.g., "Innovation", "Technical Complexity", "Presentation"
   - **Description** — what judges should evaluate
   - **Max score** (1–100, default 10) — the highest possible score
   - **Weight** (0–1, decimal) — how much this criterion counts toward the total (e.g., 0.25 = 25%)
   - **Track** (optional) — if set, this criterion only applies to teams in that track. If blank, it applies to all teams.
   - **Round** — which round this criterion belongs to
   - **Sort order** — display ordering
4. All criteria weights should ideally sum to 1.0 (100%).

**Example rubric:**
| Criterion | Max Score | Weight | Description |
|-----------|-----------|--------|-------------|
| Innovation | 10 | 0.25 | Novelty and creativity of the solution |
| Technical Execution | 10 | 0.30 | Code quality, architecture, testing |
| Design & UX | 10 | 0.20 | User interface and experience |
| Presentation | 10 | 0.15 | Demo clarity and documentation |
| Impact | 10 | 0.10 | Potential real-world impact |

### 2.8 Inviting Judges

**Where:** `platform.devsage.org` → `/hackathons/:slug/judging`

1. Click **"Invite Judge"**.
2. Enter the judge's **email address**.
3. Click **"Send Invite"**.
4. The system:
   - Creates a judge record with `pending` status.
   - Generates a unique invite token.
   - Sends an email with an invite link to `judge.devsage.org/invite/judge/:token`.
5. The judge's status shows as **Pending** until they accept.

**Bulk invite:** Click **"Bulk Invite"** and enter up to 50 email addresses at once.

**Create judge account:** For judges without existing accounts, the organizer can:
1. Click **"Create Judge Account"**.
2. Enter: name, email, temporary password, and track assignment.
3. The system creates an account with `password_must_change` flag.
4. The judge must change their password on first login.

**Judge status tracking:**
| Status | Meaning |
|--------|---------|
| **Pending** | Invite sent, waiting for response |
| **Accepted** | Judge accepted the invite |
| **Declined** | Judge declined the invite |

**Track assignment:** After a judge accepts, the organizer can assign them to a specific track (so they only score submissions in that track).

### 2.9 Activating the Hackathon

**Where:** `platform.devsage.org` → Dashboard or `/hackathons/:slug`

When everything is configured:

1. The organizer clicks **"Activate"** (transitions from `draft` → `active`).
2. The Durable Object state machine validates the transition.
3. Once active:
   - Registration opens (participants can create/join teams).
   - The hackathon appears publicly on `devsage.org`.
   - Teams can start linking repos and submitting.

### 2.10 Seeding Teams (Bulk Import)

**Where:** `platform.devsage.org` → `/hackathons/:slug/teams`

For hackathons with pre-formed teams (e.g., classroom events), organizers can bulk-seed:

1. Click **"Seed Teams"**.
2. Choose a seeding mode:
   - **Full structure** — provide team names, leader emails, and member emails.
   - **Leaders only** — provide team names and leader emails; members join later.
   - **Participants only** — provide a list of email addresses; the system assigns them.
3. Enter data in **JSON** or **CSV** format:
   - JSON: `[{"team_name": "Alpha", "leader_email": "alice@example.com", "member_emails": ["bob@example.com"]}]`
   - CSV: `Alpha, alice@example.com, bob@example.com`
4. Click **"Import"**.
5. The system:
   - Creates teams in bulk (max 100 teams or 500 emails per request).
   - Generates invite codes for each team.
   - Sends email invitations to all members.
   - Returns a summary of created teams and sent invites.

### 2.11 Monitoring the Event

**Where:** `platform.devsage.org` → Various pages

While the hackathon is `active`, the organizer monitors activity:

**Teams page** (`/hackathons/:slug/teams`):
- See all registered teams with member counts.
- Search/filter by team name.
- Click into any team to see members, linked repo, and status.

**Submissions page** (`/hackathons/:slug/submissions`):
- View all team submissions with:
  - Team name and repo link.
  - Git tag and commit SHA.
  - **AI analysis score** (color-coded: red < 40, amber 40–70, green ≥ 70).
  - Expandable **AI review** showing: summary, strengths, improvements, tech stack assessment, hackathon readiness.
  - **Repo analysis** details: detected frameworks, dependencies, Docker, CI/CD, tests, README quality.
- Search submissions by team name.

**Announcements** (`/hackathons/:slug/announcements`):
- Post announcements to all participants.
- Pin important announcements to the top.
- Edit or delete existing announcements.

**Analytics** (`/hackathons/:slug/analytics`):
- Total teams, submissions, and judgments.
- Participation metrics.
- Score distributions.

**Activity log** (`/hackathons/:slug/activity`):
- Full audit trail of every action taken in the hackathon.
- Filter by: action type, entity type, actor.
- Cursor-paginated (up to 100 events per page).
- Every event includes: who did it, what changed, when, and a SHA-256 hash for integrity.

### 2.12 Transitioning to Judging

**Where:** `platform.devsage.org` → Dashboard or `/hackathons/:slug`

When the coding phase ends:

1. The organizer clicks **"Start Judging"** (transitions from `active` → `judging`).
2. The Durable Object state machine enforces the transition:
   - Submissions are locked — no new submissions accepted.
   - The version number is checked for optimistic concurrency.
3. Once in judging:
   - Judges can begin scoring.
   - The leaderboard becomes active.

### 2.13 Assigning Judges to Submissions

**Where:** `platform.devsage.org` → `/hackathons/:slug/judging`

Judges need to be assigned to submissions before they can score:

**Auto-assign (round-robin):**
1. Click **"Auto-Assign"**.
2. Optionally select a specific round.
3. The system distributes submissions evenly across accepted judges.
4. If judges are track-specific, they only receive submissions from their track.

**Manual review:**
- View all assignments on the judging page.
- See which judge is assigned to which team.
- Reassign if needed (e.g., after a conflict of interest).

### 2.14 Monitoring Scoring Progress

**Where:** `platform.devsage.org` → `/hackathons/:slug/judging` and `/hackathons/:slug/leaderboard`

During judging, the organizer tracks progress:

**Judging page:**
- Per-judge progress: how many assignments scored vs. total.
- Assignment statuses: pending, scored, skipped (conflict).
- Conflict of interest declarations with reasons.

**Leaderboard** (`/hackathons/:slug/leaderboard`):
- Real-time rankings updated as judges submit scores.
- Shows: rank, team name, total weighted score, judging completion percentage.
- Filterable by round and track.
- ETag-cached (30s during judging, 1h when completed).

### 2.15 Handling Conflicts of Interest

When a judge declares a conflict of interest:

1. The organizer sees the COI on the judging page with the judge's stated reason.
2. They click **"Reassign"** on the flagged assignment.
3. They select a different judge to take over.
4. The system creates a new assignment and marks the old one as `reassigned`.

### 2.16 Publishing Results

**Where:** `platform.devsage.org` → `/hackathons/:slug/judging`

When all judges have finished scoring:

1. **Per-round results:**
   - Navigate to the round management page.
   - Click **"Publish Results"** for the round.
   - The system computes rankings based on weighted scores.
   - For elimination rounds, the organizer selects advancing teams.

2. **Final results:**
   - Click **"Publish Final Results"** on the judging page.
   - The system computes final standings across all rounds.
   - The leaderboard locks with final rankings.
   - All participants receive a notification.

3. **Transition to completed:**
   - The organizer transitions the hackathon from `judging` → `completed`.
   - The leaderboard becomes the permanent record.

### 2.17 Managing Organizer Team

**Where:** `platform.devsage.org` → `/hackathons/:slug` (organizers section)

The primary organizer can manage who helps run the hackathon:

| Action | Who Can Do It |
|--------|--------------|
| **Add co-organizer** | Organizer only (not co-organizer) |
| **Remove co-organizer** | Organizer only |
| **View organizer list** | Any co-organizer or above |

**Roles:**
- **Organizer** — full control: state transitions, result publication, score overrides, co-organizer management.
- **Co-organizer** — can manage teams, judges, rubrics, assignments, announcements, and settings. Cannot make state transitions or publish results.

### 2.18 Archiving

**Where:** `platform.devsage.org` → `/hackathons/:slug/settings`

After the hackathon is complete:

1. The organizer transitions from `completed` → `archived`.
2. The hackathon becomes read-only.
3. The audit trail is sealed.

**Exception:** An archived hackathon can be un-archived (`archived` → `completed`) for score corrections — this is the only backward transition allowed.

---

## 3. Judge (`judge.devsage.org`)

Judges are invited by organizers to evaluate hackathon submissions. They have a dedicated portal focused entirely on scoring.

### 3.1 Receiving and Accepting an Invite

**Trigger:** The organizer invites the judge from the platform app.

1. The judge receives an **email** with an invite link: `judge.devsage.org/invite/judge/:token`.
2. They click the link and land on the **invite acceptance page**.
3. **If they already have an account:** They log in and the invite is auto-accepted.
4. **If they're new:**
   - They see a registration form: name, password (minimum 8 chars), confirm password.
   - They fill it out and click **"Create Account & Accept"**.
   - An account is created and they're logged in automatically.
5. **If the organizer created their account:** They log in with the temporary password and are immediately prompted to change it on `/change-password`.
6. After acceptance, they're redirected to the **judge dashboard**.

**Declining:** Judges can also decline the invite directly from the email link without logging in.

### 3.2 The Judge Dashboard

**Where:** `judge.devsage.org` → `/dashboard`

The dashboard shows a personalized welcome and all hackathons where the judge has accepted assignments:

Each hackathon card shows:
- **Hackathon name** and status badge.
- **Pending assignments** count (amber badge) — submissions they haven't scored yet.
- **Completed scores** count (green badge) — submissions they've finished.
- **"Start Scoring"** button — navigates to the scoring interface.

If the judge has no assignments yet, they see: *"No judging assignments yet. You'll be notified when assignments are ready."*

### 3.3 Viewing Assignments

**Where:** `judge.devsage.org` → `/hackathons/:slug/assignments`

The assignments page lists every submission assigned to this judge:

Each assignment shows:
- **Team name**
- **Git tag / commit SHA** (links to GitHub)
- **Status badge:**
  - `Pending` — not yet scored (amber)
  - `Scored` — scoring complete (green)
  - `Conflict` — conflict of interest declared (red)
  - `Skipped` — skipped this assignment (gray)

**Actions per assignment:**
| Status | Available Actions |
|--------|------------------|
| Pending | **"Score"** → go to scoring form · **"COI"** → declare conflict of interest |
| Scored | View only — score already submitted |
| Conflict | View only — reason displayed |
| Skipped | View only |

### 3.4 Declaring a Conflict of Interest

If a judge has a personal connection to a team (e.g., knows a member, mentored the team):

1. They click the **"COI"** button on the assignment.
2. A dialog appears asking for the **reason** (required text field).
3. They submit the declaration.
4. The system:
   - Records the conflict with the reason.
   - Marks the assignment as `conflict`.
   - Notifies the organizer to reassign the submission to another judge.
5. **Important:** A judge cannot declare a COI after they've already scored that submission.

### 3.5 Scoring a Submission

**Where:** `judge.devsage.org` → `/hackathons/:slug/score`

This is the core judge workflow. The scoring interface has two panels:

**Left panel — Submission list:**
- All assigned submissions listed vertically.
- Search/filter by team name.
- Click a submission to load it in the right panel.
- Visual indicators show which are scored vs. pending.

**Right panel — Scoring form (for the selected submission):**

1. **Submission header:**
   - Team name.
   - Git tag and commit SHA.
   - GitHub repo link (opens in new tab for code review).
   - Demo URL and video URL (if provided).

2. **Rubric criteria** (one section per criterion):
   - **Criterion name** and description.
   - **Score input** — number field from 0 to the criterion's max score.
   - **Weight indicator** — shows what percentage of the total this criterion represents (e.g., "25% of total").
   - **Comment field** (optional, up to 1,000 characters) — feedback for this specific criterion.

3. **Scoring actions:**
   - **"Submit Score"** — saves all criterion scores for this submission. The system:
     - Upserts scores (updates if already scored, inserts if new).
     - Marks the assignment as `scored`.
     - Invalidates the leaderboard cache so rankings update.
   - **"Skip"** — skip to the next assignment without scoring.
   - **Previous / Next** buttons — navigate between assignments.

4. **Real-time calculation:**
   - As the judge enters scores, the weighted total is calculated live.
   - The judge can see how their scoring compares to the maximum possible score.

### 3.6 Reviewing Past Scores

**Where:** `judge.devsage.org` → (accessible from the scoring interface)

A judge can review scores they've already submitted:
- Navigate to a previously scored submission.
- All criterion scores and comments are pre-filled.
- They can update scores and re-submit (scores are upserted).
- The system shows up to 200 of their most recent scores with criterion metadata.

### 3.7 Viewing the Leaderboard

**Where:** `judge.devsage.org` → `/hackathons/:slug/leaderboard`

Judges can see the real-time standings:
- Rank, team name, total weighted score.
- Percentage of judges who have completed scoring for each team.
- Sortable by rank or score.
- Updates live as other judges submit their scores.

### 3.8 Managing Their Account

**Profile** (`/profile`): View and edit name, email, avatar.

**Change password** (`/change-password`):
- Enter current password.
- Enter new password and confirm.
- On success, all existing sessions are revoked for security.

---

## 4. Platform Admin (`shikdd.devsage.org`)

Platform admins oversee the entire DevSage platform. They approve hackathon requests, manage workspaces and users, and maintain platform integrity.

### 4.1 Admin Dashboard

**Where:** `shikdd.devsage.org` → `/`

The dashboard shows a bird's-eye view of the platform:

**Statistics cards:**
- Total registered users.
- Total workspaces.
- Total hackathons.
- Currently active hackathons.
- Pending hackathon requests (action needed).

**Quick action cards:**
| Card | Action |
|------|--------|
| Manage Invites | Send organizer invitations |
| Workspaces | Browse and manage all workspaces |
| Admins | Add/remove platform administrators |
| Users | Browse all registered users |
| Hackathon Requests | Review and approve new events |

**Maintenance section:** Trigger audit hash backfill (ensures SHA-256 hash chain integrity across all audit events).

### 4.2 Reviewing Hackathon Requests

**Where:** `shikdd.devsage.org` → `/hackathon-requests`

This is the admin's most important workflow — reviewing requests from organizers who want to create hackathons.

**The request queue:**
- Shows all requests sorted by status and date.
- Filterable by status: Submitted, Under Review, Approved, Changes Requested, Building, Ready, Rejected.
- Each request card shows: requester name, workspace, proposed title, expected dates, and current status.

**Reviewing a request:**

1. Click into a request to see the full detail:
   - Requester's name, email, and workspace.
   - Event title and description.
   - Expected dates and participant count.
   - Team size constraints.
   - Additional notes from the organizer.
   - **Status history** — timestamped log of every status change.
   - **Admin notes** — previous admin feedback.

2. **Status actions** (available actions depend on current status):

| Current Status | Available Actions | What Happens |
|---------------|-------------------|-------------|
| **Submitted** | Start Review | Moves to `under_review`. Organizer notified. |
| **Under Review** | Approve | Moves to `approved`. Organizer notified via email. |
| **Under Review** | Request Changes | Moves to `changes_requested`. Admin writes notes explaining what to fix. Organizer notified. |
| **Under Review** | Reject | Moves to `rejected` with reason. Organizer notified via email. |
| **Approved** | Start Building | Moves to `building`. Admin/system is setting up the event. |
| **Building** | Mark Ready | Moves to `ready`. The system **automatically creates the hackathon** in `draft` state. Organizer is notified. |
| **Approved/Building/Ready** | Request Changes | Sends back for modifications. |

3. The admin can add **notes** at each step to communicate with the organizer.

**Status color coding:**
- Amber = Submitted
- Blue = Under Review
- Green = Approved
- Orange = Changes Requested
- Purple = Building
- Sky = Ready
- Red = Rejected

### 4.3 Managing Users

**Where:** `shikdd.devsage.org` → `/users`

- Paginated table (20 users per page) showing all registered users.
- Columns: avatar, name, email, join date, last login.
- Pagination controls: Previous / Next, showing "1–20 of 350".
- Search and filtering capabilities.

### 4.4 Managing Workspaces

**Where:** `shikdd.devsage.org` → `/workspaces`

**List view:**
- All workspaces with name, slug, type, member count.
- Click any workspace to drill in.

**Workspace detail** (`/workspaces/:id`):
- Workspace info: name, slug, type, description, creation date.
- **Members list:** All members with roles (owner/admin/member).
- **Hackathons:** All hackathons created under this workspace.
- **Invites:** Pending workspace invitations.

**Create workspace:**
1. Click **"Create Workspace"**.
2. Fill in: name, slug, type, description, and **owner email**.
3. The system creates the workspace and sends an invite email to the specified owner.

### 4.5 Managing Platform Admins

**Where:** `shikdd.devsage.org` → `/admins`

- View all current platform admins.
- **Add admin:** Enter a user ID to grant platform admin access.
- **Remove admin:** Remove admin access from a user (cannot remove yourself).

### 4.6 Managing Platform Invites

**Where:** `shikdd.devsage.org` → `/invites`

Platform invites are used to onboard new organizers:

1. Click **"Create Invite"**.
2. Enter the invitee's email.
3. The system generates a unique invite code and sends an email.
4. View all pending, accepted, and expired invites.
5. **Revoke** invites that are no longer needed.

### 4.7 Monitoring Hackathons

**Where:** `shikdd.devsage.org` → `/hackathons`

- Paginated list of all hackathons across all workspaces.
- See: title, slug, status, workspace, created date, start date.
- Click into any hackathon for a detail view.
- Admin can **initialize rounds** for any hackathon (useful for troubleshooting).

### 4.8 Viewing Request Statistics

**Where:** `shikdd.devsage.org` → `/hackathon-requests` (stats section)

Aggregated counts by status:
- How many requests are in each pipeline stage.
- Helps prioritize which requests need attention.

---

## Cross-Role Interactions

The four roles don't operate in isolation — they interact throughout the hackathon lifecycle:

```
┌─────────────┐     invite      ┌──────────────┐     invite      ┌─────────────┐
│   ADMIN     │ ──────────────→ │  ORGANIZER   │ ──────────────→ │   JUDGE     │
│             │     approve     │              │    assign        │             │
│ Reviews     │ ──────────────→ │ Creates &    │ ──────────────→ │ Scores      │
│ requests    │                 │ manages      │                  │ submissions │
└─────────────┘                 │ hackathon    │                  └─────────────┘
                                │              │                        │
                                │              │ seed/invite            │ scores
                                │              │ ↓                      │ ↓
                                │              │ ┌──────────────┐       │
                                │              │→│ PARTICIPANT  │←──────┘
                                │              │ │              │ receives results
                                │              │ │ Joins teams, │
                                └──────────────┘ │ submits code │
                                                 └──────────────┘
```

**Key interaction points:**

| From | To | Interaction |
|------|----|-------------|
| Admin → Organizer | Platform invite email | Admin sends invite to onboard a new organizer |
| Organizer → Admin | Hackathon creation request | Organizer submits request, admin reviews |
| Admin → Organizer | Request status update | Admin approves/rejects/requests changes |
| Organizer → Participant | Team seeding / registration | Organizer seeds teams or opens registration |
| Participant → Participant | Team invite code | Team leader shares invite code with teammates |
| Organizer → Judge | Judge invite email | Organizer invites judges by email |
| Organizer → Judge | Assignment | Organizer assigns submissions to judges |
| Judge → Organizer | COI declaration | Judge flags a conflict, organizer reassigns |
| Judge → Participant | Scores & feedback | Judge scores appear on leaderboard; comments visible if enabled |
| Organizer → Participant | Announcements | Organizer posts updates, participants receive notifications |
| Organizer → Participant | Results publication | Organizer publishes results, participants see final leaderboard |

---

## Hackathon Lifecycle

The hackathon state machine drives the entire event flow. Each state determines what actions are available:

```
                    ┌─────────────────────────────────────────────────┐
                    │              HACKATHON LIFECYCLE                 │
                    └─────────────────────────────────────────────────┘

   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌───────────┐     ┌──────────┐
   │  DRAFT  │────→│ ACTIVE  │────→│ JUDGING │────→│ COMPLETED │────→│ ARCHIVED │
   └─────────┘     └─────────┘     └─────────┘     └───────────┘     └──────────┘
                                                          ↑                │
                                                          └────────────────┘
                                                        (score corrections)
```

### What Users Can Do in Each State

| State | Organizer | Participant | Judge |
|-------|-----------|-------------|-------|
| **Draft** | Configure settings, rounds, rubric, invite judges | Cannot see (not yet public) | Cannot access |
| **Active** | Monitor teams, review submissions, post announcements | Register, create/join teams, link repos, submit projects | Cannot score yet |
| **Judging** | Assign judges, monitor scoring, handle COIs | View leaderboard (no new submissions) | Score assigned submissions, declare COIs |
| **Completed** | Publish final results, review audit trail | View final leaderboard and scores | View final results |
| **Archived** | Read-only access | Read-only access | Read-only access |

### Transition Details

| Transition | Who Triggers | What Happens |
|------------|-------------|-------------|
| `draft` → `active` | Organizer | Registration opens. Event appears publicly. Teams can form. |
| `active` → `judging` | Organizer | Submissions lock. Judges can begin scoring. |
| `judging` → `completed` | Organizer | Results are finalized. Final leaderboard published. |
| `completed` → `archived` | Organizer | Event becomes read-only. Audit trail sealed. |
| `archived` → `completed` | Organizer | Re-opened for score corrections only. |

Each transition is enforced by a **Durable Object** (`HackathonStateMachine`) with optimistic versioning — the caller must provide the current `version` number, preventing concurrent conflicting transitions.

---

## Notification Map

Notifications are delivered both in-app (bell icon with unread count) and via email:

### Hackathon Request Notifications

| Event | Who Gets Notified | Channel |
|-------|-------------------|---------|
| New request submitted | All platform admins | In-app + email |
| Request under review | Requesting organizer | In-app |
| Request approved | Organizer + workspace members | In-app + email |
| Request rejected | Requesting organizer | In-app + email |
| Changes requested | Requesting organizer | In-app + email |
| Request building | Requesting organizer | In-app |
| Request ready (hackathon created) | Organizer + workspace members | In-app + email |

### Hackathon Event Notifications

| Event | Who Gets Notified | Channel |
|-------|-------------------|---------|
| Team invite sent | Invited participant | Email |
| Team joined | Team members | In-app |
| Submission received | Team members | In-app |
| Submission deadline approaching | All participants | In-app + email |
| Announcement posted | All hackathon participants | In-app |
| Judge invited | Judge | Email |
| Judge assignment ready | Judge | In-app |
| Results published | All participants | In-app + email |

### Account Notifications

| Event | Who Gets Notified | Channel |
|-------|-------------------|---------|
| Email verification OTP | User | Email |
| Password reset link | User | Email |
| Workspace invite | Invitee | Email |
| Account deletion confirmation | User | Email |
