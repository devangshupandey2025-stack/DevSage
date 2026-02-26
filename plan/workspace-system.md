# Workspace & Billing System — Cross-Functional Feature Document

**Last updated:** 2026-02-15
**Status:** Workspaces implemented · Billing not yet built
**Packages:** `apps/api`, `apps/platform`, `apps/admin`, `packages/db`, `packages/shared`

---

## 1. Overview

Workspaces are the top-level organizational container in DevSage — analogous to GitHub Organizations. Every hackathon belongs to exactly one workspace. A workspace can represent either a **club** (organization-backed, multiple members) or an **individual** (personal workspace, single owner).

### Core Principles

- **Workspace-scoped resources** — Hackathons, templates, and hackathon requests all belong to a workspace via `workspace_id` foreign key.
- **Role-based access** — Three workspace roles (`owner`, `admin`, `member`) control who can manage the workspace, create hackathons, and invite members.
- **Slug-based addressing** — Workspaces are addressed by unique slug in the platform UI (e.g., `/workspaces/ieee-rvce`).
- **Invite-only membership** — Members join via email invitations with token-based verification. No self-join.
- **Platform admin oversight** — Platform admins (`shikdd.devsage.org`) can create and manage all workspaces.

### Current Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| DB schema (3 tables) | ✅ Complete | `packages/db/src/schema/workspaces.ts`, `workspace-members.ts`, `workspace-invites.ts` |
| Zod validation schemas | ✅ Complete | `packages/shared/src/schemas/workspace.ts` |
| API routes (CRUD + invites) | ✅ Complete | `apps/api/src/routes/workspaces.ts` |
| Admin API routes | ✅ Complete | `apps/api/src/routes/admin.ts` (workspace section) |
| API integration tests | ✅ Complete | `apps/api/src/__tests__/workspaces.test.ts` |
| Platform UI (list + detail + invite accept) | ✅ Complete | `apps/platform/src/pages/workspaces.tsx`, `workspace-detail.tsx`, `workspace-invite-accept.tsx` |
| Admin UI (list + create + detail) | ✅ Complete | `apps/admin/src/pages/workspaces.tsx`, `workspace-detail.tsx` |
| Billing & subscription system | 🔴 Not started | See [Section 7](#7-billing--plans) |

---

## 2. Data Model

### 2.1 Workspaces

**Table:** `workspaces`
**Schema file:** `packages/db/src/schema/workspaces.ts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `text` | `PRIMARY KEY` | UUID v4 via `crypto.randomUUID()` |
| `name` | `text` | `NOT NULL` | Display name (e.g., "IEEE RVCE") |
| `slug` | `text` | `NOT NULL`, `UNIQUE` | URL-safe identifier (e.g., `ieee-rvce`). Regex: `^[a-z0-9-]+$`, max 100 chars |
| `description` | `text` | `NOT NULL`, default `''` | Freeform description, max 2000 chars |
| `type` | `text` | `NOT NULL`, default `'club'` | Enum: `'club'` or `'individual'` |
| `logo_url` | `text` | nullable | URL to workspace logo/avatar |
| `website` | `text` | nullable | External website URL |
| `settings` | `text` | `NOT NULL`, default `'{}'` | JSON blob for workspace-level settings (extensible) |
| `created_by` | `text` | `NOT NULL`, FK → `users.id` | The user who created the workspace |
| `created_at` | `text` | `NOT NULL`, default `strftime(...)` | ISO-8601 UTC timestamp |
| `updated_at` | `text` | `NOT NULL`, default `strftime(...)` | ISO-8601 UTC timestamp |

**Indexes:**
- `idx_workspaces_created_by` on `created_by`

**Foreign keys:**
- `created_by` → `users.id` (⚠️ no cascade — see [Known Issues](#101-data-model-issues))

### 2.2 Workspace Members

**Table:** `workspace_members`
**Schema file:** `packages/db/src/schema/workspace-members.ts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `text` | `PRIMARY KEY` | UUID v4 |
| `workspace_id` | `text` | `NOT NULL`, FK → `workspaces.id` `ON DELETE CASCADE` | Parent workspace |
| `user_id` | `text` | `NOT NULL`, FK → `users.id` `ON DELETE CASCADE` | Member user |
| `role` | `text` | `NOT NULL` | Enum: `'owner'`, `'admin'`, `'member'` |
| `invited_by` | `text` | nullable, FK → `users.id` `ON DELETE SET NULL` | Who sent the invite |
| `created_at` | `text` | `NOT NULL`, default `strftime(...)` | When membership was created |

**Indexes:**
- `uq_workspace_members_workspace_user` — unique on `(workspace_id, user_id)` — prevents duplicate membership
- `idx_workspace_members_user` on `user_id`

**Notes:**
- No `updated_at` column — role changes require delete + re-insert (or a future migration to add it).
- The `invited_by` column is currently always set to `null` on invite acceptance (see [Known Issues](#101-data-model-issues)).

### 2.3 Workspace Invites

**Table:** `workspace_invites`
**Schema file:** `packages/db/src/schema/workspace-invites.ts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `text` | `PRIMARY KEY` | UUID v4 |
| `workspace_id` | `text` | `NOT NULL`, FK → `workspaces.id` `ON DELETE CASCADE` | Target workspace |
| `email` | `text` | `NOT NULL` | Invitee's email address |
| `role` | `text` | `NOT NULL` | Role to assign on acceptance (`'owner'`, `'admin'`, `'member'`) |
| `invite_token` | `text` | `NOT NULL`, `UNIQUE` | Opaque UUID token used in invite link |
| `invited_by` | `text` | nullable, FK → `users.id` `ON DELETE SET NULL` | User who created the invite |
| `status` | `text` | `NOT NULL`, default `'pending'` | Enum: `'pending'`, `'accepted'`, `'declined'`, `'revoked'` (revoked via admin) |
| `created_at` | `text` | `NOT NULL`, default `strftime(...)` | When invite was created |
| `expires_at` | `text` | `NOT NULL` | ISO-8601 expiration timestamp (7 days from creation) |

**Indexes:**
- `idx_workspace_invites_email` on `email`

**Notes:**
- No unique constraint on `(workspace_id, email)` — duplicate invites to the same email are possible.
- Expired invites are checked at query time (`expires_at < now`), not cleaned up by cron.

### 2.4 Related Tables

**`hackathons`** — `workspace_id` FK (see `packages/db/src/schema/hackathons.ts`):
- `workspace_id: text('workspace_id').notNull().references(() => workspaces.id)` — no cascade behavior.
- `idx_hackathons_workspace` index on `workspace_id`.

**`hackathon_templates`** and **`hackathon_requests`** — also carry `workspace_id` foreign keys.

### 2.5 Entity Relationship Diagram (text)

```
┌──────────────┐       ┌────────────────────┐       ┌──────────────┐
│   users      │       │ workspace_members   │       │  workspaces  │
│──────────────│       │────────────────────│       │──────────────│
│ id (PK)      │◄──────│ user_id (FK)       │──────►│ id (PK)      │
│ name         │       │ workspace_id (FK)  │       │ name         │
│ email        │       │ role               │       │ slug (UNIQUE)│
│ ...          │       │ invited_by (FK)    │       │ type         │
└──────────────┘       └────────────────────┘       │ created_by   │
       │                                             │ settings     │
       │               ┌────────────────────┐       │ ...          │
       │               │ workspace_invites   │       └──────┬───────┘
       └──────────────►│────────────────────│              │
                       │ workspace_id (FK)  │──────────────┘
                       │ email              │
                       │ invite_token (UNQ) │       ┌──────────────┐
                       │ role               │       │  hackathons  │
                       │ status             │       │──────────────│
                       │ invited_by (FK)    │       │ workspace_id │───► workspaces.id
                       │ expires_at         │       │ ...          │
                       └────────────────────┘       └──────────────┘
```

---

## 3. Workspace CRUD

### 3.1 Create Workspace

**Endpoint:** `POST /api/v1/workspaces`
**Auth:** `authMiddleware` + `requirePlatformAdmin`
**Source:** `apps/api/src/routes/workspaces.ts` lines 18–52

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | Min 1, max 200 chars |
| `slug` | string | ✅ | Min 1, max 100, regex `^[a-z0-9-]+$` |
| `description` | string | ❌ | Max 2000 chars |
| `type` | string | ✅ | `'club'` or `'individual'` |

**Behavior:**
1. Validates required fields (`name`, `slug`, `type`).
2. Checks slug uniqueness — returns `409 SLUG_TAKEN` if taken.
3. Inserts workspace row with `created_by` set to the authenticated admin.
4. Auto-creates a `workspace_members` row for the creator as `owner`.
5. Logs `workspace.created` audit event (non-blocking via `waitUntil`).
6. Returns the created workspace (status 201).

**Important:** Workspace creation is restricted to **platform admins only**. Regular users cannot self-create workspaces. Admin workspace creation (via `POST /api/v1/admin/workspaces`) also sends an owner invite email — see [Section 8](#8-platform-admin-perspective).

### 3.2 List User's Workspaces

**Endpoint:** `GET /api/v1/workspaces`
**Auth:** `authMiddleware`
**Source:** `apps/api/src/routes/workspaces.ts` lines 55–65

Returns all workspaces where the authenticated user is a member. Joins `workspace_members` to include `member_role` in each result. Ordered by `created_at DESC`.

**Response shape:** `{ ok: true, data: [{ ...workspace, member_role: string }] }`

⚠️ **No pagination** — returns all workspaces. This is acceptable for now since users typically belong to < 20 workspaces.

### 3.3 Get Workspace Detail

**Endpoint:** `GET /api/v1/workspaces/:workspaceId`
**Auth:** `authMiddleware`
**Source:** `apps/api/src/routes/workspaces.ts` lines 68–97

Accepts **either** a workspace `id` (UUID) or `slug` — resolves via `WHERE id = ? OR slug = ?`.

Returns the workspace plus two parallel-fetched sub-resources:
- `members[]` — all members with user profile data (`name`, `email`, `avatar_url`)
- `hackathons[]` — all hackathons in the workspace (`id`, `slug`, `title`, `status`, `created_at`)

### 3.4 Update Workspace

**Endpoint:** `PATCH /api/v1/workspaces/:workspaceId`
**Auth:** `authMiddleware` + workspace `owner` or `admin`
**Source:** `apps/api/src/routes/workspaces.ts` lines 100–127

**Allowed fields:** `name`, `description` only. Slug and type are **immutable** after creation.

Builds a dynamic `UPDATE` query from provided fields. Returns `400 VALIDATION_ERROR` if no fields provided.

⚠️ Uses raw workspace ID (not slug) in the WHERE clause. The `:workspaceId` param here expects a UUID, unlike the GET endpoint which accepts either.

### 3.5 Delete Workspace

**Not implemented.** There is no `DELETE /api/v1/workspaces/:workspaceId` endpoint.

Deletion would require resolving cascade behavior for:
- `workspace_members` — has `ON DELETE CASCADE` ✅
- `workspace_invites` — has `ON DELETE CASCADE` ✅
- `hackathons` — **no cascade behavior** ⚠️ — would orphan hackathons

### 3.6 Slug-Based Addressing

Workspace slugs follow the pattern `^[a-z0-9-]+$` (lowercase alphanumeric + hyphens).

- The GET detail endpoint accepts slug or UUID interchangeably.
- Platform UI routes use slugs: `/workspaces/:slug`.
- Slugs are immutable after workspace creation (not in `allowedFields` for PATCH).
- Admin dashboard uses workspace IDs internally but displays slugs.

---

## 4. Membership

### 4.1 Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| `owner` | Highest | Full control. Can manage members, settings, hackathons, and transfer ownership. |
| `admin` | Mid | Can manage members (invite/remove), manage hackathons. Cannot change workspace settings. |
| `member` | Lowest | Can view workspace resources and participate in hackathons. |

**Constants definition:** `packages/shared/src/schemas/constants.ts`
```typescript
workspaceRoleSchema = z.enum(['owner', 'admin', 'member'])
```

### 4.2 Owner Privileges

- **Max 2 owners per workspace** — enforced on invite acceptance (line 267–273 of `workspaces.ts`).
- Owners can:
  - Update workspace name/description (`PATCH` endpoint checks `owner` or `admin`).
  - Remove any member except themselves (`DELETE /:workspaceId/members/:userId` — owner-only).
  - Invite members with any role including `owner`.
- Owners **cannot** be removed by other owners (only self-removal is blocked; there is no role-check preventing one owner from removing another — see [Known Issues](#102-api-route-issues)).
- Ownership transfer is **not implemented** — there is no endpoint to promote a member to owner or demote an owner.

### 4.3 Admin Privileges

- Can invite new members (`POST /:workspaceId/invites` — checks `owner` or `admin`).
- Can update workspace name/description.
- **Cannot** remove members (remove endpoint is owner-only).
- **Cannot** invite with role `owner` (Zod schema `inviteWorkspaceMemberSchema` excludes `owner` from invitable roles).

### 4.4 Member Privileges

- Can view workspace details and member list.
- Can view hackathons in the workspace.
- Cannot invite, remove, or update workspace settings.

### 4.5 Invite Flow

**Step-by-step lifecycle:**

```
1. Owner/Admin → POST /api/v1/workspaces/:id/invites { email, role }
   │
   ├─ Creates workspace_invites row (status: 'pending', expires_at: now + 7 days)
   ├─ Generates UUID invite_token
   └─ Sends email with link: https://platform.devsage.org/invite/workspace/{token}
       │
2. Invitee clicks link → Platform app loads WorkspaceInviteAcceptPage
   │
   ├─ GET /api/v1/workspaces/invites/token/{token}  (public — no auth required)
   │   └─ Returns: workspace_name, role, email, expires_at, inviter_name
   │
3. Invitee logs in (if not already) → clicks "Accept"
   │
   ├─ POST /api/v1/workspaces/invites/token/{token}/accept  (auth required)
   │   ├─ Validates: invite exists, status = 'pending', not expired
   │   ├─ Validates: user email matches invite email (case-insensitive)
   │   ├─ Validates: user not already a member
   │   ├─ Validates: owner count < 2 (if role = 'owner')
   │   ├─ D1 batch: update invite status → 'accepted' + insert workspace_member
   │   └─ Logs audit event: workspace.invite_accepted
   │
   └─ OR: POST .../decline → sets invite status to 'declined'
```

**Invite email template:**
- Subject: `You've been invited to {workspace_name} on DevSage`
- Body: Role, workspace name, CTA button (lime green `#CCFF00`), 7-day expiry notice.
- Sent via `services/email.ts` (fail-open, non-blocking via `waitUntil`).

**Token details:**
- Generated via `crypto.randomUUID()` — 36-char UUID with hyphens.
- Stored in `invite_token` column with UNIQUE constraint.
- Lookup endpoint is **public** (no auth) — exposes workspace name, invitee email, role, and inviter name to anyone with the token.

### 4.6 Member Removal

**Endpoint:** `DELETE /api/v1/workspaces/:workspaceId/members/:userId`
**Auth:** Owner only.

- Owners cannot remove themselves (`409 CANNOT_REMOVE_SELF`).
- Hard deletes the `workspace_members` row.
- No audit event logged (see [Known Issues](#102-api-route-issues)).
- No notification sent to the removed member.

---

## 5. Workspace Types

### 5.1 Club

- Represents an organization (college club, company, community group).
- Can have multiple members across all three roles.
- Default type.
- Intended for organizations running multiple hackathons.

### 5.2 Individual

- Represents a personal workspace for a single organizer.
- Functionally identical to `club` in current implementation — no enforcement of single-member limit.
- Type is set at creation and is **immutable**.

### 5.3 Differences in Capabilities

Currently, there are **no behavioral differences** between `club` and `individual` workspaces in the API. The type is stored as metadata but not used for feature gating or validation. Planned differences (from plan docs):

| Capability | Club | Individual (planned) |
|------------|------|---------------------|
| Max members | Unlimited | 1 (owner only) |
| Billing tier | Organization plans | Free / personal plan |
| Hackathon limit | Per billing plan | 1–3 hackathons |
| Custom branding | ✅ | Limited |

---

## 6. Hackathon Ownership

### 6.1 Workspace–Hackathon Relationship

Every hackathon has a `workspace_id` foreign key (non-nullable) pointing to `workspaces.id`.

```sql
-- packages/db/src/schema/hackathons.ts
workspace_id: text('workspace_id').notNull().references(() => workspaces.id)
```

The `idx_hackathons_workspace` index enables efficient lookup of all hackathons in a workspace.

### 6.2 Who Can Create Hackathons

Hackathon creation is gated by workspace membership. Only workspace `owner` and `admin` roles can create hackathons within a workspace. This is enforced at the hackathon route level via `resolveRole()` which checks the user's workspace membership.

### 6.3 Workspace Deletion Impact

Workspace deletion is **not implemented** and would require careful handling:

- `workspace_members` and `workspace_invites` have `ON DELETE CASCADE` — they would be auto-deleted.
- `hackathons` has **no cascade behavior** — deleting a workspace would leave orphaned hackathon rows with invalid `workspace_id` references.
- Hackathon templates and requests also reference `workspace_id` without cascade.
- **Recommended approach:** Soft-delete workspaces (add `deleted_at` column) or require all hackathons to be archived/deleted first.

---

## 7. Billing & Plans

### 7.1 Current State

**Billing is completely absent from the codebase.** There are:
- ❌ No database tables for plans, subscriptions, invoices, or payments
- ❌ No API endpoints for billing management
- ❌ No payment gateway integration (Razorpay, Stripe, or other)
- ❌ No UI for plan selection or billing management
- ❌ No feature gating based on plan tier

This is classified as **🔴 CRITICAL (GAP-1)** in `debt/plan-gaps.md`.

### 7.2 Planned Billing Model

From plan documentation (`plan/role-club-president.md`):

| Plan | Price | Billing Cycle | Target |
|------|-------|---------------|--------|
| Starter | ₹3,999 | Per semester | Small clubs |
| Growth | ₹6,999 | Per semester | Mid-size orgs |
| Enterprise | ₹9,999 | Per semester | Large organizations |

### 7.3 Required Implementation (Future)

**New DB tables needed:**
```
plans           — id, name, price, currency, interval, features (JSON), limits (JSON)
subscriptions   — id, workspace_id (FK), plan_id (FK), status, current_period_start/end, ...
invoices        — id, subscription_id (FK), amount, currency, status, paid_at, ...
payment_events  — id, provider, provider_event_id, payload (JSON), processed_at, ...
```

**New API routes:**
```
GET    /api/v1/workspaces/:slug/billing          — Current plan & usage
POST   /api/v1/workspaces/:slug/billing/checkout  — Create payment session
POST   /api/v1/workspaces/:slug/billing/cancel    — Cancel subscription
POST   /api/v1/webhooks/razorpay                  — Payment webhook handler
GET    /api/v1/admin/billing/overview              — Admin billing dashboard
```

**Feature gating per plan:**
- Max hackathons per workspace
- Max participants per hackathon
- Custom branding options
- Priority support
- Analytics access level

**Payment gateway:** Razorpay (primary, for INR) or Stripe (international). Webhook handler should follow the existing queue pattern — enqueue payment events to a queue for async processing.

---

## 8. Platform Admin Perspective

### 8.1 Admin Workspace Management

Platform admins (`shikdd.devsage.org`) have full oversight of all workspaces via the admin API and UI.

**Admin API routes** (all require `authMiddleware` + `requirePlatformAdmin`):

| Method | Endpoint | Description | Source |
|--------|----------|-------------|--------|
| `GET` | `/api/v1/admin/workspaces` | List all workspaces with member/hackathon counts | `admin.ts` lines 183–192 |
| `POST` | `/api/v1/admin/workspaces` | Create workspace + send owner invite email | `admin.ts` lines 195–257 |
| `GET` | `/api/v1/admin/workspaces/:id` | Workspace detail with members, hackathons, invites | `admin.ts` lines 260–288 |

### 8.2 Admin Workspace Creation Flow

The admin creation flow differs from the standard `POST /api/v1/workspaces` endpoint:

1. Admin provides `name`, `slug`, `type`, `description`, and **`owner_email`**.
2. System creates the workspace (with `created_by` = admin's user ID).
3. System creates a `workspace_invites` row for the `owner_email` with role `owner`.
4. System sends an invite email to the owner with a link to accept.
5. Audit event logged: `workspace.created` with `owner_email` in details.
6. Returns the workspace object + `invite_token`.

**Key difference:** The admin is NOT automatically added as a workspace member. The intended owner receives an invite email and must accept it to become the workspace owner.

### 8.3 Admin Dashboard Features

**Workspace list page** (`apps/admin/src/pages/workspaces.tsx`):
- Create workspace form (name, slug auto-generated from name, type dropdown, description, owner email)
- Search/filter by name or slug
- Pagination (20 per page)
- Each row shows: name, slug, type, member count, hackathon count, created date

**Workspace detail page** (`apps/admin/src/pages/workspace-detail.tsx`):
- Workspace info display (name, slug, type, description)
- Members section with role badges (color-coded)
- Add member invite form (email + role)
- Pending invites section with expiry dates
- Hackathons section with status badges

### 8.4 Not Yet Implemented (Admin)

- Workspace approval/verification workflow (workspaces are auto-approved on creation)
- Workspace suspension/deactivation
- Workspace ownership transfer
- Billing/plan assignment from admin panel
- Workspace analytics or usage metrics
- Bulk workspace operations

---

## 9. Frontend Integration

### 9.1 Platform App (`apps/platform`)

**Route structure:**
```
/workspaces                → WorkspacesPage (list)
/workspaces/:slug          → WorkspaceDetailPage (detail)
/invite/workspace/:token   → WorkspaceInviteAcceptPage (invite acceptance)
```

**Workspaces Page** (`pages/workspaces.tsx`):
- Grid layout with workspace cards
- Each card shows: name, role badge, type, description
- Loading skeleton states
- Empty state with icon and message
- Links to workspace detail: `/workspaces/{slug}`
- API call: `GET /api/v1/workspaces`

**Workspace Detail Page** (`pages/workspace-detail.tsx`):
- Workspace info header (name, slug, type, description)
- Members list with role color-coding:
  - Owner → yellow/amber badge
  - Admin → blue badge
  - Member → gray badge
- Member avatars and email display
- Hackathons section with status badges
- API call: `GET /api/v1/workspaces/{slug}`

**Invite Accept Page** (`pages/workspace-invite-accept.tsx`):
- Displays invitation details: workspace name, assigned role, invitee email, expiry date
- Status indicator (Pending / Expired)
- Accept and Decline buttons (conditional on auth state and invite validity)
- Invite details card with grid layout
- APIs:
  - `GET /api/v1/workspaces/invites/token/{token}` — fetch invite details
  - `POST /api/v1/workspaces/invites/token/{token}/accept` — accept
  - `POST /api/v1/workspaces/invites/token/{token}/decline` — decline

### 9.2 Admin App (`apps/admin`)

See [Section 8.3](#83-admin-dashboard-features) for admin workspace pages.

### 9.3 Web App (`apps/web`)

**No workspace-specific pages or components.** The public website (`devsage.org`) does not expose workspace management. Workspace functionality is entirely within the platform and admin apps.

### 9.4 Shared UI Patterns

- **Component library:** shadcn/ui (Card, Badge, Button, Skeleton, Input, Select, Textarea)
- **Icons:** lucide-react (Building, Users, Trophy, Mail, Shield, Calendar, Clock, ExternalLink)
- **Notifications:** sonner (toast)
- **Styling:** Tailwind CSS v4, dark-first theme, accent `#CCFF00`
- **Data fetching:** `fetch` with `credentials: 'include'`, manual 401 → refresh → retry via `apiRequest()`

---

## 10. Known Issues & Future Plans

### 10.1 Data Model Issues

| ID | Severity | Description | Ref |
|----|----------|-------------|-----|
| PKG-013 | MEDIUM | `workspaces.created_by` FK has **no cascade behavior** — deleting a user leaves orphan `created_by` references | `debt/COMPREHENSIVE-DEBT-AUDIT.md` |
| PKG-014 | MEDIUM | `hackathons.workspace_id` FK has **no cascade behavior** — workspace deletion would orphan hackathons | `debt/COMPREHENSIVE-DEBT-AUDIT.md` |
| PKG-031 | HIGH | `workspaceRoleSchema` defines `owner/admin/member` but seed data uses `workspace_owner/workspace_member` — role string mismatch | `debt/COMPREHENSIVE-DEBT-AUDIT.md` |
| — | LOW | No `updated_at` column on `workspace_members` — cannot track when a membership was last modified | — |
| — | LOW | `invited_by` is always `null` on invite acceptance (line 283 of `workspaces.ts` passes `null`) — loses the invite chain | — |
| — | LOW | No unique constraint on `(workspace_id, email)` in `workspace_invites` — duplicate pending invites possible | — |

### 10.2 API Route Issues

| ID | Severity | Description | Ref |
|----|----------|-------------|-----|
| API-026 | LOW | `paginatedResponse` imported but unused in `workspaces.ts` | `debt/COMPREHENSIVE-DEBT-AUDIT.md` |
| API-042 | LOW | No pagination on workspace member listing or admin workspace listing | `debt/COMPREHENSIVE-DEBT-AUDIT.md` |
| API-028 | LOW | Email HTML templates hardcoded inline with inconsistent brand colors | `debt/COMPREHENSIVE-DEBT-AUDIT.md` |
| — | MEDIUM | Member removal (`DELETE`) logs no audit event — breaks audit trail completeness | — |
| — | MEDIUM | `PATCH` endpoint accepts only workspace UUID, not slug — inconsistent with `GET` | — |
| — | MEDIUM | One owner can remove another owner — no protection against last-owner removal | — |
| — | LOW | Invite token lookup (`GET /invites/token/:token`) is public — exposes workspace name, email, and role to anyone with the token | — |
| — | LOW | No workspace Zod validation used in API routes — body is parsed as raw JSON with manual field checks | — |

### 10.3 Frontend Issues

| ID | Severity | Description | Ref |
|----|----------|-------------|-----|
| FE-015 | LOW | Unused import `Mail` in `workspace-detail.tsx` (platform) | `debt/COMPREHENSIVE-DEBT-AUDIT.md` |
| — | LOW | No optimistic updates or stale-while-revalidate patterns for workspace data | — |
| — | LOW | No workspace settings page (logo upload, website, settings JSON) | — |

### 10.4 Critical Gaps

| Gap | Priority | Description | Ref |
|-----|----------|-------------|-----|
| GAP-1 | 🔴 CRITICAL | **Billing & Subscription System** — completely absent. Blocks monetization. Requires DB tables, payment gateway, API routes, webhooks, UI. | `debt/plan-gaps.md` |
| — | 🟡 MEDIUM | **Workspace deletion** — no endpoint exists. Cascade behavior incomplete. | — |
| — | 🟡 MEDIUM | **Ownership transfer** — no endpoint to transfer owner role. | — |
| — | 🟡 MEDIUM | **Role change** — no endpoint to change a member's role in-place. | — |
| — | 🟡 MEDIUM | **Workspace settings UI** — `logo_url`, `website`, and `settings` columns exist in DB but are not exposed in any UI. | — |
| — | 🟢 LOW | **Invite resend** — no endpoint to resend an expired or pending invite. | — |
| — | 🟢 LOW | **Invite revocation from workspace routes** — only admin can revoke invites (via `DELETE /admin/invites/:id`). | — |
| — | 🟢 LOW | **Workspace type enforcement** — `individual` type has no behavioral restrictions vs `club`. | — |

---

## Appendix A: Zod Validation Schemas

**File:** `packages/shared/src/schemas/workspace.ts`

```typescript
// Create — all required except description
createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  type: workspaceTypeSchema,       // z.enum(['club', 'individual'])
});

// Update — partial, slug and type excluded (immutable)
updateWorkspaceSchema = createWorkspaceSchema.partial().omit({ slug: true, type: true });

// Invite — email + role (owner excluded from invitable roles)
inviteWorkspaceMemberSchema = z.object({
  email: z.string().email(),
  role: workspaceRoleSchema.exclude(['owner']),  // z.enum(['admin', 'member'])
});

// Response — full workspace object shape
workspaceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  type: workspaceTypeSchema,
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

**Note:** The `inviteWorkspaceMemberSchema` excludes `owner` from the role enum. However, the admin workspace creation flow (`POST /api/v1/admin/workspaces`) sends `owner` invites directly — it bypasses this Zod schema and uses raw SQL insertion.

## Appendix B: Audit Events

| Action | Trigger | Entity Type | Details |
|--------|---------|-------------|---------|
| `workspace.created` | Workspace creation (both standard and admin flows) | `workspace` | `{ name }` or `{ name, owner_email }` |
| `workspace.invite_accepted` | Member accepts invite | `workspace` | `{ role }` |

**Missing audit events:**
- `workspace.updated` — workspace name/description changes
- `workspace.member_removed` — member removal
- `workspace.invite_sent` — invite creation
- `workspace.invite_declined` — invite decline

## Appendix C: Test Coverage

**File:** `apps/api/src/__tests__/workspaces.test.ts`

| Endpoint | Tests | Scenarios |
|----------|-------|-----------|
| `POST /` | ✅ | Create workspace, auth required (401), slug uniqueness (409), field validation (400) |
| `GET /` | ✅ | List only user's workspaces, excludes non-member workspaces |
| `GET /:id` | ✅ | Workspace details, 404 for non-existent |
| `PATCH /:id` | ✅ | Update as owner, permission denied for non-owner/admin (403) |
| `GET /:id/members` | ✅ | List members |
| `DELETE /:id/members/:userId` | ✅ | Remove member (owner-only), cannot remove self (409) |

**Not tested:**
- Invite creation (`POST /:id/invites`) — likely due to email service dependency
- Invite acceptance/decline (`POST /invites/token/:token/accept|decline`)
- Invite token lookup (`GET /invites/token/:token`)
- Admin workspace endpoints
