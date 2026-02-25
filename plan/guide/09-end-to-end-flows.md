# 09 — End-to-End Flows

Every user journey from start to finish. Exact API calls, state changes, data mutations, and frontend interactions.

---

## Flow 1: Platform Bootstrap (DevSage Team)

### Step 1: First Admin Setup
```
Manual: Add first admin to platform_admins table directly in D1
```

### Step 2: Admin Logs In
```
Frontend: admin (shikdd.devsage.org)
GET  /auth/me                        → 401 (not logged in)
POST /auth/login {email, password}   → 200 + set cookies
GET  /auth/me                        → 200 {user, is_admin: true}
```

### Step 3: Create Workspace
```
POST /api/v1/admin/workspaces {
  name: "IIIT Coding Club",
  slug: "iiit-cc",
  type: "club",
  owner_email: "president@iiit.ac.in"
}
→ 201 {workspace, invite_token}

DB writes:
  INSERT workspaces (id, name, slug, type)
  INSERT workspace_invites (email, role='owner', invite_token)
  Email sent: workspace invite to president@iiit.ac.in
  Audit: workspace.created
```

### Step 4: Invite More Admins (optional)
```
POST /api/v1/admin/admins {user_id: "..."}
→ 201 {id}

DB: INSERT platform_admins
```

---

## Flow 2: Workspace Owner Onboarding (Club President)

### Step 1: Accept Invite
```
Frontend: platform (platform.devsage.org)

Click email link → /workspace-invite?token=ABC123

GET  /api/v1/workspaces/invites/token/ABC123  → 200 {workspace, role, email}
```

### Step 2: Sign Up / Log In
```
If new user:
  POST /auth/register {email, name, password}  → 201 + cookies
  POST /auth/send-verification                 → 200 (OTP email sent)
  POST /auth/verify-email {otp: "123456"}      → 200 {verified: true}

If existing:
  POST /auth/login {email, password}            → 200 + cookies
  — OR —
  GET  /auth/google → redirect → GET /auth/callback/google → redirect + cookies
```

### Step 3: Accept Workspace Invite
```
POST /api/v1/workspaces/invites/token/ABC123/accept
→ 200 {accepted: true, workspace_id, role: "owner"}

DB writes:
  UPDATE workspace_invites SET status='accepted'
  INSERT workspace_members (workspace_id, user_id, role='owner')
  Audit: workspace.member_joined
```

### Step 4: Invite Managers (Club VPs)
```
POST /api/v1/workspaces/:workspaceId/invites {
  email: "vp1@iiit.ac.in",
  role: "admin"
}
→ 201 {id, invite_token}

DB: INSERT workspace_invites
Email sent to VP
```

---

## Flow 3: Hackathon Request Pipeline (Club VP)

### Step 1: VP Accepts Workspace Invite
```
Same as Flow 2 Steps 1-3, but role='admin' instead of 'owner'
```

### Step 2: Submit Hackathon Request
```
POST /api/v1/hackathon-requests {
  workspace_id: "...",
  title: "CodeStorm 2026",
  description: "48-hour hackathon...",
  starts_at: "2026-04-01T00:00:00Z",
  ends_at: "2026-04-03T00:00:00Z",
  expected_participants: 200,
  team_min_size: 2,
  team_max_size: 4
}
→ 201 {id, status: "submitted", status_history: [{status: "submitted", ...}]}

DB: INSERT hackathon_requests
Notification queued: hackathon.request.submitted → platform admins
```

### Step 3: Track Status
```
GET /api/v1/hackathon-requests       → user's requests with current status
GET /api/v1/hackathon-requests/:id   → single request detail
```

### Step 4: Admin Reviews (on shikdd.devsage.org)
```
Admin flow:
GET  /api/v1/hackathon-requests/admin/all          → all requests
PATCH /api/v1/hackathon-requests/admin/:id {
  status: "under_review"
}
→ Notification: hackathon.request.under_review

PATCH /api/v1/hackathon-requests/admin/:id {
  status: "approved",
  admin_notes: "Looks good"
}
→ Notification: hackathon.request.approved

PATCH /api/v1/hackathon-requests/admin/:id {
  status: "building"
}
→ CLI command shown on admin dashboard

PATCH /api/v1/hackathon-requests/admin/:id {
  status: "ready",
  admin_notes: "Frontend deployed at codestorm.iiit-cc.devsage.org"
}
→ AUTO-CREATES hackathon:
  INSERT hackathons (slug, status='draft', workspace_id)
  INSERT organizer_roles (user_id=requester, role='organizer')
  DO: HackathonStateMachine.initialize(hackathon_id, 'draft')
  Audit: hackathon.created
  Notification: hackathon.request.ready
```

