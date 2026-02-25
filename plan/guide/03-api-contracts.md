# 03 — API Contracts

Every endpoint in the system. Method, path, required role, request shape, response shape, error cases.

---

## Auth (`/auth`)

See `02-auth.md` for full details. Summary:

| # | Method | Path | Auth | Body / Query | Success Response |
|---|--------|------|------|-------------|-----------------|
| 1 | POST | `/auth/register` | ❌ | `{email, name, password}` | 201 `{id, email, name}` + cookies |
| 2 | POST | `/auth/login` | ❌ | `{email, password}` | 200 `{id, email, name, avatar_url, password_must_change}` + cookies |
| 3 | GET | `/auth/google` | ❌ | — | 302 redirect to Google |
| 4 | GET | `/auth/callback/google` | ❌ | `?code&state` | 302 redirect to frontend + cookies |
| 5 | GET | `/auth/github` | ❌ | — | 302 redirect to GitHub |
| 6 | GET | `/auth/callback/github` | ❌ | `?code&state` | 302 redirect to frontend + cookies |
| 7 | POST | `/auth/refresh` | ❌ | — (cookie) | 200 `{refreshed: true}` + new cookies |
| 8 | POST | `/auth/logout` | ✅ | — | 200 `{logged_out: true}` |
| 9 | GET | `/auth/me` | ✅ | — | 200 user + roles + password_must_change |
| 10 | GET | `/auth/sessions` | ✅ | — | 200 array of sessions |
| 11 | DELETE | `/auth/sessions/:familyId` | ✅ | — | 200 `{revoked: true}` |
| 12 | DELETE | `/auth/sessions` | ✅ | — | 200 `{revoked_all: true}` |
| 13 | POST | `/auth/change-password` | ✅ | `{current_password, new_password}` | 200 `{message}` |
| 14 | POST | `/auth/forgot-password` | ❌ | `{email}` | 200 `{message}` (always) |
| 15 | POST | `/auth/reset-password` | ❌ | `{token, password}` | 200 `{message}` |
| 16 | POST | `/auth/send-verification` | ✅ | — | 200 `{message}` |
| 17 | POST | `/auth/verify-email` | ✅ | `{otp}` | 200 `{verified: true}` |
| 18 | POST | `/auth/delete-account` | ✅ | — | 200 `{confirmation_token}` |
| 19 | POST | `/auth/delete-account/confirm` | ✅ | `{confirmation_token}` | 200 `{deleted: true}` |

---

## Hackathons (`/api/v1/hackathons`)

| # | Method | Path | Role | Body / Query | Success Response |
|---|--------|------|------|-------------|-----------------|
| 1 | GET | `/hackathons` | Public | `?limit&offset&status` | 200 paginated hackathon list |
| 2 | POST | `/hackathons` | Auth | `{workspace_id, title, slug, ...}` | 201 created hackathon |
| 3 | GET | `/hackathons/:slug` | Public | — | 200 hackathon detail + ETag |
| 4 | PATCH | `/hackathons/:slug` | Co-Organizer+ | `{title?, dates?, sizes?, settings?}` | 200 updated hackathon |
| 5 | DELETE | `/hackathons/:slug` | Organizer | — (draft only) | 200 `{deleted: true}` |
| 6 | POST | `/hackathons/:slug/transition` | Organizer | `{target_status, version}` | 200 transition result |
| 7 | GET | `/hackathons/:slug/state` | Co-Organizer+ | — | 200 DO state vs D1 sync |

### Hackathon Create Body
```json
{
  "workspace_id": "uuid",
  "title": "string (1-200)",
  "slug": "string (1-100, /^[a-z0-9-]+$/)",
  "description?": "string (≤5000)",
  "start_date?": "ISO-8601",
  "end_date?": "ISO-8601",
  "submission_deadline?": "ISO-8601",
  "max_team_size?": "1-50 (default 5)",
  "min_team_size?": "≥1 (default 1)",
  "max_teams?": "int",
  "settings?": "JSON object",
  "template_id?": "uuid"
}
```

---

## Teams (`/api/v1/hackathons/:slug/teams`)

