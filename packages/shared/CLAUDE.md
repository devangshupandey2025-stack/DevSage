# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this package.

## Package: @devsage/shared

Zod validation schemas, TypeScript types, and constants shared between all apps. Only runtime dependency is `zod`. Consumed by `@devsage/api`, `@devsage/web`, `@devsage/platform`, and `@devsage/admin`.

## Commands

```bash
# From repo root
pnpm --filter @devsage/shared run build   # Compile TypeScript (tsc --build)
pnpm --filter @devsage/shared run test    # Run vitest
```

## Source Layout

```
src/
├── index.ts              # Barrel: re-exports all schemas (use .js extensions)
├── __tests__/
│   └── schemas.test.ts   # Schema validation tests
└── schemas/
    ├── constants.ts      # All enum schemas (hackathon status, team status, roles, etc.)
    ├── api.ts            # Generic response/pagination schemas
    └── *.ts              # Per-entity request/response schemas (25 files)
```

## Adding a New Schema

1. Create `src/schemas/{entity}.ts`
2. Define Zod schemas: `create{Entity}Schema`, `update{Entity}Schema`, `{entity}ResponseSchema`
3. Export TypeScript types via `z.infer<typeof schema>`
4. Add `export * from './schemas/{entity}.js'` to `src/index.ts` (note `.js` extension)
5. Run `pnpm --filter @devsage/shared run build` to compile

## Schema Conventions

### Naming
- Request schemas: `create{Entity}Schema`, `update{Entity}Schema`
- Response schemas: `{entity}ResponseSchema`
- Type exports: `Create{Entity}`, `Update{Entity}`, `{Entity}Response`
- Enum schemas: `{entity}{Field}Schema` (e.g., `hackathonStatusSchema`)

### Constants (`schemas/constants.ts`)
Central file for all enums used across schemas:
- `hackathonStatusSchema`: draft, active, judging, completed, archived
- `teamStatusSchema`: forming, ready, submitted, dissolved
- `submissionStatusSchema`: pending_validation, validated, failed_validation, tag_deleted
- `hackathonRoleSchema`: organizer, co_organizer, judge, team_lead, team_member, anonymous
- `workspaceRoleSchema`: owner, admin, member
- Plus: `teamMemberRoleSchema`, `organizerRoleSchema`, `judgeInviteStatusSchema`, `auditActorTypeSchema`, `sponsorTierSchema`, etc.

### API Schemas (`schemas/api.ts`)
- `successResponseSchema<T>` — generic `{ ok: true, data: T, meta? }`
- `errorResponseSchema` — `{ ok: false, error: { code, message, details? } }`
- `paginationQuerySchema` — `{ limit: 1-100 (default 20), offset: default 0 }`
- `cursorPaginationQuerySchema` — `{ limit: 1-100, cursor? }`

### Validation
Schemas include min/max lengths, format validation (emails, UUIDs, URLs, datetimes), enum constraints. Use `.safeParse()` in tests, `.parse()` or `@hono/zod-validator` in API routes.

## Package Exports
```json
{
  ".": "./dist/index.js",
  "./package.json": "./package.json"
}
```
Import as: `import { createHackathonSchema, type HackathonResponse } from '@devsage/shared'`
