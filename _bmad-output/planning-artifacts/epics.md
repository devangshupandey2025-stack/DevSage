---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# DevSage - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for DevSage, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can sign up and log in via GitHub OAuth
FR2: User can sign up and log in via Google OAuth
FR3: User can sign up and log in via email and password with OTP-based two-factor authentication
FR4: System maintains user sessions using dual-token authentication (short-lived access token + rotating refresh token stored in secure, non-JavaScript-accessible browser cookies)
FR5: User can log out, invalidating their current session
FR6: User can initiate account deletion with a 30-day grace period before permanent removal
FR7: System anonymizes deleted user data while preserving audit trail integrity with anonymized references
FR8: User can export all personal data in downloadable format before account deletion
FR9: Organizer can add co-organizers to a hackathon (Pro and Max tiers only)
FR10: Co-organizer has all organizer capabilities except destructive actions (delete hackathon, transfer ownership, modify subscription settings)
FR11: User can create a workspace representing their organization
FR12: Workspace owner can add and remove workspace members
FR13: Workspace owner can subscribe to a tier (Starter, Pro, Max) for a semester period
FR14: System enforces tier-specific limits on features (active hackathon count, co-organizer access, custom domains, audit logs, deadline reminders, participant site generation)
FR15: System returns upgrade prompts when a tier-gated action is attempted on an insufficient plan
FR16: Workspace configuration persists independently of individual member accounts for leadership continuity
FR17: System isolates all workspace data with no cross-workspace visibility of teams, submissions, scores, or analytics
FR18: Organizer can submit a hackathon creation request with event details to the platform admin queue
FR19: Platform admin can approve, defer, or request additional information on a creation request
FR20: Organizer can configure hackathon settings including name, description, tracks, team size limits, and registration type (open or invite-only)
FR21: Hackathon progresses through defined lifecycle states: draft → active → judging → completed → archived
FR22: System enforces forward-only state transitions with the single exception of un-archiving (archived → completed) for score corrections
FR23: Organizer can configure multiple rounds with per-round deadlines, tag patterns, and rubrics
FR24: Organizer can extend or shorten deadlines with automatic notification to all participants showing old and new deadlines
FR25: Organizer can clone a previous hackathon's configuration to create a new event
FR26: Organizer can configure elimination thresholds between rounds
FR27: Participant can create a team within a hackathon
FR28: Team lead can generate invite codes for team membership
FR29: Participant can join a team using an invite code
FR30: Team lead can link a GitHub repository to the team via GitHub App installation
FR31: System enforces team size limits configured by the organizer
FR32: System prevents a participant from joining multiple teams within the same hackathon
FR33: System restricts team membership changes after the submission deadline
FR34: System receives and processes GitHub webhook events triggered by git tag pushes matching configured tag patterns
FR35: System verifies webhook authenticity via cryptographic signature verification and rejects payloads older than 5 minutes
FR36: System creates timestamped submission records from verified tag events using server-side receipt time (not git tag timestamp)
FR37: System detects and flags late submissions received after the round or hackathon deadline
FR38: Team lead can mark a submission as the final submission for a round
FR39: System processes submissions idempotently — duplicate webhook deliveries produce no duplicate records
FR40: System queues unprocessable webhooks in a dead-letter queue with alerting
FR41: Organizer can trigger manual submission reconciliation by comparing GitHub repository tags against existing submission records
FR42: System detects and logs force pushes with before/after SHAs and pusher identity
FR43: System flags tag deletions on previously submitted tags for organizer review
FR44: Organizer can create scoring rubrics with weighted criteria, configurable per round
FR45: Organizer can invite judges via email to a specific hackathon and round
FR46: Judge can accept a judging invitation via one-click email link
FR47: System auto-assigns submissions to judges using balanced distribution ensuring no judge receives more than ±1 submission compared to any other judge
FR48: Organizer can manually reassign submissions between judges
FR49: Judge can score submissions against all rubric criteria with per-criterion comments
FR50: Judge can save scoring progress as a draft and return across multiple sessions to complete
FR51: System enforces all-criteria-required scoring — partial scoring remains in draft state, not finalized
FR52: Organizer can monitor real-time judge completion progress per round with percentage tracking
FR53: System eliminates teams below configurable score thresholds between rounds
FR54: System generates leaderboard rankings from finalized scores
FR55: Organizer can control leaderboard visibility (public, participants-only, hidden)
FR56: Organizer can freeze the leaderboard before official result announcement
FR57: System supports track-specific, round-specific, and cumulative leaderboard views
FR58: Judge can self-declare conflict of interest with an assigned submission, triggering organizer review
FR59: System flags scoring patterns where a judge's average score deviates more than 2 standard deviations from the mean of all judges, or where a judge gives identical scores to ≥80% of submissions, for organizer review
FR60: Platform admin can view and manage the hackathon creation request queue with filtering and sorting
FR61: Platform admin can monitor all active hackathons across the platform
FR62: Platform admin can delegate request processing to other platform admins
FR63: System enforces platform admin access as a separate privilege layer independent of per-hackathon roles
FR64: Platform admin can view platform-wide audit logs
FR65: System sends email notifications for judge invitations with one-click accept links
FR66: System sends email confirmations when a submission is received
FR67: System sends email reminders before approaching deadlines at configurable intervals
FR68: System sends email notifications for round transitions and elimination results
FR69: System sends email notifications when organizers change deadlines, showing old and new values
FR70: Organizer can post announcements visible to all hackathon participants
FR71: System sends OTP verification codes via email for email/password authentication
FR72: System generates a standalone participant-facing website for each hackathon from a template
FR73: Participant site displays hackathon information, schedule, rules, and submission instructions
FR74: Participant site displays the public leaderboard when visibility settings allow
FR75: Participant site displays team listings and registration status
FR76: Participant site is deployed on a hackathon-specific subdomain
FR77: Max-tier workspaces can configure custom domains for participant sites
FR78: Spectators can view participant site content without authentication
FR79: System logs all state-changing operations as audit events with cryptographic hash-chain integrity ensuring tamper detection
FR80: Organizer can query audit logs scoped to their hackathon
FR81: Platform admin can query audit logs across all hackathons
FR82: Every audit event attributes the action to a specific actor type (user, bot, system, cron)
FR83: System preserves audit records permanently, even after account deletion, using anonymized actor references
FR84: System displays clear data collection consent notices at registration (DPDPA compliance)
FR85: System stores all deadlines in UTC and displays them with timezone indicators
FR86: Organizer can view analytics dashboards showing registration count, team formation rate, submission rate per round, judge completion progress, and final score distribution
FR87: Organizer can export hackathon results in CSV and PDF formats
FR88: Participant can view judge feedback and per-criterion scores on their submission when the organizer enables feedback visibility for that round

### NonFunctional Requirements

NFR1: Webhook processing pipeline (tag push → submission record visible) must complete at p95 < 30 seconds
NFR2: Standard API reads (list teams, view scores, get hackathon) must respond at p95 < 200ms
NFR3: API writes (create team, submit score, audit logging) must respond at p95 < 500ms
NFR4: Leaderboard refresh after score finalization must complete in < 5 seconds
NFR5: Participant site first contentful paint must be < 2 seconds
NFR6: Platform app (organizer dashboard) page load must be < 3 seconds
NFR7: Admin panel page load must be < 5 seconds
NFR8: Dual-token authentication system — 15-minute signed access token + 30-day rotating refresh token, both in secure non-JavaScript-accessible cookies with per-subdomain scoping
NFR9: Cryptographic signature double-verification + 5-minute staleness rejection on all GitHub webhook payloads
NFR10: TLS encryption on all connections in transit
NFR11: Tiered rate limiting — 120 req/min authenticated, 30 req/min anonymous, 10 req/min auth endpoints, no limit on verified webhooks, 60 req/min unknown webhook sources, 300 req/min leaderboard reads
NFR12: 429 responses include Retry-After header
NFR13: Pre-commit secret scanning (secretlint) blocks commits with secrets; gitleaks in CI on every PR
NFR14: Session concurrency limits — participants unlimited, organizers limited to 2 concurrent sessions
NFR15: Zero silent submission loss guarantee — every tag push produces either a submission record OR a dead-letter queue entry with alerting
NFR16: Idempotent webhook processing — duplicate deliveries produce no duplicate submissions, enforced via delivery_id uniqueness
NFR17: Dead-letter queue for unprocessable webhooks with alerting to operations team
NFR18: Manual reconciliation — organizer-triggered comparison of GitHub repo tags vs existing submissions as safety net
NFR19: Graceful degradation when GitHub API is unavailable — queue messages for later processing, show "pending verification" status
NFR20: Audit trail integrity — hash-chained events are append-only and tamper-detectable
NFR21: Year 1 scalability targets — 10-15 concurrent active hackathons, 2-3 concurrent deadline windows, ~120 webhook events per 15-min peak per hackathon
NFR22: Auto-scaling via Cloudflare Workers platform — no manual capacity planning for Year 1-2 volumes
NFR23: GitHub API rate limit monitoring — 5,000 requests/hour per installation, alert when approaching limits during peak periods
NFR24: GitHub webhook retry handling — handlers must support GitHub's up to 3-day retry policy
NFR25: Email/SMTP reliability — failed sends retried with exponential backoff and logged
NFR26: OAuth provider fallback — email/password auth remains available when GitHub or Google OAuth is temporarily unavailable
NFR27: WCAG 2.1 Level A compliance — keyboard navigation, alt text, proper heading hierarchy, 4.5:1 minimum color contrast across all three frontend apps
NFR28: Screen reader compatibility — all interactive elements must have accessible names and ARIA labels
NFR29: Focus management — modal dialogs, page transitions, and dynamic content updates must manage focus for keyboard and assistive technology users

### Additional Requirements

**From Architecture:**
- Brownfield rebuild: Keep stack choices, upgrade all packages, rebuild code within optimized architecture. Every file rewritten to follow new patterns
- Full Drizzle query builder for all data access (no raw D1 prepared statements)
- Better Auth v1.4.x replaces custom JWT auth — complete auth lifecycle for OAuth, email/password, session management, cookies
- @hono/zod-openapi v1.2.x for type-safe API routes with auto-generated OpenAPI spec
- Hono RPC client (hc<AppType>) for end-to-end type-safe frontend↔API communication
- TanStack Router v1.x for type-safe routing with Zod search params (replaces React Router)
- React 19 upgrade — use Actions API, useActionState for form handling, use() hook
- Zod 4 upgrade from Zod 3 — required by @hono/zod-openapi, affects @devsage/shared
- Drizzle 0.45.x upgrade for latest D1 improvements and relational query support
- Vite 7.x evaluation (fallback to Vite 6.x if Workers Static Assets incompatible)
- Vitest 4.x evaluation (fallback to Vitest 3.x if @cloudflare/vitest-pool-workers incompatible)
- Migration strategy: drop and recreate D1 (no production data to preserve)
- Implementation sequence: config → shared → db → api → web → platform → admin → E2E tests
- New @devsage/ui shared package for centralized design tokens and shared components
- Playwright E2E tests for critical flows (auth, hackathon creation, submission, judging)
- Workers Static Assets + GitHub Actions for all deployments
- Workers Observability (built-in) for monitoring — no external dependencies initially
- AppError class for all API errors with global Hono error handler
- Feature-based frontend organization in src/features/
- Better Auth role enrichment plugin needed for per-hackathon roles in session
- Hono RPC type export configuration needed from @devsage/api

