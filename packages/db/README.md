# @devsage/db

**Database Layer**

Drizzle ORM schemas and D1 migrations for Cloudflare D1 (SQLite). Provides a typed database client and all table definitions used across the DevSage platform.

## Exports

```typescript
import { createDbClient } from '@devsage/db/client';
import { users, hackathons, teams, ... } from '@devsage/db/schema';
```

## Directory Structure

```
packages/db/
├── src/
│   ├── client.ts              # createDbClient factory
│   └── schema/
│       ├── index.ts           # Barrel export (all tables)
│       ├── users.ts
│       ├── hackathons.ts
│       ├── organizer-roles.ts
│       ├── teams.ts
│       ├── team-members.ts
│       ├── submissions.ts
│       ├── commit-log.ts
│       ├── force-push-events.ts
│       ├── judges.ts
│       ├── rubric-criteria.ts
│       ├── judge-assignments.ts
│       ├── scores.ts
│       ├── ai-reviews.ts
│       └── audit-events.ts
├── migrations/                # Generated D1 migration files
├── drizzle.config.ts
└── package.json
```

## Usage

```typescript
import { createDbClient } from '@devsage/db/client';
import { users } from '@devsage/db/schema';

const db = createDbClient(env.DB);
const allUsers = await db.select().from(users);
```

## Adding a Table

1. Create a new schema file in `src/schema/`.
2. Re-export it from `src/schema/index.ts`.
3. Generate the migration:
   ```bash
   pnpm --filter @devsage/db generate
   ```
4. Apply the migration:
   ```bash
   wrangler d1 migrations apply
   ```

## Conventions

- **IDs**: TEXT columns storing UUIDs via `crypto.randomUUID()`.
- **Timestamps**: TEXT columns storing ISO-8601 UTC strings (`new Date().toISOString()`).
- **SQL columns**: `snake_case` in the database.
- **Drizzle references**: `camelCase` in TypeScript schema definitions.

For full table schemas and ERD, see `docs/v2/architecture/10-data-model.md`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Compile TypeScript |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm generate` | Run `drizzle-kit generate` to create migrations |
