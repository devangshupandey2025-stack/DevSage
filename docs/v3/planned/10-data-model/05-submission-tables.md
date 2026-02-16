# Submission Tables

> Git-tag-based submissions, commit activity tracking, and force push detection.

## Tables

### submissions

Each submission is a validated git tag. `is_current` marks the active submission per team/round.

```sql
CREATE TABLE submissions (
  id                  TEXT PRIMARY KEY,
  hackathon_id        TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  team_id             TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  round_id            TEXT REFERENCES hackathon_rounds(id) ON DELETE SET NULL,
  tag_name            TEXT NOT NULL,
  commit_sha          TEXT NOT NULL,
  submitted_at        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending_validation'
                        CHECK (status IN (
                          'pending_validation','validated',
                          'failed_validation','tag_deleted'
                        )),
  validation_results  TEXT,          -- JSON: { checks: [], errors: [] }
  delivery_id         TEXT,          -- GitHub webhook delivery ID
  is_current          INTEGER NOT NULL DEFAULT 1,  -- SQLite boolean
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_submissions_hackathon_current ON submissions(hackathon_id, is_current);
CREATE INDEX idx_submissions_team_round        ON submissions(team_id, round_id);
```

### commit_log

Append-only record of commits pushed to team repos. Populated by webhook handler.

```sql
CREATE TABLE commit_log (
  id              TEXT PRIMARY KEY,
  team_repo_id    TEXT NOT NULL REFERENCES team_repos(id) ON DELETE CASCADE,
  commit_sha      TEXT NOT NULL,
  commit_message  TEXT NOT NULL,
  author_login    TEXT,
  author_email    TEXT,
  committed_at    TEXT NOT NULL,        -- git author timestamp
  pushed_at       TEXT NOT NULL,        -- webhook received timestamp
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_commit_log_repo_time ON commit_log(team_repo_id, committed_at);
```

### force_push_events

Tracks force pushes for audit and integrity monitoring.

```sql
CREATE TABLE force_push_events (
  id            TEXT PRIMARY KEY,
  team_repo_id  TEXT NOT NULL REFERENCES team_repos(id) ON DELETE CASCADE,
  before_sha    TEXT NOT NULL,
  after_sha     TEXT NOT NULL,
  ref           TEXT NOT NULL,           -- e.g. 'refs/heads/main'
  pusher_login  TEXT NOT NULL,
  detected_at   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_force_push_repo ON force_push_events(team_repo_id);
```

## Schema Files

- `packages/db/src/schema/submissions.ts`
- `packages/db/src/schema/commit-log.ts`
- `packages/db/src/schema/force-push-events.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_submissions_hackathon_current` | submissions | `(hackathon_id, is_current)` | Active submissions for leaderboard/judging |
| `idx_submissions_team_round` | submissions | `(team_id, round_id)` | Submission history per team per round |
| `idx_commit_log_repo_time` | commit_log | `(team_repo_id, committed_at)` | Chronological commit feed for a repo |
| `idx_force_push_repo` | force_push_events | `(team_repo_id)` | Audit trail per repo |

## Notes

- When a team re-submits, the previous submission's `is_current` is set to `0` and the new one is inserted with `is_current = 1`.
- `validation_results` stores automated check output (tag exists, commit reachable, deadline met).
- Force push events are informational — they do not automatically invalidate submissions, but organizers are notified.
- `delivery_id` links back to `webhook_deliveries.github_delivery_id` for traceability.
