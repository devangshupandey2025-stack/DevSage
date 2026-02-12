# packages/db — Drizzle ORM + D1

Drizzle SQLite schema for Cloudflare D1. 15 tables, barrel export, typed client factory.

## STRUCTURE

```
src/
├── index.ts              # Barrel: re-exports schema + client
├── client.ts             # createDbClient(d1) → typed DrizzleD1Database<typeof schema>
└── schema/
    ├── index.ts          # Re-exports all tables (explicit .js extensions)
    ├── users.ts          # users (UUID PK, email UNIQUE, github_id NOT NULL, google_id nullable)
    ├── hackathons.ts     # hackathons (slug UNIQUE, 7-state status, dates, config fields)
    ├── organizer-roles.ts # organizer_roles (hackathon+user, role: owner/admin/moderator)
    ├── teams.ts          # teams (join_code UNIQUE, hackathon FK, max_size)
    ├── team-members.ts   # team_members (team+user, role: leader/member)
    ├── submissions.ts    # submissions (hackathon+team UNIQUE, tag_name, is_final)
    ├── commit-log.ts     # commit_log (submission FK, SHA, author, timestamp)
    ├── force-push-events.ts # force_push_events (submission FK, before/after SHA)
    ├── judges.ts         # judges (hackathon+user UNIQUE, invite_status)
    ├── rubric-criteria.ts # rubric_criteria (hackathon FK, name, weight, max_score, sort_order)
    ├── judge-assignments.ts # judge_assignments (judge+submission, status)
    ├── scores.ts         # scores (assignment+criterion UNIQUE, score, comment)
    ├── ai-reviews.ts     # ai_reviews (submission FK, provider, content)
    └── audit-events.ts   # audit_events (hackathon FK, actor_type, action, entity, details JSON)
drizzle.config.ts         # dialect: sqlite, driver: d1-http, schema: ./dist/schema/*.js
migrations/               # Generated SQL migrations (wrangler.jsonc points here)
```

## CONVENTIONS

- **All timestamps**: TEXT columns, UTC ISO-8601 strings (`new Date().toISOString()`)
- **All IDs**: TEXT columns, `crypto.randomUUID()` at insert time
- **Column naming**: snake_case in SQL (`created_at`), camelCase in Drizzle schema references
- **Migrations**: `drizzle-kit generate` from `packages/db/`. Wrangler picks up from `../../packages/db/migrations` (relative path)
- **Client**: `createDbClient(c.env.DB)` in API routes. Returns typed `DrizzleD1Database<typeof schema>`
- **Adding a table**: Create file in `schema/`, re-export from `schema/index.ts` with `.js` extension, run `drizzle-kit generate`
- **Barrel exports**: Explicit `.js` extensions required (ESM strict)

## ANTI-PATTERNS

- Using Prisma (incompatible with D1/Workers)
- Forgetting to re-export new tables from `schema/index.ts`
- Running `drizzle-kit generate` from wrong directory (must be `packages/db/`)
- Accessing D1 directly instead of through Drizzle client
- Omitting `.js` extension in barrel re-exports