### Step 5: Frontend Deployment (DevSage CLI)
```bash
# Admin copies command from dashboard:
node scripts/generate-hackathon-site.js \
  --hackathon-slug codestorm \
  --workspace-slug iiit-cc \
  --config <base64-json>

# CLI does:
# 1. Clone SHIKDD-org/hackathon-template
# 2. Rename to codestorm-iiit-cc
# 3. Replace placeholders (slugs, API origin, branding)
# 4. Push to SHIKDD-org/codestorm-iiit-cc on GitHub
# 5. Deploy to Cloudflare Workers
# 6. Site live at codestorm.iiit-cc.devsage.org

# Manual follow-up:
# - Customize design/branding
# - Add CORS origin to wrangler.jsonc
# - Final deploy
# - Notify event leads
```

---

## Flow 4: Hackathon Configuration (Event Lead)

### Step 1: Event Lead Invited
```
On platform.devsage.org (by VP):
POST /api/v1/hackathons/:slug/organizers {
  user_id: "...",
  role: "co_organizer"
}
→ 201

DB: INSERT organizer_roles
```

### Step 2: Configure Rounds
```
POST /api/v1/hackathons/codestorm/rounds {
  name: "Round 1 - Prototype",
  round_number: 1,
  type: "scoring_only",
  submission_deadline: "2026-04-02T00:00:00Z"
}
→ 201 round

POST /api/v1/hackathons/codestorm/rounds {
  name: "Round 2 - Finals",
  round_number: 2,
  type: "elimination",
  submission_deadline: "2026-04-03T00:00:00Z"
}
→ 201 round
```

### Step 3: Configure Rubric
```
POST /api/v1/hackathons/codestorm/judging/rubric {
  name: "Innovation",
  weight: 0.3,
  max_score: 10,
  description: "Novelty and creativity of the solution"
}

POST /api/v1/hackathons/codestorm/judging/rubric {
  name: "Technical Execution",
  weight: 0.4,
  max_score: 10
}

POST /api/v1/hackathons/codestorm/judging/rubric {
  name: "Presentation",
  weight: 0.3,
  max_score: 10
}
```

### Step 4: Invite Judges

**Method A — Email invite:**
```
POST /api/v1/hackathons/codestorm/judging/judges {
  email: "professor@university.edu"
}
→ 201 {id, invite_token, invite_status: "pending"}

DB: INSERT judges
Email: Judge invite with link to judge.devsage.org/invite/judge/:token
```

**Method B — Create account with temp password:**
```
POST /api/v1/hackathons/codestorm/judging/judges/create-account {
  email: "expert@industry.com",
  name: "Dr. Expert",
  temp_password: "TempPass123!"
}
→ 201 {id, user_id, password_must_change: true}

DB: INSERT users (password_must_change=1)
DB: INSERT judges (invite_status='accepted')
Email: credentials sent
```

### Step 5: Configure Settings
```
PATCH /api/v1/hackathons/codestorm {
  submission_tag_pattern: "v*",
  min_team_size: 2,
  max_team_size: 4,
  max_teams: 50,
  allow_resubmission: true,
  registration_mode: "open",
  timezone: "Asia/Kolkata"
}
```

### Step 6: Post Pre-Event Announcement
```
POST /api/v1/hackathons/codestorm/announcements {
  title: "Welcome to CodeStorm 2026!",
  content: "Registration opens April 1st...",
  pinned: true
}
```

### Step 7: Seed Participants (Private Hackathon Only)
```
POST /api/v1/hackathons/codestorm/teams/seed {
  mode: "full_structure",  // or "leaders_only" or "participants_only"
  teams: [
    {
      name: "Team Alpha",
      members: [
        {email: "lead@uni.edu", name: "Alice", role: "team_lead"},
        {email: "dev@uni.edu", name: "Bob", role: "team_member"}
      ]
    }
  ],
  send_invites: true
}
→ 200 {teams: 1, total_invites_sent: 2}

DB: INSERT teams, INSERT team_members, INSERT team_invites
Emails: Invite links to all participants
```

### Step 8: Activate Hackathon
```
POST /api/v1/hackathons/codestorm/transition {
  target_status: "active",
  version: 1  // current DO version
}
→ 200 {status: "active", version: 2}

DO: transition(draft → active), set alarm for submission_deadline
DB: UPDATE hackathons SET status='active'
Audit: hackathon.state_changed
```

