# @devsage/shared

**Shared Schemas and Types**

Zod schemas, TypeScript types, and constants shared between the API and web app. The only runtime dependency is `zod`.

## Import

```typescript
import {
  HackathonSchema,
  TeamSchema,
  HACKATHON_STATUS_TRANSITIONS,
  ROLES,
  ...
} from '@devsage/shared';
```

## Schemas

All validation schemas follow the `{Entity}Schema` naming convention. Request schemas for API input use `Create{Entity}RequestSchema`.

| Schema | Purpose |
|--------|---------|
| `UserSchema` | User profile |
| `HackathonSchema` | Hackathon entity |
| `CreateHackathonRequestSchema` | Hackathon creation input |
| `TeamSchema` | Team entity |
| `CreateTeamRequestSchema` | Team creation input |
| `JoinTeamRequestSchema` | Team join input |
| `TeamMemberSchema` | Team membership |
| `SubmissionSchema` | Project submission |
| `OrganizerRoleSchema` | Per-hackathon organizer role |
| `JudgeSchema` | Judge profile |
| `RubricCriteriaSchema` | Judging rubric criteria |
| `ScoreSchema` | Individual score entry |
| `JudgeAssignmentSchema` | Judge-to-submission assignment |
| `AiReviewSchema` | AI-generated review |
| `AuditEventSchema` | Audit log entry |
| `CommitLogSchema` | Git commit log |
| `ForcePushEventSchema` | Force push event |
| `ApiErrorSchema` | Standardized API error |

## Constants

| Constant | Description |
|----------|-------------|
| `HACKATHON_STATUS_TRANSITIONS` | Valid state machine transitions |
| `ROLES` | All per-hackathon role identifiers |
| `MAX_TEAM_NAME_LENGTH` | Maximum allowed team name length |
| `JOIN_CODE_LENGTH` | Length of generated team join codes |

## Types

Types are derived directly from Zod schemas. There are no separate type declaration files.

```typescript
import { z } from 'zod';
import { HackathonSchema } from '@devsage/shared';

type Hackathon = z.infer<typeof HackathonSchema>;
```

## Domain Values

**Hackathon statuses** (forward-only state machine):

`draft` -> `registration_open` -> `registration_closed` -> `active` -> `judging` -> `completed` -> `archived`

**Roles** (resolved per-request, not stored in JWT):

`anonymous` | `participant` | `team_leader` | `judge` | `moderator` | `admin` | `owner`

## Adding a Schema

1. Create a new file in `src/schemas/`.
2. Re-export from `src/index.ts` using an explicit `.js` extension:
   ```typescript
   export { MyNewSchema } from './schemas/my-new-schema.js';
   ```
3. Follow the naming conventions: `{Entity}Schema` for entities, `Create{Entity}RequestSchema` for API input validation.

## Conventions

- All schemas use `{Entity}Schema` naming.
- API input schemas use `Create{Entity}RequestSchema`.
- Types are always inferred from Zod -- no separate type files.
- Barrel exports use explicit `.js` extensions (ESM strict).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Compile TypeScript |
| `pnpm test` | Run Vitest tests |
