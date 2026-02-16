# Hackathons API

Base URL: `https://api.devsage.org`

All responses follow the standard envelope format:
- **Success**: `{ "ok": true, "data": ..., "meta": ... }`
- **Error**: `{ "ok": false, "error": { "code": "...", "message": "..." } }`

---

## State Machine

Hackathons follow a forward-only 5-state lifecycle managed by a Durable Object:

```
draft ──► active ──► judging ──► completed ──► archived
                                      ▲            │
                                      └────────────┘
                                     (un-archive)
```

### Valid Transitions

| From | Allowed Targets |
|------|-----------------|
| `draft` | `active` |
| `active` | `judging` |
| `judging` | `completed` |
| `completed` | `archived` |
| `archived` | `completed` (un-archive for score corrections) |

All other transitions are rejected with `409 INVALID_TRANSITION`.

---

## Hackathon Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | UUID | auto | Primary key |
| `workspace_id` | UUID | — | Parent workspace |
| `slug` | string | — | URL-safe identifier (unique) |
| `title` | string | — | Display name |
| `tagline` | string | `null` | Short tagline |
| `description` | string | `null` | Full description |
| `rules_md` | string | `null` | Rules in Markdown |
| `status` | string | `"draft"` | Current lifecycle state |
| `starts_at` | ISO 8601 | `null` | Hackathon start time |
| `judging_starts` | ISO 8601 | `null` | Judging period start |
| `judging_ends` | ISO 8601 | `null` | Judging period end |
| `min_team_size` | integer | `1` | Minimum members per team |
| `max_team_size` | integer | `5` | Maximum members per team |
| `max_teams` | integer | `null` | Team cap (`null` = unlimited) |
| `submission_tag_pattern` | string | `"submission_v%"` | Git tag pattern for submissions |
| `allow_resubmission` | 0/1 | `0` | Allow overwriting submissions |
| `allow_registration_during_active` | 0/1 | `0` | Allow new teams after hackathon starts |
| `notify_all_on_deadline` | 0/1 | `0` | Notify all participants near deadline |
| `show_judge_comments_to_participants` | 0/1 | `0` | Expose judge feedback |
| `registration_mode` | string | `"open"` | `"open"` or `"invite_only"` |
| `allowed_email_domains` | JSON string | `"[]"` | Restrict registration by email domain |
| `require_repo` | 0/1 | `1` | Require linked GitHub repository |
| `timezone` | string | `"UTC"` | Display timezone |
| `template_id` | UUID | `null` | Template used during creation |
| `tracks` | JSON | `"[]"` | Hackathon tracks/categories |
| `prizes` | JSON | `"[]"` | Prize definitions |
| `settings` | JSON | `"{}"` | Arbitrary key-value settings |
| `created_by` | UUID | — | User who created the hackathon |
| `created_at` | ISO 8601 | auto | Creation timestamp |
| `updated_at` | ISO 8601 | auto | Last update timestamp |

---

## Endpoints

### POST /api/v1/workspaces/:workspaceId/hackathons

Create a new hackathon under a workspace. The creator is automatically added as an organizer.

**Auth**: Required (JWT)
**Role**: Workspace `owner` or `admin`

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `workspaceId` | UUID | Target workspace ID |

#### Request Body

```json
{
  "title": "Summer Hack 2026",
  "slug": "summer-hack-2026",
  "tagline": "Build something amazing",
  "description": "A weekend hackathon for students",
  "rules_md": "## Rules\n- Teams of 1–5...",
  "starts_at": "2026-06-15T09:00:00.000Z",
  "judging_starts": "2026-06-17T09:00:00.000Z",
  "judging_ends": "2026-06-18T18:00:00.000Z",
  "max_team_size": 4,
  "min_team_size": 2,
  "max_teams": 50,
  "registration_mode": "open",
  "timezone": "America/New_York",
  "tracks": [{ "name": "AI/ML" }, { "name": "Web3" }],
  "prizes": [{ "name": "1st Place", "value": "$5000" }],
  "settings": {},
  "template_id": null
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | **Yes** | |
| `slug` | **Yes** | Must be unique across all hackathons |
| All others | No | See defaults in fields table |

#### Response `201 Created`

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-...",
    "workspace_id": "w1x2y3z4-...",
    "slug": "summer-hack-2026",
    "title": "Summer Hack 2026",
    "status": "draft",
    "max_team_size": 4,
    "min_team_size": 2,
    "created_at": "2026-02-15T10:00:00.000Z",
    "updated_at": "2026-02-15T10:00:00.000Z"
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing `title` or `slug` |
| 403 | `FORBIDDEN` | User is not workspace owner/admin |
| 409 | `SLUG_TAKEN` | Slug already in use |

---

### GET /api/v1/hackathons

List hackathons with optional status filter and pagination.

**Auth**: None (public)

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | `20` | Results per page (max `100`) |
| `offset` | integer | `0` | Pagination offset |
| `status` | string | — | Filter by status (`draft`, `active`, `judging`, `completed`, `archived`) |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "a1b2c3d4-...",
      "slug": "summer-hack-2026",
      "title": "Summer Hack 2026",
      "status": "active",
      "starts_at": "2026-06-15T09:00:00.000Z",
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

### GET /api/v1/hackathons/:slug

Get a single hackathon by slug. Supports conditional requests via `ETag` / `If-None-Match`.

**Auth**: None (public)

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `slug` | string | Hackathon slug |

#### Response Headers

| Header | Description |
|--------|-------------|
| `ETag` | Entity tag for conditional caching |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-...",
    "workspace_id": "w1x2y3z4-...",
    "slug": "summer-hack-2026",
    "title": "Summer Hack 2026",
    "tagline": "Build something amazing",
    "description": "A weekend hackathon for students",
    "rules_md": "## Rules\n...",
    "status": "active",
    "starts_at": "2026-06-15T09:00:00.000Z",
    "judging_starts": "2026-06-17T09:00:00.000Z",
    "judging_ends": "2026-06-18T18:00:00.000Z",
    "min_team_size": 2,
    "max_team_size": 4,
    "max_teams": 50,
    "tracks": "[{\"name\":\"AI/ML\"},{\"name\":\"Web3\"}]",
    "prizes": "[{\"name\":\"1st Place\",\"value\":\"$5000\"}]",
    "settings": "{}",
    "created_by": "u1v2w3x4-...",
    "created_at": "2026-02-15T10:00:00.000Z",
    "updated_at": "2026-02-15T10:00:00.000Z"
  }
}
```

