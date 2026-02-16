# Submissions API

All endpoints are prefixed with `/api/v1/hackathons/:slug/submissions`.

Every request passes through the `hackathonContext` middleware, which resolves the hackathon by `:slug` and attaches it to the request context. If the slug is invalid, a `404 NOT_FOUND` error is returned before the handler runs.

> **Submissions are not created via the API.** They are created automatically when a team pushes a Git tag that matches the hackathon's tag pattern. The incoming GitHub webhook (`push` event with a tag ref) is processed by the webhook handler, which validates the tag and inserts a submission record. See the webhooks documentation for details.

---

## Submission Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID primary key |
| `hackathon_id` | string | Hackathon this submission belongs to |
| `team_id` | string | Team that submitted |
| `round_id` | string \| null | Judging round (null if single-round) |
| `tag_name` | string | Git tag name (e.g. `v1.0.0`) |
| `commit_sha` | string | Full commit SHA the tag points to |
| `submitted_at` | string | ISO-8601 UTC timestamp of the push event |
| `status` | string | `pending_validation`, `validated`, or `rejected` |
| `validated_at` | string \| null | When validation completed |
| `validation_results` | string \| null | JSON string with validation details |
| `delivery_id` | string | Unique GitHub webhook delivery ID |
| `is_current` | integer | `1` if this is the team's latest (current) submission |
| `created_at` | string | ISO-8601 UTC record creation timestamp |

---

## Endpoints

### GET /

List submissions for the hackathon with offset pagination.

| Detail | Value |
|--------|-------|
| Auth | None (public) |
| Role | None |

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | `20` | Results per page (max `100`) |
| `offset` | number | `0` | Number of results to skip |
| `team_id` | string | — | Filter to a specific team |
| `round_id` | string | — | Filter to a specific judging round |
| `current_only` | string | `"true"` | When `"true"` (default), only returns submissions where `is_final = 1`. Set to `"false"` to include all historical submissions |

**Response** `200`

```json
{
  "ok": true,
  "data": [
    {
      "id": "s1a2b3c4-...",
      "hackathon_id": "h1a2b3c4-...",
      "team_id": "t1a2b3c4-...",
      "round_id": null,
      "tag_name": "v1.0.0",
      "commit_sha": "abc123def456789...",
      "submitted_at": "2026-02-14T23:59:00.000Z",
      "status": "validated",
      "validated_at": "2026-02-15T00:01:00.000Z",
      "validation_results": null,
      "delivery_id": "d1a2b3c4-...",
      "is_current": 1,
      "created_at": "2026-02-14T23:59:00.000Z"
    }
  ],
  "meta": {
    "total": 48,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

---

### GET /:submissionId

Get a single submission by ID.

| Detail | Value |
|--------|-------|
| Auth | None (public) |
| Role | None |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `submissionId` | UUID of the submission |

**Response** `200`

```json
{
  "ok": true,
  "data": {
    "id": "s1a2b3c4-...",
    "hackathon_id": "h1a2b3c4-...",
    "team_id": "t1a2b3c4-...",
    "round_id": null,
    "tag_name": "v1.0.0",
    "commit_sha": "abc123def456789...",
    "submitted_at": "2026-02-14T23:59:00.000Z",
    "status": "validated",
    "validated_at": "2026-02-15T00:01:00.000Z",
    "validation_results": null,
    "delivery_id": "d1a2b3c4-...",
    "is_current": 1,
    "created_at": "2026-02-14T23:59:00.000Z"
  }
}
```

**Errors**

| Status | Code | Cause |
|--------|------|-------|
| 404 | `NOT_FOUND` | No submission with this ID in the hackathon |

---

### GET /team/:teamId/current

Get a team's current (latest final) submission. Returns the most recent submission where `is_final = 1`, ordered by `submitted_at DESC`.

| Detail | Value |
|--------|-------|
| Auth | None (public) |
| Role | None |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `teamId` | UUID of the team |

**Response** `200`

```json
{
  "ok": true,
  "data": {
    "id": "s1a2b3c4-...",
    "hackathon_id": "h1a2b3c4-...",
    "team_id": "t1a2b3c4-...",
    "round_id": null,
    "tag_name": "v2.0.0",
    "commit_sha": "def456abc789012...",
    "submitted_at": "2026-02-15T11:30:00.000Z",
    "status": "validated",
    "validated_at": "2026-02-15T11:32:00.000Z",
    "validation_results": null,
    "delivery_id": "d5e6f7g8-...",
    "is_current": 1,
    "created_at": "2026-02-15T11:30:00.000Z"
  }
}
```

**Errors**

| Status | Code | Cause |
|--------|------|-------|
| 404 | `NOT_FOUND` | Team has no final submission in this hackathon |

---

## How Submissions Are Created

Submissions are **not** created through a REST endpoint. The flow is:

1. A participant pushes a Git tag (e.g. `v1.0.0`) to their team's repository.
2. GitHub sends a `push` webhook with a tag ref to `/webhooks/github`.
3. The webhook handler verifies the HMAC signature, normalizes the event, and matches the repository to a hackathon and team.
4. A submission record is inserted with `status: 'pending_validation'` and `is_current: 1`.
5. The previous current submission (if any) has `is_current` set to `0`.
6. Validation runs (tag format, deadline check, repo ownership) and updates `status` to `validated` or `rejected`.

This design ensures submissions are cryptographically tied to actual Git commits and cannot be fabricated through the API.