---

## Flow 5: Participant Journey (Public Hackathon)

### Step 1: Discover & Register
```
Frontend: web (devsage.org)
GET /api/v1/hackathons?status=active     → list active hackathons
→ User clicks → redirected to codestorm.iiit-cc.devsage.org

Frontend: branded site
GET /auth/github → redirect to GitHub OAuth → callback → cookies set
```

### Step 2: Create or Join Team
```
Create team:
POST /api/v1/hackathons/codestorm/teams {
  name: "Binary Blazers"
}
→ 201 {id, name, invite_code: "AB3D7K9X", status: "forming"}

DB: INSERT teams, INSERT team_members (role='team_lead')

Join team:
POST /api/v1/hackathons/codestorm/teams/join {
  invite_code: "AB3D7K9X"
}
→ 200 {joined: true, team_id}

DB: INSERT team_members (role='team_member')
Notification: team_joined → team leader
```

### Step 3: Link GitHub Repo (Team Leader)
```
POST /api/v1/hackathons/codestorm/teams/:teamId/repo {
  github_repo_url: "https://github.com/user/my-hackathon-project"
}
→ 201 {id, repo_full_name: "user/my-hackathon-project"}

DB: INSERT team_repos
GitHub App: Receives installation events → botActive=1
```

### Step 4: Build Phase — Push Code
```
Team pushes code to GitHub repo
→ GitHub sends push webhook → POST /webhooks/github
→ HMAC verified → enqueued to github-webhooks queue
→ push-handler:
    INSERT commit_log (per commit, batched ≤10)
    If force-push: INSERT force_push_events + notify organizers
```

### Step 5: Submit via Git Tag
```
Team leader creates tag: git tag v1.0 && git push origin v1.0
→ GitHub sends tag webhook → POST /webhooks/github
→ tag-create-handler:
    1. Find team_repo by owner/name
    2. Validate tag "v1.0" matches pattern "v*"
    3. Resolve tag SHA from GitHub API
    4. DO: lockSubmission(delivery_id) → {locked: true}
    5. INSERT submissions (status='pending_validation', is_current=1)
    6. Mark previous submissions is_current=0
    7. Audit: submission.created
    8. Notification: submission.received → team + organizers
```

### Step 6: View Submission Status
```
GET /api/v1/hackathons/codestorm/submissions/team/:teamId/current
→ 200 {id, tag_name: "v1.0", commit_sha, status, is_current: true}
```

---

## Flow 6: Judge Journey

### Step 1A: Accept Email Invite
```
Frontend: judge.devsage.org
Click email link → /invite/judge/:token

GET  /api/v1/invites/judge/token/:token  → {hackathon, email, user_exists}

If user_exists:
  POST /auth/login → cookies
  POST /api/v1/invites/judge/token/:token/accept → {accepted: true}

If new user:
  POST /api/v1/invites/judge/token/:token/accept {
    name: "Dr. Smith",
    password: "SecurePass123!"
  }
  → {accepted: true, user_created: true} + cookies

DB: UPDATE judges SET invite_status='accepted', user_id=...
```

### Step 1B: Login with Temp Credentials
```
POST /auth/login {email, password: "TempPass123!"}
→ 200 {password_must_change: true} + cookies

POST /auth/change-password {
  current_password: "TempPass123!",
  new_password: "MyNewSecure456!"
}
→ 200 {message: "Password changed"}

DB: UPDATE users SET password_hash=new, password_must_change=0
All sessions revoked → re-login required
```

### Step 2: View Assignments
```
GET /api/v1/judge/hackathons
→ [{hackathon_id, title, slug, assignments_count, pending_count}]

GET /api/v1/hackathons/codestorm/judging/my-assignments
→ [{id, team_id, team_name, submission_id, round, status}]
```

### Step 3: Declare Conflict of Interest
```
POST /api/v1/hackathons/codestorm/judging/assignments/:assignmentId/coi {
  reason: "The team lead is my student"
}
→ 200 {conflict_declared: true}

DB: UPDATE judge_assignments SET status='conflict'

Event Lead reassigns:
POST /api/v1/hackathons/codestorm/judging/assignments/:assignmentId/reassign {
  new_judge_id: "..."
}
→ 200 {reassigned: true, new_assignment_id}
```