**From UX Design:**
- Responsive design: mobile-first for participant-facing surfaces (Web, Participant Sites); desktop-first for complex surfaces (Platform, Admin) with responsive fallback
- Dark/light mode with system preference auto-detection and user toggle
- Per-hackathon branding via CSS variable overrides for participant sites
- Custom DevSage UI components: StatusBadge, PipelineStatus, ProgressTracker, DataTable, ActivityFeed, MetricCard
- Git-tag submission education: multiple touchpoints including participant site documentation, test submission workflow, onboarding guide
- Judge experience as "task list that shrinks to zero" — single-purpose scoring interface, linear task flow, persistent progress bar
- Progressive disclosure for organizer dashboards — show what matters now, reveal complexity on demand
- Submission fallback UX: manual commit SHA upload when webhook fails
- Error states always lead with solution ("Here's what to do"), not problem ("Something went wrong")
- Real-time feedback: submission confirmation with celebratory animation, leaderboard auto-updates
- Permission-aware UI — disabled buttons with explanatory tooltips for unauthorized actions, not hidden functionality
- Sonner toasts for notification feedback across all apps
- Framer Motion + GSAP for component transitions and web landing page animations

### FR Coverage Map

FR1: Epic 2 - GitHub OAuth sign up/login
FR2: Epic 2 - Google OAuth sign up/login
FR3: Epic 2 - Email/password with OTP authentication
FR4: Epic 2 - Dual-token session management
FR5: Epic 2 - User logout with session invalidation
FR6: Epic 2 - Account deletion with 30-day grace period
FR7: Epic 2 - Deleted user data anonymization
FR8: Epic 2 - Personal data export before deletion
FR9: Epic 4 - Co-organizer addition (tier-gated)
FR10: Epic 4 - Co-organizer scoped permissions
FR11: Epic 3 - Workspace creation
FR12: Epic 3 - Workspace member management
FR13: Epic 3 - Subscription tier selection
FR14: Epic 3 - Tier-specific feature enforcement
FR15: Epic 3 - Upgrade prompts on tier-gated actions
FR16: Epic 3 - Workspace configuration persistence
FR17: Epic 3 - Workspace data isolation
FR18: Epic 4 - Hackathon creation request submission
FR19: Epic 4 - Admin approve/defer/request-info workflow
FR20: Epic 4 - Hackathon settings configuration
FR21: Epic 4 - 5-state lifecycle management
FR22: Epic 4 - Forward-only state transitions
FR23: Epic 4 - Multi-round configuration
FR24: Epic 4 - Deadline extension with notifications
FR25: Epic 4 - Hackathon config cloning
FR26: Epic 4 - Elimination threshold configuration
FR27: Epic 5 - Team creation
FR28: Epic 5 - Invite code generation
FR29: Epic 5 - Team join via invite code
FR30: Epic 5 - GitHub repo linking via GitHub App
FR31: Epic 5 - Team size limit enforcement
FR32: Epic 5 - Multi-team prevention
FR33: Epic 5 - Post-deadline membership restriction
FR34: Epic 6 - Webhook event processing for tag pushes
FR35: Epic 6 - Webhook cryptographic verification
FR36: Epic 6 - Server-side timestamped submission records
FR37: Epic 6 - Late submission detection and flagging
FR38: Epic 6 - Final submission marking
FR39: Epic 6 - Idempotent submission processing
FR40: Epic 6 - Dead-letter queue with alerting
FR41: Epic 6 - Manual submission reconciliation
FR42: Epic 6 - Force push detection and logging
FR43: Epic 6 - Tag deletion flagging
FR44: Epic 7 - Scoring rubric creation
FR45: Epic 7 - Judge invitation via email
FR46: Epic 7 - One-click judge invitation acceptance
FR47: Epic 7 - Balanced auto-assignment
FR48: Epic 7 - Manual submission reassignment
FR49: Epic 7 - Per-criterion scoring with comments
FR50: Epic 7 - Draft scoring with multi-session persistence
FR51: Epic 7 - All-criteria-required enforcement
FR52: Epic 7 - Real-time judge completion tracking
FR53: Epic 7 - Elimination between rounds
FR54: Epic 7 - Leaderboard generation from scores
FR55: Epic 7 - Leaderboard visibility controls
FR56: Epic 7 - Leaderboard freeze
FR57: Epic 7 - Track/round/cumulative leaderboard views
FR58: Epic 7 - Judge conflict of interest declaration
FR59: Epic 7 - Score anomaly detection
FR60: Epic 9 - Creation request queue management
FR61: Epic 9 - Active hackathon monitoring
FR62: Epic 9 - Request processing delegation
FR63: Epic 9 - Platform admin privilege layer
FR64: Epic 9 - Platform-wide audit logs
FR65: Epic 8 - Judge invitation email notifications
FR66: Epic 8 - Submission confirmation emails
FR67: Epic 8 - Deadline reminder emails
FR68: Epic 8 - Round transition/elimination emails
FR69: Epic 8 - Deadline change notification emails
FR70: Epic 8 - Organizer announcements
FR71: Epic 8 - OTP verification emails
FR72: Epic 11 - Participant site generation from template
FR73: Epic 11 - Hackathon info display
FR74: Epic 11 - Public leaderboard display
FR75: Epic 11 - Team listings and registration status
FR76: Epic 11 - Subdomain deployment
FR77: Epic 11 - Custom domain support (Max tier)
FR78: Epic 11 - Spectator access without authentication
FR79: Epic 10 - Hash-chained audit event logging
FR80: Epic 10 - Organizer audit log queries
FR81: Epic 10 - Platform admin audit log queries
FR82: Epic 10 - Actor type attribution
FR83: Epic 10 - Permanent audit record preservation
FR84: Epic 2 - DPDPA consent notices at registration
FR85: Epic 10 - UTC deadline storage with timezone display
FR86: Epic 12 - Analytics dashboards
FR87: Epic 12 - CSV and PDF export
FR88: Epic 12 - Judge feedback visibility for participants

## Epic List

### Epic 1: Baseline User Slice & Developer Foundation
Deliver a day-0 user-visible slice (sign-in + public hackathon shell) while standing up the shared packages and scaffolding needed for subsequent features.
**FRs covered:** FR1 (baseline auth entry), FR72 (public hackathon shell)

### Epic 2: Authentication & User Identity
Users can create accounts via GitHub OAuth, Google OAuth, or email/password with OTP, maintain secure sessions, log out, manage account deletion with data export, and see DPDPA consent at registration.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR84

### Epic 3: Workspace & Subscription Management
Organizations can create workspaces, manage members, subscribe to pricing tiers (Starter/Pro/Max), and operate in fully isolated multi-tenant environments with tier enforcement and upgrade prompts.
**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR16, FR17

### Epic 4: Hackathon Lifecycle & Configuration
Organizers can submit hackathon creation requests, configure events with rounds/tracks/settings, manage the full 5-state lifecycle (draft→active→judging→completed→archived), add co-organizers, and clone previous hackathon configs.
**FRs covered:** FR9, FR10, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26

### Epic 5: Team Formation & Participation
Participants can create teams, generate/share invite codes, join teams, link GitHub repositories via the GitHub App, with enforced team size limits, multi-team prevention, and post-deadline membership constraints.
**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR33

### Epic 6: Git-Native Submission Pipeline
Teams submit work by pushing git tags — the platform automatically captures, cryptographically verifies, timestamps, and records submissions with zero-loss guarantee, idempotent processing, DLQ, late detection, force-push logging, tag deletion flagging, and manual reconciliation tools.
**FRs covered:** FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR42, FR43

### Epic 7: Judging, Scoring & Leaderboard
Organizers create weighted rubrics, invite judges via email, auto-assign submissions. Judges score with draft/final states across sessions. System generates real-time leaderboards with visibility controls, track/round views, freezing, elimination gates, conflict-of-interest workflows, and anomaly detection.
**FRs covered:** FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59

### Epic 8: Notifications & Communication
System delivers timely email notifications for judge invitations, submission confirmations, deadline reminders, round transitions, deadline changes, and OTP codes. Organizers can post announcements visible to all hackathon participants.
**FRs covered:** FR65, FR66, FR67, FR68, FR69, FR70, FR71

### Epic 9: Platform Administration
Platform admins (SHIKDD team) can manage the hackathon creation request queue with approve/defer/request-info workflow, monitor all active hackathons, delegate request processing, and access platform-wide audit logs via the admin panel.
**FRs covered:** FR60, FR61, FR62, FR63, FR64

### Epic 10: Audit Trail & Compliance
All platform mutations are recorded in a tamper-proof, SHA-256 hash-chained audit trail queryable by organizers (per-hackathon) and admins (platform-wide), with actor attribution, permanent preservation, anonymized references, and UTC timezone compliance.
**FRs covered:** FR79, FR80, FR81, FR82, FR83, FR85

### Epic 11: Participant Sites
Each hackathon gets a branded standalone website deployed on a unique subdomain with hackathon info, submission instructions, public leaderboard, team listings — accessible to spectators without login. Max-tier workspaces can configure custom domains.
**FRs covered:** FR72, FR73, FR74, FR75, FR76, FR77, FR78

### Epic 12: Analytics, Export & Feedback
Organizers view analytics dashboards (registration, teams, submissions, judging progress, score distribution), export results in CSV/PDF, and participants view judge feedback when organizers enable it.
**FRs covered:** FR86, FR87, FR88

---

## Epic 1: Baseline User Slice & Developer Foundation

Deliver a day-0 user-visible slice (sign-in + public hackathon shell) while standing up the shared packages and scaffolding needed for subsequent features. This epic must ship user-observable value independently; subsequent epics build on the foundations established here without forward dependencies.

### Story 1.0: Day-0 Usable Slice (User Value)

As a participant or organizer,
I want to sign in and view a public hackathon shell page with basic info and submission instructions (stubbed data allowed),
So that I have a working baseline experience even before deeper features arrive.

**Acceptance Criteria:**

- **Given** a user visits devsage.org, **when** they choose “Sign in with GitHub” or “Sign in with Google,” **then** they successfully authenticate via Better Auth and land on a minimal dashboard with their name and avatar.
- **Given** a user signs out, **when** they revisit devsage.org, **then** they see the logged-out state and can sign back in.
- **Given** a public visitor, **when** they open a hackathon shell page, **then** they see basic event info (name, dates, rules, submission instructions) rendered from stubbed data with a visible “Live data coming soon” badge.
- **And** the shell page includes a “Submit via Git tags” summary with a link to docs and a “Manual SHA upload (coming soon)” placeholder CTA to prepare users for the fallback flow.

### Story 1.1: Monorepo Configuration & Tooling Upgrade

As a developer,
I want the monorepo tooling, TypeScript configs, and ESLint configs upgraded to the latest versions with consistent settings across all packages,
So that all packages build cleanly with modern tooling and follow unified code quality standards.

**Acceptance Criteria:**

**Given** the existing Turborepo monorepo with pnpm workspaces
**When** I run `pnpm install` and `pnpm build`
**Then** all packages compile without errors using updated TypeScript, ESLint flat config, and Turborepo pipeline
**And** tsconfig variants (base, react, worker) are updated with strict mode and modern module resolution
**And** ESLint flat config (eslint.config.mjs) enforces no-console-log (warn), no-explicit-any (warn), and unused-vars with `_` prefix ignore
**And** Turborepo pipeline defines build, test, lint, typecheck, and dev tasks with correct dependency graph

