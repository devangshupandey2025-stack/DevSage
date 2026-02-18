# Judging API

All endpoints are prefixed with `/api/v1/hackathons/:slug/judging`.

Every request passes through the `hackathonContext` middleware, which resolves the hackathon by `:slug` and attaches it to the request context. If the slug is invalid, a `404 NOT_FOUND` error is returned before the handler runs.

---

## Rubric

### POST /rubric

Create a rubric criterion for the hackathon.

| Detail | Value |
|--------|-------|
| Auth | Required (`authMiddleware`) |
| Role | `co_organizer` or above |

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Criterion name |
| `description` | string | — | `""` | Criterion description |
| `max_score` | number | — | `10` | Maximum score a judge can award |
| `weight` | number | ✅ | — | Weight multiplier for scoring |
| `track_id` | string \| null | — | `null` | Scope criterion to a specific track |
| `sort_order` | number | — | `0` | Display order |
| `round` | number | — | `1` | Judging round this criterion applies to |

**Response** `201`

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-...",
    "hackathon_id": "h1a2b3c4-...",
    "name": "Innovation",
    "description": "How novel is the solution?",
    "max_score": 10,
    "weight": 0.3,
    "track_id": null,
    "sort_order": 0,
    "round": 1,
    "created_at": "2026-02-15T12:00:00.000Z"
  }
}
```

**Errors**

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing `name` or `weight` |
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Role below `co_organizer` |

---

### GET /rubric

List all rubric criteria for the hackathon, ordered by `sort_order ASC`.

| Detail | Value |
|--------|-------|
| Auth | None (public) |
| Role | None |

**Response** `200`

```json
{
  "ok": true,
  "data": [
    {
      "id": "a1b2c3d4-...",
      "hackathon_id": "h1a2b3c4-...",
      "name": "Innovation",
      "description": "How novel is the solution?",
      "max_score": 10,
      "weight": 0.3,
      "track_id": null,
      "sort_order": 0,
      "round": 1,
      "created_at": "2026-02-15T12:00:00.000Z"
    }
  ]
}
```

---

### PATCH /rubric/:criterionId

Update a rubric criterion. Only the provided fields are updated.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `co_organizer` or above |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `criterionId` | UUID of the rubric criterion |

**Request Body** — any subset of:

| Field | Type |
|-------|------|
| `name` | string |
| `description` | string |
| `max_score` | number |
| `weight` | number |
| `track_id` | string \| null |
| `sort_order` | number |
| `round` | number |

**Response** `200`

```json
{
  "ok": true,
  "data": {
    "id": "a1b2c3d4-...",
    "name": "Updated Name",
    "weight": 0.5
  }
}
```

**Errors**

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Empty update (no recognized fields) |
| 403 | `FORBIDDEN` | Role below `co_organizer` |

---

### DELETE /rubric/:criterionId

Delete a rubric criterion.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `co_organizer` or above |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `criterionId` | UUID of the rubric criterion |

**Response** `200`

```json
{
  "ok": true,
  "data": { "deleted": true }
}
```

---

## Judges

### POST /judges

Invite a single judge to the hackathon. Sends a notification via the queue.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `co_organizer` or above |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | ✅ | ID of the user to invite |
| `track_id` | string \| null | — | Assign judge to a specific track |

**Response** `201`

```json
{
  "ok": true,
  "data": {
    "id": "j1a2b3c4-...",
    "user_id": "u1a2b3c4-..."
  }
}
```

**Errors**

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing `user_id` |
| 409 | `JUDGE_ALREADY_INVITED` | User has already been invited |

---

### POST /judges/bulk

Invite multiple judges at once. Processes up to **50** user IDs per request. Duplicates are silently skipped (returned as `already_invited`).

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `co_organizer` or above |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_ids` | string[] | ✅ | Array of user IDs (max 50 processed) |

**Response** `201`

