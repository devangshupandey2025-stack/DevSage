# Route Table

> Complete list of API endpoints with method, auth, and minimum role.

## Auth Routes (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/github` | — | Start GitHub OAuth |
| GET | `/auth/callback/github` | — | GitHub OAuth callback |
| GET | `/auth/google` | — | Start Google OAuth |
| GET | `/auth/callback/google` | — | Google OAuth callback |
| GET | `/auth/github/elevate` | ✅ | Re-auth with expanded scopes |
| GET | `/auth/me` | ✅ | Get current user |
| POST | `/auth/refresh` | cookie | Rotate refresh token |
| POST | `/auth/logout` | ✅ | Logout current session |
| POST | `/auth/logout-all` | ✅ | Logout all sessions |
| GET | `/auth/sessions` | ✅ | List active sessions |
| DELETE | `/auth/sessions/:familyId` | ✅ | Revoke a session |
| DELETE | `/auth/account` | ✅ | Initiate account deletion |
| POST | `/auth/account/delete-confirm` | ✅ | Confirm deletion |
| GET | `/auth/account/export` | ✅ | GDPR data export |

## Workspace Routes (`/api/v1/workspaces`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/workspaces` | admin | platform_admin | Create workspace |
| GET | `/workspaces` | ✅ | — | List my workspaces |
| GET | `/workspaces/:id` | ✅ | ws_member | Get workspace |
| PATCH | `/workspaces/:id` | ✅ | ws_owner | Update workspace |
| POST | `/workspaces/:id/members` | ✅ | ws_admin | Invite member |
| GET | `/workspaces/:id/members` | ✅ | ws_member | List members |
| DELETE | `/workspaces/:id/members/:userId` | ✅ | ws_admin | Remove member |
| GET | `/workspaces/:id/hackathons` | ✅ | ws_member | List hackathons |

## Hackathon Routes (`/api/v1/hackathons`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/hackathons` | ✅ | ws_admin | Create hackathon |
| GET | `/hackathons/:slug` | opt | — | Get hackathon (public fields) |
| PATCH | `/hackathons/:slug` | ✅ | co_organizer | Update hackathon |
| DELETE | `/hackathons/:slug` | ✅ | organizer | Delete hackathon |
| POST | `/hackathons/:slug/transition` | ✅ | organizer | Transition state |

## Team Routes (`/api/v1/hackathons/:slug/teams`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/teams` | ✅ | team_member | List teams |
| POST | `/teams` | ✅ | co_organizer | Create team |
| POST | `/teams/join` | ✅ | — | Join via invite code |
| POST | `/teams/bulk-invite` | ✅ | co_organizer | Bulk Excel upload |
| GET | `/teams/:teamId` | ✅ | team_member | Get team |
| DELETE | `/teams/:teamId` | ✅ | co_organizer | Dissolve team |
| POST | `/teams/:teamId/invites` | ✅ | team_lead | Invite member |
| POST | `/teams/:teamId/leave` | ✅ | team_member | Leave team |
| POST | `/teams/:teamId/transfer-lead` | ✅ | team_lead | Transfer leadership |
| DELETE | `/teams/:teamId/members/:userId` | ✅ | team_lead | Remove member |
| GET | `/teams/:teamId/readiness` | ✅ | team_member | Readiness check |

## Repo Routes (`/api/v1/hackathons/:slug/teams/:teamId/repos`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/repos` | ✅ | team_lead | Link GitHub repo |
| DELETE | `/repos/:repoId` | ✅ | team_lead | Unlink repo |

## Submission Routes (`/api/v1/hackathons/:slug/submissions`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/submissions` | ✅ | judge | List all submissions |
| GET | `/submissions/:id` | ✅ | team_member | Get submission |
| GET | `/submissions/:id/diff` | ✅ | judge | Get diff |
| POST | `/submissions/:id/override` | ✅ | organizer | Override status |

## Judging Routes (`/api/v1/hackathons/:slug`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/rubric` | ✅ | judge | Get rubric |
| POST | `/rubric` | ✅ | co_organizer | Set rubric |
| PATCH | `/rubric/:criterionId` | ✅ | co_organizer | Update criterion |
| GET | `/judges` | ✅ | co_organizer | List judges |
| POST | `/judges` | ✅ | co_organizer | Invite judge |
| GET | `/judges/me/assignments` | ✅ | judge | My assignments |
| POST | `/scores` | ✅ | judge | Submit scores |
| GET | `/leaderboard` | ✅ | varies | Get leaderboard |
| POST | `/results/publish` | ✅ | organizer | Publish results |
| POST | `/results/unpublish` | ✅ | organizer | Unpublish results |

## Round Routes (`/api/v1/hackathons/:slug/rounds`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/rounds` | ✅ | team_member | List rounds |
| POST | `/rounds` | ✅ | organizer | Create round |
| PATCH | `/rounds/:roundId` | ✅ | organizer | Update round |
| POST | `/rounds/:roundId/advance` | ✅ | organizer | Mark advancing teams |

## Other Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/github` | HMAC | GitHub webhook receiver |
| GET | `/api/v1/notifications` | ✅ | List notifications |
| POST | `/api/v1/notifications/:id/read` | ✅ | Mark read |
| POST | `/api/v1/notifications/read-all` | ✅ | Mark all read |
| GET | `/api/v1/hackathons/:slug/audit` | ✅ organizer | Query audit log |
| POST | `/api/v1/invites/:token/accept` | ✅ | Accept team invite |
| POST | `/api/v1/invites/judge/:token/accept` | ✅ | Accept judge invite |
| GET | `/api/v1/templates` | ✅ | List templates |
| POST | `/api/v1/templates` | ✅ | Create template |
| GET | `/` | — | Health check |
