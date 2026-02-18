# Rounds API

Base path: `/api/v1/hackathons/:slug/rounds`

All endpoints run through `hackathonContext` middleware which resolves the hackathon from `:slug`.

---

## POST `/`

Create a new round for a hackathon.

**Auth:** Required — `authMiddleware` + `requireRole('co_organizer')` (co_organizer or above)

### Request Body

| Field                 | Type   | Required | Description                                  |
|-----------------------|--------|----------|----------------------------------------------|
| `name`                | string | Yes      | Round name                                   |
| `round_number`        | number | Yes      | Numeric order of the round                   |
| `type`                | string | No       | Round type (defaults to `"standard"`)        |
| `submission_deadline` | string | No       | ISO-8601 UTC deadline for submissions        |

### Response — `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "hackathon_id": "h1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "round_number": 1,
    "name": "Ideation Round",
    "type": "standard",
    "status": "upcoming",
    "submission_deadline": "2026-03-15T23:59:59.000Z",
    "created_at": "2026-02-15T10:00:00.000Z",
    "updated_at": "2026-02-15T10:00:00.000Z"
  }
}
```

### Errors

| Status | Code               | Message                         |
|--------|--------------------|---------------------------------|
| 400    | `VALIDATION_ERROR` | Name and round_number required  |

---

## GET `/`

List all rounds for a hackathon, ordered by `round_number` ascending.

**Auth:** None required (public via `hackathonContext` only)

### Response — `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "hackathon_id": "h1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "round_number": 1,
      "name": "Ideation Round",
      "type": "standard",
      "status": "upcoming",
      "submission_deadline": "2026-03-15T23:59:59.000Z",
      "created_at": "2026-02-15T10:00:00.000Z",
      "updated_at": "2026-02-15T10:00:00.000Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "hackathon_id": "h1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "round_number": 2,
      "name": "Final Presentation",
      "type": "standard",
      "status": "upcoming",
      "submission_deadline": null,
      "created_at": "2026-02-15T11:00:00.000Z",
      "updated_at": "2026-02-15T11:00:00.000Z"
    }
  ]
}
```

---

## PATCH `/:roundId`

Update an existing round. Only specified fields are modified.

**Auth:** Required — `authMiddleware` + `requireRole('co_organizer')` (co_organizer or above)

### Path Parameters

| Param     | Type   | Description |
|-----------|--------|-------------|
| `roundId` | string | Round UUID  |

### Request Body

All fields are optional. Only the provided fields are updated.

| Field                 | Type   | Description                          |
|-----------------------|--------|--------------------------------------|
| `name`                | string | Round name                           |
| `type`                | string | Round type                           |
| `status`              | string | Round status                         |
| `submission_deadline` | string | ISO-8601 UTC deadline                |
| `started_at`          | string | ISO-8601 UTC timestamp when started  |
| `completed_at`        | string | ISO-8601 UTC timestamp when finished |

Fields not in the allowed list are silently ignored. `updated_at` is set automatically.

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "hackathon_id": "h1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "round_number": 1,
    "name": "Updated Round Name",
    "type": "standard",
    "status": "active",
    "submission_deadline": "2026-03-20T23:59:59.000Z",
    "started_at": "2026-03-01T00:00:00.000Z",
    "completed_at": null,
    "created_at": "2026-02-15T10:00:00.000Z",
    "updated_at": "2026-02-16T08:30:00.000Z"
  }
}
```

### Errors

| Status | Code               | Message              |
|--------|--------------------|-----------------------|
| 400    | `VALIDATION_ERROR` | No fields to update   |

---

## DELETE `/:roundId`

Delete a round.

**Auth:** Required — `authMiddleware` + `requireRole('co_organizer')` (co_organizer or above)

### Path Parameters

| Param     | Type   | Description |
|-----------|--------|-------------|
| `roundId` | string | Round UUID  |

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "deleted": true
  }
}
```