```json
{
  "ok": true,
  "data": [
    { "user_id": "u1a2b3c4-...", "status": "invited" },
    { "user_id": "u5e6f7g8-...", "status": "already_invited" }
  ]
}
```

**Errors**

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Missing or empty `user_ids` |

---

### GET /judges

List all judges for the hackathon with user profile info. Ordered by `invited_at ASC`.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `co_organizer` or above |

**Response** `200`

```json
{
  "ok": true,
  "data": [
    {
      "id": "j1a2b3c4-...",
      "invite_status": "accepted",
      "user_id": "u1a2b3c4-...",
      "track_id": null,
      "invited_at": "2026-02-10T08:00:00.000Z",
      "responded_at": "2026-02-10T09:30:00.000Z",
      "name": "Jane Doe",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345"
    }
  ]
}
```

---

### DELETE /judges/:judgeId

Remove a judge from the hackathon.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `co_organizer` or above |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `judgeId` | UUID of the judge record |

**Response** `200`

```json
{
  "ok": true,
  "data": { "deleted": true }
}
```

---

### POST /judges/:judgeId/tracks

Assign or reassign a judge to a track. Pass `null` to remove the track assignment.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `co_organizer` or above |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `judgeId` | UUID of the judge record |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `track_id` | string \| null | ✅ | Track ID, or `null` to unassign |

**Response** `200`

```json
{
  "ok": true,
  "data": { "updated": true }
}
```

---

## Assignments

### POST /assign

Auto-assign submissions to judges using round-robin distribution. Only final (`is_final = 1`) validated submissions are assigned. Duplicate judge–team–round pairs are skipped.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `co_organizer` or above |

