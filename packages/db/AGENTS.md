# packages/db — Drizzle ORM + D1

Drizzle SQLite schema for Cloudflare D1. 6 tables, barrel export, typed client factory.

## STRUCTURE

```
src/
├── index.ts              # Barrel: re-exports schema + client
├── client.ts             # createDbClient(d1) → typed Drizzle instance
└── schema/
    ├── index.ts          # Re-exports all tables
    ├── users.ts          # users table (UUID PK, email UNIQUE, provider, role)
    ├── hackathons.ts     # hackathons table (status, dates, organiser FK)
    ├── registrations.ts  # registrations (hackathon+user UNIQUE)
    ├── teams.ts          # teams (join_code UNIQUE, captain FK)
    ├── team_members.ts   # team_members (composite PK: team+user)
    └── submissions.ts    # submissions (hackathon+team UNIQUE)
drizzle.config.ts         # dialect: sqlite, driver: d1-http
migrations/               # Generated SQL migrations (wrangler.jsonc points here)
```

## CONVENTIONS

- **All timestamps**: TEXT columns, UTC ISO-8601 strings
- **All IDs**: TEXT columns, `crypto.randomUUID()` at insert time
- **Column naming**: snake_case in SQL (`created_at`), camelCase in Drizzle schema references
- **Migrations**: `drizzle-kit generate` from `packages/db/`. Wrangler picks up from `../../packages/db/migrations` (relative path in `wrangler.jsonc`)
- **Client**: `createDbClient(c.env.DB)` in API routes. Returns typed `DrizzleD1Database<typeof schema>`
- **Adding a table**: Create file in `schema/`, re-export from `schema/index.ts`, run `drizzle-kit generate`

## ANTI-PATTERNS

- Using Prisma (incompatible with D1/Workers)
- Forgetting to re-export new tables from `schema/index.ts`
- Running `drizzle-kit generate` from wrong directory (must be `packages/db/`)
- Accessing D1 directly instead of through Drizzle client