| # | Method | Path | Role | Body / Query | Success Response |
|---|--------|------|------|-------------|-----------------|
| 1 | GET | `/teams/me` | Auth | — | 200 `{team, members, role}` |
| 2 | POST | `/teams` | Auth | `{name, track_id?}` | 201 created team |
| 3 | GET | `/teams` | Public | `?limit&offset` | 200 paginated teams |
| 4 | GET | `/teams/:teamId` | Public | — | 200 team detail |
| 5 | GET | `/teams/:teamId/members` | Public | — | 200 member array |
| 6 | POST | `/teams/join` | Auth | `{invite_code}` (8 chars) | 200 `{joined: true, team_id}` |
| 7 | PATCH | `/teams/:teamId` | Leader/Org | `{name?, track_id?}` | 200 updated team |
| 8 | DELETE | `/teams/:teamId/members/:userId` | Leader/Org | — | 200 `{removed: true}` |
| 9 | POST | `/teams/:teamId/leave` | Auth | — | 200 `{left: true}` |
| 10 | POST | `/teams/:teamId/transfer` | Leader | `{new_leader_id}` | 200 `{transferred: true}` |
| 11 | POST | `/teams/:teamId/dissolve` | Leader/Org | — | 200 `{dissolved: true}` |
| 12 | POST | `/teams/seed` | Co-Organizer+ | `{mode, teams?, emails?, send_invites?}` | 200 seed results |

### Team Repos (mounted on same path)
| # | Method | Path | Role | Body | Response |
|---|--------|------|------|------|----------|
| 13 | POST | `/teams/:teamId/repo` | Leader | `{github_repo_url}` | 201 repo object |
| 14 | GET | `/teams/:teamId/repo` | Public | — | 200 repo object |
| 15 | DELETE | `/teams/:teamId/repo` | Leader | — | 200 `{unlinked: true}` |

---

## Submissions (`/api/v1/hackathons/:slug/submissions`)

| # | Method | Path | Role | Body / Query | Success Response |
|---|--------|------|------|-------------|-----------------|
| 1 | GET | `/submissions/github/repos` | Auth | — | 200 `{github_username, repos}` |
| 2 | POST | `/submissions/github/analyze` | Auth | `{owner, repo}` | 200 analysis object |
| 3 | POST | `/submissions/github/ai-review` | Auth | `{analysis}` | 200 AI review |
| 4 | GET | `/submissions` | Public | `?limit&offset&team_id&round_id&current_only` | 200 paginated submissions |
| 5 | GET | `/submissions/ai-leaderboard` | Public | `?limit&offset` | 200 AI score leaderboard |
| 6 | GET | `/submissions/team/:teamId/current` | Public | — | 200 current submission |
| 7 | GET | `/submissions/:submissionId` | Public | — | 200 submission + parsed analysis |
| 8 | POST | `/submissions` | Team member | `{title, repo_url, description, ...}` | 201 created submission |

---

## Judging (`/api/v1/hackathons/:slug/judging`)

| # | Method | Path | Role | Body | Response |
|---|--------|------|------|------|----------|
| 1 | POST | `/judging/rubric` | Co-Org+ | `{name, weight, description?, max_score?, track_id?, sort_order?, round?}` | 201 criterion |
| 2 | GET | `/judging/rubric` | Public | — | 200 criteria array |
| 3 | PATCH | `/judging/rubric/:criterionId` | Co-Org+ | partial updates | 200 updated criterion |
| 4 | DELETE | `/judging/rubric/:criterionId` | Co-Org+ | — | 200 `{deleted: true}` |
| 5 | POST | `/judging/judges` | Co-Org+ | `{email?, user_id?, track_id?}` | 201 judge + invite_token |
| 6 | POST | `/judging/judges/bulk` | Co-Org+ | `{user_ids: string[]}` | 200 results array |
| 7 | GET | `/judging/judges` | Public | — | 200 judges array |
| 8 | DELETE | `/judging/judges/:judgeId` | Co-Org+ | — | 200 `{deleted: true}` |
| 9 | POST | `/judging/judges/create-account` | Co-Org+ | `{email, name, temp_password, track_id?}` | 201 judge with user |
| 10 | POST | `/judging/judges/:judgeId/tracks` | Co-Org+ | `{track_id?}` | 200 `{updated: true}` |
| 11 | POST | `/judging/judges/:judgeId/accept` | Co-Org+ | — | 200 `{accepted: true}` |
| 12 | POST | `/judging/assign` | Co-Org+ | `{round_id?}` | 200 assignment result |
| 13 | GET | `/judging/judges/:judgeId/assignments` | Auth | — | 200 assignments array |
| 14 | GET | `/judging/my-assignments` | Auth | — | 200 current judge's assignments |
| 15 | GET | `/judging/my-scores` | Auth | — | 200 current judge's scores |
| 16 | POST | `/judging/submissions/:submissionId/scores` | Judge | `{scores: [{criteria_id, score, comment?, assignment_id, round?}]}` | 200 `{scored: true}` |
| 17 | GET | `/judging/submissions/:submissionId/scores` | Judge | — | 200 scores array |
| 18 | GET | `/judging/leaderboard` | Public | `?round_id&track_id` | 200 leaderboard + ETag |
| 19 | POST | `/judging/assignments/:assignmentId/coi` | Judge | `{reason}` | 200 `{conflict_declared: true}` |
| 20 | GET | `/judging/coi` | Co-Org+ | — | 200 COI list |
| 21 | POST | `/judging/assignments/:assignmentId/reassign` | Co-Org+ | `{new_judge_id}` | 200 `{reassigned: true}` |
| 22 | POST | `/judging/results/publish` | Organizer | `{round_id?}` | 200 `{published: true, results}` |

