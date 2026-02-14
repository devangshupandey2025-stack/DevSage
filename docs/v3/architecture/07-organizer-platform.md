# 07 — Organizer Platform

> The Organizer Platform at `platform.devsage.org` is where hackathon organizers create, configure, and manage their events. It provides a full management dashboard for hackathon settings, judge invitations, rubric configuration, phase transitions, and leaderboard monitoring.

**Related docs:** [System Overview](./00-overview.md) | [Authentication](./01-authentication.md) | [Hackathon Lifecycle](./02-hackathon-lifecycle.md) | [Judging](./09-judging.md) | [Admin & Web](./08-admin-and-web.md) | [API Design](./04-api-design.md) | [Roles & Permissions](./10-roles-permissions.md)

---

## Purpose

The Organizer Platform is a dedicated React SPA for hackathon organizers. It is separate from the main site (`devsage.org`) and the admin dashboard (`admin.devsage.org`) to provide a focused management experience. Organizers use it to:

- Create new hackathons with titles, descriptions, dates, and team size limits
- Manage the full hackathon lifecycle by advancing through the 7-state machine
- Invite judges and trigger round-robin judge assignment
- Define and edit rubric criteria (name, description, max score, weight)
- Monitor the leaderboard with weighted scoring results
- Accept organizer invitations sent by the DevSage admin team

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix + CVA) |
| Routing | React Router (v7) |
| Notifications | Sonner (toast) |
| Icons | Lucide React |
| API Client | `apiRequest()` wrapper with `credentials: 'include'` |
| Deployment | Cloudflare Workers Static Assets |

---

## Authentication

The platform uses the same cross-subdomain cookie authentication as all DevSage surfaces:

1. User clicks "Login" on `platform.devsage.org`
2. Redirected to `api.devsage.org/auth/github` (or `/auth/google`) with `redirect_to=platform.devsage.org`
3. OAuth completes, API sets JWT in HttpOnly cookie with `Domain=.devsage.org`
4. Cookie is automatically sent on all subsequent requests to `api.devsage.org`
5. `AuthProvider` hydrates user state via `GET /auth/me`

All authenticated routes are wrapped in a `<ProtectedRoute>` component that redirects unauthenticated users to `/login`.

---

## Route Structure

```
platform.devsage.org/
├── /login                          # Public — OAuth login page
├── /auth/callback                  # Public — OAuth callback handler
├── /invite/:code                   # Public — Organizer invite acceptance
│
├── /dashboard                      # Protected — List organizer's hackathons
├── /hackathons/:slug               # Protected — Full hackathon management
├── /hackathons/:slug/judge         # Protected — Judge scoring interface
└── /profile                        # Protected — User profile settings
```

All protected routes render inside a `<DashboardLayout>` that provides a persistent navigation shell.

The root path (`/`) and any unmatched paths redirect to `/dashboard`.

---

## Pages

### Dashboard (`/dashboard`)

The organizer's home page. Lists all hackathons created by the current user, filtered from the full hackathon list by matching `created_by` against the authenticated user's ID.

**Features:**
- **Hackathon cards** — Each card shows title, description, current status badge, and a "Manage" link to the hackathon detail page
- **Create Hackathon dialog** — Modal form with fields for title, description, registration open/close dates, submission deadline, and max team size. Generates a slug from the title automatically (`toLowerCase().replace(/\s+/g, '-')`)
- **Phase advancement** — Each card includes a button to advance to the next phase (e.g., "Open Registration", "Start Hacking", "Start Judging") with a confirmation prompt
- **Status labels** — Human-readable labels for all 7 states: Draft, Registration Open, Registration Closed, Hacking in Progress, Judging, Completed, Archived

**API calls:**
- `GET /api/v1/hackathons` — Fetch all hackathons, client-side filter by `created_by`
- `POST /api/v1/hackathons` — Create a new hackathon
- `PATCH /api/v1/hackathons/:slug/status` — Advance hackathon phase

### Hackathon Manage (`/hackathons/:slug`)

The primary management interface for a single hackathon. Uses a tabbed layout with four sections: Overview, Judges, Rubric, and Leaderboard.

**Overview Tab:**
- Displays hackathon details: description, min/max team size
- Shows the full timeline: registration opens, registration closes, submission deadline, judging starts, judging ends
- Phase transition button in the page header with confirmation dialog

**Judges Tab:**
- **Invite judges** — Form to invite a judge by user UUID. Calls `POST /api/v1/hackathons/:slug/judges` with `{ userId }`
- **Judge list** — Grid of judge cards showing display name, email, avatar, and invite status badge (pending/accepted/declined, color-coded)
- **Auto-assign** — Button visible only during `judging` phase. Triggers `POST /api/v1/hackathons/:slug/judges/assign` for round-robin assignment of accepted judges to teams with submissions

**Rubric Tab:**
- **Criteria editor** — Dynamic list of rubric criteria, each with fields for name, description, max score (integer), and weight (0.0-1.0)
- **Add/remove criteria** — Add new blank criteria rows, remove existing ones
- **Bulk save** — Saves all criteria at once via `POST /api/v1/hackathons/:slug/rubric` (delete-all-then-insert pattern)
- **Edit lock** — Rubric editing is disabled after registration closes (only editable in `draft` or `registration_open` status). A warning banner is shown when locked

