# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package: @devsage/db

Drizzle ORM schemas and D1 migrations for DevSage. ~38 tables covering better-auth identity, workspaces, hackathons, teams, submissions, judging, notifications, and audit. Consumed by `@devsage/api` and `@devsage/auth`.

## Commands

```bash
# From repo root
pnpm --filter @devsage/db run build       # Compile TypeScript (tsc)
pnpm --filter @devsage/db run typecheck   # Type-check without emitting
pnpm --filter @devsage/db run generate    # Compile + drizzle-kit generate (creates migration SQL)
```

## Schema Change Workflow

1. Edit/add schema files in `src/schema/`
2. Re-export from `src/schema/index.ts` (use `.js` extension in imports)
3. Run `pnpm --filter @devsage/db run generate`
4. Review generated SQL in `migrations/`
5. Commit the migration file
6. Wrangler applies migrations automatically (path: `../../packages/db/migrations` from `apps/api`)

## Source Layout

```
src/
├── index.ts          # Barrel: re-exports all schema tables
├── client.ts         # createDb(d1: D1Database) factory → typed Database
└── schema/
    ├── index.ts      # Barrel: all table exports with .js extensions
    └── *.ts          # Individual table definitions (one per file)
```

## Schema Conventions

### Table Definitions
- Use `sqliteTable()` from `drizzle-orm/sqlite-core`
- Primary keys: `text('id').primaryKey()` (UUIDs, generated via `crypto.randomUUID()`)
- Timestamps: `text` columns with `sql\`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))\`` defaults (UTC ISO-8601)
- Booleans: `integer` columns (0/1, SQLite convention)
- JSON data: `text` columns storing stringified JSON
- Foreign keys: Inline `.references(() => table.column)` with `{ onDelete: 'cascade' }` or `{ onDelete: 'set null' }`

### Indexing
- `index()` for frequently queried columns, `uniqueIndex()` for uniqueness constraints
- Name pattern: `idx_{table}_{columns}` or `uq_{table}_{columns}`

### Table Groups

| Group | Tables |
|-------|--------|
| **better-auth** | `user`, `session`, `account`, `verification`, `twoFactor`, `passkey` |
| **Platform** | `platform-admins` |
| **Workspaces** | `workspaces`, `workspace-members`, `workspace-invites` |
| **Hackathons** | `hackathons`, `organizer-roles`, `hackathon-tracks`, `hackathon-rounds`, `custom-phases`, `hackathon-templates`, `hackathon-sponsors`, `hackathon-notification-config` |
| **Teams** | `teams`, `team-members`, `team-invites`, `team-repos`, `team-messages` |
| **Submissions** | `submissions`, `commit-log`, `force-push-events` |
| **Judging** | `judges`, `judge-assignments`, `judge-tracks`, `rubric-criteria`, `scores`, `round-results` |
| **Notifications** | `in-app-notifications`, `notification-deliveries`, `notification-idempotency`, `webhook-deliveries`, `pending-installations` |
| **Audit** | `audit-events`, `announcements` |

### better-auth Tables
The `user`, `session`, `account`, `verification`, `twoFactor`, and `passkey` tables are managed by the better-auth library. Do NOT manually insert/update rows in these tables — better-auth handles them. Other tables reference `user.id` for foreign keys.

### Cascade Rules
- Team/submission deletions cascade from hackathon
- Score/assignment deletions cascade from submission
- User deletions set FKs to NULL in business tables (preserve audit records)

## Client Usage

```typescript
import { createDb } from '@devsage/db/client';
const db = createDb(env.DB); // env.DB is the D1 binding
```

## Drizzle Config
- Dialect: `sqlite` (Cloudflare D1), Driver: `d1-http`
- Schema source: `./dist/schema/*.js` (compiled JS)
- Migration output: `./migrations/`

## Migrations
Located in `migrations/`. Applied by wrangler during `pnpm dev` (local) and deploy (production). Seed data in `0004_seed_accounts.sql` provides test accounts.
