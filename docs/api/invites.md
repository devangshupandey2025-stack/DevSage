# Invites API

Base path: `/api/v1/invites`

Handles acceptance and declining of team and judge invitations. All accept actions are audit-logged.

---

## POST `/team/:token`

Accept a team invite using the invite token.

**Auth:** Required — `authMiddleware`

### Path Parameters

| Param   | Type   | Description                          |
|---------|--------|--------------------------------------|
| `token` | string | Unique invite token from the invite  |

### Behavior

1. Looks up the invite by `invite_token` in `team_invites` (joined with `teams` to get `hackathon_id`).
2. Validates the invite is `pending` and not expired.
3. Checks the authenticated user is not already on a team in the same hackathon.
4. Atomically (via D1 batch): marks the invite as `accepted` and inserts a `team_members` record with role `"member"`.
5. Logs audit event `team.invite_accepted`.

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "accepted": true,
    "team_id": "t1a2b3c4-d5e6-7890-abcd-ef1234567890"
  }
}
```

### Audit Event

Action: `team.invite_accepted` — entity_type: `team`, entity_id: the team UUID.

### Errors

| Status | Code              | Message              |
|--------|-------------------|----------------------|
| 404    | `NOT_FOUND`       | Invite not found     |
| 409    | `INVITE_USED`     | Invite already used  |
| 410    | `INVITE_EXPIRED`  | Invite has expired   |
| 409    | `ALREADY_ON_TEAM` | Already on a team    |

---

## POST `/judge/:id`

Accept a judge invite by judge record ID.

**Auth:** Required — `authMiddleware`

### Path Parameters

| Param | Type   | Description       |
|-------|--------|-------------------|
| `id`  | string | Judge record UUID |

### Behavior

1. Looks up the judge record by ID.
2. Validates `invite_status` is `pending`.
3. Sets `user_id` to the authenticated user, updates `invite_status` to `"accepted"`, and records `responded_at`.
4. Logs audit event `judge.invite_accepted`.

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "accepted": true,
    "hackathon_id": "h1a2b3c4-d5e6-7890-abcd-ef1234567890"
  }
}
```

### Audit Event

Action: `judge.invite_accepted` — entity_type: `judge`, entity_id: the judge record UUID.

### Errors

| Status | Code          | Message            |
|--------|---------------|--------------------|
| 404    | `NOT_FOUND`   | Invite not found   |
| 409    | `INVITE_USED` | Already responded  |

---

## POST `/judge/:id/decline`

Decline a judge invite. Does **not** require authentication — allows declining via email link.

**Auth:** None required

### Path Parameters

| Param | Type   | Description       |
|-------|--------|-------------------|
| `id`  | string | Judge record UUID |

### Behavior

1. Looks up the judge record by ID.
2. Validates `invite_status` is `pending`.
3. Sets `invite_status` to `"declined"`.

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "declined": true
  }
}
```

### Errors

| Status | Code          | Message            |
|--------|---------------|--------------------|
| 404    | `NOT_FOUND`   | Invite not found   |
| 409    | `INVITE_USED` | Already responded  |