### Story 1.2: Shared Schema Package — Zod 4 Migration

As a developer,
I want @devsage/shared upgraded to Zod 4 with all validation schemas, types, and constants rewritten,
So that all packages share a single source of truth for data validation and type definitions using the latest Zod APIs.

**Acceptance Criteria:**

**Given** the @devsage/shared package with Zod 3 schemas
**When** I upgrade to Zod 4.3.x and rewrite all schemas
**Then** all schemas compile and export correctly from src/index.ts with explicit .js extensions
**And** schemas exist for: hackathon, team, submission, judging, workspace, notification, auth, and common (pagination, id, slug)
**And** type exports exist for: HackathonState enum (draft, active, judging, completed, archived), Role enum (organizer, co_organizer, judge, team_lead, team_member, anonymous), SubscriptionTier enum (starter, pro, max), ApiResponse, ApiError, PaginatedResponse
**And** constants exist for: limits (MAX_TEAM_SIZE, DEFAULT_PAGE_SIZE) and role hierarchy definition
**And** `pnpm --filter @devsage/shared build` and `pnpm --filter @devsage/shared test` pass

### Story 1.3: Database Package Setup — Drizzle 0.45.x Foundation

As a developer,
I want @devsage/db upgraded to Drizzle 0.45.x with the foundational configuration and users schema (for Better Auth),
So that the database layer is ready for incremental schema addition as each epic introduces its domain tables.

**Acceptance Criteria:**

**Given** the @devsage/db package
**When** I upgrade to Drizzle 0.45.x and set up the foundation
**Then** the package has Drizzle 0.45.x installed with D1 SQLite dialect
**And** a D1 → Drizzle client factory exists in src/client.ts
**And** drizzle.config.ts is configured for D1 SQLite with migration output path (`../../packages/db/migrations`)
**And** a `users` schema module exists in src/schema/users.ts (Better Auth compatible — required by Epic 2)
**And** all schemas re-export from src/schema/index.ts with .js extensions
**And** `drizzle-kit generate` produces clean migrations for the users table
**And** all tables use UUIDs (text primary key), UTC ISO-8601 timestamps, and snake_case column naming
**And** a conventions README documents the pattern for subsequent epics to add their domain schemas

**Note:** Domain-specific tables are created by the first story in each epic that needs them:
- Epic 3 creates: workspaces, workspace_members, subscriptions
- Epic 4 creates: hackathons, hackathon_rounds, creation_requests, organizer_roles
- Epic 5 creates: teams, team_members, team_github_repos
- Epic 6 creates: submissions, webhook_deliveries
- Epic 7 creates: rubrics, rubric_categories, rubric_criteria, judge_invitations, judge_assignments, scores
- Epic 8 creates: notification_logs, announcements
- Epic 10 creates: audit_events

### Story 1.4: Design System Package — @devsage/ui

As a developer,
I want a shared @devsage/ui package with design tokens, theme support, and core UI components,
So that all three frontend apps share a consistent visual language with dark/light mode and reusable components.

**Acceptance Criteria:**

**Given** a new packages/ui/ package
**When** I create the design system with shadcn/ui + Radix UI + Tailwind v4 + CVA
**Then** design tokens are defined as HSL CSS variables in token files (colors, typography, spacing, animations)
**And** dark/light mode is supported via system preference detection and user toggle
**And** core components are implemented: Button, Card, Dialog, Input, Select, Tabs, Badge, Tooltip, DropdownMenu, DataTable, StatusBadge (✓/✗/⏳), ProgressTracker, MetricCard, ActivityFeed, PipelineStatus
**And** all components use CVA for type-safe variants and cn() for class merging
**And** Lucide React is used for all icons
**And** Sonner is configured for toast notifications
**And** barrel exports from src/index.ts with .js extensions
**And** package.json exports are configured for consumption by all three frontend apps

### Story 1.5: API Worker Scaffolding

As a developer,
I want the API Worker (apps/api) scaffolded with Hono + @hono/zod-openapi, Better Auth instance, global middleware chain, and Worker entry point,
So that the API is ready to accept route definitions with type-safe request/response validation and auto-generated OpenAPI spec.

**Acceptance Criteria:**

