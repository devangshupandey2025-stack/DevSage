# Admin App (shikdd.devsage.org)

Platform admin panel for DevSage team. User management, workspace provisioning, hackathon oversight.

## Current Pages (11)

| Route | Status | Gaps |
|-------|--------|------|
| `/login` | Complete | — |
| `/` | Complete | Stats are basic counts |
| `/users` | Complete | Suspend/unsuspend UI only |
| `/workspaces` | Complete | — |
| `/workspaces/:id` | Complete | — |
| `/hackathons` | Complete | No intervention tools |
| `/hackathons/:id` | Complete | No state override |
| `/hackathon-requests` | Complete | — |
| `/admins` | Complete | — |
| `/invites` | Complete | — |
| `/profile` | Complete | — |

## Features to Build

### 1. Platform Analytics Dashboard

**Source**: `role-devsage-team.md` (ongoing platform management)

**Backend dependency**: `GET /api/v1/admin/analytics/overview` (see `backend/08-remaining-gaps.md`)

Replace basic stats on `/` with:
- User growth chart (line chart, daily/weekly/monthly)
- Active hackathons over time
- Submission volume trend
- Workspace creation rate
- Key metrics cards: total users, active hackathons, total submissions, active judges

### 2. Intervention Tools

**Source**: `role-devsage-team.md` (fix issues, override states, debug webhooks)

On `/hackathons/:id`:
- **State Override**: Force-transition hackathon to any state (with confirmation + audit)
- **Debug Panel**: Show recent webhook deliveries for this hackathon
- **Queue Status**: Show pending/failed queue messages
- **Audit Trail**: Inline audit event viewer (already have backend)

New pages or sections:
```
/webhooks              — Failed webhook deliveries list
/webhooks/:id          — Webhook detail with payload, retry button
/queues                — Queue stats dashboard
```

### 3. Hackathon Theming Admin

**Source**: `role-devsage-team.md` (logo, colors, sponsor content, custom domain, CORS)

On `/hackathons/:id`:
- "Theming" tab:
  - Logo upload/URL
  - Primary/secondary colors
  - Banner image
  - Sponsor management (CRUD for sponsors by tier)
- "Domain" section:
  - Custom domain configuration display
  - CORS origin list management

### 4. User Management Improvements

On `/users`:
- Search by email, name, or GitHub username
- Filter by: status (active, suspended), role (platform admin, organizer, judge)
- User detail view: linked workspaces, hackathon participation, login history
- Actions: suspend/unsuspend with reason, force password reset, impersonate (view-only)

### 5. Workspace Provisioning Flow

**Source**: `role-devsage-team.md` (workspace provisioning)

On `/workspaces`:
- "Create Workspace" button (admin-only)
- Form: workspace name, slug, type, description
- After creation: invite owner (club president) via email

### 6. Upgrade to React Query

**Current**: Direct `apiRequest()` + `useState/useEffect` pattern.

**Recommendation**: Migrate to React Query for consistency with platform/judge apps.

Benefits:
- Automatic refetching, caching, error retry
- Loading/error states managed by library
- Optimistic updates for admin actions
- Consistent pattern across all authenticated apps

Migration approach:
1. Add `@tanstack/react-query` dependency
2. Create `lib/queries.ts` with admin query factories
3. Migrate one page at a time (start with most complex: `/users`, `/hackathon-requests`)
4. Keep simple pages as-is if React Query adds no value

## Components to Build

| Component | Page | Purpose |
|-----------|------|---------|
| `PlatformAnalytics` | Dashboard | Charts for platform-wide metrics |
| `StateOverride` | Hackathon detail | Force state transition dialog |
| `WebhookDebugger` | Hackathon detail / Webhooks | Failed webhook list + retry |
| `ThemingAdmin` | Hackathon detail | Full theming configuration |
| `SponsorManager` | Hackathon detail | Sponsor CRUD by tier |
| `UserSearch` | Users | Search/filter controls |
| `UserDetail` | Users | Expanded user info panel |
| `WorkspaceCreator` | Workspaces | Creation form + owner invite |