---

## Rounds (`/api/v1/hackathons/:slug/rounds`)

| # | Method | Path | Role | Body | Response |
|---|--------|------|------|------|----------|
| 1 | POST | `/rounds` | Co-Org+ | `{name, round_number, type?, submission_deadline?}` | 201 created round |
| 2 | GET | `/rounds` | Public | — | 200 rounds array (ordered) |
| 3 | PATCH | `/rounds/:roundId` | Co-Org+ | partial updates | 200 updated round |
| 4 | PATCH | `/rounds/:roundId/initialize` | Co-Org+ | `{is_initialized: boolean}` | 200 updated round |
| 5 | DELETE | `/rounds/:roundId` | Co-Org+ | — | 200 `{deleted: true}` |
| 6 | GET | `/rounds/:roundId/results` | Public | `?limit&offset` | 200 paginated results |
| 7 | POST | `/rounds/:roundId/advance` | Co-Org+ | `{advancing_team_ids}` | 200 `{advanced, eliminated}` |
| 8 | POST | `/rounds/:roundId/publish` | Co-Org+ | — | 200 `{teams_ranked, round_type}` |

---

## Organizers (`/api/v1/hackathons/:slug/organizers`)

| # | Method | Path | Role | Body | Response |
|---|--------|------|------|------|----------|
| 1 | GET | `/organizers` | Co-Org+ | — | 200 organizer array |
| 2 | POST | `/organizers` | Organizer | `{user_id, role}` | 201 `{id, role}` |
| 3 | DELETE | `/organizers/:roleId` | Organizer | — | 200 `{removed: true}` |

---

## Announcements (`/api/v1/hackathons/:slug/announcements`)

| # | Method | Path | Role | Body | Response |
|---|--------|------|------|------|----------|
| 1 | GET | `/announcements` | Public | — | 200 announcements array |
| 2 | POST | `/announcements` | Co-Org+ | `{title, content, pinned?}` | 201 created |
| 3 | PATCH | `/announcements/:id` | Co-Org+ | `{title?, content?, pinned?}` | 200 updated |
| 4 | DELETE | `/announcements/:id` | Co-Org+ | — | 200 `{deleted: true}` |

---

## Audit (`/api/v1/hackathons/:slug/audit`)

| # | Method | Path | Role | Query | Response |
|---|--------|------|------|-------|----------|
| 1 | GET | `/audit` | Co-Org+ | `?limit&cursor&action&entity_type&entity_id&actor_id` | 200 cursor-paginated events |

---

## Workspaces (`/api/v1/workspaces`)

| # | Method | Path | Role | Body / Query | Response |
|---|--------|------|------|-------------|----------|
| 1 | POST | `/workspaces` | Platform Admin | `{name, slug, type}` | 201 workspace |
| 2 | GET | `/workspaces` | Auth | — | 200 user's workspaces |
| 3 | GET | `/workspaces/:id` | Auth | — | 200 workspace + members + hackathons |
| 4 | PATCH | `/workspaces/:id` | Owner/Admin | `{name?, description?}` | 200 updated |
| 5 | GET | `/workspaces/:id/members` | Auth | — | 200 members array |
| 6 | POST | `/workspaces/:id/invites` | Owner/Admin | `{email, role}` | 201 `{id, invite_token}` |
| 7 | DELETE | `/workspaces/:id/members/:userId` | Owner | — | 200 `{removed: true}` |
| 8 | GET | `/workspaces/invites/token/:token` | Public | — | 200 invite details |
| 9 | POST | `/workspaces/invites/token/:token/accept` | Auth | — | 200 `{accepted: true}` |
| 10 | POST | `/workspaces/invites/token/:token/decline` | Auth | — | 200 `{declined: true}` |

---

## Notifications (`/api/v1/notifications`)

