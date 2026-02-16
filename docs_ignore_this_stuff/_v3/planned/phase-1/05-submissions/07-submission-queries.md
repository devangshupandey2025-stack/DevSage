# Submission Queries

> REST endpoints for listing, getting, and comparing submissions.

## Endpoints

### `GET /api/v1/hackathons/:slug/submissions`

List all submissions for a hackathon.

```
Auth: judge+ sees all; team_member sees own team only
Query: ?round_id=&team_id=&status=&limit=&offset=
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "team_id": "uuid",
      "team_name": "Team Alpha",
      "round_id": "uuid",
      "round_name": "Final",
      "tag_name": "submission-v2",
      "commit_sha": "abc123",
      "status": "validated",
      "validation_results": [...],
      "submitted_at": "2026-02-15T...",
      "is_current": true
    }
  ],
  "meta": { "total": 30, "limit": 20, "offset": 0, "has_more": true }
}
```

### `GET /api/v1/hackathons/:slug/submissions/:id`

Get a single submission with full details.

```
Auth: team_member (own team) or judge+
```

**Response includes:**
- Submission metadata
- Commit details (SHA, message, author, timestamp)
- Validation results
- Score summary (if judging phase)

### `GET /api/v1/hackathons/:slug/submissions/:id/diff`

Get the diff between this submission and the previous one (or initial commit).

```
Auth: judge+
```

Uses GitHub API: `GET /repos/{owner}/{repo}/compare/{base}...{head}`

**Response:**
```json
{
  "ok": true,
  "data": {
    "base_sha": "def456",
    "head_sha": "abc123",
    "files_changed": 12,
    "additions": 350,
    "deletions": 80,
    "files": [
      {
        "filename": "src/index.ts",
        "status": "modified",
        "additions": 25,
        "deletions": 10,
        "patch": "@@..."
      }
    ]
  }
}
```

### `GET /api/v1/hackathons/:slug/teams/:teamId/submissions`

List submissions for a specific team. Same response format as the hackathon-level query but pre-filtered.

```
Auth: team_member (own team) or co_organizer+
```

## Commit Log

Every push event is recorded in `commit_log` for activity tracking:

```sql
CREATE TABLE commit_log (
  id TEXT PRIMARY KEY,
  team_repo_id TEXT NOT NULL REFERENCES team_repos(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  commit_message TEXT,
  author_login TEXT,
  author_email TEXT,
  committed_at TEXT NOT NULL,
  pushed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

This provides an activity feed showing how actively a team is coding (visible to organizers/judges).

## Implementation Notes

- `is_current` flag marks the latest submission per team per round
- Diffs use GitHub's compare API — requires valid installation token
- Commit log is populated by the push handler (separate from submission capture)
- Pagination follows standard offset-based pattern
