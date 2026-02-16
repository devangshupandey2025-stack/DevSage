# Organizers API

Base path: `/api/v1/hackathons/:slug/organizers`

All endpoints run through `hackathonContext` middleware which resolves the hackathon from `:slug`. All actions are audit-logged via `insertAuditEvent`.

---

## GET `/`

List all organizers for a hackathon, including user profile information.

**Auth:** Required — `authMiddleware` + `requireRole('co_organizer')` (co_organizer or above)

### Response — `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "r1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "user_id": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "role": "organizer",
      "created_at": "2026-01-10T12:00:00.000Z",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345"
    },
    {
      "id": "r2b3c4d5-e6f7-8901-bcde-f12345678901",
      "user_id": "u2b3c4d5-e6f7-8901-bcde-f12345678901",
      "role": "co_organizer",
      "created_at": "2026-01-15T09:00:00.000Z",
      "name": "John Smith",
      "email": "john@example.com",
      "avatar_url": null
    }
  ]
}
```

---

## POST `/`

Add an organizer or co-organizer to a hackathon.

**Auth:** Required — `authMiddleware` + `requireRole('organizer')` (organizer only — higher than co_organizer)

### Request Body

| Field     | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| `user_id` | string | Yes      | UUID of the user to add                       |
| `role`    | string | Yes      | Must be `"organizer"` or `"co_organizer"`     |

### Response — `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "r3c4d5e6-f7a8-9012-cdef-123456789012",
    "role": "co_organizer"
  }
}
```

### Audit Event

Action: `organizer.added` — entity_type: `organizer_role`, details include `target_user_id` and `role`.

### Errors

| Status | Code                | Message                                   |
|--------|---------------------|-------------------------------------------|
| 400    | `VALIDATION_ERROR`  | user_id and role required                 |
| 400    | `VALIDATION_ERROR`  | Role must be organizer or co_organizer    |
| 409    | `ALREADY_ORGANIZER` | User already has an organizer role        |

---

## DELETE `/:roleId`

Remove an organizer from a hackathon. Cannot remove yourself.

**Auth:** Required — `authMiddleware` + `requireRole('organizer')` (organizer only)

### Path Parameters

| Param    | Type   | Description          |
|----------|--------|----------------------|
| `roleId` | string | Organizer role UUID  |

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "removed": true
  }
}
```

### Audit Event

Action: `organizer.removed` — entity_type: `organizer_role`.

### Errors

| Status | Code                 | Message              |
|--------|----------------------|----------------------|
| 404    | `NOT_FOUND`          | Role not found       |
| 409    | `CANNOT_REMOVE_SELF` | Cannot remove yourself |