| # | Method | Path | Role | Query | Response |
|---|--------|------|------|-------|----------|
| 1 | GET | `/notifications` | Auth | `?limit&offset&hackathon_id` | 200 paginated |
| 2 | GET | `/notifications/unread-count` | Auth | — | 200 `{count}` |
| 3 | PATCH | `/notifications/:id/read` | Auth | — | 200 `{read: true}` |
| 4 | PATCH | `/notifications/read-all` | Auth | — | 200 `{read_all: true}` |

---

## Invites (`/api/v1/invites`)

| # | Method | Path | Role | Body | Response |
|---|--------|------|------|------|----------|
| 1 | POST | `/invites/team/:token` | Auth | — | 200 `{accepted: true, team_id}` |
| 2 | GET | `/invites/judge/:id/details` | Public | — | 200 invite details |
| 3 | POST | `/invites/judge/:id` | Auth | — | 200 `{accepted: true}` |
| 4 | POST | `/invites/judge/:id/decline` | Public | — | 200 `{declined: true}` |
| 5 | GET | `/invites/judge/token/:token` | Public | — | 200 invite + `user_exists` flag |
| 6 | POST | `/invites/judge/token/:token/accept` | Public | `{name?, password?}` | 200 `{accepted: true, user_created}` |
| 7 | POST | `/invites/judge/token/:token/decline` | Public | — | 200 `{declined: true}` |

---

## Judge Portal (`/api/v1/judge`)

| # | Method | Path | Role | Response |
|---|--------|------|------|----------|
| 1 | GET | `/judge/hackathons` | Auth (judge) | 200 hackathons + assignment counts |

---

## Hackathon Requests (`/api/v1/hackathon-requests`)

| # | Method | Path | Role | Body / Query | Response |
|---|--------|------|------|-------------|----------|
| 1 | POST | `/hackathon-requests` | Auth | `{workspace_id, title, description, dates, sizes}` | 201 request |
| 2 | GET | `/hackathon-requests` | Auth | `?limit&offset` | 200 user's requests |
| 3 | GET | `/hackathon-requests/:id` | Auth (owner) | — | 200 request detail |
| 4 | GET | `/hackathon-requests/admin/all` | Platform Admin | `?limit&offset&status` | 200 all requests |
| 5 | PATCH | `/hackathon-requests/admin/:id` | Platform Admin | `{status, admin_notes?}` | 200 updated (auto-creates hackathon if "ready") |
| 6 | PUT | `/hackathon-requests/:id/resubmit` | Auth (owner) | full body | 200 resubmitted |
| 7 | GET | `/hackathon-requests/admin/stats` | Platform Admin | — | 200 counts by status |

---

## Admin (`/api/v1/admin`)

All endpoints require `requirePlatformAdmin` middleware.

| # | Method | Path | Body / Query | Response |
|---|--------|------|-------------|----------|
| 1 | GET | `/admin/users` | `?limit&offset` | 200 paginated users |
| 2 | GET | `/admin/hackathons` | `?limit&offset` | 200 paginated hackathons |
| 3 | GET | `/admin/hackathons/:id` | — | 200 hackathon detail |
| 4 | GET | `/admin/hackathons/:id/rounds` | — | 200 rounds array |
| 5 | PATCH | `/admin/hackathons/:id/rounds/:roundId/initialize` | `{is_initialized}` | 200 updated round |
| 6 | POST | `/admin/admins` | `{user_id}` | 201 `{id}` |
| 7 | DELETE | `/admin/admins/:userId` | — | 200 `{removed: true}` |
| 8 | GET | `/admin/admins` | — | 200 admins array |
| 9 | POST | `/admin/audit/backfill` | — | 200 `{processed}` |
| 10 | GET | `/admin/stats` | — | 200 system-wide counts |
| 11 | GET | `/admin/invites` | `?limit&offset` | 200 paginated invites |
| 12 | POST | `/admin/invites` | `{email}` | 201 invite |
| 13 | DELETE | `/admin/invites/:id` | — | 200 `{revoked: true}` |
| 14 | GET | `/admin/workspaces` | — | 200 all workspaces + stats |
| 15 | POST | `/admin/workspaces` | `{name, slug, type, owner_email}` | 201 workspace + invite |
| 16 | GET | `/admin/workspaces/:id` | — | 200 workspace detail |

---

## Webhooks (`/webhooks`)

| # | Method | Path | Auth | Headers | Response |
|---|--------|------|------|---------|----------|
| 1 | POST | `/webhooks/github` | HMAC | `X-Hub-Signature-256`, `X-GitHub-Event`, `X-GitHub-Delivery` | 200 `{received: true}` |

---

**Total: 108 endpoints** (48 GET, 37 POST, 10 PATCH, 12 DELETE, 1 PUT)
