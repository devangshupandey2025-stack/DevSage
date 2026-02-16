# Indexing Strategy

> Key indexes across the data model, the query patterns they support, and D1/SQLite considerations.

## Index Summary

### hackathons

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `UNIQUE` | `(slug)` | Route resolution: `GET /hackathons/:slug` — every API request hitting a hackathon route resolves slug → ID. |
| `idx_hackathons_workspace` | `(workspace_id)` | Workspace dashboard: "List all hackathons in this workspace." Filtered by status in WHERE clause. |
| `idx_hackathons_status` | `(status)` | Platform admin: "Show all active hackathons." Also used by cron to find hackathons approaching deadlines. |

### teams

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `idx_teams_hackathon` | `(hackathon_id)` | Hackathon admin: "List all teams in this hackathon." Participant view: "Browse teams." |
| `UNIQUE` | `(invite_code)` | Join-by-code: `POST /teams/join` — participant enters a code to join a team. |

### team_members

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `idx_team_members_user` | `(user_id)` | "My teams": list all teams a user belongs to across hackathons. Also used for "is this user already on a team in this hackathon?" check. |
| `UNIQUE(team_id, user_id)` | `(team_id, user_id)` | Prevent duplicate membership — enforced at DB level. |

### submissions

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `idx_submissions_hackathon_current` | `(hackathon_id, is_current)` | Leaderboard and judging: "Get all current submissions for this hackathon." Filters out superseded submissions. |
| `idx_submissions_team_round` | `(team_id, round_id)` | Team submission history: "Show all submissions from this team in round 2." Used by participants and organizers. |

### scores

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `idx_scores_submission` | `(submission_id)` | Score aggregation: compute average/weighted total for leaderboard ranking. Runs during judging phase. |
| `idx_scores_judge` | `(judge_id)` | Judge progress: "How many submissions has this judge scored?" Used in the judge dashboard. |

### audit_events

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `idx_audit_hackathon_seq` | `(hackathon_id, sequence)` | Audit feed: cursor-paginated chronological log for a hackathon. Primary query for the audit log page. |
| `idx_audit_entity` | `(entity_type, entity_id)` | Entity history: "Show all events for team X" or "What happened to this submission?" Used in detail views. |
| `idx_audit_event_type` | `(event_type)` | Event filtering: "Show all `submission.validated` events" or "All `hackathon.status_changed` events." |

### in_app_notifications

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `idx_notifications_user_read` | `(user_id, read_at)` | Notification feed + unread count: `WHERE user_id = ? AND read_at IS NULL` for the unread badge; `WHERE user_id = ? ORDER BY created_at DESC` for the feed. |

### commit_log

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `idx_commit_log_repo_time` | `(team_repo_id, committed_at)` | Commit activity: "Show recent commits for this team's repo." Powers the commit timeline in the team detail view. |

### team_repos

| Index | Columns | Query Pattern |
|-------|---------|---------------|
| `idx_team_repos_github` | `(github_owner, github_repo)` | Webhook resolution: incoming push/tag webhook → find which team this repo belongs to. Critical path for submission processing. |

## D1/SQLite Considerations

- **No partial indexes**: D1 (SQLite) doesn't support partial indexes. The `(hackathon_id, is_current)` index includes all rows; queries must still filter `WHERE is_current = 1`.
- **No hash indexes**: All indexes are B-tree. UUID primary keys produce random insertion patterns — acceptable at D1 scale but worth monitoring.
- **Composite index ordering**: The leftmost column should be the most selective filter. For `(hackathon_id, sequence)`, hackathon_id narrows first, then sequence orders within.
- **UNIQUE as index**: SQLite automatically creates an index for UNIQUE constraints. These don't need separate `CREATE INDEX` statements.
- **Write amplification**: Each index adds overhead on INSERT. Tables with many indexes (e.g. `audit_events` with 4) should be monitored for write latency.
- **Covering indexes**: Where possible, query only indexed columns to avoid table lookups. For example, `SELECT id FROM submissions WHERE hackathon_id = ? AND is_current = 1` is covered by `idx_submissions_hackathon_current`.

## Notes

- All indexes listed here are defined in their respective Drizzle schema files and generated via `drizzle-kit generate`.
- Index names follow the convention `idx_{table}_{column(s)}` for consistency.
- UNIQUE constraints double as indexes and are not duplicated with separate `CREATE INDEX` statements.
