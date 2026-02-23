# Event Lead(s) — Student Coordinator User Flow

> Role: Event Lead | Scope: Per-hackathon | App: `platform.devsage.org` | Count: Typically 2 per hackathon

---

## Who

Student coordinators who run hackathons day-to-day. Invited by Workspace Managers onto specific hackathons. Both Event Leads on a hackathon have equal, identical permissions.

---

## Flow

### 1. Onboarding

1. Receive invite from Workspace Manager for a specific hackathon
2. Click invite link → land on `platform.devsage.org`
3. Sign up or log in (Google OAuth or email/password with OTP 2FA)
4. Accept hackathon invite → now has access to that hackathon

### 2. Configuration (Draft Phase)

Once the DevSage team has deployed the hackathon frontend and notified the leads:

1. Log into Platform, select the hackathon
2. Configure operational details:
   - **Rounds** — define round names, numbers, and type per round:
     - **Elimination round** — after judging, Event Lead selects which teams advance; remaining teams are eliminated
     - **Scoring-only round** — all teams are scored and ranked but none are eliminated; everyone proceeds to the next round
   - **Rubric** — weighted scoring criteria per round (e.g., Innovation ×2.0, Execution ×1.5). Can differ between rounds
   - **Judges** — two methods:
     - **Email invite** — send invite link, judge signs up with their own password
     - **Create account** — create judge account with temporary credentials, judge must reset password on first login
   - **Settings** — registration mode, email domain restrictions, submission tag pattern, repo requirements, resubmission policy, timezone
   - **Announcements** — pre-event communications

### 3. Participant Seeding (Private Hackathons)

For private hackathons, Event Lead uploads an Excel file with participant data. Three modes:

| Mode | Excel Columns | What Happens |
|------|---------------|--------------|
| **A: Full Structure** | Name, Email, Team Name, Role (lead/member) | Teams pre-created. Leaders invited first, then members |
| **B: Leaders Only** | Name, Email, Role (lead) | Leaders invited. They confirm/create teams, invite members |
| **C: Participants Only** | Name, Email | Everyone invited as generic participant. Self-organize |

### 4. Activation

1. Transition hackathon: **`draft → active`**
2. Submission deadline alarm is set in the Durable Object
3. Participants can now register, form teams, link GitHub repos, push submissions

### 5. Active Monitoring

During the active phase:

- **Teams** — view all teams, drill into details
- **Submissions** — review incoming git-tag-based submissions (auto-created via GitHub webhooks)
- **Activity** — audit log of all events
- **Analytics** — real-time stats and metrics
- **Announcements** — post updates to participants
- **Leaderboard** — track standings

Can also:
- Change deadlines while hackathon is in draft or active
- Postpone the event
- Modify operational settings

### 6. Judging Phase

1. Transition: **`active → judging`** (manual or auto via deadline alarm) — this opens the judging window
2. Assign judges to submissions (judges can declare conflicts of interest, which requires reassignment)
3. Judges score against rubric on their dedicated scoring interface (`judge.devsage.org`)
4. Monitor scoring progress

Judging windows are tight 1–2 hour periods. The window opens when the hackathon enters `judging` state and closes when the Event Lead transitions out or the configured duration elapses.

### 7. Multi-Round Management

For hackathons with multiple rounds:

1. Each round has its own deadline, tag pattern, and round type (elimination or scoring-only)
2. After judging, publish round results — scores and rankings are visible to all participants
3. **Elimination round:**
   - Event Lead selects which teams advance (based on scores, cutoff, or manual selection)
   - Eliminated teams can still view (leaderboard, announcements) but can't submit
   - Teams can be disbanded after elimination
   - Advancing teams enter the next round's submission window
4. **Scoring-only round:**
   - All teams are scored and ranked — no teams are eliminated
   - All teams proceed to the next round's submission window
   - Intermediate leaderboard updated with cumulative or per-round standings
5. Repeat submission → judging → results cycle
6. A hackathon can mix round types (e.g., scoring-only for Round 1, elimination for Round 2, scoring-only for Finals)

### 8. Completion

1. Transition: **`judging → completed`**
2. Publish final results — leaderboard becomes visible to participants
3. Optionally **archive** later (`completed → archived`)
4. Can **un-archive** if needed (`archived → completed`)

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
| Select advancing teams (elimination rounds) | ✅ Primary responsibility |
| View hackathon analytics | ✅ |
| Post announcements | ✅ |
| Upload participant Excel (private) | ✅ |
| Change deadlines (draft/active) | ✅ |
| Billing & plan | ❌ |
| Invite managers | ❌ |
| Submit hackathon request | ❌ |
| Invite other event leads | ❌ |
| Modify hackathon frontend | ❌ (DevSage team only) |

---

## Key Constraints

- Scoped to specific hackathon(s) they're invited to, not the entire workspace
- Cannot modify the hackathon frontend — that stays with the DevSage team
- Cannot manage workspace-level settings (billing, managers)
- Cannot approve or submit hackathon requests
