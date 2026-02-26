# Hackathon Management & Lifecycle

> **Scope:** End-to-end reference for the hackathon entity in DevSage — data model, state machine, CRUD operations, roles, rounds, templates, deadline automation, and platform UI.
> **Audience:** Any engineer, PM, or contributor who needs to understand how hackathons work without reading source code.
> **Last updated:** 2025-07-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [Hackathon Data Model](#2-hackathon-data-model)
3. [State Machine](#3-state-machine)
4. [Hackathon CRUD](#4-hackathon-crud)
5. [Organizer Roles](#5-organizer-roles)
6. [Rounds](#6-rounds)
7. [Templates](#7-templates)
8. [Settings & Configuration](#8-settings--configuration)
9. [Deadline Automation](#9-deadline-automation)
10. [Platform UI](#10-platform-ui)
11. [Known Issues & Future Plans](#11-known-issues--future-plans)

---

## 1. Overview

A **hackathon** is the central entity in DevSage. It represents a time-boxed coding event managed by organizers, participated in by teams, and evaluated by judges. Every hackathon belongs to a **workspace** (the organizing group) and follows a strict five-state lifecycle from creation to archival.

**Key concepts:**

- **Lifecycle:** Every hackathon progresses through `draft → active → judging → completed → archived`. Transitions are forward-only (one exception: un-archive).
- **Slug-based addressing:** All API routes reference hackathons by their unique slug (`/api/v1/hackathons/:slug/...`), not by UUID.
- **Durable Object (DO):** The canonical state lives in a Cloudflare Durable Object (`HackathonStateMachine`), synced to D1 for query purposes.
- **Role-per-hackathon:** Permissions are resolved per-request against the specific hackathon — never stored in the JWT.

---

## 2. Hackathon Data Model

**Table:** `hackathons` (D1 / SQLite via Drizzle ORM)

### 2.1 Identity & Ownership

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT (PK) | ✅ | — | UUID (`crypto.randomUUID()`) |
| `workspace_id` | TEXT (FK → `workspaces`) | ✅ | — | The workspace that owns this hackathon |
| `slug` | TEXT (UNIQUE) | ✅ | — | URL-safe identifier (`/^[a-z0-9-]+$/`). Immutable after creation |
| `title` | TEXT | ✅ | — | Display name (max 200 chars) |
| `tagline` | TEXT | ❌ | NULL | Short description (max 300 chars) |
| `description` | TEXT | ❌ | NULL | Long-form description (max 5000 chars) |
| `rules_md` | TEXT | ❌ | NULL | Markdown rules document |
| `created_by` | TEXT (FK → `users`) | ✅ | — | User who created the hackathon |
| `template_id` | TEXT (FK → `hackathon_templates`) | ❌ | NULL | Template used during creation |

### 2.2 Lifecycle & Scheduling

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `status` | TEXT | ✅ | `'draft'` | Current lifecycle state (see §3) |
| `starts_at` | TEXT | ❌ | NULL | ISO-8601 UTC kickoff timestamp |
| `judging_starts` | TEXT | ❌ | NULL | ISO-8601 UTC judging start |
| `judging_ends` | TEXT | ❌ | NULL | ISO-8601 UTC judging end |
| `timezone` | TEXT | ✅ | `'UTC'` | Display timezone for organizer UI |

### 2.3 Team & Registration Configuration

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `min_team_size` | INTEGER | ✅ | `1` | Minimum members per team |
| `max_team_size` | INTEGER | ✅ | `5` | Maximum members per team (hard cap: 50) |
| `max_teams` | INTEGER | ❌ | NULL | Team cap (NULL = unlimited) |
| `registration_mode` | TEXT | ✅ | `'open'` | One of: `open`, `invite_only`, `approval` |
| `allowed_email_domains` | TEXT | ✅ | `'[]'` | JSON array of allowed domains for registration |
| `allow_registration_during_active` | INTEGER | ✅ | `0` | Boolean (0/1): allow sign-ups after hackathon starts |

### 2.4 Submission Settings

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `submission_tag_pattern` | TEXT | ✅ | `'submission_v%'` | Git tag glob for detecting submissions |
| `allow_resubmission` | INTEGER | ✅ | `0` | Boolean: whether teams can submit more than once |
| `require_repo` | INTEGER | ✅ | `1` | Boolean: GitHub repo required for participation |

### 2.5 Judging & Visibility

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `notify_all_on_deadline` | INTEGER | ✅ | `0` | Boolean: broadcast notification when deadline passes |
| `show_judge_comments_to_participants` | INTEGER | ✅ | `0` | Boolean: visibility of judge feedback |

### 2.6 JSON Fields (stored as TEXT)

| Column | Default | Description |
|--------|---------|-------------|
| `tracks` | `'[]'` | JSON array of track definitions (name, description, constraints) |
| `prizes` | `'[]'` | JSON array of prize tiers and details |
| `settings` | `'{}'` | JSON object for extensible key-value configuration |

### 2.7 Timestamps

| Column | Type | Default |
|--------|------|---------|
| `created_at` | TEXT | `strftime('%Y-%m-%dT%H:%M:%fZ','now')` |
| `updated_at` | TEXT | `strftime('%Y-%m-%dT%H:%M:%fZ','now')` |

### 2.8 Indexes

| Index | Columns | Notes |
|-------|---------|-------|
| `hackathons_slug_unique` | `slug` | Enforced unique |
| `idx_hackathons_workspace` | `workspace_id` | Fast workspace listing |
| `idx_hackathons_status` | `status` | Status-based filtering |

---

## 3. State Machine

### 3.1 States

| State | Meaning | What's Allowed |
|-------|---------|----------------|
| **`draft`** | Hackathon is being configured. Not visible to participants | Edit all fields, delete, add tracks/rounds/judges |
| **`active`** | Hackathon is live. Teams can register and submit | Registration (if configured), submissions accepted, limited field edits |
| **`judging`** | Submission window closed. Judges score entries | Submissions locked, judge scoring enabled, no new registrations |
| **`completed`** | Judging finished. Results finalized and visible | Leaderboard visible, results published, read-only |
| **`archived`** | Event fully concluded and archived | Read-only. Can un-archive back to `completed` for score corrections |

### 3.2 Transitions

```
draft ──────► active ──────► judging ──────► completed ──────► archived
                                                  ▲                │
                                                  └────────────────┘
                                                   (un-archive only)
```

**Transition map** (source: `VALID_TRANSITIONS` in `lib/constants.ts`):

| From | To | Trigger | Who Can Trigger | What Happens |
|------|----|---------|-----------------|--------------|
| `draft` | `active` | Manual ("Launch Hackathon") | `organizer` only | Hackathon goes live; alarm set for submission deadline; registration opens |
| `active` | `judging` | Manual or automatic (deadline) | `organizer` or cron/alarm | Submissions locked in DO; judge scoring enabled; notification `hackathon.judging_started` sent |
| `judging` | `completed` | Manual ("Finalize Event") | `organizer` only | Results frozen; leaderboard published |
| `completed` | `archived` | Manual ("Archive") | `organizer` only | Event moved to archived state for long-term storage |
| `archived` | `completed` | Manual (un-archive) | `organizer` only | Re-opens for score corrections only; single exception to forward-only rule |

**On transition:**

1. **Optimistic locking:** Every transition includes a `version` number. The DO checks the stored version matches the requested version before proceeding. `version: -1` bypasses the check (used by cron/alarm).
2. **D1 sync:** After the DO transition succeeds, the API route updates the `hackathons.status` column in D1.
3. **Audit trail:** Every transition creates an audit event with `old_status` and `new_status`.

### 3.3 Durable Object: `HackathonStateMachine`

The DO is the **source of truth** for hackathon state. D1 is a read-optimized copy synced after transitions.

**Binding:** `HACKATHON_SM` (configured in `wrangler.jsonc`)
**Storage:** SQLite-backed (`new_sqlite_classes` migration tag `v2`)
**Re-export:** Must be re-exported from `apps/api/src/index.ts` or wrangler deploy fails.

#### SQLite Schema (inside the DO)

```sql
CREATE TABLE lifecycle_state (
  hackathon_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE submission_locks (
  submission_key TEXT PRIMARY KEY,   -- "{team_id}:{tag_name}"
  submission_id TEXT NOT NULL,
  locked_at TEXT NOT NULL
);

CREATE TABLE team_submissions (
  team_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
```

#### HTTP Interface (internal, called by the API Worker)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/initialize` | Idempotent init. Creates `lifecycle_state` row with `draft` (or specified status). Sets alarm if `active` + deadline exists |
| `POST` | `/transition` | Validates transition against `VALID_TRANSITIONS`, checks version, increments version, manages alarms |
| `GET` | `/state` | Returns `{ status, version, updated_at }` |
| `POST` | `/accept-submission` | Atomic submission lock. Returns `{ accepted: true/false }` |

#### Alarm Mechanism

- **Set:** When transitioning to `active` and a `submission_deadline` exists, `ctx.storage.setAlarm(deadlineMs)` schedules auto-transition.
- **Cleared:** When leaving `active` state, `ctx.storage.deleteAlarm()` cancels any pending alarm.
- **Fired:** When alarm triggers at the deadline, the DO automatically transitions `active → judging`, syncs D1, and enqueues a `hackathon.judging_started` notification.

#### Submission Locking

When a team submits (via `POST /accept-submission`):

1. Checks hackathon status is `active` (rejects otherwise).
2. Builds `submission_key = "{team_id}:{tag_name}"`.
3. Uses `INSERT OR IGNORE` into `submission_locks` — first write wins.
4. If `rowsWritten === 0`, submission is a duplicate → returns `{ accepted: false }`.
5. On success, increments `team_submissions.count` for the team.

#### State Reconciliation

`GET /hackathons/:slug/state` (requires `co_organizer` role) returns both the DO state and the D1 state. If they diverge, the DO is authoritative and D1 is synced.

---

## 4. Hackathon CRUD

### 4.1 Create

**Endpoints:**
- `POST /api/v1/hackathons` — workspace_id in request body
- `POST /api/v1/workspaces/:workspaceId/hackathons` — legacy path-param variant (same handler)

**Required fields:** `title`, `slug`, `workspace_id`

**Optional fields:** `tagline`, `description`, `rules_md`, `starts_at`, `judging_starts`, `judging_ends`, `max_team_size`, `min_team_size`, `max_teams`, `registration_mode`, `timezone`, `template_id`, `tracks`, `prizes`, `settings`, `submission_tag_pattern`, `allow_resubmission`, `require_repo`, `allowed_email_domains`, `allow_registration_during_active`, `notify_all_on_deadline`, `show_judge_comments_to_participants`

**Authorization:** Caller must be the workspace **owner** or **admin** (checked against `workspace_members` table).

**Flow:**

1. Validate input (camelCase and snake_case both accepted).
2. Check slug uniqueness (409 `SLUG_TAKEN` if duplicate).
3. If `template_id` is provided, query template and apply `settings` and `tracks` from it. ⚠️ Rounds and rubric are **not applied** (known debt — see §11).
4. Insert into `hackathons` table with status `draft`.
5. Create `organizer_roles` entry granting the creator the `organizer` role.
6. Initialize the `HackathonStateMachine` Durable Object (idempotent `POST /initialize`).
7. Log audit event: `hackathon.created`.
8. Return the created hackathon in the standard response envelope.

### 4.2 Read

#### Get by Slug

**Endpoint:** `GET /api/v1/hackathons/:slug`
**Auth:** Public (no auth required).
**Caching:** ETag-based conditional GET. Returns `304 Not Modified` if `If-None-Match` matches. Cache headers: `max-age=10, stale-while-revalidate=30`.

#### List Hackathons

**Endpoint:** `GET /api/v1/hackathons`
**Auth:** Public.
**Query params:**
- `limit` (1–100, default 20)
- `offset` (default 0)
- `status` — filter by lifecycle state

**Response:** `{ ok: true, data: [...], meta: { total, limit, offset, has_more } }`

### 4.3 Update

**Endpoint:** `PATCH /api/v1/hackathons/:slug`
**Auth:** Requires `co_organizer` role or higher.

**Allowed fields (19 total):**

`title`, `tagline`, `description`, `rules_md`, `starts_at`, `judging_starts`, `judging_ends`, `max_team_size`, `min_team_size`, `max_teams`, `registration_mode`, `timezone`, `tracks`, `prizes`, `settings`, `submission_tag_pattern`, `allow_resubmission`, `require_repo`, `allowed_email_domains`

**Note:** `slug` and `workspace_id` are **immutable** after creation. `status` changes go through the transition endpoint (§3.2).

JSON fields (`tracks`, `prizes`, `settings`) are stringified before storage.

### 4.4 Delete

**Endpoint:** `DELETE /api/v1/hackathons/:slug`
**Auth:** Requires `organizer` role.
**Constraint:** Status **must be `draft`**. Non-draft hackathons cannot be deleted.

**Type: Hard delete.** The hackathon row is permanently removed from D1. All dependent data is cascade-deleted:

| Cascade-deleted table | Relation |
|-----------------------|----------|
| `organizer_roles` | FK → hackathons (ON DELETE CASCADE) |
| `judges` | FK → hackathons (ON DELETE CASCADE) |
| `teams` | FK → hackathons (ON DELETE CASCADE) |
| `hackathon_rounds` | FK → hackathons (ON DELETE CASCADE) |
| `hackathon_tracks` | FK → hackathons (ON DELETE CASCADE) |
| `round_results` | FK → hackathons (ON DELETE CASCADE) |

**Audit:** `hackathon.deleted` event logged before deletion.

> ⚠️ **No soft-delete.** There is no `is_deleted` or `deleted_at` column. Accidental deletion of a draft is permanent.

---

## 5. Organizer Roles

### 5.1 Role Hierarchy

DevSage uses a 6-tier per-hackathon role system. Roles are resolved **per-request** via `resolveRole()` — never stored in the JWT.

| Role | Priority | Scope |
|------|----------|-------|
| `organizer` | 1 (highest) | Full control — create, transition, delete, manage team |
| `co_organizer` | 2 | Edit hackathon, manage teams and judges, view everything |
| `judge` | 3 | Score submissions, view teams and submissions |
| `leader` | 4 | Team lead — manage team, submit |
| `member` | 5 | Team member — view team, submit |
| `anonymous` | 6 (lowest) | Public access only |

### 5.2 Resolution Logic

`resolveRole()` executes a single `UNION ALL` SQL query with priority ordering:

1. Check `organizer_roles` table for `organizer` (priority 1) or `co_organizer` (priority 2)
2. Check `judges` table for accepted judges (priority 3)
3. Check `team_members` + `teams` for team lead (priority 4) or member (priority 5)
4. Check `workspace_members` for workspace-level fallback: owner/admin → `organizer`, member → `co_organizer` (priority 6–7)
5. Default: `anonymous` (priority 8)

Result is cached in KV with a **60-second TTL** (`ROLE_CACHE`).

### 5.3 Organizer Roles Table

**Table:** `organizer_roles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID |
| `hackathon_id` | TEXT (FK → hackathons) | Target hackathon |
| `user_id` | TEXT (FK → users) | Assigned user |
| `role` | TEXT | `'organizer'` or `'co_organizer'` |
| `invited_by` | TEXT (FK → users, nullable) | Who assigned this role |
| `created_at` | TEXT | Timestamp |

**Unique constraint:** `(hackathon_id, user_id)` — one role per user per hackathon.

### 5.4 Middleware

- **`requireRole(minRole)`** — hierarchy check: user's resolved role priority must be ≤ `minRole` priority.
- **`requireExactRole(role)`** — strict match: used for judge-only endpoints.
- **`requirePlatformAdmin`** — separate layer for `shikdd.devsage.org` admin panel (checks `platform_admins` table).

---

## 6. Rounds

### 6.1 Overview

Hackathons support **multiple rounds** for staged competition (e.g., qualifying → semifinals → finals). Each round has its own submission deadline and can be managed independently.

### 6.2 Round Schema

**Table:** `hackathon_rounds`

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT (PK) | ✅ | — | UUID |
| `hackathon_id` | TEXT (FK → hackathons) | ✅ | — | Parent hackathon (CASCADE delete) |
| `round_number` | INTEGER | ✅ | — | Sequential order (1-indexed) |
| `name` | TEXT | ✅ | — | Display name (max 200 chars) |
| `type` | TEXT | ✅ | `'standard'` | Round type |
| `status` | TEXT | ✅ | `'pending'` | Round status |
| `submission_deadline` | TEXT | ❌ | NULL | ISO-8601 deadline for this round |
| `started_at` | TEXT | ❌ | NULL | When the round began |
| `completed_at` | TEXT | ❌ | NULL | When the round finished |
| `is_initialized` | INTEGER | ✅ | `0` | Boolean: whether round has been set up |
| `created_at` | TEXT | ✅ | Auto | Timestamp |
| `updated_at` | TEXT | ✅ | Auto | Timestamp |

**Indexes:**
- `(hackathon_id, round_number)` — UNIQUE, ensures sequential ordering
- `(hackathon_id, status)` — efficient status-based queries

### 6.3 Round Results

**Table:** `round_results`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID |
| `hackathon_id` | TEXT (FK) | Parent hackathon |
| `round_id` | TEXT (FK → hackathon_rounds) | Which round |
| `team_id` | TEXT (FK → teams) | Evaluated team |
| `status` | TEXT | Result status (e.g., `advanced`, `eliminated`) |
| `rank` | INTEGER (nullable) | Team's rank in this round |
| `total_score` | REAL (nullable) | Aggregate score |
| `decided_by` | TEXT (FK → users, nullable) | Organizer who finalized |
| `created_at` | TEXT | Timestamp |

**Unique constraint:** `(round_id, team_id)` — one result per team per round.

### 6.4 Zod Schemas

```typescript
createRoundSchema: {
  name: string        // min 1, max 200
  description: string // max 2000, optional
  round_number: number // int, min 1
  submission_deadline: string // ISO datetime, optional
  is_elimination: boolean    // default: false
  sort_order: number         // int, default: 0
}

updateRoundSchema: // partial of createRoundSchema
```

---

## 7. Templates

### 7.1 Overview

Hackathon templates allow organizers to save and reuse configurations. Templates store settings, tracks, rounds, and rubric definitions.

### 7.2 Template Schema

**Table:** `hackathon_templates`

| Column | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | TEXT (PK) | ✅ | — | UUID |
| `workspace_id` | TEXT (FK → workspaces, nullable) | ❌ | NULL | Workspace-specific (NULL = platform-level) |
| `name` | TEXT | ✅ | — | Template name (max 200 chars) |
| `description` | TEXT | ❌ | NULL | Description (max 2000 chars) |
| `settings` | TEXT | ✅ | `'{}'` | JSON: team sizes, registration mode, etc. |
| `tracks` | TEXT | ✅ | `'[]'` | JSON array of track definitions |
| `rounds` | TEXT | ✅ | `'[]'` | JSON array of round configurations |
| `rubric` | TEXT | ✅ | `'[]'` | JSON array of scoring criteria |
| `is_platform_default` | INTEGER | ✅ | `0` | Boolean: platform-wide default template |
| `created_by` | TEXT (FK → users, nullable) | ❌ | NULL | Creator |
| `created_at` | TEXT | ✅ | Auto | Timestamp |
| `updated_at` | TEXT | ✅ | Auto | Timestamp |

### 7.3 Template Application

When a hackathon is created with a `template_id`:

1. The template is fetched from `hackathon_templates`.
2. `settings` JSON is applied to the hackathon's `settings` field.
3. `tracks` JSON is applied to the hackathon's `tracks` field.
4. ⚠️ **`rounds` and `rubric` are NOT applied** — the code queries them but does not copy them to the hackathon (see §11, DEBT-2).

### 7.4 Template CRUD

> ⚠️ **No template management API endpoints exist.** The `hackathon_templates` table has a schema and Zod schemas (`createTemplateSchema`, `updateTemplateSchema`), but no route file has been created. Templates must currently be managed via direct database access.

**Zod schemas (defined but not wired):**

```typescript
createTemplateSchema: {
  name: string             // min 1, max 200
  description: string      // max 2000, optional
  settings: Record         // default: {}
  tracks: Array<Record>    // default: []
  rounds: Array<Record>    // default: []
  rubric: Array<Record>    // default: []
  is_platform_default: boolean // default: false
}
```

---

## 8. Settings & Configuration

### 8.1 Registration Mode

| Mode | Behavior |
|------|----------|
| `open` | Anyone can register (default) |
| `invite_only` | Only users with a valid invite code can register |
| `approval` | Users request to join; organizer must approve |

### 8.2 Team Size Constraints

- `min_team_size` (default: 1) — minimum required members before a team can submit.
- `max_team_size` (default: 5, hard cap: 50) — maximum members per team.
- `max_teams` (default: NULL / unlimited) — cap on total registered teams.

### 8.3 Submission Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `submission_tag_pattern` | `'submission_v%'` | Git tag glob pattern that identifies a submission |
| `allow_resubmission` | `0` (false) | Whether teams can submit multiple times |
| `require_repo` | `1` (true) | Whether a GitHub repository is required |

### 8.4 Judging Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `show_judge_comments_to_participants` | `0` (false) | Whether participants can see judge feedback |
| `notify_all_on_deadline` | `0` (false) | Broadcast notification when deadline passes |

### 8.5 Email Domain Restrictions

`allowed_email_domains` stores a JSON array of permitted email domains (e.g., `["@university.edu", "@company.com"]`). When non-empty, only users with matching email domains can register. An empty array (`'[]'`) means no restriction.

### 8.6 Timezone

The `timezone` field (default: `'UTC'`) is used for **display purposes** in the organizer dashboard. All internal timestamps remain UTC ISO-8601. The platform UI converts UTC dates to the hackathon's timezone for organizer-facing views.

### 8.7 Extensible Settings

The `settings` JSON field is a catch-all for additional configuration that doesn't have dedicated columns. This allows features to be added without schema migrations.

---

## 9. Deadline Automation

Deadline automation runs through two independent mechanisms that provide redundancy.

### 9.1 Durable Object Alarms (Primary)

The `HackathonStateMachine` DO uses Cloudflare's alarm API for precise deadline enforcement:

1. When a hackathon transitions to `active` with a `submission_deadline`, `ctx.storage.setAlarm(deadlineMs)` is called.
2. At the deadline, the `alarm()` handler fires automatically.
3. The alarm transitions the state from `active → judging`.
4. D1 is synced (hackathon status updated).
5. A `hackathon.judging_started` notification is enqueued to `NOTIFICATION_QUEUE`.
6. The alarm is cleared after firing.

**Advantages:** Millisecond precision, no polling, survives Worker restarts.

### 9.2 Cron-Based Deadline Checking (Backup)

A cron job runs **hourly** (`0 * * * *`) as a safety net:

**`checkSubmissionDeadlines()`:**
1. Queries D1 for `active` hackathons where the latest round's `submission_deadline` has passed.
2. For each, calls the DO's `/transition` endpoint with `version: -1` (bypass optimistic locking).
3. Syncs D1 status.
4. Creates audit event: `cron.deadline_transition`.
5. Enqueues `hackathon.judging_started` notification.
6. Errors per-hackathon are caught silently (doesn't halt processing of others).

### 9.3 Deadline Reminders

**`sendDeadlineReminders()`** (part of the hourly cron):

1. Fetches active rounds with submission deadlines.
2. Calculates `hoursRemaining = (deadline - now) / (1000 * 60 * 60)`.
3. Sends `deadline_reminder` notifications at two windows:
   - **24-hour window:** when `23 < hoursRemaining ≤ 24`
   - **1-hour window:** when `0 < hoursRemaining ≤ 1`
4. Notification payload includes `hours_remaining` for display.

### 9.4 Audit Hash Backfill

**`backfillAuditHashes()`** runs in the same hourly cron, processing up to 100 audit events per run to fill missing SHA-256 hash chain integrity values.

---

## 10. Platform UI

The organizer dashboard at `platform.devsage.org` provides the primary management interface.

### 10.1 URL Structure

| Path | Page | Purpose |
|------|------|---------|
| `/dashboard` | Dashboard | List hackathons, create via modal dialog |
| `/hackathons/:slug` | Overview | Status badge, metrics cards, lifecycle progress tracker, schedule |
| `/hackathons/:slug/settings` | Settings | Edit configuration fields, danger zone (delete) |
| `/hackathons/:slug/teams` | Teams | Team management and listing |
| `/hackathons/:slug/teams/:id` | Team Detail | Individual team view |
| `/hackathons/:slug/submissions` | Submissions | Submission tracking |
| `/hackathons/:slug/judging` | Judging | Judge assignments, scoring interface |
| `/hackathons/:slug/leaderboard` | Leaderboard | Results and rankings |
| `/hackathons/:slug/rounds` | Rounds | Round management |
| `/hackathons/:slug/announcements` | Announcements | Event announcements |
| `/hackathons/:slug/activity` | Activity | Audit log viewer |
| `/hackathons/:slug/analytics` | Analytics | Event analytics dashboard |

### 10.2 Hackathon Creation

Creation is done via a **modal dialog** on the dashboard (not a dedicated page):

- **Fields:** Title (required), Description, Starts At (required), Judging Starts (required), Max Team Size (default: 4)
- **Slug:** Auto-generated from title (lowercase, hyphenated)
- **API call:** `POST /api/v1/hackathons`

### 10.3 State Transition UI

Transition buttons appear on both the Overview page and the Dashboard:

| Current State | Button Label | Target State |
|---------------|-------------|--------------|
| `draft` | "Launch Hackathon" | `active` |
| `active` | "Begin Judging" | `judging` |
| `judging` | "Finalize Event" | `completed` |
| `completed` | "Archive" | `archived` |

All transitions call `POST /api/v1/hackathons/:slug/transition` with `{ target_status, version: -1 }`.

### 10.4 Settings Page

**Editable sections:**

| Section | Fields |
|---------|--------|
| General | Title, Tagline |
| Dates & Deadlines | Starts At, Judging Starts |
| Team Configuration | Min Team Size, Max Team Size |
| Visibility & Access | Public listing, Require approval, Allow late submissions |
| Danger Zone | Delete hackathon (draft only, with confirmation dialog) |

**UX:** Real-time duration calculation between dates, animated save button states (Saving → Saved → default), status badge display.

### 10.5 Hackathon Request System

An alternative creation flow where users submit **hackathon requests** for approval:

**Request status lifecycle:**
```
Submitted → Under Review → Approved → Building → Ready
                              ↓
                        Changes Requested (edit & resubmit)
                              ↓
                            Rejected
```

Includes a progress stepper UI, admin notes, and activity timeline.

---

## 11. Known Issues & Future Plans

### 11.1 Critical Debt

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| **DEBT-2** | 🔴 CRITICAL | `hackathons.ts:77-86` | Template `rounds` and `rubric` are fetched but **not applied** during hackathon creation. Only `settings` and `tracks` are copied. Organizers must manually recreate rounds after using a template |
| **API-006** | 🔴 HIGH | `hackathons.ts:15-104` | No runtime Zod validation on hackathon creation input — body is accepted without schema parsing |
| **API-007** | 🔴 HIGH | `hackathons.ts:58-59` | Slug format not validated at the API level — accepts spaces, special characters, potentially SQL injection or path traversal |
| **API-030** | 🔴 HIGH | `hackathons.ts:15-233` | ~120 lines duplicated between two creation route handlers (body `workspace_id` vs path param) |

### 11.2 Medium Debt

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| **PKG-014** | 🟡 MEDIUM | `schema/hackathons.ts` | `workspace_id` and `created_by` FK columns missing cascade/set-null behavior |
| **PKG-024** | 🟡 MEDIUM | Zod ↔ DB | Template Zod schema uses `name` but DB column is `title` (field mismatch) |
| **PKG-027** | 🟡 MEDIUM | `shared/schemas/hackathon.ts` | Create schema only validates ~10 of 27 columns; remaining fields pass without validation |

### 11.3 Low Debt

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| **API-009** | 🟢 LOW | `hackathons.ts:239` | Status filter on list endpoint not validated against the 5-state enum |
| **API-022** | 🟢 LOW | `hackathons.ts:10` | Unused import: `VALID_TRANSITIONS` |
| **API-027** | 🟢 LOW | `hackathons.ts:98` | Two different default tag patterns (`submission_v%` vs `submission-v*`) |
| **DEBT-10** | 🟢 LOW | `settings.tsx` (platform) | Settings page missing UI fields for timezone, registration mode, email domain restrictions |

### 11.4 Missing Features

| Feature | Status | Notes |
|---------|--------|-------|
| Template CRUD API | ❌ Not started | Schema and Zod types exist, but no route file |
| Soft delete | ❌ Not implemented | Hard delete only, draft-only restriction mitigates risk |
| Slug validation (API-level) | ❌ Not enforced | Zod schema has regex but route bypasses validation |
| Prize structure validation | ❌ Not validated | `prizes` column uses `z.unknown()` — no schema enforcement |
| Track structure validation | ❌ Not validated | `tracks` column uses `z.unknown()` — no schema enforcement |
| Settings page completeness | 🟡 Partial | Missing timezone, registration mode, email domain, submission settings in UI |
| Multi-round deadline automation | 🟡 Partial | Cron checks latest round deadline only; per-round alarms not implemented |

---

## Appendix A: API Endpoint Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/hackathons` | Workspace owner/admin | Create hackathon |
| `POST` | `/api/v1/workspaces/:id/hackathons` | Workspace owner/admin | Create hackathon (legacy) |
| `GET` | `/api/v1/hackathons` | Public | List hackathons (paginated) |
| `GET` | `/api/v1/hackathons/:slug` | Public | Get hackathon by slug (ETag) |
| `PATCH` | `/api/v1/hackathons/:slug` | co_organizer+ | Update hackathon |
| `POST` | `/api/v1/hackathons/:slug/transition` | organizer | State transition |
| `GET` | `/api/v1/hackathons/:slug/state` | co_organizer+ | State reconciliation (DO vs D1) |
| `DELETE` | `/api/v1/hackathons/:slug` | organizer | Delete (draft only, hard delete) |

## Appendix B: Notification Events

| Event | Trigger | Recipients |
|-------|---------|------------|
| `hackathon.judging_started` | `active → judging` transition (alarm or cron) | All participants |
| `deadline_reminder` | Cron at 24h and 1h before deadline | Active teams in hackathon |

## Appendix C: Audit Events

| Action | When |
|--------|------|
| `hackathon.created` | After successful creation |
| `hackathon.updated` | After PATCH update |
| `hackathon.deleted` | Before hard deletion |
| `hackathon.transitioned` | After state transition (includes `old_status`, `new_status`) |
| `cron.deadline_transition` | Cron-triggered `active → judging` |
