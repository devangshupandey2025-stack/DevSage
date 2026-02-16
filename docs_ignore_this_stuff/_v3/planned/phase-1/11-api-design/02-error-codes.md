# Error Codes

> Complete error code catalog organized by domain.

## Format

Error codes are UPPER_SNAKE_CASE strings. Response format:

```json
{ "ok": false, "error": { "code": "AUTH_REQUIRED", "message": "Authentication required" } }
```

## Authentication

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_REQUIRED` | 401 | No valid access token |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT has expired |
| `AUTH_TOKEN_INVALID` | 401 | JWT signature invalid |
| `AUTH_REFRESH_INVALID` | 401 | Refresh token not found or expired |
| `AUTH_REFRESH_REUSE` | 401 | Replay detected — family revoked |
| `AUTH_INVALID_STATE` | 400 | OAuth state missing or expired |
| `AUTH_CODE_EXCHANGE_FAILED` | 502 | OAuth provider rejected code |
| `AUTH_PROFILE_FETCH_FAILED` | 502 | Could not fetch profile |
| `AUTH_NO_VERIFIED_EMAIL` | 400 | No verified email on account |

## Authorization

| Code | HTTP | Description |
|------|------|-------------|
| `INSUFFICIENT_ROLE` | 403 | Role below minimum required |
| `NOT_PLATFORM_ADMIN` | 403 | Not a platform admin |
| `HACKATHON_REQUIRED` | 400 | No hackathon context |

## Hackathon

| Code | HTTP | Description |
|------|------|-------------|
| `HACKATHON_NOT_FOUND` | 404 | Slug doesn't match any hackathon |
| `HACKATHON_NOT_ACTIVE` | 400 | Action requires active state |
| `SLUG_TAKEN` | 409 | Slug already exists |
| `INVALID_TRANSITION` | 400 | State transition not allowed |
| `STATE_VERSION_CONFLICT` | 409 | Optimistic lock failure |
| `DEADLINE_REQUIRED` | 400 | Deadline must be set |
| `DEADLINE_IN_PAST` | 400 | Deadline is not in the future |

## Teams

| Code | HTTP | Description |
|------|------|-------------|
| `MAX_TEAMS_REACHED` | 400 | Hackathon team limit exceeded |
| `TEAM_FULL` | 400 | Team at max size |
| `TEAM_NAME_TAKEN` | 409 | Name already used |
| `ALREADY_IN_TEAM` | 409 | User already in a team |
| `INVALID_INVITE_CODE` | 404 | Invite code not found |
| `LEAD_CANNOT_LEAVE` | 400 | Must transfer leadership first |
| `NOT_TEAM_MEMBER` | 404 | User not in team |
| `TEAM_HAS_SUBMISSIONS` | 400 | Cannot dissolve team with submissions |

## Submissions

| Code | HTTP | Description |
|------|------|-------------|
| `SUBMISSION_REJECTED` | 400 | DO rejected submission |
| `DEADLINE_PASSED` | 400 | Submission after deadline |
| `MAX_SUBMISSIONS_REACHED` | 400 | Team exceeded limit |

## Judging

| Code | HTTP | Description |
|------|------|-------------|
| `JUDGING_NOT_ACTIVE` | 400 | Not in judging state |
| `NOT_ASSIGNED` | 403 | Judge not assigned to submission |
| `SCORE_OUT_OF_RANGE` | 400 | Score exceeds max |
| `INVALID_CRITERION` | 400 | Criterion not found |
| `JUDGE_ALREADY_INVITED` | 409 | Already invited |
| `NO_SCORES` | 400 | No scores to publish |

## Repos

| Code | HTTP | Description |
|------|------|-------------|
| `REPO_NOT_FOUND` | 404 | GitHub repo doesn't exist |
| `REPO_ALREADY_LINKED` | 409 | Repo linked to another team |
| `APP_NOT_INSTALLED` | 400 | GitHub App not installed |

## General

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request body failed Zod validation |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `WEBHOOK_INVALID_SIGNATURE` | 401 | Webhook HMAC verification failed |
