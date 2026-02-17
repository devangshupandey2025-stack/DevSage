# DevSage Hackathon Platform — TODO

**BDD-Driven Development Specification**
Behavioral specifications describing every feature that must be built, integrated, or hardened to ship a production-ready hackathon management platform.

Repository: `devsage` monorepo
Version: 1.0 | Date: February 2026

---

## Table of Contents

1. [Architecture & Deployment Pipeline](#1-architecture--deployment-pipeline)
2. [Per-Hackathon Frontend (`{slug}.devsage.org`)](#2-per-hackathon-frontend-slugdevsageorg)
3. [Authentication — OAuth Providers](#3-authentication--oauth-providers)
4. [Workspace Scoping & Organizer Isolation](#4-workspace-scoping--organizer-isolation)
5. [Hackathon Configuration Completeness](#5-hackathon-configuration-completeness)
6. [Registration & Participant Onboarding](#6-registration--participant-onboarding)
7. [Team Management Gaps](#7-team-management-gaps)
8. [Repository Integration & GitHub App](#8-repository-integration--github-app)
9. [Submission Pipeline Hardening](#9-submission-pipeline-hardening)
10. [Judging & Scoring Completeness](#10-judging--scoring-completeness)
11. [Notifications & Communication](#11-notifications--communication)
12. [Audit & Compliance](#12-audit--compliance)
13. [Platform Administration](#13-platform-administration)
14. [Frontend — Platform (Organizer Dashboard)](#14-frontend--platform-organizer-dashboard)
15. [Frontend — Web (Participant App)](#15-frontend--web-participant-app)
16. [Frontend — Admin Panel](#16-frontend--admin-panel)
17. [Observability, Error Handling & Resilience](#17-observability-error-handling--resilience)
18. [Testing](#18-testing)
19. [Documentation & Onboarding](#19-documentation--onboarding)

---

## 1. Architecture & Deployment Pipeline

### 1.1 Use `hackathon-template` Repo from Org

> **STATUS: NOT STARTED**

```gherkin
Feature: Hackathon site scaffolding from org template repo
  The existing `templates/hackathon-site/` directory is a local prototype.
  Production must use the `hackathon-template` repo from the DevSage GitHub org
  as the canonical scaffold for all per-hackathon frontends.

  Scenario: Scaffold a new hackathon frontend from the org template
    Given the `hackathon-template` repo exists in the DevSage GitHub org
    And an organizer has created a hackathon with slug "acme-hack"
    When the platform provisions a new hackathon frontend
    Then it clones/forks the `hackathon-template` repo
    And replaces `site.config.json` with the hackathon's configuration
    And the site is deployed to `acme-hack.devsage.org`

  Scenario: Template repo is versioned and maintained separately
    Given the `hackathon-template` repo has its own CI/CD
    When a new version of the template is released
    Then existing hackathon sites are NOT auto-updated
    And new hackathon sites use the latest template version
    And organizers can opt-in to upgrade their site to a newer template version

  Scenario: Local `templates/hackathon-site/` is deprecated
    Given the local template exists at `templates/hackathon-site/`
    When the `hackathon-template` repo is adopted
    Then the local directory should be removed or converted to a symlink/reference
    And all documentation should point to the org repo
```

**TODO:**
- [ ] Configure the `hackathon-template` repo in the DevSage GitHub org with the canonical site scaffold
- [ ] Add a site provisioning script/CLI that clones the template, injects `site.config.json`, and deploys to Cloudflare Pages
- [ ] Remove or archive `templates/hackathon-site/` once the org repo is canonical
- [ ] Add template versioning (tag-based) so hackathons pin to a template version

---

### 1.2 Per-Hackathon Deployment Automation

> **STATUS: NOT STARTED**

```gherkin
Feature: Automated deployment of per-hackathon frontends
  Each hackathon gets its own frontend at {slug}.devsage.org.
  Organizers provide the design, DevSage team builds the frontend,
  organizers approve it, then the backend is connected and the site goes live.

  Scenario: Organizer requests a new hackathon site
    Given an organizer has created hackathon "acme-hack" on the platform
    When they submit their design assets and branding requirements
    Then a new Cloudflare Pages project is created for "acme-hack.devsage.org"
    And the `hackathon-template` repo is cloned as the base
    And the design team customizes the frontend per the organizer's spec

  Scenario: Organizer reviews and approves the frontend
    Given the design team has built the custom frontend for "acme-hack"
    When the preview URL is shared with the organizer
    Then the organizer can review the site in a staging environment
    And request changes via the platform's feedback mechanism
    And approve the final design

  Scenario: Approved frontend is connected to the backend
    Given the organizer has approved the frontend for "acme-hack"
    When the site is promoted from staging to production
    Then `site.config.json` is configured with `apiOrigin: "https://api.devsage.org"`
    And DNS CNAME for `acme-hack.devsage.org` is created
    And the hackathon status is set to "active" or remains "draft" pending the organizer

  Scenario: All hackathon frontends share the same backend API
    Given hackathons "acme-hack" and "beta-hack" are both live
    When participants on `acme-hack.devsage.org` make API calls
    And participants on `beta-hack.devsage.org` make API calls
    Then all requests go to `api.devsage.org`
    And are scoped to their respective hackathon by slug in the URL path
```

**TODO:**
- [ ] Build a CLI tool or GitHub Action workflow that provisions a new Cloudflare Pages project from the `hackathon-template` repo
- [ ] Automate DNS CNAME creation for `{slug}.devsage.org` via Cloudflare API
- [ ] Add staging/preview URL support per hackathon (e.g., `preview-{slug}.devsage.org`)
- [ ] Build an organizer-facing "Site Review" page in the platform app for feedback/approval
- [ ] Document the organizer workflow: submit design → DevSage builds → review → approve → go live

---

### 1.3 Monorepo CI/CD & Wrangler Config

> **STATUS: PARTIAL — wrangler.toml exists but CI/CD pipeline is not set up**

```gherkin
Feature: Automated CI/CD for the monorepo
  Scenario: Push to main triggers build and deploy
    Given a PR is merged to main
    When the CI pipeline runs
    Then `apps/api` is deployed to Cloudflare Workers
    And `apps/platform` is deployed to Cloudflare Pages at platform.devsage.org
    And `apps/admin` is deployed to Cloudflare Pages at shikdd.devsage.org
    And `apps/web` is deployed to Cloudflare Pages at devsage.org
    And database migrations are applied to D1

  Scenario: PR preview deployments
    Given a PR is opened
    When the CI runs
    Then each frontend app gets a preview URL
    And the API is deployed to a preview Worker (optional)
```

**TODO:**
- [ ] Set up GitHub Actions for monorepo CI (turbo-based build, lint, test)
- [ ] Add Wrangler deploy steps for `apps/api` (Worker + D1 migrations + DO + Queues + KV)
- [ ] Add Cloudflare Pages deploy steps for each frontend app
- [ ] Configure staging vs production environments
- [ ] Add preview deployments for PRs

---

## 2. Per-Hackathon Frontend (`{slug}.devsage.org`)

> **STATUS: PROTOTYPE ONLY — `templates/hackathon-site/` exists with basic components but no API integration**

```gherkin
Feature: Custom hackathon landing and participation site
  Each hackathon has its own branded frontend deployed at {slug}.devsage.org.
  The frontend uses the shared backend at api.devsage.org.

  Scenario: Participant visits a hackathon site
    Given hackathon "acme-hack" is active
    When a user visits `acme-hack.devsage.org`
    Then they see the hackathon's custom branding, hero section, dates, and prizes
    And a "Register" or "Login" button is prominently displayed
    And the site fetches data from `api.devsage.org/api/v1/hackathons/acme-hack`

  Scenario: Participant registers on the hackathon site
    Given the user is on `acme-hack.devsage.org`
    When they click "Register"
    Then they are redirected to the auth flow (email/password or OAuth)
    And after authentication, they are registered for "acme-hack"
    And redirected to their participant dashboard

  Scenario: Participant manages their team on the hackathon site
    Given a registered participant is on `acme-hack.devsage.org`
    When they navigate to the Teams section
    Then they can create a team, join via invite code, or manage their existing team
    And link their GitHub repository

  Scenario: Hackathon site shows real-time status
    Given the hackathon is in "active" phase
    When the participant visits the dashboard
    Then they see a countdown timer to submission deadline
    And their team's submission status
    And the current leaderboard (if published)
```

**TODO:**
- [ ] Migrate `templates/hackathon-site/` scaffold to the `hackathon-template` org repo
- [ ] Add full auth flow in the template (login, register, OAuth redirect to api.devsage.org)
- [ ] Add participant dashboard page (team status, submission status, countdown)
- [ ] Add team management pages (create, join, invite code, link repo)
- [ ] Add leaderboard page
- [ ] Add submission history view
- [ ] Connect all components to the backend API via `site.config.json` → `apiOrigin`
- [ ] Add proper CORS handling for `{slug}.devsage.org` → `api.devsage.org`

---

## 3. Authentication — OAuth Providers

> **STATUS: EMAIL/PASSWORD ONLY — OAuth (GitHub, Google) routes are spec'd but NOT implemented**

```gherkin
Feature: GitHub OAuth login
  Scenario: Successful GitHub OAuth login
    Given I am an unauthenticated user
    When I navigate to /auth/github
    Then I am redirected to GitHub OAuth authorization page
    And after authorizing, GitHub redirects to /auth/github/callback
    And the system exchanges the code for an access token
    And creates or updates my user record (linking GitHub ID)
    And sets HttpOnly access_token cookie (JWT, 15-min expiry)
    And sets HttpOnly refresh_token cookie (opaque, 30-day expiry)
    And redirects me to the appropriate dashboard

  Scenario: Link GitHub account to existing email/password user
    Given I registered with email/password
    When I initiate GitHub OAuth
    And GitHub returns an email matching my existing account
    Then my account is linked to my GitHub profile
    And I can log in via either method

Feature: Google OAuth login
  Scenario: Successful Google OAuth login
    Given I am an unauthenticated user
    When I navigate to /auth/google
    Then I am redirected to Google OAuth consent screen
    And after consenting, Google redirects to /auth/google/callback
    And the system exchanges the code for tokens
    And creates or updates my user record
    And sets HttpOnly cookies and redirects
```

**TODO:**
- [ ] Implement `GET /auth/github` — redirect to GitHub OAuth authorization URL
- [ ] Implement `GET /auth/github/callback` — exchange code for token, upsert user, set cookies
- [ ] Implement `GET /auth/google` — redirect to Google OAuth consent screen
- [ ] Implement `GET /auth/google/callback` — exchange code for token, upsert user, set cookies
- [ ] Add `github_id` and `google_id` columns to `users` table for account linking
- [ ] Handle account linking when OAuth email matches an existing email/password user
- [ ] Add Wrangler secrets for `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] Update login pages in all frontend apps to show OAuth buttons

---

## 4. Workspace Scoping & Organizer Isolation

> **STATUS: PARTIAL — Workspace CRUD exists, but organizer isolation is incomplete**

The BDD spec requires that organizers can ONLY see and modify hackathons they are part of, OR hackathons under a workspace where they have owner/admin/member roles. Currently, some endpoints don't enforce this scoping.

```gherkin
Feature: Organizer can only see hackathons they belong to
  Scenario: Organizer lists hackathons — sees only their own
    Given I am an organizer of hackathon "hack-a" in workspace "ws-1"
    And I am NOT part of hackathon "hack-b" in workspace "ws-2"
    When I GET /api/v1/hackathons (from the platform dashboard)
    Then I see only "hack-a"
    And I do NOT see "hack-b"

  Scenario: Workspace member sees all hackathons in their workspace
    Given I am a member of workspace "ws-1"
    And "ws-1" has hackathons "hack-a" and "hack-c"
    When I list hackathons
    Then I see both "hack-a" and "hack-c"
    Even if I am not explicitly an organizer of "hack-c"

  Scenario: Organizer cannot access hackathon outside their scope
    Given I am an organizer of "hack-a" in workspace "ws-1"
    When I try to GET /api/v1/hackathons/hack-b (in workspace "ws-2")
    Then I can see it (it's public read for participants)
    But when I try to PATCH it or access organizer endpoints
    Then I receive 403 FORBIDDEN

Feature: Workspace-level hackathon listing
  Scenario: List hackathons under a workspace
    Given workspace "ws-1" has 3 hackathons
    When I GET /api/v1/workspaces/ws-1/hackathons
    Then I see all 3 hackathons
    And each includes its current status and participant count
```

**TODO:**
- [ ] Add `GET /api/v1/workspaces/:workspaceId/hackathons` endpoint (list hackathons scoped to a workspace)
- [ ] Add an "organizer's hackathons" endpoint or filter: `GET /api/v1/hackathons?mine=true` that returns only hackathons the user is an organizer of or is a workspace member for
- [ ] Ensure the platform dashboard only fetches hackathons the organizer has access to (not all hackathons)
- [ ] Add workspace_id to the hackathon list response in the platform frontend
- [ ] Verify role middleware correctly resolves workspace membership → organizer access for all organizer endpoints

---

## 5. Hackathon Configuration Completeness

> **STATUS: PARTIAL — Core CRUD and state machine exist; several config areas are missing**

```gherkin
Feature: Hackathon tracks management
  Scenario: Create tracks for a hackathon
    Given a hackathon in draft status
    When the organizer creates tracks like "AI/ML", "Web3", "Social Impact"
    Then each track has a name, description, and optional prize
    And teams can select a track when registering

  Scenario: Track-specific rubric criteria
    Given a track "AI/ML" exists
    When the organizer creates rubric criteria scoped to "AI/ML"
    Then those criteria only apply to teams in the "AI/ML" track

Feature: Hackathon sponsors management
  Scenario: Add sponsors to a hackathon
    Given a hackathon in draft or active status
    When the organizer adds a sponsor with name, logo URL, tier, and website
    Then the sponsor appears on the hackathon page
    And sponsors are ordered by tier (platinum > gold > silver > bronze)

Feature: Hackathon prizes management
  Scenario: Configure prizes for a hackathon
    Given a hackathon in draft status
    When the organizer adds prizes with name, description, value, and track (optional)
    Then prizes are displayed on the hackathon site
    And can be awarded to teams after judging

Feature: Template-based hackathon creation
  Scenario: Apply rounds and rubric from template
    Given a hackathon template with predefined rounds and rubric criteria
    When I create a hackathon with template_id
    Then the hackathon inherits not just settings and tracks
    But also rounds and rubric criteria from the template
    (Currently: TODO comment in hackathons.ts line 69)
```

**TODO:**
- [ ] Add track CRUD endpoints (`POST/GET/PATCH/DELETE /api/v1/hackathons/:slug/tracks`)
- [ ] Add `hackathon_tracks` table queries to hackathon detail responses
- [ ] Add sponsor CRUD endpoints (`POST/GET/PATCH/DELETE /api/v1/hackathons/:slug/sponsors`)
- [ ] Add prize CRUD endpoints or extend the `prizes` JSON field with proper validation
- [ ] Complete template application (line 69 in `hackathons.ts`): apply rounds and rubric from template during hackathon creation
- [ ] Add template CRUD endpoints for platform admins
- [ ] Add `allowed_email_domains` enforcement during registration
- [ ] Add `registration_mode` enforcement (`open`, `invite_only`, `approval_required`)

---

## 6. Registration & Participant Onboarding

> **STATUS: NOT STARTED — No participant registration endpoint for hackathons**

The system has team creation and joining, but there is no explicit "register for a hackathon" flow.

```gherkin
Feature: Participant registration for a hackathon
  Scenario: Register for an open hackathon
    Given hackathon "acme-hack" has registration_mode "open"
    And I am an authenticated user
    When I POST /api/v1/hackathons/acme-hack/register
    Then I am registered as a participant
    And an audit event "hackathon.participant_registered" is logged
    And I can now create or join a team

  Scenario: Register for an invite-only hackathon
    Given hackathon "acme-hack" has registration_mode "invite_only"
    When an uninvited user tries to register
    Then they receive 403 REGISTRATION_CLOSED
    When a user with a valid invite token registers
    Then they are registered successfully

  Scenario: Registration with email domain restriction
    Given hackathon "acme-hack" has allowed_email_domains ["acme.com", "university.edu"]
    When a user with email "user@random.com" tries to register
    Then they receive 403 EMAIL_DOMAIN_NOT_ALLOWED
    When a user with email "student@university.edu" registers
    Then they are registered successfully

  Scenario: View participant list (organizer)
    Given I am an organizer of "acme-hack"
    When I GET /api/v1/hackathons/acme-hack/participants
    Then I see all registered participants with their team status

  Scenario: Registration cap
    Given a hackathon with max_participants set to 200
    When the 201st user tries to register
    Then they receive 409 REGISTRATION_FULL
```

**TODO:**
- [ ] Create a `hackathon_participants` table (or use team_members for implicit registration)
- [ ] Add `POST /api/v1/hackathons/:slug/register` endpoint
- [ ] Add `GET /api/v1/hackathons/:slug/participants` endpoint (organizer-only)
- [ ] Enforce `registration_mode` (open, invite_only, approval_required)
- [ ] Enforce `allowed_email_domains` during registration
- [ ] Add `max_participants` column to hackathons and enforce registration cap
- [ ] Add participant invite system for invite-only hackathons
- [ ] Add a "My Hackathons" page for participants showing all hackathons they're registered for

---

## 7. Team Management Gaps

> **STATUS: MOSTLY COMPLETE — Core team CRUD exists; a few features missing**

```gherkin
Feature: Team invite via email (not just invite code)
  Scenario: Team leader sends email invite
    Given I am the leader of team "Alpha"
    When I POST /api/v1/hackathons/:slug/teams/:id/invite with an email address
    Then a team invite is created with a unique token
    And an email is sent to the invitee with a join link
    And the invite appears in the team's pending invites list

  Scenario: List pending team invites
    Given team "Alpha" has 2 pending invites
    When the leader GETs /api/v1/hackathons/:slug/teams/:id/invites
    Then they see both pending invites with email and expiry

Feature: Team validation before submission
  Scenario: Team with fewer than min_team_size cannot submit
    Given a hackathon with min_team_size = 2
    And team "Solo" has only 1 member
    When the system processes a submission tag for "Solo"
    Then the submission is rejected with reason "Team below minimum size"
```

**TODO:**
- [ ] Add `POST /api/v1/hackathons/:slug/teams/:teamId/invite` — email-based team invite
- [ ] Add `GET /api/v1/hackathons/:slug/teams/:teamId/invites` — list pending team invites
- [ ] Add `DELETE /api/v1/hackathons/:slug/teams/:teamId/invites/:inviteId` — revoke a team invite
- [ ] Add min_team_size validation in the submission pipeline (reject submissions from undersized teams)
- [ ] Add team search/browse for participants looking to join a team

---

## 8. Repository Integration & GitHub App

> **STATUS: PARTIAL — Webhook verification, tag handler, push handler exist; GitHub App JWT signing NOT implemented**

```gherkin
Feature: GitHub App authentication via JWT
  Scenario: System obtains an installation access token
    Given the GitHub App private key is configured as a Wrangler secret
    When the system needs to call the GitHub API for an installation
    Then it signs a JWT using the App's private key (RS256)
    And exchanges it for an installation access token
    And caches the token in KV for 50 minutes
    (Currently: TODO comment in services/github.ts line 29)

Feature: Repository validation
  Scenario: Validate repo exists and is accessible
    Given a team leader links repo "acme-org/my-project"
    When the repo is linked
    Then the system verifies the repo exists via GitHub API
    And confirms the GitHub App is installed on the repo
    And returns an error if the App is not installed

Feature: Commit status posting
  Scenario: Post submission status to GitHub
    Given a submission is received from a tag push
    When the submission is processed
    Then a GitHub commit status is posted to the commit SHA
    With state "success" and description "Submission received by DevSage"
```

**TODO:**
- [ ] Implement GitHub App JWT signing (RS256) in `services/github.ts` — the `getInstallationToken()` function currently returns null with a TODO
- [ ] Add `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` as Wrangler secrets
- [ ] Add repo validation on link (check repo exists, check App is installed)
- [ ] Integrate commit status posting into the tag-create-handler after successful submission
- [ ] Add webhook replay/retry tracking (mark failed deliveries, allow manual reprocessing)
- [ ] Add a "repo health check" endpoint for organizers to verify bot status on team repos

---

## 9. Submission Pipeline Hardening

> **STATUS: CORE WORKS — Tag-based submission creation is functional; several hardening items missing**

```gherkin
Feature: Submission validation pipeline
  Scenario: Validate submission before accepting
    Given a submission is received from a tag push
    When the system processes it
    Then it should validate:
      - The team meets min_team_size
      - The hackathon allows resubmission (if this is not the first)
      - The submission is not a duplicate (same SHA)
    And set the submission status to "validated" or "rejected"

Feature: Submission status progression
  Scenario: Submission moves through status pipeline
    Given a submission is created with status "received"
    When validation completes
    Then status becomes "validated" or "rejected"
    And organizers can manually override status if needed

Feature: Manual submission override (organizer)
  Scenario: Organizer marks a submission as final
    Given a team has multiple submissions
    When the organizer manually sets submission X as final
    Then submission X gets is_final = 1
    And all others get is_final = 0
```

**TODO:**
- [ ] Add min_team_size validation check in tag-create-handler before accepting submission
- [ ] Add `allow_resubmission` check (currently resubmission is always allowed)
- [ ] Add duplicate SHA detection (reject if same commit SHA already submitted)
- [ ] Add submission status progression: `received` → `validated` → `scored`
- [ ] Add `PATCH /api/v1/hackathons/:slug/submissions/:id` for organizer overrides (set is_final, change status)
- [ ] Add submission deadline enforcement per round (not just hackathon-level)

---

## 10. Judging & Scoring Completeness

> **STATUS: CORE WORKS — Rubric CRUD, judge invite/accept, scoring, leaderboard exist; several gaps**

```gherkin
Feature: Judge invite via email (not just user_id)
  Scenario: Organizer invites a judge by email
    Given the judge is not yet a platform user
    When the organizer invites them by email
    Then an invite email is sent with a unique accept link
    And when the judge signs up and accepts, they gain the judge role
    (Currently: judge invite requires a user_id, meaning the user must already exist)

Feature: Judge assignment strategies
  Scenario: Assign judges with conflict-of-interest prevention
    Given judge "Alice" is a member of workspace "ws-1"
    And team "Beta" is also in "ws-1"
    When auto-assignment runs
    Then Alice is NOT assigned to judge team "Beta"

Feature: Score visibility controls
  Scenario: Participants see scores only after publication
    Given the organizer has NOT published results
    When a participant requests the leaderboard
    Then they see "Results not yet published"
    When the organizer publishes results
    Then the leaderboard becomes visible to participants

Feature: Multi-round judging
  Scenario: Elimination round followed by finals
    Given a hackathon has Round 1 (elimination) and Round 2 (finals)
    When Round 1 scoring completes
    Then the organizer can advance top N teams to Round 2
    And Round 2 has its own rubric criteria and judge assignments
```

**TODO:**
- [ ] Add judge invite by email (create a placeholder judge record, send email, link to user on signup)
- [ ] Add invite token to judge records for email-based acceptance (currently uses judge ID)
- [ ] Add conflict-of-interest detection in auto-assignment (don't assign judge to teams in same workspace)
- [ ] Add score visibility control — hide leaderboard from participants until results are published
- [ ] Add `show_judge_comments_to_participants` enforcement (column exists but not checked)
- [ ] Add multi-round advancement: `POST /api/v1/hackathons/:slug/rounds/:roundId/advance` — advance top N teams
- [ ] Add round-specific rubric criteria filtering in the scoring UI
- [ ] Add judge progress dashboard (how many assignments scored out of total)
- [ ] Add score export (CSV/JSON) for organizers

---

## 11. Notifications & Communication

> **STATUS: CORE WORKS — Queue-based notification handler, in-app notifications, email via Resend; several features missing**

```gherkin
Feature: Announcements (organizer → all participants)
  Scenario: Organizer broadcasts an announcement
    Given I am an organizer of hackathon "acme-hack"
    When I POST /api/v1/hackathons/acme-hack/announcements with title and body
    Then an announcement is stored
    And all registered participants receive an in-app notification
    And an email is sent to all participants
    (Currently: AnnouncementsPage exists in platform frontend but no backend endpoint)

Feature: Notification preferences
  Scenario: User disables email notifications
    Given I want to receive in-app notifications only
    When I update my notification preferences
    Then I stop receiving emails but still see in-app notifications

Feature: Real-time notification delivery
  Scenario: User sees notifications without page refresh
    Given I am on the dashboard
    When a new notification arrives
    Then I see an updated badge count
    And the notification appears in the dropdown
    (Requires SSE or WebSocket — currently polling only)
```

**TODO:**
- [ ] Add `POST /api/v1/hackathons/:slug/announcements` endpoint
- [ ] Add `GET /api/v1/hackathons/:slug/announcements` endpoint
- [ ] Add `announcements` table in the database schema
- [ ] Add notification preferences per user (email on/off per notification type)
- [ ] Add `DELETE /api/v1/notifications/:id` — delete a notification
- [ ] Consider SSE or Durable Object-based WebSocket for real-time notification push (future enhancement)
- [ ] Add email templates with proper HTML/CSS (currently inline `<p>` tags only)
- [ ] Add unsubscribe link in emails

---

## 12. Audit & Compliance

> **STATUS: MOSTLY COMPLETE — Audit trail with hash chaining exists; a few gaps**

```gherkin
Feature: Audit log query filters
  Scenario: Filter audit log by action type
    Given the audit log has thousands of entries
    When I GET /api/v1/hackathons/:slug/audit?action=score.submitted&limit=50
    Then I see only score submission events, paginated

  Scenario: Audit log export
    Given I am an organizer
    When I request an audit log export
    Then I receive a CSV/JSON file with all audit events for my hackathon

Feature: Hash chain integrity verification
  Scenario: Verify audit trail has not been tampered with
    Given the audit trail uses SHA-based hash chaining
    When an admin runs integrity verification
    Then each event's hash is recomputed and compared to the stored hash
    And any tampered records are flagged
```

**TODO:**
- [ ] Add query filters to the audit endpoint (action, entity_type, date range, actor)
- [ ] Add pagination to the audit endpoint (currently returns all)
- [ ] Add audit log export endpoint (CSV/JSON)
- [ ] Add hash chain integrity verification endpoint for admins
- [ ] Add audit events for missing actions: workspace invite accepted, workspace member removed, team invite sent, etc.

---

## 13. Platform Administration

> **STATUS: BASIC — CRUD for admins, users list, hackathons list, stats; many features missing**

```gherkin
Feature: Admin manages all workspaces
  Scenario: Admin drills into a workspace
    Given I am a platform admin
    When I view workspace "ws-1"
    Then I see all members, hackathons, and activity
    And I can modify workspace settings
    (Currently: admin/workspaces list exists, but no detail view with full management)

Feature: Admin manages platform invites
  Scenario: Admin creates a platform invite
    Given I am a platform admin
    When I POST /api/v1/admin/invites with email and role
    Then a platform invite is sent
    (Currently: invites page exists in admin frontend but no backend endpoint)

Feature: Admin workspace management
  Scenario: Admin can delete or suspend a workspace
    Given problematic workspace "ws-bad"
    When the admin suspends the workspace
    Then all hackathons in the workspace are paused
    And members cannot create new hackathons

Feature: Admin user management
  Scenario: Admin can suspend a user
    Given a user violating platform rules
    When the admin suspends the user
    Then the user cannot log in
    And their active sessions are revoked
```

**TODO:**
- [ ] Add `GET /api/v1/admin/workspaces` — list all workspaces with member counts and hackathon counts
- [ ] Add `GET /api/v1/admin/workspaces/:id` — workspace detail with members and hackathons
- [ ] Add `PATCH /api/v1/admin/workspaces/:id` — admin can update/suspend any workspace
- [ ] Add `DELETE /api/v1/admin/workspaces/:id` — admin can delete a workspace
- [ ] Add `POST /api/v1/admin/invites` — platform-level invites
- [ ] Add `GET /api/v1/admin/invites` — list platform invites
- [ ] Add user suspend/unsuspend endpoints
- [ ] Add `suspended` column to users and workspaces tables
- [ ] Add workspace detail page in admin frontend with full management capabilities

---

## 14. Frontend — Platform (Organizer Dashboard)

> **STATUS: PAGES EXIST — Routes and layouts are set up but many pages need API integration and feature completion**

```gherkin
Feature: Hackathon creation wizard
  Scenario: Organizer creates a hackathon step-by-step
    Given I am on the platform dashboard
    When I click "Create Hackathon"
    Then I am guided through a multi-step wizard:
      Step 1: Basic info (title, slug, description, workspace)
      Step 2: Schedule (dates, timezone, rounds)
      Step 3: Rules (team sizes, registration mode, email domains)
      Step 4: Tracks & Prizes
      Step 5: Review & Create

Feature: Hackathon settings page
  Scenario: Organizer updates all hackathon settings
    Given I am on the Settings page for "acme-hack"
    When I modify team size limits, registration mode, or tag pattern
    Then the changes are saved via PATCH /api/v1/hackathons/:slug
    And an audit event is logged

Feature: Analytics dashboard
  Scenario: Organizer views hackathon analytics
    Given I am on the Analytics page
    Then I see:
      - Total registrations over time
      - Teams created over time
      - Submissions per team
      - Judging progress (scored/total)
      - Geographic distribution (if collected)
```

**TODO:**
- [ ] Build hackathon creation wizard (multi-step form) on the platform dashboard
- [ ] Wire up the Settings page to PATCH hackathon configuration
- [ ] Wire up the Analytics page with real data from API (currently placeholder)
- [ ] Wire up the Announcements page with backend (endpoint needs to be built first)
- [ ] Add workspace switcher/selector in the platform sidebar
- [ ] Add hackathon state transition controls with confirmation dialogs
- [ ] Add judge management UI (invite, assign, track progress)
- [ ] Add rubric builder UI (drag-and-drop criteria ordering)
- [ ] Add round management UI (create rounds, set deadlines, advance teams)
- [ ] Ensure the platform only shows hackathons the organizer has access to

---

## 15. Frontend — Web (Participant App)

> **STATUS: PAGES EXIST — Browsing, team management, participant dashboard, leaderboard have routes; some need wiring**

```gherkin
Feature: Hackathon discovery and registration
  Scenario: User browses active hackathons
    Given I am on devsage.org/hackathons
    Then I see a list of active and upcoming hackathons
    And each card shows title, dates, team count, and status
    When I click on a hackathon
    Then I see its detail page with full info and a "Register" button

Feature: Participant dashboard
  Scenario: Participant sees their hackathon status
    Given I am registered for "acme-hack"
    When I visit the participant dashboard
    Then I see:
      - Current hackathon phase (active, judging, completed)
      - Countdown to next deadline
      - My team info and members
      - Linked repository status
      - Submission history
      - Checklist of required actions
```

**TODO:**
- [ ] Wire up Browse Hackathons page with proper filtering (status, search)
- [ ] Add hackathon registration flow (register button → API call → success state)
- [ ] Complete the participant dashboard with real API data (phase header, countdown, team card, repo card, submission history are started)
- [ ] Add profile page with edit capability (name, avatar)
- [ ] Add OAuth login buttons on the login page
- [ ] Add notification bell/dropdown in the top bar
- [ ] Add hackathon-specific theming based on the hackathon's accent color

---

## 16. Frontend — Admin Panel

> **STATUS: PAGES EXIST — Routes for admins, users, workspaces, hackathons, invites; need backend wiring**

```gherkin
Feature: Admin panel shows system-wide data
  Scenario: Admin views dashboard
    Given I am a platform admin
    When I visit shikdd.devsage.org
    Then I see system stats (total users, hackathons, teams, submissions)
    And recent activity across the platform

  Scenario: Admin manages users
    Given I am on the Users page
    Then I see all users with search and pagination
    And I can click a user to see their details, hackathons, and teams
    And I can suspend or delete a user
```

**TODO:**
- [ ] Wire up admin dashboard with `/api/v1/admin/stats` (already exists)
- [ ] Add search/filter to users list
- [ ] Add user detail view (click through from users list)
- [ ] Wire up workspaces page with admin workspace endpoints (need backend endpoints first)
- [ ] Wire up invites page with admin invite endpoints (need backend endpoints first)
- [ ] Add workspace detail page in admin
- [ ] Add system health monitoring view (queue depth, DO status, error rates)

---

## 17. Observability, Error Handling & Resilience

> **STATUS: BASIC — Error handler middleware exists; no structured logging, metrics, or alerting**

```gherkin
Feature: Structured logging
  Scenario: Every request is logged with context
    Given any API request is processed
    Then a structured log entry is created with:
      - Request ID, method, path, status, duration
      - User ID (if authenticated)
      - Hackathon slug (if in hackathon context)

Feature: Queue dead-letter handling
  Scenario: Webhook message fails after max retries
    Given a webhook queue message has been retried 3 times
    When it fails again
    Then it is moved to a dead-letter queue
    And an alert is triggered
    And an admin can inspect and replay the message

Feature: Rate limiting
  Scenario: Auth endpoints are rate-limited
    Given the auth rate limiter is configured
    When more than 10 login attempts per minute from the same IP
    Then subsequent requests receive 429 TOO_MANY_REQUESTS
    (Partial: rateLimitMiddleware exists on auth routes; need to verify it works correctly on Workers)
```

**TODO:**
- [ ] Add structured logging with request context (request ID, user ID, hackathon slug, duration)
- [ ] Configure dead-letter queue for failed webhook messages
- [ ] Add retry count tracking in webhook_deliveries
- [ ] Add health check improvements (check D1 connectivity, KV availability, DO responsiveness)
- [ ] Verify rate limiter works correctly on Cloudflare Workers (current implementation may not persist state across isolates)
- [ ] Add rate limiting to other sensitive endpoints (registration, team join)
- [ ] Add Sentry or equivalent error tracking integration

---

## 18. Testing

> **STATUS: EXTENSIVE TEST FILES EXIST — 20+ test files in apps/api/src/__tests__; need to verify coverage and passing status**

```gherkin
Feature: All BDD scenarios have corresponding tests
  Scenario: Test coverage matches spec
    Given the BDD specification describes N scenarios
    When we audit the test suite
    Then every scenario has at least one corresponding test
    And edge cases (invalid input, auth failures, race conditions) are covered
```

**TODO:**
- [ ] Audit test coverage against BDD scenarios (map each scenario to a test)
- [ ] Add integration tests for the full submission pipeline (tag push → webhook → queue → DO → D1)
- [ ] Add integration tests for the full judging pipeline (invite → accept → assign → score → leaderboard)
- [ ] Add E2E tests for critical frontend flows (login, register for hackathon, create team, link repo)
- [ ] Verify all existing tests pass (`pnpm test`)
- [ ] Add CI step to run tests on every PR

---

## 19. Documentation & Onboarding

> **STATUS: AGENTS.md and README.md exist; operational docs missing**

**TODO:**
- [ ] Document the organizer workflow end-to-end: create workspace → create hackathon → provide design → review frontend → approve → go live → manage event → judge → publish results
- [ ] Document the per-hackathon frontend deployment process (how to use `hackathon-template` repo)
- [ ] Document API endpoints with request/response examples (OpenAPI spec or similar)
- [ ] Add developer setup guide (local dev with miniflare/wrangler dev, seed data, test accounts)
- [ ] Document the webhook processing pipeline for debugging
- [ ] Document the state machine transitions and how to recover from stuck states

---

## Summary of Critical Path (MVP Blocklist)

These items MUST be completed for a working hackathon to be hosted end-to-end:

| # | Item | Blocks |
|---|------|--------|
| 1 | Adopt `hackathon-template` org repo | Per-hackathon frontends |
| 2 | Per-hackathon frontend deployment automation | Hosting any hackathon |
| 3 | OAuth (GitHub/Google) implementation | Participant login on hackathon sites |
| 4 | Participant registration endpoint | Joining a hackathon |
| 5 | Workspace-scoped hackathon listing | Organizer dashboard correctness |
| 6 | GitHub App JWT signing | Submission pipeline (tag SHA resolution, commit status) |
| 7 | Judge invite by email | Inviting external judges |
| 8 | Announcements backend | Organizer communication |
| 9 | CI/CD pipeline | Deploying anything to production |
| 10 | CORS for `{slug}.devsage.org` | Per-hackathon sites calling the API |

---

*Generated: February 2026 | DevSage Platform v1.0 Planning*
