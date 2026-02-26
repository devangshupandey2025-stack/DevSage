# Admin & Platform Operations — Cross-Functional Feature Document

> **Scope**: Platform Admin system (`shikdd.devsage.org`) + Organizer Platform (`platform.devsage.org`)
> **Last Updated**: 2026-02-15
> **Status**: Living document — reflects current implementation state

---

## Table of Contents

1. [Overview](#1-overview)
2. [Platform Admin System](#2-platform-admin-system)
3. [Organizer Platform](#3-organizer-platform)
4. [Audit System](#4-audit-system)
5. [Deletion Requests & GDPR](#5-deletion-requests--gdpr)
6. [Notification System](#6-notification-system)
7. [Stats & Analytics](#7-stats--analytics)
8. [Hackathon Request Pipeline](#8-hackathon-request-pipeline)
9. [Role Resolution Architecture](#9-role-resolution-architecture)
10. [Known Issues & Future Plans](#10-known-issues--future-plans)

---

## 1. Overview

DevSage has two distinct administrative contexts with separate frontends, separate user populations, and separate authorization models:

| Dimension | Platform Admin (`shikdd.devsage.org`) | Organizer Platform (`platform.devsage.org`) |
|-----------|---------------------------------------|---------------------------------------------|
| **App** | `apps/admin` | `apps/platform` |
| **Users** | DevSage internal team (SHIKDD) | Workspace owners, hackathon organizers, co-organizers |
| **Auth gate** | `requirePlatformAdmin` middleware | `requireRole('co_organizer')` or workspace membership |
| **Scope** | Global — all workspaces, users, hackathons | Per-workspace and per-hackathon |
| **Purpose** | Platform governance, onboarding, audit, ops | Hackathon lifecycle management |
| **API prefix** | `GET/POST/PATCH/DELETE /api/v1/admin/*` | `GET/POST/PATCH/DELETE /api/v1/hackathons/:slug/*` + `/api/v1/workspaces/*` |

Both apps share:
- React 18 + Vite + Tailwind CSS v4 + shadcn/ui + React Router v7
- Cookie-based auth (`credentials: 'include'`) with auto-refresh on 401
- Dark theme with `#CCFF00` (lime green) brand accent
- `@devsage/shared` as sole package dependency (Zod schemas + types)

Neither app may import from `@devsage/db` or `@devsage/api`.

---

## 2. Platform Admin System

### 2.1 Who Are Platform Admins

Platform admins are stored in the `platform_admins` table — a simple join table linking users to global admin privileges:

```
platform_admins
├─ id          (text PK)
├─ user_id     (text NOT NULL, UNIQUE) → FK: users.id (CASCADE)
├─ added_by    (text)                  → FK: users.id (SET NULL)
└─ created_at  (text NOT NULL, auto-timestamp)
```

**Key characteristics:**
- Completely separate from hackathon roles — a platform admin is not automatically an organizer of any hackathon.
- Authentication uses the standard auth flow (`POST /auth/login` or OAuth), then `requirePlatformAdmin` middleware checks the `platform_admins` table.
- Admins can add/remove other admins but cannot remove themselves (self-deletion guard).
- The admin list is not cached; every request queries D1 directly.

### 2.2 Platform Admin Middleware

**File:** `apps/api/src/middleware/platform-admin.ts`

```
requirePlatformAdmin
  1. Check c.get('user') exists → 401 AUTH_REQUIRED
  2. SELECT * FROM platform_admins WHERE user_id = ? → 403 FORBIDDEN
  3. next()
```

All admin routes apply both `authMiddleware` (JWT cookie verification) and `requirePlatformAdmin` in sequence. There is no role hierarchy within platform admins — it is a binary check.

### 2.3 Admin API Routes

**File:** `apps/api/src/routes/admin.ts`
**Base path:** `/api/v1/admin`
**Middleware:** `authMiddleware` → `requirePlatformAdmin` (applied to all routes)

#### User Management

| Method | Path | Description | Pagination |
|--------|------|-------------|------------|
| `GET` | `/users` | List all platform users (id, email, name, image, created_at) | Offset: limit (max 100, default 20), offset |

#### Hackathon Management

| Method | Path | Description | Pagination |
|--------|------|-------------|------------|
| `GET` | `/hackathons` | List all hackathons across all workspaces | Offset: limit, offset |
| `GET` | `/hackathons/:hackathonId` | Get full hackathon object | — |
| `GET` | `/hackathons/:hackathonId/rounds` | List rounds for a hackathon | — |
| `PATCH` | `/hackathons/:hackathonId/rounds/:roundId/initialize` | Toggle round initialization (`is_initialized: boolean`). Updates `started_at` and `status` | — |

#### Admin Management

| Method | Path | Description | Notes |
|--------|------|-------------|-------|
| `GET` | `/admins` | List all platform admins with user details (name, email) | Joins `platform_admins` ← `users` |
| `POST` | `/admins` | Add a user as platform admin (`{ user_id }`) | 409 ALREADY_ADMIN if exists |
| `DELETE` | `/admins/:userId` | Remove a platform admin | 409 CANNOT_REMOVE_SELF |

#### Platform Invites (Organizer Onboarding)

| Method | Path | Description | Notes |
|--------|------|-------------|-------|
| `GET` | `/invites` | List all platform invites | Offset: limit (default 10), offset |
| `POST` | `/invites` | Create platform invite (`{ email }`) | Returns `{ id, email, invite_code, status, created_at, expires_at }` (201) |
| `DELETE` | `/invites/:id` | Revoke a pending invite | Returns `{ revoked: true }` |

Platform invites use the `platform_invites` table:

```
platform_invites
├─ id          (text PK)
├─ email       (text NOT NULL, indexed)
├─ invite_code (text NOT NULL, UNIQUE)
├─ status      (text, default: 'pending')  — pending | accepted | expired | revoked
├─ created_by  (text)                      → FK: users.id (SET NULL)
├─ created_at  (text NOT NULL, auto-timestamp)
└─ expires_at  (text NOT NULL)
```

#### Workspace Management

| Method | Path | Description | Notes |
|--------|------|-------------|-------|
| `GET` | `/workspaces` | List all workspaces with `member_count` and `hackathon_count` | Aggregated counts |
| `POST` | `/workspaces` | Create workspace (`{ name, slug, type, description?, owner_email }`) | Creates workspace + sends invite email to owner. Returns `{ workspace, invite_token }` (201) |
| `GET` | `/workspaces/:workspaceId` | Get workspace with nested `members`, `hackathons`, `invites` arrays | Full detail view |

Workspace types: `club`, `college`, `company`, `community`.

#### Audit & Maintenance

| Method | Path | Description | Notes |
|--------|------|-------------|-------|
| `POST` | `/audit/backfill` | Process unhashed audit events (batch of 100) | Returns `{ processed: number }` |

#### Platform Stats

| Method | Path | Description | Notes |
|--------|------|-------------|-------|
| `GET` | `/stats` | Global platform statistics | Returns `{ users, hackathons, teams, submissions }` (aggregate COUNT queries) |

### 2.4 Admin Frontend (`apps/admin`)

**URL:** `shikdd.devsage.org` (port 5175 in dev)

#### Authentication Flow

1. `LoginPage` → `POST /auth/login` (email/password)
2. `AuthProvider` calls `GET /auth/me` on mount → syncs `user`, `isPlatformAdmin`, `isOrganizer`, `hackathonRoles`, `workspaceRoles`
3. `ProtectedRoute` component gates all routes: redirects to `/login` if unauthenticated; shows "Access Denied" if `isPlatformAdmin === false`
4. On 401: `apiRequest()` auto-calls `POST /auth/refresh` → retries original request → redirects to `/login` on failure

#### Layout

- **Sticky header** (z-50): "SHIKDD ADMIN" branding, horizontal nav links, user profile dropdown (avatar, name, email, profile link, logout)
- **Navigation items:** Dashboard, Users, Hackathons, Invites, Admins, Workspaces, Requests
- **Background:** Grid pattern with lime green blur circles
- **Main content:** `<Outlet />` (max-width 7xl, padded)

#### Page Inventory

| Route | Page Component | Features | Key API Calls |
|-------|---------------|----------|---------------|
| `/login` | `LoginPage` | Email/password form, Framer Motion animation | `POST /auth/login` |
| `/` | `AdminDashboardPage` | 5 metric cards (Users, Workspaces, Hackathons, Active, Pending Requests), quick action links, "Audit Hash Backfill" maintenance button | `GET /api/v1/admin/stats`, `GET /api/v1/hackathon-requests/admin/stats`, `POST /api/v1/admin/audit/backfill` |
| `/users` | `UsersPage` | Paginated table (20/page): avatar+name, email, joined date, last login | `GET /api/v1/admin/users` |
| `/admins` | `AdminsPage` | Add admin form (user UUID input), admin list with delete buttons (no self-delete) | `GET/POST/DELETE /api/v1/admin/admins` |
| `/invites` | `InvitesPage` | Create invite dialog, paginated table (10/page) with status badges (pending=yellow, accepted=green, expired=gray, revoked=red), copy invite code, revoke button | `GET/POST/DELETE /api/v1/admin/invites` |
| `/workspaces` | `WorkspacesPage` | Create workspace form (name → auto-slug, type dropdown, owner email), search/filter, workspace cards with member/hackathon counts, pagination (20/page) | `GET/POST /api/v1/admin/workspaces` |
| `/workspaces/:id` | `WorkspaceDetailPage` | Header with type badge, member list (crown icon for owners), invite form (email + role dropdown), pending invites list, hackathon list with status badges | `GET /api/v1/admin/workspaces/:id`, `POST /api/v1/workspaces/:id/invites` |
| `/hackathons` | `HackathonsPage` | Paginated cards (20/page): trophy icon, title, slug, dates, status badge | `GET /api/v1/admin/hackathons` |
| `/hackathons/:id` | `HackathonDetailPage` | Hackathon header, round list with initialization toggles (Initialize/Un-initialize buttons), refresh button | `GET /api/v1/admin/hackathons/:id`, `GET .../rounds`, `PATCH .../rounds/:id/initialize` |
| `/hackathon-requests` | `HackathonRequestsPage` | Stats bar (6 status count cards), filter tabs, expandable request cards with: requester info, dates, description, visual progress stepper, status history timeline, admin notes, status update form, deploy command (for approved/building) | `GET /api/v1/hackathon-requests/admin/stats`, `GET .../admin/all`, `PATCH .../admin/:id` |
| `/profile` | `ProfilePage` | User avatar, name, email, user ID, role badges (Platform Admin, Organizer) | Auth context only |

#### UI Component Library

Shared `components/ui/` primitives built on Radix UI: Button, Card, Badge, Input, Dialog, Dropdown Menu, Tabs, Skeleton. Plus `dashboard-layout.tsx` (layout shell) and `protected-route.tsx` (auth gate).

#### Dependencies

React 18, React Router v7, Radix UI (dialog, dropdown, tabs, labels), Tailwind CSS v4, Framer Motion, Lucide React (icons), Sonner (toasts), class-variance-authority, clsx, tailwind-merge.

---

## 3. Organizer Platform

### 3.1 Who Are Organizers

Organizers access `platform.devsage.org` via two paths:

1. **Workspace ownership/admin** — Creating a workspace or being invited as an `owner`/`admin` member grants implicit organizer access to all hackathons in that workspace.
2. **Hackathon role assignment** — Being assigned `organizer` or `co_organizer` role for a specific hackathon (stored in `organizer_roles` table).

```
organizer_roles
├─ id           (text PK)
├─ hackathon_id (text NOT NULL) → FK: hackathons.id (CASCADE)
├─ user_id      (text NOT NULL) → FK: users.id (CASCADE)
├─ role         (text NOT NULL)   — organizer | co_organizer
├─ invited_by   (text)           → FK: users.id (SET NULL)
└─ created_at   (text NOT NULL, auto-timestamp)

UNIQUE: (hackathon_id, user_id)
```

Role resolution happens per-request via `resolveRole()` (see [Section 9](#9-role-resolution-architecture)).

### 3.2 Platform Features

The organizer platform provides complete hackathon lifecycle management:

#### Hackathon Creation & Configuration
- Create hackathons through the request pipeline (see [Section 8](#8-hackathon-request-pipeline))
- Configure: title, description, rules (markdown), dates (start, judging start/end), team size limits, registration mode, timezone, tracks, prizes
- 5-state lifecycle: `draft → active → judging → completed → archived` (forward-only, except `archived → completed` for score corrections)
- Phase transitions via `POST /api/v1/hackathons/:slug/phase`

#### Team Oversight
- View all teams with member lists, GitHub repo links, and search
- Team seeding dialog with 3 modes: `full_structure`, `leaders_only`, `participants_only` (bulk-creates teams via `POST /api/v1/hackathons/:slug/teams/seed`)
- Individual team detail: members (crown icon for leads), submissions
- Crown icon distinguishes team leads from members

#### Submission Management
- View all submissions with repository URLs
- AI analysis and scoring: tech stack detection, framework detection, strengths/improvements
- Color-coded AI scores: green (70+), amber (40-69), red (<40)
- Expandable detail cards per submission

#### Judge Management
- Invite judges via email (`POST /api/v1/hackathons/:slug/judging/invite`)
- View judge list with invitation status
- Assign submissions to judges — manual or auto-assign (round-robin shuffle)
- Define rubric criteria (name, max score, weight per criterion)
- View scoring progress per judge

#### Scoring & Leaderboard
- View leaderboard with ranked teams, total scores, judge completion counts
- Rank display: Trophy (1st), Medal (2nd), Award (3rd), `#N` for rest
- Leaderboard computation: per-judge normalized scores averaged across judges per team

#### Round Management
- Create, initialize, and delete competition rounds
- Round status tracking: pending → active → completed
- Round initialization controls start timing
- Supports elimination-style multi-round hackathons

#### Announcements
- Create, pin/unpin, and delete announcements
- Pinned announcements displayed prominently
- Author attribution with avatar and timestamp

#### Activity & Audit
- Timeline view of all hackathon events
- Event types: team.created, submission.created, score.submitted, hackathon.phase_changed, etc.
- Icon-coded by category: Users (teams), FileText (submissions), Trophy (judging), Shield (settings)
- Cursor-based pagination for efficient log browsing

#### Analytics
- Stat cards: teams count, submissions count, judges count
- Bar charts and trend indicators
- **Note:** Currently uses placeholder/fabricated data — no real analytics backend API exists yet

#### Settings
- Basic info editing (title, description)
- Date configuration (start, judging window)
- Team size limits
- Hackathon deletion (with confirmation dialog)

### 3.3 Platform Frontend (`apps/platform`)

**URL:** `platform.devsage.org` (port 5174 in dev)

#### Authentication Flow

Same cookie-based flow as admin app:
1. Login → `POST /auth/login`
2. `AuthProvider` loads `GET /auth/me` → sets `isOrganizer` flag
3. `ProtectedRoute` requires `isAuthenticated && isOrganizer`
4. Auto-refresh on 401

#### Layout

- **Collapsible sidebar** (72px collapsed / 240px expanded) with Framer Motion animation
- **Top bar:** Search input (⌘K shortcut), notification bell with unread count, user profile dropdown
- **Sidebar navigation:**
  - **Main:** Dashboard
  - **Hackathon context** (when inside a hackathon): Overview, Teams, Submissions, Judging, Leaderboard, Rounds, Announcements, Activity, Analytics, Settings
- Active route indicator with lime green highlight

#### Page Inventory (20 pages)

| Route | Page Component | Purpose | Key API Calls |
|-------|---------------|---------|---------------|
| `/login` | `LoginPage` | Auth form | `POST /auth/login` |
| `/invite/:code` | `InviteAcceptPage` | Accept organizer invite | `GET/POST /api/v1/invites/:code` |
| `/invite/workspace/:token` | `WorkspaceInviteAcceptPage` | Accept workspace invite | `GET/POST /api/v1/workspaces/invites/token/:token` |
| `/invite/judge/:token` | `JudgeInviteAcceptPage` | Accept judge invite | `GET/POST /api/v1/invites/judge/:token` |
| `/dashboard` | `DashboardPage` | Hackathon list, creation/request form, stage indicators | `GET /api/v1/hackathons`, `POST /api/v1/hackathons/:id/phase` |
| `/profile` | `ProfilePage` | User info, role badges, logout | Auth context |
| `/workspaces` | `WorkspacesPage` | User's workspace memberships | `GET /api/v1/workspaces` |
| `/workspaces/:slug` | `WorkspaceDetailPage` | Members (owner/admin/member roles), hackathon list | `GET /api/v1/workspaces/:slug` |
| `/hackathons/:slug` | `HackathonOverviewPage` | Status, countdown timers, metrics, phase transition | `GET /api/v1/hackathons/:slug`, `GET .../metrics`, `POST .../phase` |
| `/hackathons/:slug/teams` | `TeamsPage` | Team grid/list, search, seeding dialog | `GET /api/v1/hackathons/:slug/teams`, `POST .../teams/seed` |
| `/hackathons/:slug/teams/:id` | `TeamDetailPage` | Team members, submissions | React Query: `hackathonQueries.teamDetail()` |
| `/hackathons/:slug/submissions` | `SubmissionsPage` | Submissions with AI analysis, search, expandable cards | `GET /api/v1/hackathons/:slug/submissions` |
| `/hackathons/:slug/judging` | `JudgingPage` | Judge list, assignments, rubric, scoring interface | `GET/POST /api/v1/hackathons/:slug/judging/*` |
| `/hackathons/:slug/leaderboard` | `LeaderboardPage` | Ranked teams with scores, judge completion | `GET /api/v1/hackathons/:slug/judging/leaderboard` |
| `/hackathons/:slug/rounds` | `RoundsPage` | Round cards, create/initialize/delete | `GET/POST/DELETE /api/v1/hackathons/:slug/rounds` |
| `/hackathons/:slug/announcements` | `AnnouncementsPage` | Create, pin, delete announcements | `GET/POST/PATCH/DELETE /api/v1/hackathons/:slug/announcements` |
| `/hackathons/:slug/activity` | `ActivityPage` | Audit event timeline | `GET /api/v1/hackathons/:slug/audit` |
| `/hackathons/:slug/analytics` | `AnalyticsPage` | Stat cards, charts (mock data) | — |
| `/hackathons/:slug/settings` | `SettingsPage` | Hackathon config, dates, deletion | `GET/PATCH/DELETE /api/v1/hackathons/:slug` |
| `/terms` | `TermsOfServicePage` | Static legal content | — |
| `/privacy` | `PrivacyPolicyPage` | Static legal content | — |

#### Data Fetching

Uses TanStack React Query v5 with typed query factories:
- `hackathonQueries` — detail, teams, submissions, judges, rubric, leaderboard, audit
- `judgeQueries` — assignments
- `notificationQueries` — all, unreadCount
- `roundQueries` — list
- `organizerQueries` — list

#### Dependencies

Same base as admin app, plus: `@tanstack/react-query` v5.90.21, Framer Motion for page transitions.

---

## 4. Audit System

### 4.1 Audit Events Table

```
audit_events
├─ id              (text PK)
├─ hackathon_id    (text)           → FK: hackathons.id (SET NULL)
├─ actor_id        (text)           → FK: users.id (SET NULL)
├─ actor_type      (text NOT NULL)    — user | system | bot | cron
├─ event_type      (text NOT NULL)    — action classification
├─ entity_type     (text NOT NULL)    — target entity type (team, submission, hackathon, etc.)
├─ entity_id       (text NOT NULL)    — target entity UUID
├─ metadata        (text)             — JSON: additional context (IP, user agent, etc.)
├─ changes         (text)             — JSON: before/after diff for mutations
├─ hash            (text)             — SHA-256 chain hash
├─ prev_hash       (text)             — previous event's hash in chain
└─ created_at      (text NOT NULL, auto-timestamp)

Indexes:
├─ idx_audit_entity     ON (entity_type, entity_id)
├─ idx_audit_event_type ON (event_type)
└─ idx_audit_actor      ON (actor_id)
```

### 4.2 Hash Chain Integrity

Every audit event is linked to its predecessor via a SHA-256 hash chain, partitioned per hackathon:

```
hash = SHA-256("${event_id}:${prev_hash || 'genesis'}:${hackathon_id || 'global'}")
```

**Chain properties:**
- **Per-hackathon partitioning:** Each hackathon has its own hash chain. Global events (no `hackathon_id`) form a separate chain.
- **Sequence numbers:** Auto-incrementing per event (`MAX(sequence) + 1`), used for ordering.
- **Genesis block:** First event in a chain uses `"genesis"` as the previous hash.
- **Tamper detection:** Recomputing hashes from sequence start detects any inserted, modified, or deleted events.
- **Backfill:** Events created without hashes (e.g., during high throughput) are backfilled later via `backfillAuditHashes()`.

### 4.3 Actor Types

| Actor Type | Source | Example Actions |
|------------|--------|----------------|
| `user` | Authenticated human via API | Create team, submit code, update settings |
| `system` | Automated platform logic | State transitions triggered by API logic |
| `bot` | GitHub webhooks, external integrations | Webhook-triggered submission creation |
| `cron` | Hourly scheduled handler | Deadline checks, reminder sends, hash backfill |

### 4.4 What Gets Audited

Every mutation in the API calls `insertAuditEvent()`. Common audit actions include:

- `team.created`, `team.member_added`, `team.member_removed`
- `submission.created`, `submission.validated`, `submission.tag_deleted`
- `hackathon.phase_changed` (draft→active→judging→completed→archived)
- `hackathon.settings_updated`
- `score.submitted`, `results.published`
- `judge.invited`, `judge.assigned`
- `announcement.created`, `announcement.pinned`
- `round.created`, `round.initialized`, `round.completed`
- `workspace.created`, `workspace.member_invited`
- `admin.added`, `admin.removed`

### 4.5 Audit API

**File:** `apps/api/src/routes/audit.ts`
**Base path:** `/api/v1/hackathons/:slug/audit`
**Auth:** Requires organizer role or higher

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List audit events with cursor-based pagination |

**Query parameters:**
- `limit` (1-100, default 20)
- `cursor` (sequence number for pagination)
- `action` (filter by action type)
- `entity_type` (filter by entity type)
- `entity_id` (filter by specific entity)
- `actor_id` (filter by actor)

**Response:** Cursor-paginated with `next_cursor` and `has_more`. JSON fields (`details`, `changes`) are parsed before returning.

### 4.6 Audit Maintenance

The `backfillAuditHashes()` function processes unhashed events in batches of 100:
1. Select events where `hash IS NULL`, ordered by sequence
2. For each event, find the previous hash in its hackathon chain
3. Compute and store the SHA-256 hash + `prev_hash`
4. Return count of processed events

This runs:
- **Automatically:** Every hour via the cron handler
- **Manually:** Via `POST /api/v1/admin/audit/backfill` (admin dashboard button)

---

## 5. Deletion Requests & GDPR

### 5.1 Deletion Requests Table

```
deletion_requests
├─ id                   (text PK)
├─ user_id              (text NOT NULL) → FK: users.id (CASCADE)
├─ confirmation_token   (text NOT NULL, UNIQUE)
├─ status               (text NOT NULL, default: 'pending')
├─ created_at           (text NOT NULL, auto-timestamp)
└─ confirmed_at         (text)

Indexes:
├─ deletion_requests_confirmation_token_unique ON (confirmation_token)
└─ idx_deletion_requests_user ON (user_id)
```

### 5.2 Request Lifecycle

1. **Request:** User initiates deletion → generates `confirmation_token` → status: `pending`
2. **Confirmation:** User confirms via token → status updated, `confirmed_at` set
3. **Execution:** System processes the deletion

### 5.3 Known Issues

> ⚠️ **CRITICAL DEBT ITEM:** Account deletion does not cascade properly. Orphaned data remains in 15+ tables (teams, submissions, scores, audit events, notifications, etc.). This is a GDPR compliance risk.
>
> **Impact:** User data persists in `team_members`, `submissions`, `scores`, `judge_assignments`, `organizer_roles`, `workspace_members`, `audit_events`, `in_app_notifications`, `notification_deliveries`, and more.
>
> **Required fix:** Implement comprehensive cascading delete or anonymization across all foreign-key references.

---

## 6. Notification System

### 6.1 Architecture

Notifications flow through a Cloudflare Queue (`NOTIFICATION_QUEUE`) with dual delivery:

```
API Route → Queue Message → notification-handler.ts
                                ├─ In-app notification (D1)
                                └─ Email notification (SMTP)
```

### 6.2 Notification Types

| Type | Recipients | Trigger |
|------|-----------|---------|
| `judge.invited` | Judge user | Judge invite created |
| `submission.received` | Team members | New submission tag detected |
| `submission.validated` | Team members | Submission passes validation |
| `submission.tag_deleted` | Team members | Submission tag removed |
| `hackathon.judging_started` | All participants | Phase transition to judging |
| `force_push_detected` | Team members | Force push to linked repo |
| `team_joined` | Team members | New member joins team |
| `deadline_reminder` | All participants | 24h and 1h before deadline |
| `results.published` | All users | Results made public |
| `hackathon.request.submitted` | Platform admins | New hackathon request |
| `hackathon.request.approved` | Requester | Request approved |
| `hackathon.request.rejected` | Requester | Request rejected |
| `hackathon.request.changes_requested` | Requester | Changes needed |

### 6.3 Delivery Pipeline

1. **Idempotency check** — `notification_idempotency` table prevents duplicate processing
2. **Recipient resolution** — dynamic based on notification type (team members, all participants, admins, etc.)
3. **In-app creation** — inserted into `in_app_notifications` table
4. **Email delivery** — HTML templates with DevSage dark theme branding; delivery status tracked in `notification_deliveries` table
5. **Failure handling** — email failures mark delivery as `failed` but don't block idempotency (fail-open)

### 6.4 Email Infrastructure

- **SMTP client:** Custom RFC 5321/2822 implementation for Cloudflare Workers (no Node.js `net` module available)
- **TLS support:** Direct TLS (port 465) and STARTTLS (port 587)
- **Auto-retry:** Falls back to alternate port (465↔587) on primary failure
- **Timeout:** 15 seconds per attempt
- **Templates:** Dark-themed HTML with `#CCFF00` accents; judge invites get special CTA-button emails

### 6.5 Notification API

**Base path:** `/api/v1/notifications`
**Auth:** `authMiddleware` (any authenticated user)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List notifications (paginated, optional `hackathon_id` filter) |
| `GET` | `/unread-count` | Get unread notification count |
| `PATCH` | `/:notificationId/read` | Mark single notification as read |
| `PATCH` | `/read-all` | Mark all notifications as read |

---

## 7. Stats & Analytics

### 7.1 Platform-Level Stats (Admin)

**Endpoint:** `GET /api/v1/admin/stats`
**Auth:** Platform admin only

Returns aggregate counts across the entire platform:

```json
{
  "users": 1234,
  "hackathons": 56,
  "teams": 789,
  "submissions": 432
}
```

These are simple `COUNT(*)` queries against the respective tables.

### 7.2 Hackathon Request Stats (Admin)

**Endpoint:** `GET /api/v1/hackathon-requests/admin/stats`
**Auth:** Platform admin only

Returns counts per request status:

```json
{
  "total": 42,
  "submitted": 5,
  "under_review": 3,
  "approved": 8,
  "building": 2,
  "ready": 18,
  "rejected": 4,
  "changes_requested": 2
}
```

### 7.3 Per-Hackathon Metrics (Platform)

**Endpoint:** `GET /api/v1/hackathons/:slug/metrics`
**Auth:** Organizer or higher

Returns hackathon-specific metrics: team count, submission count, judge count.

### 7.4 Leaderboard Computation

**Service:** `apps/api/src/services/judging-service.ts`

Scoring algorithm:
1. **Per-judge score:** `SUM(score / max_score × weight × 100)` for each rubric criterion
2. **Cross-judge average:** Mean of all judge totals per team
3. **Ranking:** Ordered by total_score DESC
4. Optional filtering by `round_id` and `track_id`

### 7.5 Analytics Gap

> ⚠️ **DEBT ITEM (GAP-6):** The `apps/platform` analytics page (`/hackathons/:slug/analytics`) currently displays **fabricated/mock data**. There is no backend API for real analytics. This is shown to production users.
>
> **Required:** Build analytics aggregation endpoints and replace placeholder data.

---

## 8. Hackathon Request Pipeline

### 8.1 Overview

Before a hackathon exists, an organizer submits a **hackathon request** through the platform. Platform admins review and process these requests through a multi-stage pipeline.

### 8.2 Request Schema

```
hackathon_requests
├─ id                    (text PK)
├─ workspace_id          (text NOT NULL) → FK: workspaces.id (CASCADE)
├─ requested_by          (text NOT NULL) → FK: users.id (CASCADE)
├─ title                 (text NOT NULL)
├─ description           (text)
├─ starts_at             (text)
├─ ends_at               (text)
├─ num_events            (integer)
├─ expected_participants (integer)
├─ team_min_size         (integer)
├─ team_max_size         (integer)
├─ additional_details    (text)
├─ hackathon_id          (text)          — linked hackathon once created
├─ status                (text NOT NULL, default: 'submitted')
├─ admin_notes           (text)
├─ status_history        (text NOT NULL, default: '[]')  — JSON array of transitions
├─ created_at            (text NOT NULL, auto-timestamp)
└─ updated_at            (text NOT NULL, auto-timestamp)

Indexes:
├─ idx_hackathon_requests_workspace    ON (workspace_id)
├─ idx_hackathon_requests_status       ON (status)
└─ idx_hackathon_requests_requested_by ON (requested_by)
```

### 8.3 Status Pipeline

```
submitted → under_review → approved → building → ready
                │                         │
                ├─→ rejected              └─→ (hackathon auto-created)
                └─→ changes_requested → (resubmit) → submitted
```

**Key transitions:**
- **submitted → under_review:** Admin starts reviewing
- **under_review → approved:** Admin approves the request
- **under_review → rejected:** Admin rejects with notes
- **under_review → changes_requested:** Admin requests modifications
- **changes_requested → submitted:** Organizer resubmits via `PUT /:id/resubmit`
- **approved → building:** Admin begins hackathon site setup
- **building → ready:** Auto-creates the hackathon record in D1 (generates slug, assigns requester as organizer, links `hackathon_id`)

Each transition:
1. Updates status + `updated_at`
2. Appends to `status_history` JSON array (with timestamp + optional notes)
3. Sends notification via `NOTIFICATION_QUEUE`

### 8.4 API Routes

**File:** `apps/api/src/routes/hackathon-requests.ts`

#### Organizer Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/` | Create new request | Workspace member |
| `GET` | `/` | List user's requests (paginated) | Authenticated user |
| `GET` | `/:id` | Get single request | Request owner |
| `PUT` | `/:id/resubmit` | Resubmit after changes_requested | Request owner |

#### Admin Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/admin/all` | List all requests with status filter (paginated) | Platform admin |
| `PATCH` | `/admin/:id` | Update request status (`{ status, admin_notes? }`) | Platform admin |
| `GET` | `/admin/stats` | Count by status | Platform admin |

### 8.5 Admin UI for Requests

The `HackathonRequestsPage` in `apps/admin` is the most complex admin page:

- **Stats bar:** 6 status count cards
- **Filter tabs:** All + per-status with counts
- **Expandable cards** per request showing:
  - Requester info (name, email)
  - Workspace context (name, slug)
  - Dates, event count, description, additional details
  - **Visual progress stepper:** Submitted → Under Review → Approved → Building → Ready (with checkmarks for completed stages; rejected/changes_requested as side branches)
  - **Status history timeline:** Each transition with timestamp + optional admin notes
  - **Status update form:** Textarea for admin notes + action buttons:
    - "Next Action" (green) — advances to next pipeline step
    - "Reject" (red) — moves to rejected
    - "Request Changes" (orange) — only for submitted/under_review
  - **Deploy command** (for approved/building states): CLI command with copy button + base64 config alternative

---

## 9. Role Resolution Architecture

### 9.1 Overview

DevSage uses a 6-tier per-hackathon role hierarchy, resolved per-request (never stored in JWT):

```
organizer > co_organizer > judge > team_lead > team_member > anonymous
```

### 9.2 Resolution Logic

**File:** `apps/api/src/middleware/role.ts`

The `resolveRole()` function executes a single UNION ALL query with 7 priority levels:

| Priority | Source Table | Resolved Role |
|----------|------------|---------------|
| 1 | `organizer_roles` (role = organizer) | `organizer` |
| 2 | `organizer_roles` (role = co_organizer) | `co_organizer` |
| 3 | `judges` (status = accepted) | `judge` |
| 4 | `team_members` (role = leader) | `team_lead` |
| 5 | `team_members` (role = member) | `team_member` |
| 6 | `workspace_members` (role = owner/admin) | `organizer` (implicit) |
| 7 | `workspace_members` (role = member) | `co_organizer` (implicit) |

The highest-priority match wins. Results are cached in KV for 60 seconds.

### 9.3 Middleware

Two middleware functions consume the resolved role:

- **`requireRole(minRole)`** — Hierarchical check. If the user's resolved role is at or above `minRole` in the hierarchy, access is granted. Returns 403 otherwise.
- **`requireExactRole(...roles)`** — Strict match. Only the specified roles pass (e.g., only `judge` can submit scores).

### 9.4 Platform Admin vs Hackathon Roles

These are independent systems:
- **Platform admin:** Checked via `requirePlatformAdmin` against `platform_admins` table. Grants access to `shikdd.devsage.org` and `/api/v1/admin/*` routes.
- **Hackathon roles:** Checked via `requireRole()` against multiple tables per hackathon. Grants access to hackathon-scoped routes.

A platform admin is **not** automatically an organizer of any hackathon. They have their own separate routes.

---

## 10. Known Issues & Future Plans

### 10.1 Critical Issues

| ID | Issue | Impact | Location |
|----|-------|--------|----------|
| **DEBT-GDPR** | Account deletion doesn't cascade — orphaned data in 15+ tables | GDPR non-compliance risk | `deletion_requests` + all FK tables |
| **GAP-6** | Analytics page shows fabricated data to production users | User trust, misleading metrics | `apps/platform/src/pages/analytics.tsx` |
| **DEBT-1** | GitHub App JWT signing not implemented — `getInstallationToken()` is a stub | GitHub API integration broken | `apps/api/src/services/github.ts` |
| **DEBT-2** | Hackathon template application incomplete — templates exist in DB but don't copy rounds/rubric | Template feature non-functional | Template → hackathon creation flow |

### 10.2 Medium-Priority Gaps

| ID | Issue | Impact |
|----|-------|--------|
| **GAP-4** | No judging window enforcement (`scoring_opens_at`/`scoring_closes_at` missing) | Judges can score at any time |
| **GAP-5** | No judge guidelines/instructions endpoint or UI | Judges lack context for scoring |
| **DEBT-3** | Debug `console.log` in production code | `apps/platform/src/pages/announcements.tsx` lines 53, 72 |
| **DEBT-TESTS** | Zero test files across all 4 frontend apps | No regression safety for UI |
| **AUTH-TESTS** | `auth.ts` (19 endpoints) has no test coverage | Security-critical code untested |

### 10.3 Low-Priority Items

| ID | Issue |
|----|-------|
| **GAP-7** | Eliminated team notifications — teams eliminated but no notification or UI indicator |
| **GAP-8** | Per-round submission tag patterns — all rounds share one pattern |
| **DEBT-8** | GitHub private repo validation missing during team linking |
| **DEBT-9** | Late submission flagging — no visual indicator in UI |
| **DEBT-10** | Settings page sparse — missing email restrictions, timezone, registration mode toggles |
| **DEBT-11** | Announcements edit/delete flows need QA verification |

### 10.4 Infrastructure Debt

| Issue | Impact |
|-------|--------|
| Deploy workflow has zero quality gates | No test/lint/typecheck before production deploy |
| `@devsage/shared` Zod schemas have zero imports | Package is effectively dead code |
| `@devsage/db` Drizzle ORM unused — API uses 268 raw SQL queries | Schema definitions exist but ORM isn't leveraged |
| No Zod validation on any API route — all input uses unsafe `as string` casts | Input validation gap |
| 6 DB queries per authenticated request in auth middleware | Performance concern under load |

### 10.5 Future Plans

1. **Real analytics backend** — Replace mock data with aggregation endpoints (team growth over time, submission timeline, judge progress tracking)
2. **Billing & subscription system** — Completely absent (no DB tables, API, or UI). Required for monetization
3. **TOTP-based 2FA** — DB schema exists but no API endpoints for 2FA setup/verify
4. **Hackathon registration on branded sites** — Currently "coming soon" placeholder; participants cannot self-register
5. **E2E testing** — No Playwright/Cypress tests for cross-app flows
6. **Comprehensive GDPR compliance** — Cascading delete/anonymization for all user data

---

## Appendix A: Database Tables Referenced

| Table | Section | Purpose |
|-------|---------|---------|
| `platform_admins` | §2.1 | Platform admin membership |
| `platform_invites` | §2.3 | Organizer onboarding invites |
| `users` | §2.3, §9 | User accounts (email, OAuth, avatar) |
| `workspaces` | §2.3, §3.1 | Organization containers (club/college/company/community) |
| `workspace_members` | §2.3, §9.2 | Workspace membership + role |
| `workspace_invites` | §2.3 | Workspace join invites |
| `hackathons` | §2.3, §3.2 | Hackathon records (5-state lifecycle) |
| `hackathon_rounds` | §2.3, §3.2 | Competition rounds |
| `hackathon_requests` | §8.2 | Hackathon creation pipeline |
| `organizer_roles` | §3.1, §9.2 | Per-hackathon organizer/co-organizer assignments |
| `teams` | §3.2 | Hackathon teams |
| `team_members` | §3.2, §9.2 | Team membership + role (leader/member) |
| `judges` | §3.2, §9.2 | Judge invitations + acceptance |
| `submissions` | §3.2 | Git-tag-based submissions |
| `rubric_criteria` | §3.2 | Scoring rubric definitions |
| `scores` | §3.2 | Judge scores per submission per criterion |
| `audit_events` | §4.1 | Immutable audit trail with hash chain |
| `deletion_requests` | §5.1 | GDPR data deletion requests |
| `in_app_notifications` | §6.2 | User notifications |
| `notification_deliveries` | §6.3 | Email delivery tracking |
| `notification_idempotency` | §6.3 | Deduplication for queue processing |
| `announcements` | §3.2 | Hackathon announcements |

## Appendix B: API Route Summary

### Admin Routes (`/api/v1/admin/*`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/users` | List all users |
| `GET` | `/hackathons` | List all hackathons |
| `GET` | `/hackathons/:id` | Get hackathon detail |
| `GET` | `/hackathons/:id/rounds` | List hackathon rounds |
| `PATCH` | `/hackathons/:id/rounds/:rid/initialize` | Toggle round init |
| `GET` | `/admins` | List platform admins |
| `POST` | `/admins` | Add platform admin |
| `DELETE` | `/admins/:userId` | Remove platform admin |
| `GET` | `/invites` | List platform invites |
| `POST` | `/invites` | Create platform invite |
| `DELETE` | `/invites/:id` | Revoke invite |
| `GET` | `/workspaces` | List all workspaces |
| `POST` | `/workspaces` | Create workspace |
| `GET` | `/workspaces/:id` | Get workspace detail |
| `POST` | `/audit/backfill` | Backfill audit hashes |
| `GET` | `/stats` | Platform stats |

### Hackathon Request Routes (`/api/v1/hackathon-requests/*`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/` | Create request |
| `GET` | `/` | List user's requests |
| `GET` | `/:id` | Get request |
| `PUT` | `/:id/resubmit` | Resubmit request |
| `GET` | `/admin/all` | List all requests (admin) |
| `PATCH` | `/admin/:id` | Update request status (admin) |
| `GET` | `/admin/stats` | Request stats (admin) |
