# Teams API

Base URL: `https://api.devsage.org`
Route prefix: `/api/v1/hackathons/:slug/teams`

All routes require hackathon context — the `:slug` path parameter resolves to a hackathon via the `hackathonContext` middleware.

All responses follow the standard envelope format:
- **Success**: `{ "ok": true, "data": ..., "meta": ... }`
- **Error**: `{ "ok": false, "error": { "code": "...", "message": "..." } }`

---

## Team Roles

| Role | Description |
|------|-------------|
| `leader` | Team creator. Can update team, remove members, transfer leadership, dissolve team. |
| `member` | Regular team member. Can leave the team. |

A team always has exactly one `leader`. Leadership must be transferred before the leader can leave.

## Invite Codes

Each team gets a unique invite code generated at creation. Other authenticated users can join the team by providing this code via the `/join` endpoint. Invite codes are scoped to the hackathon — a code is only valid within the hackathon the team belongs to.

## Team Size Limits

- `min_team_size` and `max_team_size` are configured per-hackathon (defaults: 1–5).
- The join endpoint enforces `max_team_size` — once the team is full, further joins are rejected with `409 TEAM_FULL`.
- `max_teams` is an optional per-hackathon cap on total team count. When reached, new team creation is rejected with `409 MAX_TEAMS_REACHED`.

---

## Endpoints

### POST /api/v1/hackathons/:slug/teams

Create a new team. The creator is automatically added as the team `leader`.

**Auth**: Required (JWT)
**Role**: Any authenticated user
**Hackathon status**: Must be `draft` or `active`

#### Request Body

```json
{
  "name": "Byte Builders",
  "track_id": "t1r2a3c4-..."
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | **Yes** | Team display name |
| `track_id` | No | UUID of the hackathon track to compete in |

#### Response `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "tm1a2b3c-...",
    "hackathon_id": "h1a2b3c4-...",
    "name": "Byte Builders",
    "description": "",
    "invite_code": "BYT3-BLDR",
    "track_id": "t1r2a3c4-...",
    "created_at": "2026-06-15T10:00:00.000Z",
    "updated_at": "2026-06-15T10:00:00.000Z"
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing `name` |
| 409 | `INVALID_STATE` | Hackathon is not in `draft` or `active` status |
| 409 | `ALREADY_ON_TEAM` | User is already on a team in this hackathon |
| 409 | `MAX_TEAMS_REACHED` | Hackathon team limit reached |

---

### GET /api/v1/hackathons/:slug/teams

List all teams in a hackathon with pagination.

**Auth**: None (public)

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | `20` | Results per page (max `100`) |
| `offset` | integer | `0` | Pagination offset |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "tm1a2b3c-...",
      "hackathon_id": "h1a2b3c4-...",
      "name": "Byte Builders",
      "description": "",
      "invite_code": "BYT3-BLDR",
      "track_id": "t1r2a3c4-...",
      "created_at": "2026-06-15T10:00:00.000Z",
      "updated_at": "2026-06-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 12,
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

---

### GET /api/v1/hackathons/:slug/teams/:teamId

Get a single team by ID.

**Auth**: None (public)

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `teamId` | UUID | Team ID |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "tm1a2b3c-...",
    "hackathon_id": "h1a2b3c4-...",
    "name": "Byte Builders",
    "description": "",
    "invite_code": "BYT3-BLDR",
    "track_id": "t1r2a3c4-...",
    "created_at": "2026-06-15T10:00:00.000Z",
    "updated_at": "2026-06-15T10:00:00.000Z"
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 404 | `NOT_FOUND` | No team with that ID in this hackathon |

---

### GET /api/v1/hackathons/:slug/teams/:teamId/members

List all members of a team, including user profile information.

**Auth**: None (public)

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `teamId` | UUID | Team ID |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "mem1a2b3-...",
      "user_id": "u1v2w3x4-...",
      "role": "leader",
      "joined_at": "2026-06-15T10:00:00.000Z",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345"
    },
    {
      "id": "mem4d5e6-...",
      "user_id": "u5v6w7x8-...",
      "role": "member",
      "joined_at": "2026-06-15T11:30:00.000Z",
      "name": "John Smith",
      "email": "john@example.com",
      "avatar_url": "https://avatars.githubusercontent.com/u/67890"
    }
  ]
}
```

---

### POST /api/v1/hackathons/:slug/teams/join

Join an existing team using an invite code.

**Auth**: Required (JWT)

#### Request Body

```json
{
  "invite_code": "BYT3-BLDR"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `invite_code` | **Yes** | The team's invite code |

#### Response `201 Created`

```json
{
  "ok": true,
  "data": {
    "joined": true,
    "team_id": "tm1a2b3c-..."
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing `invite_code` |
| 404 | `INVALID_INVITE_CODE` | No team with that code in this hackathon |
| 409 | `ALREADY_ON_TEAM` | User is already on a team in this hackathon |
| 409 | `TEAM_FULL` | Team has reached `max_team_size` |

#### Side Effects

- Sends a `team_joined` notification via the notification queue to existing team members.

---

### PATCH /api/v1/hackathons/:slug/teams/:teamId

Update team details.

**Auth**: Required (JWT)
**Role**: Team `leader` or hackathon organizer

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `teamId` | UUID | Team ID |

#### Request Body

```json
{
  "name": "Byte Builders v2",
  "track_id": "t9r8a7c6-..."
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | No | New team name |
| `track_id` | No | New track UUID (set to `null` to clear) |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "tm1a2b3c-...",
    "hackathon_id": "h1a2b3c4-...",
    "name": "Byte Builders v2",
    "track_id": "t9r8a7c6-...",
    "updated_at": "2026-06-16T08:00:00.000Z"
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | No valid fields in request body |
| 403 | `FORBIDDEN` | User is not team leader or organizer |

---

### DELETE /api/v1/hackathons/:slug/teams/:teamId/members/:userId

Remove a member from the team.

**Auth**: Required (JWT)
**Role**: Team `leader` or hackathon organizer

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `teamId` | UUID | Team ID |
| `userId` | UUID | User ID to remove |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "removed": true
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 403 | `FORBIDDEN` | User is not team leader or organizer |
| 409 | `CANNOT_REMOVE_SELF` | Leader tried to remove themselves (must transfer leadership first) |

---

### POST /api/v1/hackathons/:slug/teams/:teamId/leave

Leave a team voluntarily. Leaders cannot leave — they must transfer leadership first.

**Auth**: Required (JWT)

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `teamId` | UUID | Team ID |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "left": true
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 404 | `NOT_FOUND` | User is not a member of this team |
| 409 | `CANNOT_LEAVE_AS_LEAD` | Leaders must transfer leadership before leaving |

---

### POST /api/v1/hackathons/:slug/teams/:teamId/transfer

Transfer team leadership to another team member. The current leader is demoted to `member`.

**Auth**: Required (JWT)
**Role**: Team `leader` only

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `teamId` | UUID | Team ID |

#### Request Body

```json
{
  "new_leader_id": "u5v6w7x8-..."
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `new_leader_id` | **Yes** | User ID of the new leader (must be on the team) |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "transferred": true
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing `new_leader_id` |
| 403 | `FORBIDDEN` | User is not the current team leader |
| 404 | `NOT_FOUND` | Target user is not on this team |

---

### POST /api/v1/hackathons/:slug/teams/:teamId/dissolve

Permanently delete a team and remove all members.

**Auth**: Required (JWT)
**Role**: Team `leader` or hackathon organizer

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `teamId` | UUID | Team ID |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "dissolved": true
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 403 | `FORBIDDEN` | User is not team leader or organizer |
