# 10 — Data Model

> ~37 tables in a single D1 (SQLite) database via Drizzle ORM. UUID primary keys, ISO-8601 timestamps, JSON for flexible data.

## Conventions

- **Primary keys:** UUID (`crypto.randomUUID()`) stored as TEXT
- **Timestamps:** ISO-8601 UTC strings (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
- **Foreign keys:** ON DELETE CASCADE where parent owns children
- **Soft deletes:** Status fields (not `deleted_at` columns) where needed
- **JSON columns:** TEXT with JSON content for flexible/optional data (settings, metadata)
- **Indexing:** Composite indexes on frequently joined columns (hackathon_id + user_id)

## Schema Location

`packages/db/src/schema/` — one file per domain, re-exported from `schema/index.ts`.

## Files in This Section

| File | Tables Covered |
|------|---------------|
| [01-identity-tables.md](./01-identity-tables.md) | users, refresh_tokens, platform_admins, deletion_requests |
| [02-workspace-tables.md](./02-workspace-tables.md) | workspaces, workspace_members, workspace_invites |
| [03-hackathon-tables.md](./03-hackathon-tables.md) | hackathons, organizer_roles, hackathon_tracks, hackathon_rounds, custom_phases, hackathon_templates |
| [04-team-tables.md](./04-team-tables.md) | teams, team_members, team_invites, team_repos, team_messages |
| [05-submission-tables.md](./05-submission-tables.md) | submissions, commit_log, force_push_events |
| [06-judging-tables.md](./06-judging-tables.md) | judges, judge_assignments, judge_tracks, rubric_criteria, scores, round_results |
| [07-webhook-tables.md](./07-webhook-tables.md) | webhook_deliveries, pending_installations |
| [08-notification-tables.md](./08-notification-tables.md) | in_app_notifications, notification_deliveries, notification_idempotency, hackathon_notification_config |
| [09-audit-tables.md](./09-audit-tables.md) | audit_events |
| [10-sponsor-tables.md](./10-sponsor-tables.md) | hackathon_sponsors (Phase 2) |
| [11-indexing-strategy.md](./11-indexing-strategy.md) | Index definitions, query patterns |

## ER Overview

```
workspaces ←── hackathons ←── teams ←── team_members ──→ users
                  │               │         └── team_invites
                  │               └── team_repos
                  │                     └── commit_log
                  ├── hackathon_tracks       └── force_push_events
                  ├── hackathon_rounds ←── round_results
                  ├── submissions ←── scores
                  ├── judges ←── judge_assignments
                  │             └── judge_tracks
                  ├── rubric_criteria
                  ├── organizer_roles
                  ├── audit_events
                  └── hackathon_notification_config
```

## Migration Strategy

- Forward-only migrations via `drizzle-kit generate`
- Never rename or remove columns in the same migration
- Rollback = deploy previous Worker version (schema is additive)
- Migration files: `packages/db/migrations/`
- wrangler.jsonc path: `../../packages/db/migrations` (relative from `apps/api/`)

### Migration Safety — CASCADE Risk

**WARNING:** D1 ignores `PRAGMA foreign_keys=OFF` during migrations. Any Drizzle migration that recreates a parent table (`users`, `hackathons`, `teams`, `workspaces`) will trigger `ON DELETE CASCADE` on ALL child tables, silently deleting production data.

**Mandatory process:**
1. Always run `drizzle-kit generate` to produce migration SQL
2. **Review every generated migration** for `DROP TABLE` statements on parent tables
3. If a parent table is dropped and recreated, **manually rewrite** the migration to use `ALTER TABLE` instead
4. Test migrations against a staging D1 database with sample data before applying to production
5. Back up D1 database before any migration: `wrangler d1 export devsage-db --output=backup.sql`

**Tables with highest CASCADE risk:**
- `users` → refresh_tokens, workspace_members, organizer_roles, team_members, scores, audit_events, etc.
- `hackathons` → organizer_roles, teams, submissions, judges, rubric_criteria, audit_events, etc.
- `teams` → team_members, team_invites, team_repos, submissions
