# API Contracts — DevSage API

**Generated:** 2026-02-18  
**Base URL:** `https://api.devsage.org`  
**Response Envelope:** `{ ok: true, data, meta }` / `{ ok: false, error: { code, message } }`

---

## Global Middleware Chain

All requests pass through (in order):
1. **CORS** — Dynamic origin validation per subdomain
2. **Request ID** — `X-Request-Id` UUID header
3. **Optional Auth** — JWT extraction from HttpOnly `access_token` cookie
4. **Error Handler** — Structured error responses

---

## Authentication Routes

**Prefix:** `/auth`  
**Rate Limited:** Yes (auth tier: 10 req/60s)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | — | User registration (email/password) |
| POST | `/login` | — | User login → sets access + refresh cookies |
| POST | `/refresh` | — | Rotate refresh token |
| POST | `/logout` | ✓ | Revoke all tokens in family |
| GET | `/me` | ✓ | Get current user profile & roles |
| GET | `/sessions` | ✓ | List active sessions |
| DELETE | `/sessions/:familyId` | ✓ | Revoke specific session |
| DELETE | `/sessions` | ✓ | Revoke all sessions |
| POST | `/delete-account` | ✓ | Request account deletion |
| POST | `/delete-account/confirm` | ✓ | Confirm account deletion |

---

## Hackathon Routes

**Prefix:** `/api/v1/hackathons`

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/workspaces/:workspaceId/hackathons` | ✓ | — | Create hackathon in workspace |
| GET | `/` | — | — | List all hackathons (public) |
| GET | `/:slug` | — | — | Get hackathon by slug |
| PATCH | `/:slug` | ✓ | co_organizer | Update hackathon settings |
| POST | `/:slug/transition` | ✓ | organizer | State machine transition |
| GET | `/:slug/state` | ✓ | co_organizer | Get DO state |
| DELETE | `/:slug` | ✓ | organizer | Delete hackathon |

---

## Team Routes

**Prefix:** `/api/v1/hackathons/:slug/teams`  
**Context:** hackathonContext

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | ✓ | Get authenticated user's team |
| POST | `/` | ✓ | Create team |
| GET | `/` | — | List teams in hackathon |
| GET | `/:teamId` | — | Get team by ID |
| GET | `/:teamId/members` | — | Get team members |
| POST | `/join` | ✓ | Join team via invite code |
| PATCH | `/:teamId` | ✓ | Update team (lead/organizer) |
| DELETE | `/:teamId/members/:userId` | ✓ | Remove member |
| POST | `/:teamId/leave` | ✓ | Leave team |
| POST | `/:teamId/transfer` | ✓ | Transfer leadership |
| POST | `/:teamId/dissolve` | ✓ | Dissolve team |

---

## Team Repos Routes

**Prefix:** `/api/v1/hackathons/:slug/teams`  
**Context:** hackathonContext

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:teamId/repo` | ✓ | Link GitHub repo (team lead only) |
| GET | `/:teamId/repo` | — | Get linked repo info |
| DELETE | `/:teamId/repo` | ✓ | Unlink repo (team lead only) |

---

## Submission Routes

**Prefix:** `/api/v1/hackathons/:slug/submissions`  
**Context:** hackathonContext

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | List submissions |
| GET | `/:submissionId` | — | Get submission by ID |
| GET | `/team/:teamId/current` | — | Get team's current submission |
| POST | `/` | ✓ | Create submission |

---

## Judging Routes

**Prefix:** `/api/v1/hackathons/:slug/judging`  
**Context:** hackathonContext

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/rubric` | ✓ | co_organizer | Create rubric criterion |
| GET | `/rubric` | — | — | Get rubric |
| PATCH | `/rubric/:criterionId` | ✓ | co_organizer | Update criterion |
| DELETE | `/rubric/:criterionId` | ✓ | co_organizer | Delete criterion |
| POST | `/judges` | ✓ | co_organizer | Invite judge |
| POST | `/judges/bulk` | ✓ | co_organizer | Bulk invite judges |
| GET | `/judges` | — | — | List judges |
| DELETE | `/judges/:judgeId` | ✓ | co_organizer | Remove judge |
| POST | `/judges/:judgeId/tracks` | ✓ | co_organizer | Assign tracks to judge |
| POST | `/assign` | ✓ | co_organizer | Assign submissions to judges |
| GET | `/judges/:judgeId/assignments` | ✓ | — | Get judge assignments |
| POST | `/submissions/:submissionId/scores` | ✓ | judge (exact) | Submit scores |
| GET | `/submissions/:submissionId/scores` | ✓ | judge+ | Get scores |
| GET | `/leaderboard` | — | — | Get leaderboard |
| POST | `/results/publish` | ✓ | organizer | Publish results |

---

## Round Routes

**Prefix:** `/api/v1/hackathons/:slug/rounds`  
**Context:** hackathonContext

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/` | ✓ | co_organizer | Create round |
| GET | `/` | — | — | List rounds |
| PATCH | `/:roundId` | ✓ | co_organizer | Update round |
| PATCH | `/:roundId/initialize` | ✓ | co_organizer | Initialize round |
| DELETE | `/:roundId` | ✓ | co_organizer | Delete round |