#### Response `304 Not Modified`

Returned when the client sends `If-None-Match` matching the current `ETag`. No body.

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 404 | `NOT_FOUND` | No hackathon with that slug |

---

### PATCH /api/v1/hackathons/:slug

Update hackathon fields. Only provided fields are modified.

**Auth**: Required (JWT)
**Role**: `co_organizer` or higher

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `slug` | string | Hackathon slug |

#### Request Body

Any subset of the updatable fields:

```json
{
  "title": "Summer Hack 2026 — Extended",
  "max_team_size": 6,
  "tracks": [{ "name": "AI/ML" }, { "name": "Web3" }, { "name": "Gaming" }]
}
```

**Updatable fields**: `title`, `tagline`, `description`, `rules_md`, `starts_at`, `judging_starts`, `judging_ends`, `min_team_size`, `max_team_size`, `max_teams`, `submission_tag_pattern`, `allow_resubmission`, `allow_registration_during_active`, `notify_all_on_deadline`, `show_judge_comments_to_participants`, `registration_mode`, `allowed_email_domains`, `require_repo`, `timezone`, `tracks`, `prizes`, `settings`

> **Note**: `slug`, `status`, `workspace_id`, `created_by`, and `id` are immutable. Status changes go through the transition endpoint.

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-...",
    "title": "Summer Hack 2026 — Extended",
    "max_team_size": 6,
    "updated_at": "2026-02-15T12:30:00.000Z"
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | No valid fields in request body |
| 403 | `FORBIDDEN` | Insufficient role (requires `co_organizer`+) |
| 404 | `NOT_FOUND` | No hackathon with that slug |

---

### POST /api/v1/hackathons/:slug/transition

Transition the hackathon to a new lifecycle state via the Durable Object state machine.

**Auth**: Required (JWT)
**Role**: `organizer` only

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `slug` | string | Hackathon slug |

#### Request Body

```json
{
  "target_status": "active",
  "version": 1
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `target_status` | **Yes** | Target state (see valid transitions above) |
| `version` | **Yes** | Current DO version for optimistic concurrency control |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "status": "active",
    "version": 2,
    "transitioned_at": "2026-06-15T09:00:00.000Z"
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing `target_status` or `version` |
| 400 | `INVALID_TRANSITION` | Transition not allowed from current state |
| 403 | `FORBIDDEN` | User is not an `organizer` |
| 409 | `VERSION_CONFLICT` | Version mismatch (another transition happened) |

---

### GET /api/v1/hackathons/:slug/state

Get the Durable Object state for reconciliation. If the DO state diverges from D1, D1 is auto-synced to match the DO (DO is source of truth).

**Auth**: Required (JWT)
**Role**: `co_organizer` or higher

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `slug` | string | Hackathon slug |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "do_state": {
      "status": "active",
      "version": 2
    },
    "d1_status": "active"
  }
}
```

> When `do_state.status` differs from `d1_status`, the D1 record is updated to match the DO before the response is returned.

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 403 | `FORBIDDEN` | Insufficient role (requires `co_organizer`+) |
| 404 | `NOT_FOUND` | No hackathon with that slug |

---

### DELETE /api/v1/hackathons/:slug

Permanently delete a hackathon. **Only allowed for hackathons in `draft` status.**

**Auth**: Required (JWT)
**Role**: `organizer` only

#### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| `slug` | string | Hackathon slug |

#### Response `200 OK`

```json
{
  "ok": true,
  "data": {
    "deleted": true
  }
}
```

#### Errors

| Status | Code | Cause |
|--------|------|-------|
| 403 | `FORBIDDEN` | User is not an `organizer` |
| 404 | `NOT_FOUND` | No hackathon with that slug |
| 409 | `INVALID_STATE` | Hackathon is not in `draft` status |