### Step 4: Score Submissions
```
GET /api/v1/hackathons/codestorm/judging/rubric
→ [{id, name, weight, max_score, description}]

POST /api/v1/hackathons/codestorm/judging/submissions/:submissionId/scores {
  scores: [
    {criteria_id: "innovation-id", score: 8, assignment_id: "...", comment: "Very creative"},
    {criteria_id: "execution-id", score: 9, assignment_id: "..."},
    {criteria_id: "presentation-id", score: 7, assignment_id: "..."}
  ]
}
→ 200 {scored: true}

DB: INSERT/UPDATE scores (UPSERT per criterion+judge+submission+round)
DB: UPDATE judge_assignments SET status='completed'
```

### Step 5: View Own Scores (Post-Judging)
```
GET /api/v1/hackathons/codestorm/judging/my-scores
→ [{submission_id, team_name, criterion, score, comment}]
```

---

## Flow 7: Judging & Multi-Round Management (Event Lead)

### Step 1: Transition to Judging
```
POST /api/v1/hackathons/codestorm/transition {
  target_status: "judging",
  version: 2
}
→ 200 {status: "judging", version: 3}

DO: transition(active → judging)
Notification: hackathon.judging_started → judges + participants
```

### Step 2: Assign Judges to Submissions
```
POST /api/v1/hackathons/codestorm/judging/assign {
  round_id: "round-1-id"
}
→ 200 {total_assignments: 45, judges_used: 5, submissions_per_judge: 9}

Service: Round-robin assignment respecting:
  - Track affinity (if judges have tracks)
  - COI declarations (skip conflicted pairs)
  - Even distribution across judges

DB: INSERT judge_assignments (one per judge+team+round)
```

### Step 3: Monitor Scoring Progress
```
GET /api/v1/hackathons/codestorm/judging/judges
→ [{id, name, email, assignments_completed, assignments_total}]

GET /api/v1/hackathons/codestorm/judging/coi
→ [{assignment_id, judge_name, team_name, reason, status}]
```

### Step 4: Publish Round 1 Results
```
POST /api/v1/hackathons/codestorm/rounds/:round1Id/publish
→ 200 {teams_ranked: 50, round_type: "scoring_only"}

Service: computeLeaderboard()
  - Per judge: sum(score * weight) per submission
  - Cross judge: average of weighted totals
  - Sort by total descending → assign ranks

DB: INSERT round_results (one per team)
KV: Invalidate leaderboard cache
```

### Step 5: Advance Teams (Elimination Round)
```
After Round 2 judging:

POST /api/v1/hackathons/codestorm/rounds/:round2Id/advance {
  advancing_team_ids: ["team-1", "team-5", "team-12", "team-23", "team-31"]
}
→ 200 {advanced: 5, eliminated: 45}

DB: INSERT round_results (status='advanced' or 'eliminated' per team)
Notifications: advancement/elimination per team
```

### Step 6: Publish Final Results
```
POST /api/v1/hackathons/codestorm/judging/results/publish {
  round_id: "round-2-id"
}
→ 200 {published: true, results: [...]}

Notification: results.published → all participants
```

### Step 7: Complete Hackathon
```
POST /api/v1/hackathons/codestorm/transition {
  target_status: "completed",
  version: 3
}
→ 200 {status: "completed", version: 4}

Later (optional):
POST /api/v1/hackathons/codestorm/transition {
  target_status: "archived",
  version: 4
}
```

---

## Flow 8: Active Monitoring (Event Lead)

### Teams Dashboard
```
GET /api/v1/hackathons/codestorm/teams?limit=20&offset=0
→ paginated teams with member counts

GET /api/v1/hackathons/codestorm/teams/:teamId
→ team detail

GET /api/v1/hackathons/codestorm/teams/:teamId/members
→ member list with roles
```

### Submissions Dashboard
```
GET /api/v1/hackathons/codestorm/submissions?limit=20&offset=0&current_only=true
→ all current submissions

GET /api/v1/hackathons/codestorm/submissions/:id
→ submission with parsed analysis
```

### Activity Log
```
GET /api/v1/hackathons/codestorm/audit?limit=50
→ cursor-paginated audit events (team joins, submissions, state changes)
```

### Leaderboard
```
GET /api/v1/hackathons/codestorm/judging/leaderboard?round_id=...
→ ranked teams with scores (ETag cached)
```

### Announcements
```
POST /api/v1/hackathons/codestorm/announcements {title, content, pinned?}
GET  /api/v1/hackathons/codestorm/announcements
PATCH /api/v1/hackathons/codestorm/announcements/:id {title?, content?, pinned?}
DELETE /api/v1/hackathons/codestorm/announcements/:id
```

