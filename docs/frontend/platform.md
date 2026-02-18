# Platform App — `platform.devsage.org`

Organizer and judge dashboard. Package: `@devsage/platform`

## Pages

| Route | Page | Description | API Endpoints |
|-------|------|-------------|---------------|
| `/login` | Login | Email/password sign-in | `POST /auth/login` |
| `/profile` | Profile | User info, roles, logout | `GET /auth/me` |
| `/dashboard` | Dashboard | Hackathon list, create dialog, metrics | `GET /api/v1/hackathons`, `GET /api/v1/workspaces`, `POST /workspaces/:id/hackathons` |
| `/hackathons/:slug` | Overview | Lifecycle progress, metrics, countdown, quick links | `GET /api/v1/hackathons/:slug` |
| `/hackathons/:slug/manage` | Manage | Tabs: Overview, Judges, Rubric, Leaderboard | `GET /hackathons/:slug`, `POST /hackathons/:slug/transition`, `GET/POST /judging/judges`, `POST /judging/assign`, `GET/POST /judging/rubric`, `GET /judging/leaderboard` |
| `/hackathons/:slug/teams` | Teams | Team grid with members, search | `GET /api/v1/hackathons/:slug/teams` |
| `/hackathons/:slug/teams/:teamId` | Team Detail | Members, submissions, invite code | `GET /teams/:teamId` |
| `/hackathons/:slug/submissions` | Submissions | Submission list with git info | `GET /api/v1/hackathons/:slug/submissions` |
| `/hackathons/:slug/rounds` | Rounds | Round CRUD, status tracking | `GET/POST/DELETE /api/v1/hackathons/:slug/rounds` |
| `/hackathons/:slug/judging` | Judging | Leaderboard, judges, rubric tabs | `GET /judging/leaderboard`, `GET /judging/judges`, `GET /judging/rubric` |
| `/hackathons/:slug/activity` | Activity | Real-time audit trail timeline | `GET /api/v1/hackathons/:slug/audit` |
| `/hackathons/:slug/settings` | Settings | Hackathon config, dates, teams, delete | `GET/PATCH /api/v1/hackathons/:slug`, `DELETE /api/v1/hackathons/:slug` |
| `/hackathons/:slug/announcements` | Announcements | Pin/publish announcements | (UI only — no backend endpoint) |
| `/hackathons/:slug/analytics` | Analytics | Charts, tech breakdown, regions | (UI only — mock data) |
| `/judge/assignments` | Judge Assignments | Judge's submission list | `GET /api/v1/judge/assignments` |
| `/judge/score/:teamId` | Judge Scoring | Score rubric criteria | `POST /judging/submissions/:id/scores` |
| `/invite/:code` | Invite Accept | Accept organizer invite | `GET/POST /api/v1/invites/:code` |
| `/invite/judge/:token` | Judge Invite | Accept judge invitation | `POST /api/v1/invites/judge/:token` |

## Layout

- **AppLayout** — Sidebar + TopBar wrapper
- **Sidebar** — Collapsible navigation with hackathon context, links change per-hackathon
- **TopBar** — Search bar (⌘K), notification bell with dropdown, user menu

## Notifications (TopBar)

The notification bell connects to:
- `GET /api/v1/notifications/unread-count` — badge count
- `GET /api/v1/notifications?limit=10` — dropdown list
- `PATCH /api/v1/notifications/:id/read` — mark individual read
- `PATCH /api/v1/notifications/read-all` — mark all read

## Query Layer

`lib/queries.ts` provides TanStack React Query factories:

| Factory | Queries |
|---------|---------|
| `hackathonQueries` | `all`, `detail(slug)`, `teams(slug)`, `teamDetail(slug, id)`, `submissions(slug)`, `judges(slug)`, `rubric(slug)`, `leaderboard(slug)`, `audit(slug)` |
| `judgeQueries` | `assignments()` |
| `notificationQueries` | `all()`, `unreadCount()` |
| `roundQueries` | `list(slug)` |
| `organizerQueries` | `list(slug)` |

## Key Components

| Component | Description |
|-----------|-------------|
| `PageHeader` | Title + badge + action buttons |
| `StatusBadge` | Hackathon status indicator |
| `MetricCard` | Stats display with icon |
| `EmptyState` | Content placeholder |
| `CountdownTimer` | Deadline countdown |

## State Transitions

The manage page (`hackathon-manage.tsx`) connects to `POST /api/v1/hackathons/:slug/transition` with:
```json
{ "target_status": "active", "version": 0 }
```
State flow: `draft → active → judging → completed → archived`

## Rubric Management

Draft hackathons allow rubric editing via the Rubric tab:
- Add/remove criteria (name, description, max_score, weight)
- Save all criteria via `POST /api/v1/hackathons/:slug/judging/rubric`
- Rubric locked after hackathon leaves draft state
