# Admin API

Base path: `/api/v1/admin`

All endpoints require authentication **and** platform admin status. The `authMiddleware` and `requirePlatformAdmin` middleware are applied to the entire router. Platform admin access is checked against the `platform_admins` table, which is separate from per-hackathon roles.

---

## GET `/users`

List all platform users with offset-based pagination.

**Auth:** Required — `authMiddleware` + `requirePlatformAdmin`

### Query Parameters

| Param    | Type   | Default | Description                |
|----------|--------|---------|----------------------------|
| `limit`  | number | `20`    | Results per page (max 100) |
| `offset` | number | `0`     | Number of results to skip  |

### Response — `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345",
      "created_at": "2026-01-10T12:00:00.000Z",
      "last_login_at": "2026-02-14T18:30:00.000Z"
    }
  ],
  "meta": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

> **Note:** The response intentionally excludes sensitive user fields. Only `id`, `email`, `name`, `avatar_url`, `created_at`, and `last_login_at` are returned.

---

## GET `/hackathons`

List all hackathons on the platform with offset-based pagination.

**Auth:** Required — `authMiddleware` + `requirePlatformAdmin`

### Query Parameters

| Param    | Type   | Default | Description                |
|----------|--------|---------|----------------------------|
| `limit`  | number | `20`    | Results per page (max 100) |
| `offset` | number | `0`     | Number of results to skip  |

### Response — `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "h1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "slug": "spring-hack-2026",
      "name": "Spring Hack 2026",
      "status": "active",
      "created_at": "2026-01-20T08:00:00.000Z",
      "updated_at": "2026-02-10T14:00:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

---

## GET `/admins`

List all platform administrators with user profile information. Not paginated.

**Auth:** Required — `authMiddleware` + `requirePlatformAdmin`

### Response — `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "pa1a2b3c-d5e6-7890-abcd-ef1234567890",
      "user_id": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "created_at": "2026-01-01T00:00:00.000Z",
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
  ]
}
```

---

## POST `/admins`

Grant platform admin access to a user.

**Auth:** Required — `authMiddleware` + `requirePlatformAdmin`

### Request Body

| Field     | Type   | Required | Description                   |
|-----------|--------|----------|-------------------------------|
| `user_id` | string | Yes      | UUID of the user to promote   |

### Response — `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "pa2b3c4d-e5f6-7890-abcd-ef1234567890"
  }
}
```

### Errors

| Status | Code               | Message                  |
|--------|--------------------|--------------------------|
| 400    | `VALIDATION_ERROR` | user_id required         |
| 409    | `ALREADY_ADMIN`    | User is already an admin |

---

## DELETE `/admins/:userId`

Remove platform admin access from a user. Cannot remove yourself.

**Auth:** Required — `authMiddleware` + `requirePlatformAdmin`

### Path Parameters

| Param    | Type   | Description                        |
|----------|--------|------------------------------------|
| `userId` | string | UUID of the user to remove as admin |

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "removed": true
  }
}
```

### Errors

| Status | Code                 | Message                |
|--------|----------------------|------------------------|
| 409    | `CANNOT_REMOVE_SELF` | Cannot remove yourself |

---

## GET `/stats`

Get aggregate platform statistics.

**Auth:** Required — `authMiddleware` + `requirePlatformAdmin`

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "users": 1520,
    "hackathons": 25,
    "teams": 340,
    "submissions": 890
  }
}
```

---

## POST `/audit/backfill`

Trigger backfill of missing hash chain values in the audit log. Processes up to 500 unhashed events per call, computing and storing SHA-256 hashes and `prev_hash` pointers.

See [Audit Trail](./audit.md) for details on the hash chain mechanism.

**Auth:** Required — `authMiddleware` + `requirePlatformAdmin`

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "processed": 127
  }
}
```

The `processed` value indicates how many audit events were backfilled. If `processed` equals 500 (the batch limit), call again to process remaining events.
