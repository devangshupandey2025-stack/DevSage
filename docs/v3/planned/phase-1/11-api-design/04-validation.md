# Request Validation

> Zod schemas for request body validation, shared between API and frontend.

## Pattern

Every mutation endpoint validates its request body with a Zod schema:

```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// Body validation — Hono middleware pattern
app.post('/api/v1/hackathons/:slug/teams',
  authMiddleware,
  requireRole('co_organizer'),
  zValidator('json', createTeamSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: result.error.issues,
        },
      }, 400);
    }
  }),
  async (c) => {
    const body = c.req.valid('json'); // fully typed from schema
    // ... handler logic
  }
);
```

> **Always use `zValidator` middleware** — never parse and validate manually inside handlers. This ensures validation runs before the handler and provides automatic TypeScript type inference via `c.req.valid('json')`.

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
// Query parameter validation
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().optional(),
});

app.get('/api/v1/hackathons/:slug/teams',
  authMiddleware,
  zValidator('query', paginationSchema),
  async (c) => {
    const { limit, offset, cursor } = c.req.valid('query'); // typed
    // ... handler logic
  }
);
```

### Enum fields
```ts
z.enum(['draft', 'active', 'judging', 'completed', 'archived'])
```

### Path Parameter Validation

Path parameters should be validated with `zValidator('param', schema)`:

```ts
const slugParamSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Invalid slug format'),
});

const uuidParamSchema = z.object({
  teamId: z.string().uuid('Invalid team ID format'),
});

// Usage
app.get('/api/v1/hackathons/:slug',
  zValidator('param', slugParamSchema),
  async (c) => {
    const { slug } = c.req.valid('param'); // typed, validated
  }
);

app.get('/api/v1/hackathons/:slug/teams/:teamId',
  zValidator('param', z.object({
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    teamId: z.string().uuid(),
  })),
  async (c) => {
    const { slug, teamId } = c.req.valid('param');
  }
);
```

> **Convention:** Always validate path params. UUIDs use `z.string().uuid()`, slugs use `z.string().regex(/^[a-z0-9-]+$/)`, tokens use `z.string().min(32)`.

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

- Use `zValidator` middleware — validation runs before the handler, never manually inside
- Query params use `z.coerce.number()` since they arrive as strings
- Shared schemas have zero dependencies besides `zod`
- Re-export from `packages/shared/src/index.ts` with `.js` extensions (ESM strict)
