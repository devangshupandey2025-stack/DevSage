# DevSage Hackathon Platform — TODO

**BDD-Driven Development Specification**
Behavioral specifications describing every feature that must be built, integrated, or hardened to ship a production-ready hackathon management platform.

Repository: `devsage` monorepo
Version: 1.0 | Date: February 2026

---

## Table of Contents

1. [Architecture & Deployment Pipeline](#1-architecture--deployment-pipeline)
2. [Per-Hackathon Frontend (`{slug}.devsage.org`)](#2-per-hackathon-frontend-slugdevsageorg)
3. [Authentication & Security](#3-authentication--security)
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
> **PRIORITY: P0 — Blocks all per-hackathon site deployments**

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
> **PRIORITY: P0 — Blocks hosting any hackathon**

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
- [ ] Add a `site_status` column to hackathons table (`pending_design`, `in_review`, `approved`, `deployed`)

---

### 1.3 Monorepo CI/CD & Wrangler Config

> **STATUS: PARTIAL — wrangler.jsonc exists but CI/CD pipeline is not set up**
> **PRIORITY: P0 — Blocks deploying anything to production**

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
- [ ] Configure staging vs production environments with separate D1 databases
- [ ] Add preview deployments for PRs
- [ ] Add secrets management in CI (JWT_SECRET, GITHUB_WEBHOOK_SECRET, RESEND_API_KEY, OAuth credentials, etc.)

---

## 2. Per-Hackathon Frontend (`{slug}.devsage.org`)

> **STATUS: PROTOTYPE ONLY — `templates/hackathon-site/` exists with basic components but no API integration**
> **PRIORITY: P0**

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
    And after authentication, they are sent an email OTP to verify identity
    And after OTP verification, they are registered for "acme-hack"
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

  Scenario: Cross-subdomain auth works correctly
    Given a user is authenticated on `acme-hack.devsage.org`
    When they navigate to `devsage.org` or `platform.devsage.org`
    Then their session is recognized (cross-subdomain cookies)
    And they do NOT need to log in again
```

**TODO:**
- [ ] Migrate `templates/hackathon-site/` scaffold to the `hackathon-template` org repo
- [ ] Add full auth flow in the template (login, register, OAuth, OTP verification)
- [ ] Add participant dashboard page (team status, submission status, countdown)
- [ ] Add team management pages (create, join, invite code, link repo)
- [ ] Add leaderboard page
- [ ] Add submission history view
- [ ] Connect all components to the backend API via `site.config.json` → `apiOrigin`
- [ ] Configure cross-subdomain cookies (`.devsage.org` domain) so auth works across all subdomains
- [ ] Add `{slug}.devsage.org` to the CORS allowed origins dynamically (validate slug exists in DB)
- [ ] Add `trustedOrigins` configuration for `*.devsage.org` wildcard

---

## 3. Authentication & Security

> **STATUS: EMAIL/PASSWORD ONLY — OAuth NOT implemented, no OTP/2FA, no email verification, no password reset**
> **PRIORITY: P0**

### 3.1 Email OTP on Every Login (Mandatory)

> All logins — email/password, OAuth, and any future method — MUST require a one-time password sent to the user's email before a session is fully established.

```gherkin
Feature: Mandatory email OTP verification on every login
  Every login attempt requires a 6-digit OTP sent to the user's
  registered email. The session is NOT created until the OTP is verified.
  This replaces traditional "optional 2FA" — it is always enforced.

  Background:
    Given OTP codes are 6 digits, valid for 5 minutes
    And OTP codes are stored encrypted (not plaintext) in the database
    And a maximum of 5 verification attempts is allowed per code
    And constant-time comparison is used to prevent timing attacks

  Scenario: Email/password login requires OTP
    Given I submit valid email and password to POST /auth/login
    When credentials are verified successfully
    Then the server does NOT issue session cookies yet
    And instead returns { requiresOTP: true, otpSessionId: "..." }
    And a 6-digit OTP is sent to my email via Resend
    And the OTP is stored encrypted with a 5-minute TTL
    When I submit the OTP to POST /auth/verify-otp with the otpSessionId
    Then the OTP is verified using constant-time comparison
    And session cookies (access_token + refresh_token) are issued
    And I am redirected to the dashboard

  Scenario: OAuth login (GitHub/Google) requires OTP
    Given I complete the OAuth flow with GitHub or Google
    When the callback processes successfully and identifies my user record
    Then the server does NOT issue session cookies yet
    And instead redirects to /auth/verify-otp?session=<otpSessionId>
    And a 6-digit OTP is sent to my email
    When I verify the OTP
    Then session cookies are issued

  Scenario: OTP is expired
    Given I received an OTP 6 minutes ago
    When I submit the expired OTP
    Then I receive 401 OTP_EXPIRED
    And the expired OTP record is deleted
    And I must request a new OTP via POST /auth/resend-otp

  Scenario: OTP is incorrect
    Given I received a valid OTP
    When I submit an incorrect code
    Then I receive 401 OTP_INVALID
    And the attempt counter increments
    When I exhaust all 5 attempts
    Then the OTP is invalidated
    And I receive 429 OTP_MAX_ATTEMPTS
    And must request a new OTP

  Scenario: OTP replay prevention
    Given I successfully verified an OTP
    When an attacker tries to reuse the same OTP
    Then it has already been deleted from the database
    And they receive 401 OTP_INVALID

  Scenario: Resend OTP with rate limiting
    Given I requested an OTP
    When I request another within 60 seconds
    Then I receive 429 OTP_COOLDOWN with a retry-after header
    When 60 seconds have passed
    Then I can request a new OTP
    And the previous OTP is invalidated

  Scenario: Trusted device skips OTP (optional future enhancement)
    Given I verified OTP and checked "Trust this device"
    When a trust cookie is set with a 30-day expiry
    Then subsequent logins from this device skip OTP
    When the trust cookie expires or is revoked
    Then OTP is required again
```

**TODO:**
- [ ] Create `otp_sessions` table: `id, user_id, otp_hash, created_at, expires_at, attempts, max_attempts, verified_at, ip_address`
- [ ] Add OTP generation: cryptographically random 6-digit code via `crypto.getRandomValues()`
- [ ] Add OTP storage: encrypt OTP before storing (use AES-GCM with a separate `OTP_ENCRYPTION_KEY` secret, NOT plaintext, NOT just hashed)
- [ ] Add `POST /auth/verify-otp` endpoint — verifies OTP with constant-time comparison, issues session cookies on success, deletes OTP record
- [ ] Add `POST /auth/resend-otp` endpoint — invalidates existing OTP, generates new one, rate-limited to 1 per 60 seconds
- [ ] Modify `POST /auth/login` — on valid credentials, create OTP session + send OTP email, return `{ requiresOTP: true, otpSessionId }` instead of session cookies
- [ ] Modify OAuth callbacks (GitHub, Google) — on valid OAuth, create OTP session + send OTP, redirect to `/auth/verify-otp?session=<id>`
- [ ] Add OTP email template via Resend with clear branding, code display, and expiry notice
- [ ] Add `OTP_ENCRYPTION_KEY` Wrangler secret (separate from JWT_SECRET — defense in depth)
- [ ] Add OTP cleanup cron: delete expired OTP records older than 1 hour
- [ ] Add OTP attempt tracking and lockout (5 max attempts per code)
- [ ] Add all frontend OTP verification screens (web, platform, admin, hackathon-template)
- [ ] (Future) Add trusted device mechanism: cookie-based device trust with 30-day TTL, revocable per user

---

### 3.2 OAuth Providers (GitHub & Google)

> **STATUS: NOT IMPLEMENTED — routes spec'd in BDD but code only has email/password**

```gherkin
Feature: GitHub OAuth login
  Scenario: Successful GitHub OAuth login
    Given I am an unauthenticated user
    When I navigate to /auth/github
    Then I am redirected to GitHub OAuth authorization page
    And after authorizing, GitHub redirects to /auth/github/callback
    And the system exchanges the code for an access token
    And creates or updates my user record (linking GitHub ID)
    And triggers mandatory email OTP verification
    And after OTP, session cookies are issued

  Scenario: Link GitHub account to existing email/password user
    Given I registered with email/password
    When I initiate GitHub OAuth
    And GitHub returns an email matching my existing account
    Then my account is linked to my GitHub profile (account linking)
    And I can log in via either method going forward

  Scenario: GitHub OAuth with new email creates new account
    Given no account exists for my GitHub email
    When I complete GitHub OAuth
    Then a new user record is created with my GitHub profile data
    And my email is pre-verified (GitHub has already verified it)
    And I complete OTP verification to establish the session

Feature: Google OAuth login
  Scenario: Successful Google OAuth login
    Given I am an unauthenticated user
    When I navigate to /auth/google
    Then I am redirected to Google OAuth consent screen
    And after consenting, Google redirects to /auth/google/callback
    And the system exchanges the code for tokens
    And creates or updates my user record
    And triggers mandatory email OTP verification
```

**TODO:**
- [ ] Implement `GET /auth/github` — redirect to GitHub OAuth authorization URL with `state` CSRF token
- [ ] Implement `GET /auth/github/callback` — exchange code for token, upsert user, trigger OTP flow
- [ ] Implement `GET /auth/google` — redirect to Google OAuth consent screen with `state` CSRF token
- [ ] Implement `GET /auth/google/callback` — exchange code for token, upsert user, trigger OTP flow
- [ ] Add `github_id` and `google_id` columns to `users` table for account linking
- [ ] Implement account linking: when OAuth email matches existing user, link accounts instead of creating duplicate
- [ ] Store OAuth `state` parameter in a short-lived KV key (5-min TTL) for CSRF protection
- [ ] Add Wrangler secrets: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] Update login pages in all frontend apps to show "Continue with GitHub" and "Continue with Google" buttons

---

### 3.3 Email Verification on Signup

> **STATUS: NOT IMPLEMENTED — users can register without verifying their email**

```gherkin
Feature: Email verification on registration
  Scenario: New user must verify email before using the platform
    Given I register with email "user@example.com"
    When registration completes
    Then a verification email is sent with a unique token link
    And my account is created but marked as `email_verified = false`
    And I cannot create teams, register for hackathons, or perform actions
    Until I click the verification link

  Scenario: Verification link expires
    Given I received a verification email 25 hours ago
    When I click the expired link
    Then I receive "Verification link expired"
    And I can request a new verification email

  Scenario: Resend verification email
    Given my email is not yet verified
    When I POST /auth/resend-verification
    Then a new verification email is sent (rate limited: 1 per 2 minutes)
    And the previous verification token is invalidated

  Scenario: Timing-safe verification
    Given a verification request arrives
    When the token is checked
    Then constant-time comparison is used
    And response time does NOT reveal whether the token exists
```

**TODO:**
- [ ] Add `email_verified` column to `users` table (default `false`)
- [ ] Add `email_verification_tokens` table: `id, user_id, token_hash, created_at, expires_at`
- [ ] Generate cryptographically random verification token (24+ characters)
- [ ] Send verification email on registration via Resend with a branded template
- [ ] Add `GET /auth/verify-email?token=<token>` endpoint — marks email as verified
- [ ] Add `POST /auth/resend-verification` endpoint — rate-limited to 1 per 2 minutes
- [ ] Add middleware to block unverified users from protected actions (team creation, hackathon registration)
- [ ] Set `email_verified = true` automatically for OAuth signups (provider already verified the email)
- [ ] Token expiry: 24 hours, single-use (deleted after verification)

---

### 3.4 Password Reset

> **STATUS: NOT IMPLEMENTED — no password reset flow exists**

```gherkin
Feature: Password reset via email
  Scenario: User requests password reset
    Given I have forgotten my password
    When I POST /auth/forgot-password with my email
    Then a reset email is sent with a unique token link
    And the response is ALWAYS "If this email exists, check your inbox" (timing-safe)

  Scenario: User resets password
    Given I clicked the reset link with a valid token
    When I POST /auth/reset-password with the token and new password
    Then my password is updated
    And the token is deleted (single-use)
    And all existing sessions are revoked (force re-login everywhere)
    And an audit event "auth.password_reset" is logged

  Scenario: Reset token expired
    Given the reset token is older than 1 hour
    When I try to use it
    Then I receive 410 TOKEN_EXPIRED

  Scenario: Password strength enforcement
    Given I submit a new password
    When the password is fewer than 8 characters
    Then I receive 400 VALIDATION_ERROR
    When the password is valid
    Then it is hashed and stored
```

**TODO:**
- [ ] Add `password_reset_tokens` table: `id, user_id, token_hash, created_at, expires_at`
- [ ] Add `POST /auth/forgot-password` — always returns same response regardless of email existence (timing-safe)
- [ ] Add `POST /auth/reset-password` — validates token, updates password hash, revokes all sessions
- [ ] Token expiry: 1 hour, single-use
- [ ] Hash the reset token before storing (SHA-256) — never store plaintext tokens
- [ ] Add password reset email template
- [ ] Add password reset pages in all frontend apps

---

### 3.5 Password Hashing Upgrade

> **STATUS: REVIEW NEEDED — Currently using a custom `hashPassword` in `lib/password.ts`**

```gherkin
Feature: Secure password hashing
  Scenario: Passwords are hashed with a memory-hard algorithm
    Given a user registers or resets their password
    When the password is stored
    Then it is hashed using scrypt or Argon2id (NOT bcrypt on Workers — it's CPU-only)
    And the hash includes a unique salt
    And hash parameters are stored alongside the hash for future upgrades
```

**TODO:**
- [ ] Audit `lib/password.ts` — verify it uses scrypt (native to Workers via Web Crypto) or a suitable WASM-based hasher
- [ ] Ensure hash parameters (N, r, p for scrypt) are stored alongside the hash so they can be upgraded later
- [ ] Add minimum password length of 8 (currently exists) and maximum of 128 to prevent DoS via long passwords
- [ ] Add common-password-list check (top 10,000 passwords) as a Zod refinement

---

### 3.6 Cross-Subdomain Session Sharing

> **STATUS: NOT IMPLEMENTED — cookies are set per-domain, not shared across subdomains**

```gherkin
Feature: Single sign-on across all devsage.org subdomains
  Scenario: User logs in once, authenticated everywhere
    Given I log in on `platform.devsage.org`
    When I navigate to `acme-hack.devsage.org`
    Then my session cookie is recognized (domain = `.devsage.org`)
    And I am already authenticated
    And I do NOT need to log in again

  Scenario: Logout on one subdomain logs out everywhere
    Given I am authenticated across multiple subdomains
    When I log out on `platform.devsage.org`
    Then the cookie is cleared for `.devsage.org`
    And I am logged out on all subdomains
```

**TODO:**
- [ ] Set cookie `domain` to `.devsage.org` (leading dot = all subdomains) in `lib/cookies.ts`
- [ ] Ensure `Secure`, `HttpOnly`, `SameSite=Lax` attributes are set on all auth cookies
- [ ] Add `.devsage.org` and all known subdomains to `trustedOrigins` in CORS config
- [ ] Test cross-subdomain auth flow: login on platform → verify on hackathon site → verify on admin

---

### 3.7 Rate Limiting Hardening

> **STATUS: PARTIAL — `rateLimitMiddleware` exists on auth routes using KV, but may not work correctly across Worker isolates**

```gherkin
Feature: Rate limiting on sensitive endpoints
  Scenario: Brute-force login prevention
    Given an attacker attempts more than 10 logins per minute from one IP
    When the 11th request arrives
    Then they receive 429 TOO_MANY_REQUESTS with Retry-After header
    And the block persists for the configured window

  Scenario: OTP brute-force prevention
    Given an attacker attempts more than 5 OTP verifications
    When the 6th attempt arrives for the same OTP session
    Then the OTP is invalidated entirely
    And the user must request a new OTP

  Scenario: Registration spam prevention
    Given an attacker attempts more than 5 registrations per hour from one IP
    When the 6th registration arrives
    Then they receive 429 TOO_MANY_REQUESTS
```

**TODO:**
- [ ] Verify KV-based rate limiter works correctly on Cloudflare Workers (atomic increments via KV are NOT guaranteed — consider using Durable Objects for accuracy)
- [ ] Add rate limiting to: `POST /auth/verify-otp` (5/min per session), `POST /auth/resend-otp` (1/min per user), `POST /auth/register` (5/hour per IP), `POST /auth/forgot-password` (3/hour per IP)
- [ ] Add `Retry-After` header to all 429 responses
- [ ] Consider moving rate limit state to a Durable Object for consistency (KV is eventually consistent)

---

## 4. Workspace Scoping & Organizer Isolation

> **STATUS: PARTIAL — Workspace CRUD exists, but organizer isolation is incomplete**
> **PRIORITY: P1**

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

Feature: Workspace deletion cascades correctly
  Scenario: Deleting a workspace archives its hackathons
    Given workspace "ws-1" has 2 active hackathons
    When the workspace owner deletes the workspace
    Then the system blocks deletion if any hackathon is in "active" or "judging" state
    And only allows deletion when all hackathons are "completed" or "archived"
```

**TODO:**
- [ ] Add `GET /api/v1/workspaces/:workspaceId/hackathons` endpoint (list hackathons scoped to a workspace)
- [ ] Add an "organizer's hackathons" endpoint or filter: `GET /api/v1/hackathons?mine=true` that returns only hackathons the user is an organizer of or is a workspace member for
- [ ] Ensure the platform dashboard only fetches hackathons the organizer has access to (not all hackathons)
- [ ] Add workspace_id to the hackathon list response in the platform frontend
- [ ] Verify role middleware correctly resolves workspace membership → organizer access for all organizer endpoints
- [ ] Add workspace deletion safeguards (block if active hackathons exist)
- [ ] Add workspace ownership transfer endpoint

---

## 5. Hackathon Configuration Completeness

> **STATUS: PARTIAL — Core CRUD and state machine exist; several config areas are missing**
> **PRIORITY: P1**

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

Feature: Hackathon cloning
  Scenario: Organizer clones a completed hackathon
    Given hackathon "acme-2025" is completed
    When the organizer clones it as "acme-2026"
    Then a new draft hackathon is created with the same configuration
    And dates, tracks, rubric, rounds are copied
    And teams, submissions, scores are NOT copied
```

**TODO:**
- [ ] Add track CRUD endpoints (`POST/GET/PATCH/DELETE /api/v1/hackathons/:slug/tracks`)
- [ ] Add `hackathon_tracks` table queries to hackathon detail responses
- [ ] Add sponsor CRUD endpoints (`POST/GET/PATCH/DELETE /api/v1/hackathons/:slug/sponsors`)
- [ ] Add prize CRUD endpoints or extend the `prizes` JSON field with proper Zod validation
- [ ] Complete template application (line 69 in `hackathons.ts`): apply rounds and rubric from template during hackathon creation
- [ ] Add template CRUD endpoints for platform admins
- [ ] Add `allowed_email_domains` enforcement during registration
- [ ] Add `registration_mode` enforcement (`open`, `invite_only`, `approval_required`)
- [ ] Add hackathon clone endpoint: `POST /api/v1/hackathons/:slug/clone`

---

## 6. Registration & Participant Onboarding

> **STATUS: NOT STARTED — No participant registration endpoint for hackathons**
> **PRIORITY: P0**

The system has team creation and joining, but there is no explicit "register for a hackathon" flow.

```gherkin
Feature: Participant registration for a hackathon
  Scenario: Register for an open hackathon
    Given hackathon "acme-hack" has registration_mode "open"
    And I am an authenticated user with a verified email
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

  Scenario: Unregister from a hackathon
    Given I am registered for "acme-hack" but NOT on a team
    When I POST /api/v1/hackathons/acme-hack/unregister
    Then I am removed from the participant list
    When I am on a team
    Then unregistration is blocked — must leave team first
```

**TODO:**
- [ ] Create `hackathon_participants` table: `id, hackathon_id, user_id, registered_at, status`
- [ ] Add `POST /api/v1/hackathons/:slug/register` endpoint
- [ ] Add `POST /api/v1/hackathons/:slug/unregister` endpoint (block if on a team)
- [ ] Add `GET /api/v1/hackathons/:slug/participants` endpoint (organizer-only, paginated)
- [ ] Add `GET /api/v1/hackathons/:slug/participants/me` endpoint (participant checks own status)
- [ ] Enforce `registration_mode` (open, invite_only, approval_required)
- [ ] Enforce `allowed_email_domains` during registration
- [ ] Add `max_participants` column to hackathons and enforce registration cap
- [ ] Add participant invite system for invite-only hackathons
- [ ] Add a "My Hackathons" endpoint: `GET /api/v1/hackathons?registered=true`
- [ ] Require `email_verified = true` before allowing hackathon registration

---

## 7. Team Management Gaps

> **STATUS: MOSTLY COMPLETE — Core team CRUD exists; a few features missing**
> **PRIORITY: P1**

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

Feature: Team discovery
  Scenario: Participant searches for teams looking for members
    Given I am registered for "acme-hack" but not on a team
    When I browse available teams
    Then I see teams that have open spots (current < max_team_size)
    And each shows name, track, member count, and description
```

**TODO:**
- [ ] Add `POST /api/v1/hackathons/:slug/teams/:teamId/invite` — email-based team invite
- [ ] Add `GET /api/v1/hackathons/:slug/teams/:teamId/invites` — list pending team invites
- [ ] Add `DELETE /api/v1/hackathons/:slug/teams/:teamId/invites/:inviteId` — revoke a team invite
- [ ] Add min_team_size validation in the submission pipeline (reject submissions from undersized teams)
- [ ] Add team search/browse for participants (`GET /api/v1/hackathons/:slug/teams?open=true`)
- [ ] Add team description field for "looking for members" recruitment

---

## 8. Repository Integration & GitHub App

> **STATUS: PARTIAL — Webhook verification, tag handler, push handler exist; GitHub App JWT signing NOT implemented**
> **PRIORITY: P1**

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
> **PRIORITY: P1**

```gherkin
Feature: Submission validation pipeline
  Scenario: Validate submission before accepting
    Given a submission is received from a tag push
    When the system processes it
    Then it should validate:
      - The team meets min_team_size
      - The hackathon allows resubmission (if this is not the first)
      - The submission is not a duplicate (same SHA)
      - The participant has a verified email
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

Feature: Submission freeze enforcement
  Scenario: No submissions accepted after judging starts
    Given a hackathon transitions from "active" to "judging"
    When a team pushes a tag after the transition
    Then the Durable Object rejects the submission (status != 'active')
    And the team receives a notification that submissions are closed
```

**TODO:**
- [ ] Add min_team_size validation check in tag-create-handler before accepting submission
- [ ] Add `allow_resubmission` check (currently resubmission is always allowed)
- [ ] Add duplicate SHA detection (reject if same commit SHA already submitted)
- [ ] Add submission status progression: `received` → `validated` → `scored`
- [ ] Add `PATCH /api/v1/hackathons/:slug/submissions/:id` for organizer overrides (set is_final, change status)
- [ ] Add submission deadline enforcement per round (not just hackathon-level)
- [ ] Send notification to team when their submission is rejected by validation

---

## 10. Judging & Scoring Completeness

> **STATUS: CORE WORKS — Rubric CRUD, judge invite/accept, scoring, leaderboard exist; several gaps**
> **PRIORITY: P1**

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
- [ ] Add judge invite by email (create a placeholder judge record, send email with accept link, link to user on signup/login)
- [ ] Add invite token to judge records for email-based acceptance (currently uses judge ID only)
- [ ] Add conflict-of-interest detection in auto-assignment (don't assign judge to teams in same workspace or where judge is a team member)
- [ ] Add score visibility control — hide leaderboard from participants until results are published (check `round_results.status = 'published'`)
- [ ] Add `show_judge_comments_to_participants` enforcement (column exists but not checked anywhere)
- [ ] Add multi-round advancement: `POST /api/v1/hackathons/:slug/rounds/:roundId/advance` — advance top N teams
- [ ] Add round-specific rubric criteria filtering in the scoring UI
- [ ] Add judge progress dashboard (how many assignments scored out of total)
- [ ] Add score export (CSV/JSON) for organizers
- [ ] Add "recuse" endpoint: judge can recuse themselves from an assignment

---

## 11. Notifications & Communication

> **STATUS: CORE WORKS — Queue-based notification handler, in-app notifications, email via Resend; several features missing**
> **PRIORITY: P1**

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

Feature: Email templates
  Scenario: All emails use branded templates
    Given any email is sent by the platform
    Then it uses a consistent branded HTML template
    And includes the DevSage logo and hackathon branding (if applicable)
    And includes an unsubscribe link
    (Currently: emails are plain `<p>` tags)
```

**TODO:**
- [ ] Add `announcements` table: `id, hackathon_id, title, body, created_by, created_at, pinned`
- [ ] Add `POST /api/v1/hackathons/:slug/announcements` endpoint
- [ ] Add `GET /api/v1/hackathons/:slug/announcements` endpoint (paginated)
- [ ] Add notification preferences table: `user_id, notification_type, email_enabled, in_app_enabled`
- [ ] Add `PATCH /api/v1/notifications/preferences` endpoint
- [ ] Check notification preferences before sending emails in `notification-handler.ts`
- [ ] Add `DELETE /api/v1/notifications/:id` — delete a notification
- [ ] Build branded email templates (HTML/CSS) for: OTP, verification, password reset, team invite, judge invite, announcement, deadline reminder, submission received, results published
- [ ] Add unsubscribe link/one-click-unsubscribe header in all emails
- [ ] Consider SSE or Durable Object-based WebSocket for real-time notification push (future enhancement)

---

## 12. Audit & Compliance

> **STATUS: MOSTLY COMPLETE — Audit trail with hash chaining exists; a few gaps**
> **PRIORITY: P2**

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

Feature: Auth-related audit completeness
  Scenario: All auth events are logged
    Given OTP is now mandatory on every login
    Then audit events include: auth.otp_sent, auth.otp_verified, auth.otp_failed,
      auth.email_verified, auth.password_reset_requested, auth.password_reset
```

**TODO:**
- [ ] Add query filters to the audit endpoint (action, entity_type, date range, actor)
- [ ] Add pagination to the audit endpoint (currently returns all)
- [ ] Add audit log export endpoint (CSV/JSON)
- [ ] Add hash chain integrity verification endpoint for admins
- [ ] Add audit events for missing actions: `auth.otp_sent`, `auth.otp_verified`, `auth.otp_failed`, `auth.email_verified`, `auth.password_reset_requested`, `auth.password_reset`, workspace invite accepted, workspace member removed, team invite sent, announcement created

---

## 13. Platform Administration

> **STATUS: BASIC — CRUD for admins, users list, hackathons list, stats; many features missing**
> **PRIORITY: P2**

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
  Scenario: Admin can suspend a workspace
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
    And OTP verification is blocked for their account
```

**TODO:**
- [ ] Add `GET /api/v1/admin/workspaces` — list all workspaces with member counts and hackathon counts
- [ ] Add `GET /api/v1/admin/workspaces/:id` — workspace detail with members and hackathons
- [ ] Add `PATCH /api/v1/admin/workspaces/:id` — admin can update/suspend any workspace
- [ ] Add `DELETE /api/v1/admin/workspaces/:id` — admin can delete a workspace (with safeguards)
- [ ] Add `POST /api/v1/admin/invites` — platform-level invites
- [ ] Add `GET /api/v1/admin/invites` — list platform invites
- [ ] Add `POST /api/v1/admin/users/:id/suspend` and `/unsuspend` endpoints
- [ ] Add `suspended_at` column to users and workspaces tables
- [ ] Check `suspended_at` in auth middleware — block login + OTP for suspended users
- [ ] Add workspace detail page in admin frontend with full management capabilities
- [ ] Add admin audit log viewer (cross-hackathon, platform-wide)

---

## 14. Frontend — Platform (Organizer Dashboard)

> **STATUS: PAGES EXIST — Routes and layouts are set up but many pages need API integration and feature completion**
> **PRIORITY: P1**

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
```

**TODO:**
- [ ] Build hackathon creation wizard (multi-step form) on the platform dashboard
- [ ] Wire up the Settings page to PATCH hackathon configuration
- [ ] Wire up the Analytics page with real data from API (currently placeholder)
- [ ] Wire up the Announcements page with backend (endpoint needs to be built first)
- [ ] Add workspace switcher/selector in the platform sidebar
- [ ] Add hackathon state transition controls with confirmation dialogs
- [ ] Add judge management UI (invite by email, assign, track progress)
- [ ] Add rubric builder UI (drag-and-drop criteria ordering)
- [ ] Add round management UI (create rounds, set deadlines, advance teams)
- [ ] Ensure the platform only shows hackathons the organizer has access to
- [ ] Add OTP verification screen in the login flow

---

## 15. Frontend — Web (Participant App)

> **STATUS: PAGES EXIST — Browsing, team management, participant dashboard, leaderboard have routes; some need wiring**
> **PRIORITY: P1**

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
- [ ] Add OAuth login buttons on the login page ("Continue with GitHub", "Continue with Google")
- [ ] Add OTP verification screen after login/OAuth
- [ ] Add email verification banner for unverified users
- [ ] Add notification bell/dropdown in the top bar
- [ ] Add hackathon-specific theming based on the hackathon's accent color
- [ ] Add password reset flow pages (forgot password, reset password)

---

## 16. Frontend — Admin Panel

> **STATUS: PAGES EXIST — Routes for admins, users, workspaces, hackathons, invites; need backend wiring**
> **PRIORITY: P2**

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
- [ ] Add user detail view (click through from users list) with suspend/unsuspend controls
- [ ] Wire up workspaces page with admin workspace endpoints (need backend endpoints first)
- [ ] Wire up invites page with admin invite endpoints (need backend endpoints first)
- [ ] Add workspace detail page in admin
- [ ] Add system health monitoring view (queue depth, DO status, error rates)
- [ ] Add OTP verification screen in the admin login flow

---

## 17. Observability, Error Handling & Resilience

> **STATUS: BASIC — Error handler middleware exists; no structured logging, metrics, or alerting**
> **PRIORITY: P2**

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

Feature: Rate limiting hardened for auth
  Scenario: OTP brute-force is prevented
    Given the rate limiter is configured
    When more than 5 OTP attempts are made for the same session
    Then the OTP is invalidated
    When more than 10 OTP requests per hour from the same IP
    Then subsequent requests receive 429 TOO_MANY_REQUESTS
```

**TODO:**
- [ ] Add structured logging with request context (request ID, user ID, hackathon slug, duration)
- [ ] Configure dead-letter queue for failed webhook messages
- [ ] Add retry count tracking in webhook_deliveries
- [ ] Add health check improvements (check D1 connectivity, KV availability, DO responsiveness)
- [ ] Verify rate limiter works correctly on Cloudflare Workers (current implementation may not persist state across isolates — consider DO-based rate limiter)
- [ ] Add rate limiting to OTP endpoints, registration, team join, and other sensitive operations
- [ ] Add Sentry or equivalent error tracking integration
- [ ] Add `/health` endpoint to check all dependencies (D1, KV, DO, Queues)

---

## 18. Testing

> **STATUS: EXTENSIVE TEST FILES EXIST — 20+ test files in apps/api/src/__tests__; need to verify coverage and passing status**
> **PRIORITY: P1**

```gherkin
Feature: All BDD scenarios have corresponding tests
  Scenario: Test coverage matches spec
    Given the BDD specification describes N scenarios
    When we audit the test suite
    Then every scenario has at least one corresponding test
    And edge cases (invalid input, auth failures, race conditions) are covered

Feature: OTP flow has comprehensive tests
  Scenario: OTP tests cover all edge cases
    Given the OTP system is mandatory
    Then tests must cover:
      - Successful login → OTP → session creation
      - Expired OTP rejection
      - Max attempts lockout
      - Replay prevention (OTP deleted after use)
      - Rate limiting on resend
      - OAuth → OTP flow
      - Constant-time comparison verification
```

**TODO:**
- [ ] Audit test coverage against BDD scenarios (map each scenario to a test)
- [ ] Add comprehensive OTP flow tests (success, expiry, lockout, replay, rate limit)
- [ ] Add integration tests for the full submission pipeline (tag push → webhook → queue → DO → D1)
- [ ] Add integration tests for the full judging pipeline (invite → accept → assign → score → leaderboard)
- [ ] Add E2E tests for critical frontend flows (login → OTP → dashboard, register for hackathon, create team, link repo)
- [ ] Verify all existing tests pass (`pnpm test`)
- [ ] Add CI step to run tests on every PR
- [ ] Add tests for email verification flow
- [ ] Add tests for password reset flow
- [ ] Add tests for cross-subdomain auth

---

## 19. Documentation & Onboarding

> **STATUS: AGENTS.md and README.md exist; operational docs missing**
> **PRIORITY: P2**

**TODO:**
- [ ] Document the organizer workflow end-to-end: create workspace → create hackathon → provide design → review frontend → approve → go live → manage event → judge → publish results
- [ ] Document the per-hackathon frontend deployment process (how to use `hackathon-template` repo)
- [ ] Document API endpoints with request/response examples (OpenAPI spec or similar)
- [ ] Add developer setup guide (local dev with miniflare/wrangler dev, seed data, test accounts)
- [ ] Document the webhook processing pipeline for debugging
- [ ] Document the state machine transitions and how to recover from stuck states
- [ ] Document the auth flow: register → verify email → login → OTP → session
- [ ] Document the OTP system for developers (how it works, how to test locally, how to disable in dev)

---

## Summary of Critical Path (MVP Blocklist)

These items MUST be completed for a working hackathon to be hosted end-to-end:

| # | Priority | Item | Blocks |
|---|----------|------|--------|
| 1 | P0 | Mandatory email OTP on login | All authenticated actions |
| 2 | P0 | Email verification on signup | Hackathon registration, trusted identity |
| 3 | P0 | OAuth (GitHub/Google) implementation | Participant login on hackathon sites |
| 4 | P0 | Password reset flow | Users who forget passwords |
| 5 | P0 | Adopt `hackathon-template` org repo | Per-hackathon frontends |
| 6 | P0 | Per-hackathon frontend deployment automation | Hosting any hackathon |
| 7 | P0 | Participant registration endpoint | Joining a hackathon |
| 8 | P0 | CI/CD pipeline | Deploying anything to production |
| 9 | P0 | CORS + cross-subdomain cookies for `*.devsage.org` | Per-hackathon sites calling the API |
| 10 | P1 | Workspace-scoped hackathon listing | Organizer dashboard correctness |
| 11 | P1 | GitHub App JWT signing | Submission pipeline (tag SHA resolution, commit status) |
| 12 | P1 | Judge invite by email | Inviting external judges |
| 13 | P1 | Announcements backend | Organizer communication |
| 14 | P1 | Branded email templates | Professional OTP, verification, and notification emails |

---

*Generated: February 2026 | DevSage Platform v1.0 Planning*
