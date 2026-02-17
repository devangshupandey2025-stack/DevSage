# Admin App — `shikdd.devsage.org`

Platform administration panel. Package: `@devsage/admin`

## Access Control

All routes (except `/login`) require:
1. Valid authentication (JWT cookie)
2. `isPlatformAdmin` flag (user exists in `platform_admins` table)

Non-admins see an "Access Denied" page.

## Pages

| Route | Page | Description | API Endpoints |
|-------|------|-------------|---------------|
| `/login` | Login | Email/password sign-in | `POST /auth/login` |
| `/` | Dashboard | Platform stats, quick actions, audit backfill | `GET /api/v1/admin/stats`, `POST /api/v1/admin/audit/backfill` |
| `/users` | Users | Paginated user list with search | `GET /api/v1/admin/users?limit=20&offset=0` |
| `/hackathons` | Hackathons | All hackathons with status badges | `GET /api/v1/admin/hackathons?limit=20&offset=0` |
| `/admins` | Admins | Admin list with add/remove functionality | `GET /api/v1/admin/admins`, `POST /api/v1/admin/admins`, `DELETE /api/v1/admin/admins/:userId` |
| `/invites` | Invites | Organizer invite management with pagination | `GET/POST/DELETE /api/v1/admin/invites` |
| `/workspaces` | Workspaces | Workspace cards with member/hackathon counts | `GET /api/v1/admin/workspaces` |
| `/workspaces/:id` | Workspace Detail | Members, hackathons for a workspace | `GET /api/v1/admin/workspaces/:id`, `GET /members`, `GET /hackathons` |
| `/profile` | Profile | User info, roles | `GET /auth/me` |

## Dashboard Features

### Statistics Cards
- Total Users
- Total Workspaces (mapped from teams in stats API)
- Total Hackathons
- Active Hackathons (mapped from submissions in stats API)

### Quick Actions
- Manage Invites → `/invites`
- Workspaces → `/workspaces`
- Admins → `/admins`
- Users → `/users`

### Maintenance
- **Audit Hash Backfill** — Processes up to 500 unhashed audit events for hash chain integrity via `POST /api/v1/admin/audit/backfill`

## Admin Management

The admins page (`/admins`) provides:
- **List** all platform admins with name, email, join date
- **Add** admin by entering a user UUID → `POST /api/v1/admin/admins`
- **Remove** admin (cannot self-remove) → `DELETE /api/v1/admin/admins/:userId`

## Navigation

Top navbar with links:
- Dashboard
- Users
- Hackathons
- Invites
- Admins
- Workspaces
- Profile (dropdown)

## API Endpoints Used

| Endpoint | Method | Page |
|----------|--------|------|
| `POST /auth/login` | POST | Login |
| `GET /auth/me` | GET | Auth context |
| `POST /auth/logout` | POST | Auth context |
| `POST /auth/refresh` | POST | API wrapper (auto) |
| `GET /api/v1/admin/stats` | GET | Dashboard |
| `POST /api/v1/admin/audit/backfill` | POST | Dashboard |
| `GET /api/v1/admin/users` | GET | Users |
| `GET /api/v1/admin/hackathons` | GET | Hackathons |
| `GET /api/v1/admin/admins` | GET | Admins |
| `POST /api/v1/admin/admins` | POST | Admins |
| `DELETE /api/v1/admin/admins/:userId` | DELETE | Admins |
| `GET /api/v1/admin/invites` | GET | Invites |
| `POST /api/v1/admin/invites` | POST | Invites |
| `DELETE /api/v1/admin/invites/:id` | DELETE | Invites |
| `GET /api/v1/admin/workspaces` | GET | Workspaces |
| `GET /api/v1/admin/workspaces/:id` | GET | Workspace Detail |
| `GET /api/v1/admin/workspaces/:id/members` | GET | Workspace Detail |
| `GET /api/v1/admin/workspaces/:id/hackathons` | GET | Workspace Detail |