---

## Organizer Routes

**Prefix:** `/api/v1/hackathons/:slug/organizers`  
**Context:** hackathonContext

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | ✓ | co_organizer | List organizers |
| POST | `/` | ✓ | organizer | Add organizer |
| DELETE | `/:roleId` | ✓ | organizer | Remove organizer |

---

## Announcement Routes

**Prefix:** `/api/v1/hackathons/:slug/announcements`  
**Context:** hackathonContext

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | — | — | List announcements |
| POST | `/` | ✓ | co_organizer | Create announcement |
| PATCH | `/:announcementId` | ✓ | co_organizer | Update announcement |
| DELETE | `/:announcementId` | ✓ | co_organizer | Delete announcement |

---

## Audit Routes

**Prefix:** `/api/v1/hackathons/:slug/audit`  
**Context:** hackathonContext

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | ✓ | co_organizer | Query audit events |

---

## Workspace Routes

**Prefix:** `/api/v1/workspaces`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | ✓ | Create workspace |
| GET | `/` | ✓ | List user's workspaces |
| GET | `/:workspaceId` | ✓ | Get workspace |
| PATCH | `/:workspaceId` | ✓ | Update (owner/admin) |
| GET | `/:workspaceId/members` | ✓ | List workspace members |
| POST | `/:workspaceId/invites` | ✓ | Invite member |
| DELETE | `/:workspaceId/members/:userId` | ✓ | Remove member |

---

## Notification Routes

**Prefix:** `/api/v1/notifications`  
**Auth:** All routes require authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | ✓ | List notifications |
| GET | `/unread-count` | ✓ | Get unread count |
| PATCH | `/:notificationId/read` | ✓ | Mark as read |
| PATCH | `/read-all` | ✓ | Mark all as read |

---

## Invite Routes

**Prefix:** `/api/v1/invites`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/team/:token` | ✓ | Accept team invite |
| GET | `/judge/:id/details` | — | Get judge invite details |
| POST | `/judge/:id` | ✓ | Accept judge invite |
| POST | `/judge/:id/decline` | — | Decline judge invite |

---

## Admin Routes

**Prefix:** `/api/v1/admin`  
**Auth:** All routes require `authMiddleware` + `requirePlatformAdmin`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users` | ✓ Admin | List all users (paginated) |
| GET | `/hackathons` | ✓ Admin | List all hackathons (paginated) |
| POST | `/admins` | ✓ Admin | Add platform admin |
| DELETE | `/admins/:userId` | ✓ Admin | Remove platform admin |
| GET | `/admins` | ✓ Admin | List platform admins |
| POST | `/audit/backfill` | ✓ Admin | Trigger audit hash backfill |
| GET | `/stats` | ✓ Admin | System stats |
| GET | `/hackathons/:hackathonId` | ✓ Admin | Hackathon details (admin view) |
| GET | `/hackathons/:hackathonId/rounds` | ✓ Admin | List rounds (admin) |
| PATCH | `/hackathons/:hackathonId/rounds/:roundId/initialize` | ✓ Admin | Toggle round initialization |

---

## Webhook Routes

**Prefix:** `/webhooks`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/github` | HMAC signature | GitHub webhook receiver |

---

## Queue Consumers

| Queue | Handler | Max Batch | Max Retries |
|-------|---------|-----------|-------------|
| `github-webhooks` | Push, Tag, Installation handlers | 10 | 3 |
| `devsage-notifications` | Email + in-app notification delivery | 10 | 3 |

## Cron Triggers

| Schedule | Handler | Description |
|----------|---------|-------------|
| `0 * * * *` | cronHandler | Hourly: submission deadlines, reminders |
