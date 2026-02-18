# Notifications API

Base path: `/api/v1/notifications`

All endpoints require authentication. The `authMiddleware` is applied to the entire router.

---

## GET `/`

List notifications for the authenticated user with offset-based pagination.

**Auth:** Required — `authMiddleware`

### Query Parameters

| Param          | Type   | Default | Description                                    |
|----------------|--------|---------|------------------------------------------------|
| `limit`        | number | `20`    | Results per page (max 100)                     |
| `offset`       | number | `0`     | Number of results to skip                      |
| `hackathon_id` | string | —       | Optional: filter notifications by hackathon ID |

### Response — `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "n1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "user_id": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "hackathon_id": "h1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "type": "team_invite",
      "title": "Team Invitation",
      "body": "You've been invited to join Team Alpha",
      "read_at": null,
      "created_at": "2026-02-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

---

## GET `/unread-count`

Get the count of unread notifications for the authenticated user.

**Auth:** Required — `authMiddleware`

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "count": 5
  }
}
```

---

## PATCH `/:notificationId/read`

Mark a single notification as read. Only marks notifications owned by the authenticated user.

**Auth:** Required — `authMiddleware`

### Path Parameters

| Param            | Type   | Description       |
|------------------|--------|-------------------|
| `notificationId` | string | Notification UUID |

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "read": true
  }
}
```

---

## PATCH `/read-all`

Mark all unread notifications as read for the authenticated user.

**Auth:** Required — `authMiddleware`

### Response — `200 OK`

```json
{
  "ok": true,
  "data": {
    "read_all": true
  }
}
```