**Request Body** (optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `round_id` | string | — | Limit assignment to a specific round |

**Response** `200`

```json
{
  "ok": true,
  "data": { "assigned": 42 }
}
```

---

### GET /judges/:judgeId/assignments

Get all submissions assigned to a specific judge, with team and submission details.

| Detail | Value |
|--------|-------|
| Auth | Required (`authMiddleware`) |
| Role | None (any authenticated user) |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `judgeId` | UUID of the judge record |

**Response** `200`

```json
{
  "ok": true,
  "data": [
    {
      "id": "ja1a2b3c4-...",
      "submission_id": "s1a2b3c4-...",
      "team_id": "t1a2b3c4-...",
      "round": 1,
      "status": "pending",
      "assigned_at": "2026-02-15T14:00:00.000Z",
      "completed_at": null,
      "tag_name": "v1.0.0",
      "commit_sha": "abc123def456",
      "team_name": "Team Alpha"
    }
  ]
}
```

---

## Scoring

### POST /submissions/:submissionId/scores

Submit (or update) scores for an assigned submission. Uses `requireExactRole('judge')` — only judges can score, not organizers.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | Exactly `judge` (`requireExactRole`) |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `submissionId` | UUID of the submission |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scores` | array | ✅ | Array of score objects |
| `scores[].criteria_id` | string | ✅ | Rubric criterion ID |
| `scores[].score` | number | ✅ | Score value (0 to `max_score`) |
| `scores[].comment` | string | — | Optional comment |
| `scores[].assignment_id` | string | ✅ | Judge assignment ID |
| `scores[].round` | number | — | Round number (default: `1`) |

**Behavior**

- Verifies the caller is an **accepted** judge for this hackathon.
- Verifies the judge is **assigned** to this submission.
- Upserts scores — conflicts on `(submission_id, judge_id, criteria_id, round)` are updated.
- Marks the assignment status as `scored` and sets `completed_at`.
- Invalidates the KV leaderboard cache for this hackathon.

**Response** `200`

```json
{
  "ok": true,
  "data": { "scored": true }
}
```

**Errors**

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | Empty or missing `scores` array |
| 403 | `FORBIDDEN` | Caller is not an accepted judge |
| 403 | `NOT_ASSIGNED` | Judge is not assigned to this submission |

---

### GET /submissions/:submissionId/scores

Get all scores for a submission, joined with rubric criterion details.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `judge` or above |

**Path Parameters**

| Param | Description |
|-------|-------------|
| `submissionId` | UUID of the submission |

**Response** `200`

```json
{
  "ok": true,
  "data": [
    {
      "id": "sc1a2b3c4-...",
      "criteria_id": "a1b2c3d4-...",
      "judge_id": "j1a2b3c4-...",
      "assignment_id": "ja1a2b3c4-...",
      "score": 8,
      "comment": "Great innovation",
      "round": 1,
      "scored_at": "2026-02-15T16:30:00.000Z",
      "criterion_name": "Innovation",
      "max_score": 10,
      "weight": 0.3
    }
  ]
}
```

---

## Leaderboard

### GET /leaderboard

Compute and return the ranked leaderboard. Results are cached in KV and support conditional requests via `ETag` / `If-None-Match`.

| Detail | Value |
|--------|-------|
| Auth | None (public) |
| Role | None |

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `round_id` | string | Filter to a specific judging round |
| `track_id` | string | Filter to a specific track |

**Scoring Algorithm**

1. **Per-judge score** — For each judge's scores on a submission: `SUM(score / max_score × weight × 100)`.
2. **Cross-judge average** — `AVG(per-judge totals)` across all judges who scored the submission.
3. Final scores are rounded to 2 decimal places.
4. Teams are ranked by descending `total_score`.

**Caching**

- Cache key: `leaderboard:{hackathon_id}:{round_id|all}:{track_id|all}`
- TTL varies by hackathon state: shorter during `judging`, longer when `completed`.
- Cache is invalidated when any judge submits a score.
- Supports `304 Not Modified` via `ETag`.

**Response** `200`

```json
{
  "ok": true,
  "data": [
    {
      "team_id": "t1a2b3c4-...",
      "team_name": "Team Alpha",
      "total_score": 87.50,
      "rank": 1,
      "judge_count": 3
    },
    {
      "team_id": "t5e6f7g8-...",
      "team_name": "Team Beta",
      "total_score": 82.33,
      "rank": 2,
      "judge_count": 3
    }
  ]
}
```

**Response** `304` — returned when `If-None-Match` header matches the current `ETag`.

---

## Results

### POST /results/publish

Publish the final results for the hackathon. Persists rankings to the `round_results` table and sends notifications to all participants.

| Detail | Value |
|--------|-------|
| Auth | Required |
| Role | `organizer` only |

**Request Body** (optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `round_id` | string | — | Publish results for a specific round |

**Behavior**

- Hackathon must be in `judging` or `completed` state.
- Computes the leaderboard and persists each entry as a `round_results` row with status `published`.
- Upserts on `(round_id, team_id)` — re-publishing updates existing rankings.
- Enqueues a `results.published` notification.

**Response** `200`

```json
{
  "ok": true,
  "data": {
    "published": true,
    "results": [
      {
        "team_id": "t1a2b3c4-...",
        "team_name": "Team Alpha",
        "total_score": 87.50,
        "rank": 1,
        "judge_count": 3
      }
    ]
  }
}
```

**Errors**

| Status | Code | Cause |
|--------|------|-------|
| 403 | `FORBIDDEN` | Role below `organizer` |
| 409 | `INVALID_STATE` | Hackathon is not in `judging` or `completed` state |

---

## Role Summary

| Endpoint Group | Minimum Role | Notes |
|----------------|-------------|-------|
| Rubric CRUD | `co_organizer` | Create, update, delete criteria |
| Judge Management | `co_organizer` | Invite, list, remove, assign tracks |
| Auto-assign | `co_organizer` | Round-robin distribution |
| Judge Assignments | Any authenticated | View own or any judge's assignments |
| Score Submission | `judge` (exact) | Only judges score, via `requireExactRole` |
| Score Viewing | `judge` or above | View scores for any submission |
| Leaderboard | Public | No auth required |
| Publish Results | `organizer` | Highest role; persists final rankings |