**Leaderboard Tab:**
- **Standings table** — Ranked list of teams with columns: Rank (with trophy icons for top 3), Team Name, Judges Completed, and Weighted Score (percentage)
- Fetches data from `GET /api/v1/hackathons/:slug/leaderboard`

**API calls:**
- `GET /api/v1/hackathons/:slug` — Fetch hackathon details
- `PATCH /api/v1/hackathons/:slug/status` — Phase transition
- `GET /api/v1/hackathons/:slug/judges` — List judges with user details
- `POST /api/v1/hackathons/:slug/judges` — Invite a judge
- `POST /api/v1/hackathons/:slug/judges/assign` — Round-robin assignment
- `GET /api/v1/hackathons/:slug/rubric` — Fetch rubric criteria
- `POST /api/v1/hackathons/:slug/rubric` — Bulk upsert rubric criteria
- `GET /api/v1/hackathons/:slug/leaderboard` — Fetch weighted leaderboard

### Judge Scoring (`/hackathons/:slug/judge`)

A dedicated scoring interface for judges to evaluate submissions against the hackathon's rubric criteria.

**Features:**
- **Submission ID input** — Judge enters the UUID of the submission they are evaluating
- **Rubric criteria cards** — Each criterion is displayed as a card with the criterion name, description, max score badge, a numeric score input (validated against 0 to max_score), and an optional comment textarea
- **Scoring guide sidebar** — Sticky panel with instructions about independent scoring and score finality, plus a rubric summary showing all criteria with their weights
- **Batch submission** — All scores are submitted in parallel via individual `POST /api/v1/hackathons/:slug/scores` calls. Partial success is reported (e.g., "Submitted 3 scores, but 1 failed")
- **Score validation** — Client-side range validation (0 to max_score per criterion). Server enforces write-once semantics (409 on duplicate)

**API calls:**
- `GET /api/v1/hackathons/:slug` — Fetch hackathon details
- `GET /api/v1/hackathons/:slug/rubric` — Fetch rubric criteria (sorted by `sort_order`)
- `POST /api/v1/hackathons/:slug/scores` — Submit a score (one call per criterion)

### Invite Accept (`/invite/:code`)

A standalone page (outside the dashboard layout) for accepting organizer invitations.

**Features:**
- Fetches invite details by code from `GET /api/v1/invites/:code`
- Displays invite metadata: role (Organizer), email, expiration date
- Status handling: shows "Already Accepted" badge, "Expired" badge, or "Pending Acceptance" badge
- If authenticated, shows "Accept Invitation" button that calls `POST /api/v1/invites/:code/accept`
- If not authenticated, shows "Log in to Accept" button that redirects to `/login?next=/invite/:code`
- On success, redirects to `/dashboard`

### Login (`/login`)

OAuth login page with GitHub and Google sign-in options. Redirects to `api.devsage.org/auth/github` or `/auth/google` with appropriate `redirect_to` parameter.

### Profile (`/profile`)

User profile page for viewing and managing account settings.

---

## Component Architecture

```
App.tsx
├── LoginPage                    (public)
├── AuthCallbackPage             (public)
├── InviteAcceptPage             (public, standalone layout)
│
└── ProtectedRoute
    └── DashboardLayout          (navbar + outlet)
        ├── DashboardPage        (hackathon list + create dialog)
        ├── HackathonManagePage  (tabbed management)
        │   ├── OverviewTab      (details + timeline)
        │   ├── JudgesTab        (invite + list + auto-assign)
        │   ├── RubricTab        (criteria editor)
        │   └── LeaderboardTab   (ranked standings)
        ├── JudgeScoringPage     (per-submission scoring)
        └── ProfilePage          (user settings)
```

---

## API Integration

All API calls go through the `apiRequest()` wrapper in `lib/api.ts`:

- Sends cookies automatically (`credentials: 'include'`)
- Auto-redirects to `/login` on 401 responses
- Prepends `VITE_API_ORIGIN` in production (`https://api.devsage.org`)
- In development, Vite proxies `/api/v1/*` to `http://localhost:8787`

All endpoints follow the standard response envelope:
- Success: `{ ok: true, data, meta }`
- Failure: `{ ok: false, error: { code, message } }`

---

## File References

| File | Purpose |
|------|---------|
| `apps/platform/src/App.tsx` | Route definitions (6 routes) |
| `apps/platform/src/pages/dashboard.tsx` | Organizer dashboard with hackathon list and create dialog |
| `apps/platform/src/pages/hackathon-manage.tsx` | Full hackathon management (690 LOC, 4 tabs) |
| `apps/platform/src/pages/judge-scoring.tsx` | Judge scoring interface (395 LOC) |
| `apps/platform/src/pages/invite-accept.tsx` | Organizer invite acceptance flow |
| `apps/platform/src/pages/login.tsx` | OAuth login page |
| `apps/platform/src/pages/profile.tsx` | User profile |
| `apps/platform/src/pages/auth-callback.tsx` | OAuth callback handler |
| `apps/platform/src/components/protected-route.tsx` | Auth guard component |
| `apps/platform/src/components/dashboard-layout.tsx` | Shared layout with navigation |
| `apps/platform/src/contexts/auth-context.tsx` | Auth state management |
| `apps/platform/src/lib/api.ts` | API request wrapper |
