# Request Validation

> Zod schemas for request body validation, shared between API and frontend.

## Pattern

Every mutation endpoint validates its request body with a Zod schema:

```ts
import { z } from 'zod';

const createTeamSchema = z.object({
  name: z.string().min(2).max(50),
  track_id: z.string().uuid().optional(),
});

app.post('/teams', authMiddleware, requireRole('co_organizer'), async (c) => {
  const body = createTeamSchema.safeParse(await c.req.json());

  if (!body.success) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid request body', body.error.issues);
  }

  // body.data is typed correctly
  const { name, track_id } = body.data;
});
```

## Shared Schemas

Zod schemas live in `packages/shared/src/schemas/` and are shared between API and frontend:

```
packages/shared/src/schemas/
├── hackathon.ts      # createHackathonSchema, updateHackathonSchema
├── team.ts           # createTeamSchema, joinTeamSchema
├── submission.ts     # overrideSubmissionSchema
├── score.ts          # submitScoreSchema
├── rubric.ts         # rubricSchema
├── user.ts           # updateProfileSchema
└── index.ts          # barrel export (with .js extensions)
```

**Import in API:**
```ts
import { createHackathonSchema } from '@devsage/shared';
```

**Import in frontend (form validation):**
```ts
import { createHackathonSchema } from '@devsage/shared';
// Used with React Hook Form or direct validation
```

## Common Patterns

### UUID validation
```ts
z.string().uuid()
```

### ISO-8601 datetime
```ts
z.string().datetime()
```

### Pagination params
```ts
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
```

### Enum fields
```ts
z.enum(['draft', 'active', 'judging', 'completed', 'archived'])
```

## Error Response Format

Zod validation errors are mapped to the standard error envelope:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      { "path": ["name"], "message": "String must contain at least 2 character(s)" },
      { "path": ["track_id"], "message": "Invalid uuid" }
    ]
  }
}
```

## Implementation Notes

- `safeParse()` (not `parse()`) — never throw, always return structured errors
- Query params use `z.coerce.number()` since they arrive as strings
- Shared schemas have zero dependencies besides `zod`
- Re-export from `packages/shared/src/index.ts` with `.js` extensions (ESM strict)
