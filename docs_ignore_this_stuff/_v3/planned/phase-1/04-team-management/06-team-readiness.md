# Team Readiness

> Validation checks that determine if a team is ready to submit.

## Readiness Criteria

A team is "ready" when ALL of these are true:

| Check | Required | Description |
|-------|----------|-------------|
| Min team size | ✅ | `member_count >= hackathon.min_team_size` |
| GitHub repo linked | ✅ (if `require_github_repo`) | `team_repos` row exists |
| Bot active | ✅ (if repo linked) | `team_repos.bot_active = true` |
| Track selected | ✅ (if multi-track) | `teams.track_id` is not null |

## Readiness Endpoint

### `GET /api/v1/hackathons/:slug/teams/:teamId/readiness`

```
Auth: team_lead, team_member, or co_organizer+
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "ready": false,
    "checks": [
      { "check": "min_team_size", "passed": true, "detail": "3/2 members" },
      { "check": "github_repo", "passed": true, "detail": "owner/repo linked" },
      { "check": "bot_active", "passed": false, "detail": "GitHub App not installed" },
      { "check": "track_selected", "passed": true, "detail": "Web Track" }
    ]
  }
}
```

## Team Status Updates

Team status is computed, not manually set:

```ts
function computeTeamStatus(team, members, repo, submissions): TeamStatus {
  if (submissions.length > 0) return 'submitted';

  const checks = [
    members.length >= hackathon.min_team_size,
    !hackathon.settings.require_github_repo || (repo && repo.bot_active),
    !hackathon.tracks.length || team.track_id,
  ];

  return checks.every(Boolean) ? 'ready' : 'forming';
}
```

## List Teams Endpoint

### `GET /api/v1/hackathons/:slug/teams`

```
Auth: co_organizer+ sees all teams; team members see only their team
```

**Query params:**
- `status` — filter by `forming | ready | submitted`
- `track_id` — filter by track
- `limit`, `offset` — pagination

**Response includes:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "name": "Team Alpha",
      "status": "ready",
      "member_count": 3,
      "track": { "id": "uuid", "name": "Web Track" },
      "has_repo": true,
      "bot_active": true,
      "submission_count": 0
    }
  ],
  "meta": { "total": 25, "limit": 20, "offset": 0, "has_more": true }
}
```

## Implementation Notes

- Team status is recomputed on reads, not stored and updated — avoids stale state
- The readiness endpoint is called by the participant site UI to show a checklist
- Organizer dashboard shows team readiness as a summary metric