**Given** the apps/api package
**When** I set up the Hono OpenAPI app factory and Better Auth
**Then** src/app.ts creates a Hono OpenAPI app with global middleware: CORS → Request ID → Error Handler
**And** src/auth.ts configures Better Auth with GitHub OAuth, Google OAuth, email/password providers, Drizzle adapter for D1, and crossSubDomainCookies disabled
**And** src/types/env.ts defines AuthAppEnv with all Worker bindings (D1, KV, DO, Queue)
**And** src/lib/errors.ts defines AppError class with code, statusCode, and details
**And** src/lib/response.ts provides successResponse(), errorResponse(), and paginatedResponse() helpers using the { ok, data, meta } / { ok, error } envelope
**And** src/index.ts is the Worker entry point that mounts the app, re-exports Durable Objects, and handles queue/cron
**And** routes/health.ts provides a GET /health endpoint returning { ok: true, data: { status: "healthy" } }
**And** routes/auth.ts mounts Better Auth handler at /api/auth/*
**And** wrangler.jsonc is configured with D1, KV, DO, and Queue bindings
**And** vitest.config.ts is configured with @cloudflare/vitest-pool-workers

### Story 1.6: Web App Scaffolding (devsage.org)

As a developer,
I want apps/web scaffolded with React 19, TanStack Router, TanStack Query, and Hono RPC client,
So that the main website is ready to accept feature pages with type-safe routing, server-state management, and API communication.

**Acceptance Criteria:**

**Given** the apps/web package
**When** I set up React 19 + TanStack Router v1.x + TanStack Query v5
**Then** src/main.tsx initializes the app with QueryClientProvider and RouterProvider
**And** TanStack Router file-based routes are configured in src/routes/ with __root.tsx providing the root layout
**And** src/lib/api-client.ts creates a Hono RPC client instance configured with VITE_API_ORIGIN and credentials: include
**And** src/components/Layout.tsx provides the page layout with Navbar and footer
**And** src/components/ErrorBoundary.tsx provides route-level error recovery
**And** Vite config includes dev proxy for /api/v1, /auth, /hackathons, /webhooks → http://localhost:8787
**And** @devsage/ui and @devsage/shared are properly imported
**And** Tailwind v4 is configured with @devsage/ui design tokens
**And** `pnpm --filter @devsage/web dev` starts the dev server and renders the root layout

### Story 1.7: Platform App Scaffolding (platform.devsage.org)

As a developer,
I want apps/platform scaffolded with the same frontend architecture as web, with an organizer/judge-focused sidebar layout,
So that the platform app is ready to accept organizer and judge feature pages.

**Acceptance Criteria:**

**Given** the apps/platform package
**When** I set up React 19 + TanStack Router + TanStack Query + Hono RPC client
**Then** the same frontend architecture as Story 1.6 is applied (router, query client, API client, error boundary)
**And** src/components/Layout.tsx provides a sidebar + content area layout (Stripe-inspired) suitable for data-dense organizer dashboards
**And** Vite dev proxy is configured for API requests
**And** @devsage/ui and @devsage/shared are properly imported
**And** `pnpm --filter @devsage/platform dev` starts the dev server and renders the sidebar layout

### Story 1.8: Admin App Scaffolding (shikdd.devsage.org)

As a developer,
I want apps/admin scaffolded with the same frontend architecture, with a compact admin-focused layout,
So that the admin panel is ready to accept platform administration feature pages.

**Acceptance Criteria:**

**Given** the apps/admin package
**When** I set up React 19 + TanStack Router + TanStack Query + Hono RPC client
**Then** the same frontend architecture as Story 1.6 is applied
**And** src/components/Layout.tsx provides a compact sidebar layout optimized for admin throughput (smaller typography, denser spacing)
**And** Vite dev proxy is configured for API requests
**And** @devsage/ui and @devsage/shared are properly imported
**And** `pnpm --filter @devsage/admin dev` starts the dev server and renders the admin layout

---

## Epic 2: Authentication & User Identity

Users can create accounts via GitHub OAuth, Google OAuth, or email/password with OTP, maintain secure sessions, log out, manage account deletion with data export, and see DPDPA consent at registration.

### Story 2.1: GitHub OAuth Registration & Login

As a user,
I want to sign up and log in using my GitHub account with a single click,
So that I can access the platform quickly using my existing developer identity without creating a new password.

**Acceptance Criteria:**

**Given** a user on the login page of any DevSage app (web, platform, or admin)
**When** they click "Sign in with GitHub"
**Then** they are redirected to GitHub's OAuth consent screen
**And** upon approval, they are redirected back to the app with an active session
**And** their GitHub username, email, name, and avatar are stored in the users table
**And** a Better Auth session is created with secure HttpOnly cookies scoped to the app's subdomain
**And** if the GitHub account is already linked to an existing user, the existing account is logged in (no duplicate)
**And** the login page on all three apps (web, platform, admin) includes the GitHub OAuth button

**Given** GitHub OAuth is temporarily unavailable
**When** the user attempts to sign in with GitHub
**Then** the user sees a clear error message with retry guidance and alternative login options

### Story 2.2: Google OAuth Registration & Login

As a user,
I want to sign up and log in using my Google account,
So that I can access the platform using my institutional or personal Google identity.

**Acceptance Criteria:**

**Given** a user on the login page of any DevSage app
**When** they click "Sign in with Google"
**Then** they are redirected to Google's OAuth consent screen
**And** upon approval, they are redirected back to the app with an active session
**And** their Google email, name, and avatar are stored in the users table
**And** a Better Auth session is created with secure HttpOnly cookies scoped to the app's subdomain
**And** if the Google account is already linked to an existing user, the existing account is logged in
**And** the login page on all three apps includes the Google OAuth button

**Given** Google OAuth is temporarily unavailable
**When** the user attempts to sign in with Google
**Then** the user sees a clear error message with retry guidance and alternative login options

### Story 2.3: Email/Password Registration with OTP Verification

As a user,
I want to sign up with my email and password and verify my identity via OTP,
So that I can access the platform without relying on third-party OAuth providers.

**Acceptance Criteria:**

**Given** a user on the registration page
**When** they submit their email, name, and password
**Then** an OTP verification code is sent to their email address
**And** the user is prompted to enter the OTP code
**And** upon correct OTP entry, their account is created and a session is established
**And** passwords are hashed using Better Auth's built-in hashing
**And** the registration form validates email format, password strength (minimum 8 characters), and name length

**Given** a registered user with email/password credentials
**When** they enter their email and password on the login page
**Then** they are prompted for OTP verification
**And** upon correct OTP entry, they are logged in with an active session

**Given** an incorrect OTP is entered
**When** the user submits the code
**Then** an error message is displayed and the user can request a new code
**And** OTP attempts are rate-limited to 10 per minute per IP

### Story 2.4: Session Management & Logout

As a user,
I want my login session to persist securely across page loads and expire appropriately,
So that I can stay logged in conveniently while my account remains protected.

**Acceptance Criteria:**

**Given** a logged-in user on any DevSage app
**When** they refresh the page or navigate between routes
**Then** their session persists and they remain authenticated via Better Auth session cookies
**And** session cookies are HttpOnly, Secure, SameSite=Lax, and scoped to the specific subdomain (no wildcard .devsage.org)

**Given** a logged-in user
**When** they click "Log out"
**Then** their session is invalidated on the server and session cookies are cleared
**And** they are redirected to the login page

**Given** participant users
**When** they are logged in
**Then** they can have unlimited concurrent sessions across devices

**Given** organizer users
**When** they are logged in on more than 2 devices simultaneously
**Then** the oldest session is invalidated to enforce the 2-session concurrency limit

### Story 2.5: DPDPA Consent & Data Privacy Notices

As a new user registering on DevSage,
I want to see clear information about how my data is collected and used,
So that I can provide informed consent as required by India's Digital Personal Data Protection Act.

**Acceptance Criteria:**

**Given** a user on any registration flow (GitHub OAuth, Google OAuth, or email/password)
**When** they complete the registration process
**Then** a consent notice is displayed before account creation explaining: what data is collected (name, email, GitHub username, avatar), how it's used (hackathon management only), and the user's rights (data export, account deletion)
**And** the user must acknowledge the consent notice to proceed
**And** the consent acknowledgment timestamp is recorded in the database
**And** a link to the full privacy policy is provided in the consent notice

### Story 2.6: Account Deletion & Personal Data Export

As a user,
I want to delete my account with a grace period and export my personal data beforehand,
So that I can exercise my data rights while having time to reconsider the decision.

**Acceptance Criteria:**

**Given** a logged-in user on their account settings page
**When** they initiate account deletion
**Then** a 30-day grace period begins and the user is notified of the deletion timeline
**And** the user can cancel the deletion at any time during the grace period

**Given** the 30-day grace period has expired
**When** the system processes the deletion
**Then** the user's personal data (name, email, avatar) is permanently removed
**And** audit trail references to the user are anonymized (replaced with anonymized identifiers) to preserve audit integrity
**And** the user can no longer log in

**Given** a logged-in user on their account settings page
**When** they request a personal data export
**Then** a downloadable JSON file is generated containing all their personal data: profile info, team memberships, submissions, and scores
**And** the download is available immediately or via email link

---

## Epic 3: Workspace & Subscription Management

Organizations can create workspaces, manage members, subscribe to pricing tiers (Starter/Pro/Max), and operate in fully isolated multi-tenant environments with tier enforcement and upgrade prompts.

### Story 3.1: Workspace Creation & Settings

As an organizer,
I want to create a workspace representing my organization with a name, slug, and description,
So that my organization has a dedicated space to manage hackathons with persistent configuration that survives leadership turnover.

**Acceptance Criteria:**

**Given** an authenticated user on the platform app
**When** they navigate to "Create Workspace" and submit a workspace name, slug, and optional description
**Then** a new workspace is created with a unique slug and the creator is set as the workspace owner
**And** the workspace is assigned a default configuration that persists independently of the owner's account
**And** the workspace slug is validated for uniqueness and URL-safety (lowercase alphanumeric + hyphens)
**And** the workspaces table and related schemas are created/migrated as needed
**And** an audit event is logged for workspace creation

### Story 3.2: Workspace Member Management

As a workspace owner,
I want to add and remove members from my workspace,
So that my team can collaborate on hackathon management with appropriate access.

**Acceptance Criteria:**

**Given** a workspace owner on the workspace settings page
**When** they invite a user by email
**Then** the invited user is added to the workspace_members table and can access the workspace
**And** the workspace member list displays all current members with their roles

**Given** a workspace owner
**When** they remove a member from the workspace
**Then** the member loses access to the workspace and its hackathons
**And** the workspace configuration (settings, hackathon history) is unaffected by member removal
**And** audit events are logged for both add and remove operations

**Given** the workspace owner's account is deleted or transferred
**When** another member is designated as the new owner
**Then** the workspace and all its configuration persist without interruption (FR16: leadership continuity)

### Story 3.3: Subscription Tier Selection & Enforcement

As a workspace owner,
I want to subscribe my workspace to a pricing tier (Starter/Pro/Max) for a semester,
So that my organization can access tier-appropriate features with clear limits and upgrade paths.

**Acceptance Criteria:**

**Given** a workspace owner on the workspace subscription page
**When** they select a tier (Starter at INR 3,999/sem, Pro at INR 6,999/sem, Max at INR 9,999/sem)
**Then** the workspace subscription is recorded with the selected tier, start date, and semester end date
**And** tier-specific limits are enforced: Starter (2 active hackathons, no co-organizers, no audit logs, no custom domains), Pro (10 active hackathons, co-organizers enabled, full analytics), Max (unlimited hackathons, all features)

**Given** a workspace on Starter tier attempts to create a 3rd active hackathon
**When** the API receives the creation request
**Then** a 403 response is returned with error code TIER_LIMIT_EXCEEDED and a clear upgrade prompt message (FR15)

**Given** a workspace on Starter tier
**When** an organizer attempts to add a co-organizer
**Then** a 403 response is returned indicating co-organizers require Pro tier or above with upgrade prompt

**Given** a workspace upgrades mid-semester
**When** the upgrade is processed
**Then** the new tier takes effect immediately with expanded limits

### Story 3.4: Multi-Tenant Data Isolation

As a platform operator,
I want all workspace data strictly isolated with no cross-workspace visibility,
So that competing institutions on the same platform cannot see each other's teams, submissions, scores, or analytics.

**Acceptance Criteria:**

**Given** two workspaces (Workspace A and Workspace B) on the platform
**When** an organizer of Workspace A queries teams, submissions, or scores
**Then** only data belonging to Workspace A's hackathons is returned — zero leakage from Workspace B

**Given** a judge assigned to Hackathon A in Workspace A
**When** they access the judging interface
**Then** they cannot see submissions from any other hackathon, even in the same workspace

**Given** all API endpoints that return workspace-scoped data
**When** queries are executed
**Then** every query is scoped by workspace_id or hackathon_id at the database query level (not just application filtering)
**And** analytics endpoints are strictly workspace-scoped
**And** audit logs are hackathon-scoped for organizers and platform-wide only for admins

---

## Epic 4: Hackathon Lifecycle & Configuration

Organizers can submit hackathon creation requests, configure events with rounds/tracks/settings, manage the full 5-state lifecycle (draft->active->judging->completed->archived), add co-organizers, and clone previous hackathon configs.

### Story 4.1: Hackathon Creation Request & Admin Approval Workflow

As an organizer,
I want to submit a hackathon creation request with event details to the platform admin queue,
So that my hackathon can be reviewed, approved, and set up by the platform team.

**Acceptance Criteria:**

**Given** an authenticated organizer on the platform app
**When** they navigate to "Request New Hackathon" and submit event details (title, description, expected participants, dates, rounds, tracks)
**Then** a creation request is created in "submitted" status in the creation_requests table
**And** the request appears in the platform admin's approval queue
**And** the organizer sees a tracking roadmap showing status: Submitted -> Seen -> Approved/Deferred

**Given** a platform admin on the admin panel
**When** they view a creation request and click "Approve"
**Then** the request status changes to "approved" and a draft hackathon is auto-created in the organizer's workspace with the submitted details
**And** the organizer is notified of the approval

**Given** a platform admin
**When** they click "Request More Info" on a request with a note
**Then** the request status changes to "needs_info" and the organizer sees the admin's note
**And** the organizer can resubmit with additional details

**Given** a platform admin
**When** they click "Defer" on a request
**Then** the request status changes to "deferred" with an optional reason visible to the organizer

### Story 4.2: Hackathon Configuration & Settings

As an organizer,
I want to configure my hackathon's settings including name, description, tracks, team size limits, and registration type,
So that my hackathon is fully customized for my event's specific needs.

**Acceptance Criteria:**

**Given** an organizer with a draft hackathon
**When** they access the hackathon settings page
**Then** they can edit: hackathon name, slug (URL-safe), description, tracks (name + description list), team size limits (min/max), registration type (open or invite-only), and branding (logo, colors)
**And** all settings are validated with Zod schemas from @devsage/shared
**And** changes are persisted to the hackathons table
**And** an audit event is logged for each settings change
**And** the hackathon slug is validated for uniqueness within the workspace

### Story 4.3: Hackathon State Machine (Durable Object)

As an organizer,
I want my hackathon to progress through defined lifecycle states with enforced transitions,
So that the hackathon follows a predictable lifecycle and accidental backward transitions are prevented.

**Acceptance Criteria:**

**Given** a hackathon in any state
**When** the organizer initiates a state transition
**Then** the HackathonStateMachine Durable Object enforces the 5-state lifecycle: draft -> active -> judging -> completed -> archived
**And** forward-only transitions are enforced (no backward transitions)
**And** the single exception is un-archiving: archived -> completed is allowed for score corrections

**Given** a hackathon in "draft" state
**When** the organizer transitions to "active"
**Then** registration opens (if configured), the participant site goes live, and teams can form

**Given** a hackathon in "active" state
**When** the organizer transitions to "judging"
**Then** submissions are locked (no new submissions accepted) and the judging interface opens

**Given** a hackathon in "judging" state
**When** the organizer transitions to "completed"
**Then** the final leaderboard is published and results are available for export

**Given** any state transition
**When** it occurs
**Then** an audit event is logged with the old state, new state, actor, and timestamp
**And** the Durable Object re-exports from src/index.ts (required for wrangler)

### Story 4.4: Multi-Round Configuration with Deadlines & Tag Patterns

As an organizer,
I want to configure multiple rounds with per-round deadlines, submission tag patterns, rubrics, and elimination thresholds,
So that my hackathon can run multi-round elimination competitions with clear structure.

**Acceptance Criteria:**

**Given** an organizer on the hackathon configuration page
**When** they add a round with a name, deadline (datetime), tag pattern (e.g., r1_submission_v%), and rubric
**Then** the round is saved to the rounds table linked to the hackathon
**And** multiple rounds can be configured with sequential ordering

**Given** an organizer configuring round transitions
**When** they set an elimination threshold (e.g., "eliminate bottom 5 teams" or "keep top 10")
**Then** the threshold is stored per-round for automated elimination after scoring

**Given** an organizer
**When** they extend or shorten a deadline for any round
**Then** the deadline is updated and all registered participants receive a notification showing old and new deadline values (FR24)
**And** all deadlines are stored in UTC ISO-8601 and displayed with timezone indicators (IST default)

### Story 4.5: Co-Organizer Management

As an organizer,
I want to add co-organizers to my hackathon who can help manage the event with scoped permissions,
So that I can delegate operational tasks safely without risking destructive actions.

**Acceptance Criteria:**

**Given** an organizer on a Pro or Max tier workspace
**When** they invite a user as a co-organizer by email
**Then** the user is added to the organizer_roles table with the "co_organizer" role for that hackathon
**And** the co-organizer can access the full hackathon dashboard

**Given** a co-organizer logged into the platform app
**When** they access a hackathon they co-organize
**Then** they can: view all teams, submissions, judges, audit logs; monitor judge progress; send nudge notifications; reassign judge submissions
**And** they CANNOT: delete the hackathon, transfer ownership, modify subscription settings, add/remove other organizers

**Given** a workspace on Starter tier
**When** an organizer attempts to add a co-organizer
**Then** a 403 response is returned with an upgrade prompt indicating co-organizers require Pro tier or above

**Given** any co-organizer action
**When** it is performed
**Then** an audit event is logged attributing the action to the co-organizer

### Story 4.6: Hackathon Cloning

As an organizer,
I want to clone a previous hackathon's configuration to create a new event,
So that I can quickly set up a repeat hackathon without manually re-entering all settings.

**Acceptance Criteria:**

**Given** an organizer with a completed or archived hackathon
**When** they click "Clone This Hackathon"
**Then** a new draft hackathon is created with copied settings: name (with "Copy" suffix), description, tracks, team size limits, registration type, round configuration, rubrics, and elimination thresholds
**And** the new hackathon gets a new unique slug
**And** no participant data, team data, submission data, or scoring data is copied — only configuration
**And** the organizer is redirected to the new hackathon's settings page for customization
**And** an audit event is logged for the clone action referencing the source hackathon

---

## Epic 5: Team Formation & Participation

Participants can create teams, generate/share invite codes, join teams, link GitHub repositories via the GitHub App, with enforced team size limits, multi-team prevention, and post-deadline membership constraints.

### Story 5.1: Team Creation & Invite Code Generation

As a participant,
I want to create a team within a hackathon and generate an invite code to share with friends,
So that I can assemble my team quickly and start collaborating.

**Acceptance Criteria:**

**Given** an authenticated participant on an active hackathon's page
**When** they click "Create Team" and enter a team name
**Then** a new team is created in the teams table with the creator as team lead
**And** an auto-generated invite code (short alphanumeric string) is created and displayed
**And** the team lead can copy the invite code to share via any messaging platform
**And** the team dashboard shows the team name, members, invite code, and repo link status
**And** an audit event is logged for team creation

### Story 5.2: Team Join via Invite Code

As a participant,
I want to join a team using an invite code shared by the team lead,
So that I can join my friends' team instantly without requiring organizer intervention.

**Acceptance Criteria:**

**Given** a participant with a valid invite code
**When** they enter the invite code on the hackathon's "Join Team" page
**Then** they are added to the team as a team_member and redirected to the team dashboard
**And** the team member list updates to show the new member

**Given** a participant who is already on a team in the same hackathon
**When** they attempt to join another team using an invite code
**Then** the request is rejected with error ALREADY_ON_TEAM explaining they cannot join multiple teams in the same hackathon (FR32)

**Given** a team that has reached the organizer-configured maximum team size
**When** a new participant attempts to join using the invite code
**Then** the request is rejected with error TEAM_FULL indicating the team has reached its size limit (FR31)

### Story 5.3: GitHub Repository Linking via GitHub App

As a team lead,
I want to link my team's private GitHub repository to the hackathon via the DevSage GitHub App,
So that the platform can receive webhook events for our git tag submissions.

**Acceptance Criteria:**

**Given** a team lead on the team settings page
**When** they click "Link Repository" and enter the repo owner and name
**Then** the DevSage GitHub App requests installation on the repo with read-only permissions (contents + metadata)
**And** upon GitHub App approval, the team dashboard shows "Repo linked checkmark, Bot active checkmark"
**And** the repository information is stored in the teams table (repo_owner, repo_name)
**And** all team members can see the repo link status but only the team lead can modify or unlink it

**Given** a team with a linked repository
**When** a webhook event is received for that repo
**Then** the system can match the repo to the correct team and hackathon

**Given** a team lead
**When** they attempt to link a repository that is already linked to another team in the same hackathon
**Then** the request is rejected with error REPO_ALREADY_LINKED

### Story 5.4: Team Membership Constraints & Enforcement

As an organizer,
I want the system to enforce team size limits, prevent multi-team membership, and restrict changes after deadlines,
So that hackathon participation rules are consistently enforced without manual intervention.

**Acceptance Criteria:**

**Given** the organizer has configured a team size limit (e.g., min 2, max 4)
**When** team membership exceeds the configured maximum
**Then** additional join attempts are blocked with a clear error message

**Given** a participant who is already a member of a team in hackathon X
**When** they attempt to create or join another team in hackathon X
**Then** the request is rejected — one team per participant per hackathon (FR32)

**Given** a hackathon whose submission deadline has passed
**When** a participant attempts to join or leave a team
**Then** the request is rejected with error TEAM_CHANGES_LOCKED indicating membership changes are restricted after the submission deadline (FR33)
**And** the team lead cannot remove members after the deadline either

**Given** any team membership change
**When** it occurs
**Then** an audit event is logged with the action type (join, leave, remove), actor, and timestamp

---

## Epic 6: Git-Native Submission Pipeline

**Goal:** Build the zero-loss, cryptographically verified webhook pipeline that turns git tag pushes into timestamped submission records — the core innovation of DevSage.

**FRs:** FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR42, FR43
**NFRs:** NFR1 (99.9% uptime), NFR15-NFR19 (pipeline reliability)

### Story 6.1: GitHub Webhook Receiver & Cryptographic Verification

**As a** system operator
**I want** the API to receive GitHub webhook events and cryptographically verify their authenticity
**So that** only legitimate GitHub-originated events enter the submission pipeline

**Acceptance Criteria:**

- Given a GitHub webhook POST arrives at `/webhooks/github`, when the request contains a valid `X-Hub-Signature-256` header matching the payload HMAC-SHA256 computed with `GITHUB_WEBHOOK_SECRET`, then the system accepts the event and returns 200
- Given a webhook POST arrives with an invalid or missing signature, when the system validates the signature, then the system rejects the request with 401 and logs the attempt
- Given a webhook POST arrives with a valid signature, when the `X-GitHub-Delivery` timestamp is older than 5 minutes, then the system rejects the payload as stale and returns 400
- Given a valid webhook POST arrives, when the event type is `push` with a tag ref matching the configured pattern (e.g., `refs/tags/submission-*`), then the system normalizes the payload and enqueues it to `SUBMISSION_QUEUE` for async processing
- Given a valid webhook POST arrives, when the event type is not a tag push (e.g., branch push, PR), then the system acknowledges with 200 but does not enqueue (no-op)
- Given a webhook POST arrives, when processing completes, then the `X-GitHub-Delivery` ID is stored for idempotency checking

**Technical Notes:**
- Verify using `crypto.subtle.verify()` with HMAC SHA-256
- Route: `POST /webhooks/github` — no auth middleware (GitHub cannot authenticate)
- Use Cloudflare Queue producer binding (`SUBMISSION_QUEUE`)
- FR34, FR35

### Story 6.2: Submission Record Creation from Tag Events

**As a** team lead
**I want** my git tag pushes to automatically create timestamped submission records
**So that** my team's work is recorded without any manual upload process

**Acceptance Criteria:**

- Given a tag push event is dequeued from `SUBMISSION_QUEUE`, when the system processes it, then it resolves the GitHub repo → team → hackathon mapping via the `team_github_repos` table
- Given a valid tag event is processed, when a submission record is created, then it stores: team_id, hackathon_id, round_id, tag_name, commit_sha, pusher identity, and `received_at` timestamp (server-side, not git timestamp)
- Given a tag event arrives for a repo not linked to any team, when the system processes it, then the event is logged as unmatched and no submission record is created
- Given a tag event arrives for a team in a hackathon whose state is not `active`, when the system processes it, then the event is logged but no submission record is created (only `active` hackathons accept submissions)
- Given a submission record is created, when the record is persisted, then an audit event is logged with the full webhook payload hash
- Given a tag push event is dequeued, when the system resolves the round, then it matches the tag pattern to the currently active round for that hackathon

**Technical Notes:**
- Queue consumer handler in `apps/api/src/queue/`
- Use server-side `new Date().toISOString()` for `received_at` — never trust client timestamps
- DB tables: `submissions`, `team_github_repos`
- FR34, FR36

### Story 6.3: Idempotent Processing & Dead-Letter Queue

**As a** system operator
**I want** duplicate webhook deliveries to be safely ignored and unprocessable events to be quarantined
**So that** the submission pipeline never creates duplicate records and never silently drops events

**Acceptance Criteria:**

- Given a webhook event with `X-GitHub-Delivery` ID `abc-123` has already been processed, when a retry delivery arrives with the same delivery ID, then the system skips processing and returns success (idempotent)
- Given the `webhook_deliveries` table stores processed delivery IDs, when checking for duplicates, then the lookup uses a unique index on `delivery_id` for O(1) performance
- Given a queued event fails processing (e.g., DB error, schema mismatch), when the retry count exceeds the configured maximum (3 retries), then the event is moved to `DEAD_LETTER_QUEUE`
- Given an event is moved to `DEAD_LETTER_QUEUE`, when the move completes, then a `console.error` structured log is emitted with event details for alerting
- Given events are in the dead-letter queue, when a platform admin views the admin panel, then they can see quarantined events with failure reasons
- Given a quarantined event is reviewed, when a platform admin triggers reprocessing, then the event is re-enqueued to `SUBMISSION_QUEUE` for another attempt

**Technical Notes:**
- DB table: `webhook_deliveries` with unique constraint on `delivery_id`
- Cloudflare Queues support automatic retries — configure `max_retries: 3` in wrangler.jsonc
- Dead-letter queue is a separate Queue binding (`DEAD_LETTER_QUEUE`)
- FR39, FR40

### Story 6.4: Late Submission Detection & Final Submission Marking

**As an** organizer
**I want** submissions received after the deadline to be flagged, and team leads to mark their final submission
**So that** I can enforce deadlines while maintaining a complete audit trail

**Acceptance Criteria:**

- Given a submission record is created, when `received_at` is after the round's `submission_deadline`, then the submission is marked with `is_late: true` and a `late_by` duration is calculated and stored
- Given a submission is marked late, when organizers view submissions, then late submissions are visually distinguished and sortable
- Given a team has multiple submissions for a round, when the team lead selects one as final, then the system sets `is_final: true` on that submission and clears `is_final` on all other submissions for the same team+round
- Given the hackathon state transitions from `active` to `judging`, when the state machine triggers the transition, then for each team that has not marked a final submission, the system auto-selects the latest non-late submission (or latest overall if all are late)
- Given a submission is marked as final, when the marking occurs, then an audit event is logged with the actor and timestamp

**Technical Notes:**
- Late detection happens at record creation time (Story 6.2 flow)
- Final marking: `PATCH /api/v1/hackathons/:slug/submissions/:id/final`
- Auto-selection logic runs as part of `HackathonStateMachine` transition handler
- FR37, FR38

### Story 6.5: Force Push Detection, Tag Deletion & Manual Reconciliation

**As an** organizer
**I want** to be alerted when teams force-push or delete submission tags, and to reconcile submissions against GitHub
**So that** I can detect potential academic dishonesty and ensure submission integrity

**Acceptance Criteria:**

- Given a push event arrives with `forced: true`, when the system processes it, then it logs a `force_push` event with `before` SHA, `after` SHA, and pusher identity, and flags the associated submission for organizer review
- Given a tag deletion event arrives (ref type `tag`, `deleted: true`), when the tag was previously used for a submission, then the system flags the submission record with `tag_deleted: true` and creates a notification for the hackathon organizer
- Given a tag deletion for a tag not associated with any submission, when the system processes it, then the event is logged but no flag is raised
- Given an organizer triggers manual reconciliation for a team, when the system executes reconciliation, then it calls the GitHub API to list tags on the team's linked repo, compares against existing submission records, and reports: missing submissions (tags without records), orphaned records (records without tags), and mismatched SHAs
- Given reconciliation finds discrepancies, when the report is generated, then the organizer can choose to create missing submission records or flag orphaned records
- Given reconciliation runs, when API calls are made to GitHub, then the system uses the fail-open pattern (10s timeout) and logs any GitHub API failures without throwing

**Technical Notes:**
- Force push detection: check `forced` field in push event payload
- Tag deletion: GitHub sends `delete` event type for tag deletions
- Reconciliation endpoint: `POST /api/v1/hackathons/:slug/teams/:teamId/reconcile`
- GitHub API calls via `apps/api/src/services/` with fail-open pattern
- FR41, FR42, FR43

### Story 6.6: Manual Commit SHA Upload Fallback

**As a** team lead
**I want** to submit a commit SHA manually when webhooks fail
**So that** our submission is recorded even if GitHub delivery is delayed or blocked.

**Acceptance Criteria:**

- Given a team lead authenticates, when they call `POST /api/v1/hackathons/:slug/submissions/manual` with repo_owner, repo_name, commit_sha, optional tag and notes, then the request is accepted only if the team is linked to the repo and the hackathon is in `active` state.
- Given a manual submission is accepted, when the handler runs, then it enqueues the same normalization/queue path as webhook events, marks the submission source as `manual_fallback`, and logs an audit event.
- Given a manual submission is processing, when status updates (queued → recorded → failed) occur, then the team dashboard reflects the current status and any failure reason.
- Given a manual submission is created while a webhook for the same commit arrives later, when idempotency checks run, then duplicate records are not created (delivery_id/commit_sha uniqueness).

**Technical Notes:**
- Route: `POST /api/v1/hackathons/:slug/submissions/manual`
- Reuses queue consumer from Story 6.2; shares idempotency guard
- FR34, FR39

---

## Epic 7: Judging, Scoring & Leaderboard

**Goal:** Build the complete judging workflow from judge invitation through score aggregation to leaderboard generation, with statistical anomaly detection and conflict-of-interest handling.

**FRs:** FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59
**NFRs:** NFR2 (leaderboard <500ms), NFR20-NFR23 (scoring integrity)

### Story 7.1: Judge Invitation & Role Assignment

**As an** organizer
**I want** to invite judges via email and have them accept with one click
**So that** I can assemble my judging panel efficiently without manual account setup

**Acceptance Criteria:**

- Given an organizer is managing a hackathon, when they invite a judge by email for a specific round, then the system creates a `judge_invitations` record with a unique token and sends an invitation email
- Given a judge invitation email is sent, when the recipient clicks the one-click accept link, then the system marks the invitation as accepted and assigns the `judge` role for that hackathon
- Given the accept link is clicked by an unauthenticated user, when they arrive at the platform, then they are redirected through authentication (sign up or sign in) before the invitation is finalized
- Given a judge invitation token is used, when the same token is clicked again, then the system shows "already accepted" (idempotent)
- Given an invitation is pending, when the organizer views the judge management panel, then they see invitation status (pending, accepted, declined) for each invited judge
- Given an organizer sends invitations, when the invitation is created, then an audit event is logged

**Technical Notes:**
- Invitation token: `crypto.randomUUID()`, stored in `judge_invitations` table
- Accept link: `{PLATFORM_URL}/judging/accept?token={token}`
- Email sent via notification queue (Epic 8)
- FR45, FR46

### Story 7.2: Rubric Builder

**As an** organizer
**I want** to create scoring rubrics with weighted categories and criteria
**So that** judges evaluate submissions consistently using my defined standards

**Acceptance Criteria:**

- Given an organizer is configuring a round, when they create a rubric, then they can add multiple categories, each with a name, description, weight (percentage), and one or more criteria
- Given a rubric has categories, when the organizer sets weights, then the system validates that all category weights sum to exactly 100%
- Given a rubric category has criteria, when the organizer configures a criterion, then they can set: name, description, scoring scale (1-5, 1-10, or custom), and optional guidance text for judges
- Given a rubric is finalized, when judging has not yet started for that round, then the organizer can still edit the rubric
- Given judging has started (at least one score submitted), when the organizer attempts to edit the rubric, then the system prevents modification and shows a warning
- Given a rubric is created for round N, when the organizer creates round N+1, then they can optionally clone the rubric from a previous round

**Technical Notes:**
- DB tables: `rubrics`, `rubric_categories`, `rubric_criteria`
- Rubric is per-round (each round can have different criteria)
- Weight validation: sum of `category.weight` must equal 100
- FR44

### Story 7.3: Submission Assignment & Judge Dashboard

**As a** judge
**I want** to see my assigned submissions in a clear dashboard
**So that** I can efficiently work through my judging assignments

**Acceptance Criteria:**

- Given judging begins for a round, when the organizer triggers assignment, then the system auto-distributes submissions to judges using balanced distribution (no judge receives more than ±1 submission compared to any other judge)
- Given submissions are auto-assigned, when the assignment completes, then each `judge_assignments` record links a judge to a submission with status `pending`
- Given an organizer views the assignment panel, when they identify an imbalance, then they can manually reassign a submission from one judge to another
- Given a judge logs into the platform, when they navigate to their judging dashboard, then they see: assigned submissions grouped by status (pending, in-progress, completed), the rubric for the current round, and a completion progress bar
- Given the organizer views the management panel, when checking judge progress, then they see real-time completion percentage per judge and overall for the round

**Technical Notes:**
- Assignment algorithm: round-robin with shuffle for randomness
- DB table: `judge_assignments` (judge_id, submission_id, round_id, status)
- Dashboard route: `/hackathons/:slug/judging`
- FR47, FR48, FR52

### Story 7.4: Score Entry & Per-Criterion Feedback

**As a** judge
**I want** to score each submission against every rubric criterion with comments
**So that** teams receive detailed, structured feedback on their work

**Acceptance Criteria:**

- Given a judge opens an assigned submission, when they begin scoring, then they see all rubric categories and criteria with input fields for scores and per-criterion comment boxes
- Given a judge is scoring, when they enter scores for some but not all criteria, then they can save as draft and return later across sessions
- Given a judge has entered scores for all criteria, when they submit the scores, then the system validates all criteria are scored and transitions the assignment status from `in_progress` to `completed`
- Given a judge attempts to submit with missing criteria scores, when they click submit, then the system highlights the incomplete criteria and prevents submission (stays in draft)
- Given a judge has finalized scores for a submission, when they attempt to edit, then the system prevents changes (scores are immutable after finalization)
- Given a judge submits scores, when the scores are persisted, then an audit event is logged with the full score payload

**Technical Notes:**
- DB tables: `scores` (judge_id, submission_id, criterion_id, score_value, comment)
- Draft state: scores exist in DB but assignment status is `in_progress`
- Finalized: assignment status is `completed`, scores become immutable
- FR49, FR50, FR51

### Story 7.5: Score Aggregation, Normalization & Leaderboard

**As an** organizer
**I want** scores automatically aggregated into ranked leaderboards
**So that** I can announce results based on objective, weighted scoring

**Acceptance Criteria:**

- Given all judges have finalized scores for a round, when the organizer triggers leaderboard generation, then the system calculates weighted aggregate scores per team using rubric category weights
- Given leaderboard scores are calculated, when multiple judges scored the same submission, then the system averages their scores per criterion before applying category weights
- Given a leaderboard is generated, when the organizer views it, then they see: rank, team name, total weighted score, per-category breakdown, and number of judges
- Given an organizer configures leaderboard visibility, when they select a setting (public, participants-only, hidden), then the leaderboard is accessible only according to that setting
- Given an organizer freezes the leaderboard, when the freeze is active, then scores cannot be recalculated and the leaderboard is locked for announcement
- Given a hackathon has tracks, when the leaderboard is viewed, then track-specific, round-specific, and cumulative views are all available
- Given a leaderboard query is executed, when results are returned, then the response time is under 500ms (NFR2)

**Technical Notes:**
- Aggregation: per-criterion average across judges → apply category weight → sum = total score
- DB: pre-compute `leaderboard_entries` table for fast reads
- Leaderboard visibility stored in `hackathon_rounds` or `hackathons` table
- Freeze: boolean flag that prevents recalculation
- FR54, FR55, FR56, FR57

### Story 7.6: Multi-Round Progression & Elimination

**As an** organizer
**I want** teams below a score threshold to be eliminated between rounds
**So that** only qualifying teams advance to the next round of competition

**Acceptance Criteria:**

- Given a round has completed judging and the leaderboard is generated, when the organizer configures an elimination threshold (minimum score or top-N teams), then the system identifies teams that fall below the threshold
- Given teams are identified for elimination, when the organizer confirms the elimination, then those teams are marked as `eliminated` for subsequent rounds and cannot submit
- Given elimination is executed, when affected teams log in, then they see their elimination status with their final scores
- Given a team is eliminated, when the next round starts, then eliminated teams are excluded from submission acceptance and judge assignment
- Given the organizer reviews eliminations, when they identify an error, then they can manually override a team's elimination status before the next round begins
- Given elimination occurs, when notifications are sent, then eliminated teams receive email notification with their scores and round standing (Epic 8)

**Technical Notes:**
- Elimination logic tied to `HackathonStateMachine` round transitions
- DB: `team_round_status` table (team_id, round_id, status: active/eliminated)
- Override endpoint: `PATCH /api/v1/hackathons/:slug/rounds/:roundId/teams/:teamId/status`
- FR26, FR53

### Story 7.7: Conflict of Interest & Scoring Anomaly Detection

**As an** organizer
**I want** judges to self-declare conflicts and the system to flag anomalous scoring patterns
**So that** I can ensure judging integrity and fairness

**Acceptance Criteria:**

- Given a judge is assigned a submission, when they recognize a conflict of interest, then they can self-declare the conflict with a reason, which triggers organizer review
- Given a conflict is declared, when the organizer reviews it, then they can reassign the submission to another judge or dismiss the conflict
- Given a conflict is declared, when the judge has already entered draft scores, then those draft scores are discarded upon reassignment
- Given all judges have finalized scores for a round, when the system runs anomaly detection, then it flags any judge whose average score deviates more than 2 standard deviations from the mean of all judges
- Given anomaly detection runs, when a judge has given identical scores to 80% or more of their assigned submissions, then the system flags this pattern for organizer review
- Given anomalies are flagged, when the organizer views the flagged judges, then they see the statistical evidence (judge avg vs overall avg, identical-score percentage) and can choose to: accept (no action), request re-evaluation, or exclude the judge's scores from aggregation

**Technical Notes:**
- Conflict endpoint: `POST /api/v1/hackathons/:slug/judging/conflicts`
- Anomaly detection: batch SQL query after round completion
- Standard deviation calculation in application layer (not D1 SQL)
- FR58, FR59

---

## Epic 8: Notifications & Communication

**Goal:** Build the event-driven notification system that keeps participants, judges, and organizers informed via email throughout the hackathon lifecycle.

**FRs:** FR65, FR66, FR67, FR68, FR69, FR70, FR71
**NFRs:** NFR8 (email delivery), NFR24 (notification latency)

### Story 8.1: Notification Queue & Email Delivery Service

**As a** system operator
**I want** a reliable queue-based email delivery pipeline
**So that** all platform notifications are delivered asynchronously without blocking API responses

**Acceptance Criteria:**

- Given the API needs to send a notification, when a notification event occurs, then the system enqueues a message to `NOTIFICATION_QUEUE` with type, recipient(s), template ID, and template variables
- Given a message is dequeued from `NOTIFICATION_QUEUE`, when the queue consumer processes it, then it renders the appropriate email template and sends via SMTP (using `SMTP_URL`, `SMTP_USERNAME`, `SMTP_PASSWORD` bindings)
- Given email delivery fails, when the SMTP call returns an error, then the system retries up to 3 times with exponential backoff before moving to dead-letter queue
- Given a notification is sent, when delivery succeeds, then a `notification_log` record is created with: type, recipient, sent_at, and delivery status
- Given the notification queue consumer receives a message, when the message type is unrecognized, then it logs a warning and discards the message (fail-open)
- Given the email service is called, when the timeout of 10 seconds is exceeded, then the service follows the fail-open pattern (log warning, never throw)

**Technical Notes:**
- Queue consumer: `apps/api/src/queue/notification-handler.ts`
- SMTP integration via `apps/api/src/services/email.ts`
- DB table: `notification_logs`
- Template rendering: simple string interpolation (no external template engine)
- Fail-open pattern per architecture conventions

### Story 8.2: Event-Driven Notification Triggers

**As a** participant
**I want** to receive email notifications for important hackathon events
**So that** I stay informed about submissions, deadlines, and results without constantly checking the platform

**Acceptance Criteria:**

- Given a submission is successfully created (Story 6.2), when the submission record is persisted, then the system enqueues an email confirmation to the team lead with submission details (tag, timestamp, round)
- Given a round deadline is approaching, when the configured reminder interval is reached (e.g., 24h, 1h before), then the system sends reminder emails to all teams that have not yet submitted for that round
- Given a hackathon transitions between states (active→judging, judging→completed), when the transition occurs, then all participants receive an email notification about the round/phase transition
- Given teams are eliminated after a round (Story 7.6), when elimination is confirmed, then eliminated teams receive email notification with their scores and standing
- Given an organizer changes a deadline, when the change is saved, then all affected participants receive email notification showing both old and new deadline values
- Given the cron handler runs hourly, when it detects upcoming deadlines within reminder windows, then it enqueues reminder notifications for relevant teams

**Technical Notes:**
- Notification triggers are enqueued by the originating handler (not polled)
- Deadline reminders: cron job at `0 * * * *` checks `round.submission_deadline` against configurable reminder windows
- Use `insertAuditEvent()` for deadline change notifications
- FR66, FR67, FR68, FR69

### Story 8.3: Organizer Announcements

**As an** organizer
**I want** to post announcements visible to all hackathon participants
**So that** I can communicate important updates, rule changes, or logistics to everyone at once

**Acceptance Criteria:**

- Given an organizer is managing a hackathon, when they create an announcement, then the announcement is stored with title, body (markdown), created_at, and author_id
- Given an announcement is created, when the organizer opts to send email notification, then the system enqueues email notifications to all participants of the hackathon
- Given announcements exist for a hackathon, when a participant views the hackathon page, then they see announcements in reverse chronological order
- Given an announcement is created, when the organizer views it, then they can edit or delete it (with audit trail)
- Given announcements are created, when the participant site is accessed (Epic 11), then announcements are available via the public API for display

**Technical Notes:**
- DB table: `announcements` (hackathon_id, title, body, author_id, created_at)
- API: `POST/GET /api/v1/hackathons/:slug/announcements`
- Email notification is optional per announcement (organizer checkbox)
- FR70

### Story 8.4: OTP Email Delivery

**As a** user
**I want** to receive OTP verification codes via email when using email/password authentication
**So that** I can verify my email address and complete the sign-up process

**Acceptance Criteria:**

- Given a user signs up with email/password, when the account is created, then the system enqueues an OTP email via `NOTIFICATION_QUEUE` with a 6-digit code and 10-minute expiry
- Given an OTP email is enqueued, when the notification handler processes it, then it sends an email with the OTP code, clear instructions, and the expiry time
- Given a user requests a new OTP, when the request is made, then the system invalidates the previous OTP and sends a new one
- Given an OTP email fails to deliver, when the retry limit is exceeded, then the user can request a resend from the verification page

**Technical Notes:**
- OTP generation and verification handled by Better Auth (Epic 2)
- This story only covers the email delivery integration
- Template: simple text email with OTP code prominently displayed
- FR71

### Story 8.5: Real-Time Submission Status (Toast + SSE)

**As a** participant
**I want** immediate confirmation when my submission is received
**So that** I know whether my submission was recorded or needs action.

**Acceptance Criteria:**

- Given a submission (webhook or manual) enters the queue, when status transitions occur (queued → recorded → failed), then the client receives events via SSE endpoint `/api/v1/submissions/events` and shows a toast plus inline status chip.
- Given SSE is unavailable, when the client detects disconnect, then it falls back to polling the submission status endpoint every 10 seconds until a terminal state.
- Given a submission fails, when the failure event is received, then the toast includes the failure reason and a CTA to retry (manual upload) or view troubleshooting steps.
- Given a submission succeeds, when the success event is received, then the team dashboard updates without page reload and the toast links to the submission record.

**Technical Notes:**
- Event payload shape: `{ status: 'queued' | 'recorded' | 'failed', submissionId, roundId, failureReason? }`
- SSE feed is backed by queue → Durable Object fan-out; reuse NotificationCenter client for consumption
- FR65, FR66

---

## Epic 9: Platform Administration

**Goal:** Build the shikdd.devsage.org admin panel for platform-wide oversight — hackathon request processing, monitoring, and admin privilege management.

**FRs:** FR60, FR61, FR62, FR63, FR64
**NFRs:** NFR9 (admin response time), NFR25 (admin audit)

### Story 9.1: Hackathon Request Queue & Approval Workflow

**As a** platform admin
**I want** to view, filter, and process hackathon creation requests
**So that** I can review and approve or reject new hackathon proposals efficiently

**Acceptance Criteria:**

- Given a user submits a hackathon creation request (Epic 4, Story 4.1), when the request is created, then it appears in the platform admin's request queue on shikdd.devsage.org
- Given a platform admin views the request queue, when the page loads, then they see requests sorted by submission date with columns: requester, hackathon name, workspace, status, and submitted date
- Given the request queue has many entries, when the admin filters by status (pending, approved, rejected), then only matching requests are displayed
- Given a platform admin reviews a request, when they approve it, then the hackathon transitions to `draft` state and the organizer receives an email notification
- Given a platform admin reviews a request, when they reject it with a reason, then the organizer receives an email notification with the rejection reason
- Given a platform admin wants to delegate, when they assign a pending request to another platform admin, then the assigned admin sees it highlighted in their queue
- Given any request action is taken, when the action completes, then an audit event is logged with the admin's identity and action details

**Technical Notes:**
- Admin app: `apps/admin/` (shikdd.devsage.org)
- API: `GET/PATCH /api/v1/admin/hackathon-requests`
- `requirePlatformAdmin` middleware on all admin routes
- FR60, FR62

### Story 9.2: Platform-Wide Hackathon Monitoring Dashboard

**As a** platform admin
**I want** to monitor all active hackathons across the platform
**So that** I can identify issues, track platform health, and provide support when needed

**Acceptance Criteria:**

- Given a platform admin navigates to the monitoring dashboard, when the page loads, then they see all hackathons with: name, workspace, state, participant count, team count, and last activity timestamp
- Given the dashboard is loaded, when the admin filters by state (draft, active, judging, completed, archived), then only matching hackathons are displayed
- Given the admin views a specific hackathon, when they drill down, then they see: organizer details, round configuration, submission counts, and judge progress
- Given the admin views the dashboard, when platform-wide audit logs are needed, then they can access audit logs filtered by hackathon, user, or event type with pagination
- Given the admin views audit logs, when scrolling through results, then cursor-based pagination is used for the append-only audit log table

**Technical Notes:**
- Dashboard route in `apps/admin/src/pages/`
- API: `GET /api/v1/admin/hackathons`, `GET /api/v1/admin/audit-logs`
- Audit log pagination: cursor-based (not offset) per architecture conventions
- FR61, FR64

### Story 9.3: Platform Admin Management & Privilege Isolation

**As a** platform operator
**I want** platform admin access to be a separate privilege layer from per-hackathon roles
**So that** admin access is tightly controlled and cannot be conflated with organizer permissions

**Acceptance Criteria:**

- Given the platform has a `platform_admins` table, when a user is listed in it, then they can access the admin panel at shikdd.devsage.org
- Given a user is a platform admin, when they also have a per-hackathon role (e.g., organizer, judge), then the two privilege layers are completely independent — admin access does not grant hackathon-level permissions and vice versa
- Given a user is not in the `platform_admins` table, when they attempt to access any admin API route, then the `requirePlatformAdmin` middleware returns 403 Forbidden
- Given the admin panel is accessed, when the user's platform admin status is checked, then the check queries the `platform_admins` table per-request (not cached in JWT or session)
- Given a platform admin needs to be added or removed, when the change is made, then it is performed via direct database operation (seed script or manual SQL) with an audit trail — there is no self-service admin management UI in v1

**Technical Notes:**
- Middleware: `apps/api/src/middleware/platform-admin.ts` (already exists per project context)
- DB table: `platform_admins` (user_id, created_at)
- No UI for managing admins in v1 — seed script only
- FR63

---

## Epic 10: Audit Trail & Compliance

**Goal:** Build the tamper-evident audit logging system with hash-chain integrity, and ensure DPDPA compliance through data minimization and anonymization policies.

**FRs:** FR79, FR80, FR81, FR82, FR83, FR85
**NFRs:** NFR10 (retention), NFR26-NFR29 (DPDPA compliance)

### Story 10.1: Audit Event Logging with Hash Chain Integrity

**As a** system operator
**I want** all state-changing operations logged as tamper-evident audit events
**So that** there is a cryptographically verifiable history of every mutation in the system

**Acceptance Criteria:**

- Given any state-changing API operation executes, when the operation succeeds, then an audit event is created via `insertAuditEvent()` containing: event_type, actor_id, actor_type (user/bot/system/cron), resource_type, resource_id, hackathon_id (if scoped), payload hash, and timestamp
- Given an audit event is created, when it is persisted, then the system computes a SHA-256 hash of (previous_event_hash + current_event_data) to form a hash chain
- Given the hash chain is maintained, when any audit record is tampered with, then subsequent hash verification detects the inconsistency
- Given an audit event is logged, when the actor is a cron job or queue consumer, then the actor_type is `cron` or `system` respectively (not `user`)
- Given an audit event is logged, when the actor is an authenticated user, then the actor_id references the user's ID
- Given all UTC timestamps are stored, when audit events are displayed, then they include timezone indicators (FR85)

**Technical Notes:**
- Function: `insertAuditEvent()` in `apps/api/src/lib/audit.ts` (exists per project context)
- Hash chain: `SHA-256(prev_hash || JSON.stringify(event))` via `crypto.subtle.digest()`
- DB table: `audit_events` (append-only, no updates or deletes)
- FR79, FR82, FR85

### Story 10.2: Audit Log Query API & Retention Policy

**As an** organizer
**I want** to query audit logs scoped to my hackathon
**So that** I can investigate issues, review changes, and maintain accountability

**Acceptance Criteria:**

- Given an organizer is managing a hackathon, when they query audit logs, then they receive events scoped only to their hackathon_id with cursor-based pagination
- Given a platform admin queries audit logs (Story 9.2), when they request cross-hackathon logs, then they receive events across all hackathons with filters for hackathon, user, event type, and date range
- Given audit logs are queried, when results are paginated, then cursor-based pagination is used (not offset) since audit logs are append-only
- Given audit events exist, when they are queried, then the response includes: event_type, actor display name, timestamp, resource description, and a human-readable summary
- Given audit records exist, when a user deletes their account (Story 2.6), then audit records are preserved with anonymized actor references (e.g., `deleted-user-{hash}`) — never deleted

**Technical Notes:**
- API: `GET /api/v1/hackathons/:slug/audit-logs` (organizer, scoped)
- API: `GET /api/v1/admin/audit-logs` (platform admin, unscoped)
- Cursor: use `id` or `created_at` as cursor field
- Anonymization: replace actor_id with hash on account deletion
- FR80, FR81, FR83

### Story 10.3: DPDPA Compliance — Data Minimization & Anonymization

**As a** platform operator
**I want** the system to comply with DPDPA data protection requirements
**So that** user data is handled responsibly with proper minimization and retention policies

**Acceptance Criteria:**

- Given a user creates an account, when personal data is stored, then only data necessary for platform functionality is collected (name, email, GitHub username) — no unnecessary profiling data
- Given a user deletes their account (Story 2.6), when deletion is processed, then personal data is anonymized: profile fields are cleared, email is hashed, display name is replaced with "Deleted User", but functional records (teams, submissions, scores) retain anonymized references
- Given a hackathon is archived, when data retention policy applies, then submission records and scores are retained indefinitely (competition records) but personal metadata follows the configured retention period
- Given the system processes personal data, when data is accessed, then access is logged in the audit trail (Story 10.1)
- Given DPDPA consent was collected at registration (Story 2.5), when the consent record exists, then it is preserved independently of account deletion for regulatory compliance

**Technical Notes:**
- Anonymization function: `anonymizeUser(userId)` that updates profile + audit references
- DPDPA consent records in `user_consents` table (never deleted)
- Data minimization enforced by schema design — no optional tracking fields
- FR83, NFR26-NFR29

---

## Epic 11: Participant Sites

**Goal:** Build the hackathon-specific participant-facing websites — auto-generated from templates, deployed on {slug}.devsage.org subdomains, displaying hackathon info, leaderboards, and team dashboards.

**FRs:** FR72, FR73, FR74, FR75, FR76, FR77, FR78
**NFRs:** NFR3 (FCP <2s), NFR11 (participant site performance)

### Story 11.1: Hackathon Site Template & Generation Pipeline

**As an** organizer
**I want** a participant-facing website automatically generated for my hackathon
**So that** participants have a dedicated portal without me building a website from scratch

**Acceptance Criteria:**

- Given a hackathon is approved and transitions to `draft` state, when the organizer triggers site generation, then the system creates a new repository from the `templates/hackathon-site/` template with hackathon-specific configuration
- Given a site is generated, when the template is instantiated, then it includes: hackathon name, slug, API endpoint configuration, branding placeholders, and default page structure
- Given a site repository is created, when it is deployed, then it is accessible at `{slug}.devsage.org` via Cloudflare Pages
- Given the site template is a standalone React/Vite app, when it builds, then it produces a static site that fetches dynamic data from the DevSage API at runtime
- Given a site is deployed, when spectators visit without authentication, then they can view all public content (FR78)

**Technical Notes:**
- Template: `templates/hackathon-site/` (exists in repo structure)
- Participant sites live in SEPARATE repos (per project conventions)
- Deployment: Cloudflare Pages with `{slug}.devsage.org` subdomain
- API calls: public endpoints only (no auth required for read-only content)
- FR72, FR76, FR78

### Story 11.2: Public Hackathon Info, Schedule & Leaderboard Display

**As a** spectator or participant
**I want** the participant site to display hackathon details, schedule, and leaderboard
**So that** I can follow the competition without needing a platform account

**Acceptance Criteria:**

- Given a participant site is deployed, when a visitor loads the homepage, then they see: hackathon name, description, dates, rules, and submission instructions
- Given the hackathon has a schedule with rounds, when the schedule page is viewed, then it displays round names, start/end dates, and current round status with timezone indicators
- Given leaderboard visibility is set to `public` (Story 7.5), when the leaderboard page is accessed, then it displays current rankings with team names and scores
- Given leaderboard visibility is set to `participants-only` or `hidden`, when an unauthenticated visitor views the leaderboard page, then they see a "Leaderboard not publicly available" message
- Given the participant site fetches data from the API, when the first page loads, then First Contentful Paint is under 2 seconds (NFR3)
- Given announcements exist for the hackathon (Story 8.3), when the visitor views the announcements section, then they see announcements in reverse chronological order

**Technical Notes:**
- Public API endpoints: `GET /api/v1/hackathons/:slug` (public info), `GET /api/v1/hackathons/:slug/leaderboard` (respects visibility)
- Static shell + runtime API calls for dynamic data
- FR73, FR74

### Story 11.3: Team Dashboard & Submission History on Participant Site

**As a** participant
**I want** to see my team's details and submission history on the participant site
**So that** I can track my team's progress and verify submissions were received

**Acceptance Criteria:**

- Given a participant site is deployed, when a visitor views the teams page, then they see a list of registered teams with member counts and registration status
- Given an authenticated participant views the site, when they navigate to their team dashboard, then they see: team members, linked GitHub repo, and submission history for each round
- Given a team has submissions, when the submission history is displayed, then each entry shows: tag name, commit SHA (truncated), received timestamp, round, and whether it is marked as the final submission
- Given a submission is marked as late (Story 6.4), when it appears in the history, then it is visually flagged with the late-by duration
- Given feedback visibility is enabled by the organizer (FR88), when the participant views a scored submission, then they see per-criterion scores and judge feedback

**Technical Notes:**
- Authenticated routes: participant must log in via the same auth system
- API: `GET /api/v1/hackathons/:slug/teams` (public), `GET /api/v1/hackathons/:slug/teams/:teamId/submissions` (team member only)
- Feedback API: `GET /api/v1/hackathons/:slug/submissions/:id/feedback`
- FR75, FR88

### Story 11.4: Participant Site Theming & Custom Domain

**As an** organizer on the max-tier workspace plan
**I want** to configure a custom domain for my hackathon's participant site
**So that** participants access the site on my organization's branded domain

**Acceptance Criteria:**

- Given the hackathon site template is generated, when the organizer customizes branding, then they can configure: primary/accent colors, logo URL, and hero image via the hackathon configuration
- Given branding configuration is set, when the participant site renders, then it uses the organizer's branding instead of DevSage defaults
- Given the organizer's workspace is on the max tier, when they configure a custom domain, then the system provisions the custom domain via Cloudflare Pages custom domains
- Given a custom domain is configured, when a visitor accesses it, then they see the participant site with the organizer's branding and proper HTTPS
- Given the organizer's workspace is not on the max tier, when they attempt to configure a custom domain, then the option is unavailable with an upgrade prompt

**Technical Notes:**
- Branding stored in `hackathons` table: `branding_config` JSON column
- Custom domain: Cloudflare Pages custom domains API
- Tier check: workspace subscription validation
- FR77

---

## Epic 12: Analytics, Export & Feedback

**Goal:** Provide organizers with analytics dashboards and export capabilities, and enable participants to view judge feedback on their submissions.

**FRs:** FR86, FR87, FR88

### Story 12.1: Organizer Analytics Dashboard

**As an** organizer
**I want** to view analytics dashboards for my hackathon
**So that** I can track participation trends, submission rates, and judging progress at a glance

**Acceptance Criteria:**

- Given an organizer navigates to their hackathon's analytics page, when the dashboard loads, then they see: total registration count, team formation rate (teams / registered participants), and registration timeline chart
- Given the hackathon has active rounds, when the organizer views submission analytics, then they see: submission count per round, submission rate over time, and percentage of teams that have submitted
- Given judging is in progress, when the organizer views judge analytics, then they see: judge completion progress per round (percentage and count), average time per evaluation, and overall completion estimate
- Given a round has completed scoring, when the organizer views score analytics, then they see: score distribution histogram, mean/median/standard deviation, and per-category score breakdowns
- Given analytics data is requested, when the API responds, then data is computed from source tables (not pre-aggregated) with appropriate query optimization

**Technical Notes:**
- Dashboard in `apps/platform/src/pages/` (organizer dashboard)
- API: `GET /api/v1/hackathons/:slug/analytics` with query params for metric type
- Charts: client-side rendering using a lightweight chart library
- FR86

### Story 12.2: Results Export (CSV & PDF)

**As an** organizer
**I want** to export hackathon results in CSV and PDF formats
**So that** I can share results with stakeholders, sponsors, and institutional records

**Acceptance Criteria:**

- Given an organizer views the results page for a completed round, when they click "Export CSV", then the system generates a CSV file containing: rank, team name, members, total score, per-category scores, and per-criterion scores
- Given an organizer clicks "Export PDF", when the PDF is generated, then it includes: hackathon name, round, date, a formatted results table, and DevSage branding
- Given the export is requested, when the data is assembled, then it includes only finalized scores (not drafts) and respects leaderboard freeze status
- Given a large hackathon has many teams, when export is requested, then the generation happens asynchronously and the organizer is notified when the file is ready for download
- Given export files are generated, when the organizer downloads them, then the files are served from a temporary R2 storage URL with a 24-hour expiry

**Technical Notes:**
- CSV: server-side generation in Worker
- PDF: use a lightweight PDF generation library compatible with Workers runtime (or generate server-side HTML and convert)
- Temporary storage: R2 bucket with presigned URLs
- API: `POST /api/v1/hackathons/:slug/exports` (trigger), `GET /api/v1/hackathons/:slug/exports/:id` (download)
- FR87

### Story 12.3: Participant Feedback Visibility

**As a** participant
**I want** to view judge feedback and per-criterion scores on my submission
**So that** I can learn from the evaluation and improve for future hackathons

**Acceptance Criteria:**

- Given an organizer configures a round, when they set feedback visibility to `enabled`, then participants can view judge feedback after scores are finalized
- Given feedback visibility is enabled, when a participant views their scored submission, then they see: per-criterion scores, per-criterion judge comments, weighted category scores, and overall rank
- Given feedback visibility is disabled (default), when a participant views their submission, then they see only their overall rank and total score (no per-criterion breakdown)
- Given multiple judges scored a submission, when feedback is displayed, then individual judge identities are anonymized (e.g., "Judge 1", "Judge 2") — judges are not identified by name
- Given a participant views feedback, when the round is still in `judging` state (not all judges complete), then feedback is not yet available regardless of the visibility setting

**Technical Notes:**
- Feedback visibility: per-round setting in `hackathon_rounds` table
- API: `GET /api/v1/hackathons/:slug/submissions/:id/feedback` — returns anonymized judge feedback
- Judge anonymization: replace judge names with sequential labels in response
- FR88