### Notifications
```
GET  /api/v1/notifications?hackathon_id=...
GET  /api/v1/notifications/unread-count
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/read-all
```

---

## Flow 9: Admin Dashboard Operations

### System Overview
```
GET /api/v1/admin/stats
→ {users: 1250, hackathons: 15, teams: 340, submissions: 890}
```

### User Management
```
GET /api/v1/admin/users?limit=50&offset=0
→ paginated user list
```

### Workspace Management
```
GET  /api/v1/admin/workspaces                  → all workspaces with counts
GET  /api/v1/admin/workspaces/:id              → workspace detail
POST /api/v1/admin/workspaces {name, slug, type, owner_email}  → create + invite
```

### Hackathon Oversight
```
GET  /api/v1/admin/hackathons                  → all hackathons
GET  /api/v1/admin/hackathons/:id              → hackathon detail
GET  /api/v1/admin/hackathons/:id/rounds       → rounds for hackathon
PATCH /api/v1/admin/hackathons/:id/rounds/:roundId/initialize {is_initialized: true}
```

### Platform Admin Management
```
GET    /api/v1/admin/admins           → list admins
POST   /api/v1/admin/admins {user_id} → add admin
DELETE /api/v1/admin/admins/:userId    → remove admin
```

### Invite Management
```
GET    /api/v1/admin/invites                → list platform invites
POST   /api/v1/admin/invites {email}        → create invite
DELETE /api/v1/admin/invites/:id            → revoke invite
```

---

## Flow 10: Webhook Processing (Automatic)

### Push Event
```
GitHub → POST /webhooks/github
  Headers: X-Hub-Signature-256, X-GitHub-Event: push, X-GitHub-Delivery
  → HMAC verify
  → INSERT webhook_deliveries
  → Enqueue to github-webhooks: {type: 'push', payload: normalized}
  → Queue handler:
      Find team_repo by owner/name
      Batch insert commits (≤10 per INSERT)
      If force_push: insert event + notify
```

### Tag Create Event
```
GitHub → POST /webhooks/github
  X-GitHub-Event: create (ref_type: tag)
  → Enqueue: {type: 'tag.created', payload: {...}}
  → Queue handler:
      Find team_repo → find hackathon (must be 'active')
      Validate tag pattern
      Resolve tag SHA via GitHub API
      DO.lockSubmission(delivery_id) → exactly-once
      INSERT submission (is_current=1)
      Mark previous submissions is_current=0
      Notify team + organizers
```

### Tag Delete Event
```
GitHub → POST /webhooks/github
  X-GitHub-Event: delete (ref_type: tag)
  → Enqueue: {type: 'tag.deleted', payload: {...}}
  → Queue handler:
      Find submission by tag
      UPDATE submission SET status='tag_deleted'
      Notify organizers
```

---

## Flow 11: Cron Jobs (Hourly)

```
Worker scheduled handler fires at 0 * * * *

Job 1: Deadline Check
  SELECT hackathons WHERE status='active' AND rounds have expired deadlines
  For each: DO.transition(active → judging, version=-1)
  Update D1, audit log, notify

Job 2: Deadline Reminders
  SELECT hackathons with deadlines in 24h or 1h windows
  For each: enqueue deadline_reminder notification
  Deduplicated via idempotency keys

Job 3: Audit Hash Backfill
  SELECT TOP 100 audit_events WHERE hash IS NULL
  Compute SHA-256 chain
  UPDATE hash, prev_hash
```

---

## Flow 12: Token Refresh & Session Management

### Silent Refresh (Frontend)
```
Any API call returns 401
→ apiRequest wrapper catches 401
→ POST /auth/refresh (sends refresh_token cookie)
→ If 200: new access_token + refresh_token cookies set
→ Retry original request with new token
→ If refresh fails: redirect to login

Refresh token rotation:
  1. Hash incoming token
  2. SELECT refresh_token by hash + user
  3. Check expiry
  4. Check if revoked (2s grace period for concurrent requests)
  5. Revoke old token
  6. Generate new token in same family
  7. Set new cookies
```

### Session Revocation
```
GET    /auth/sessions              → list all active sessions
DELETE /auth/sessions/:familyId    → revoke one session (kills all tokens in family)
DELETE /auth/sessions              → revoke ALL sessions (nuclear option)
POST   /auth/logout                → revoke current session + clear cookies
```
