# Rubric Configuration

> `POST /api/v1/hackathons/:slug/rubric` — Define scoring criteria for judging.

## What's a Rubric?

A rubric defines WHAT judges score and HOW each criterion is weighted:

```json
[
  { "name": "Innovation", "description": "How novel is the solution?", "max_score": 10, "weight": 0.3 },
  { "name": "Technical", "description": "Code quality, architecture", "max_score": 10, "weight": 0.3 },
  { "name": "Design", "description": "UI/UX quality", "max_score": 10, "weight": 0.2 },
  { "name": "Presentation", "description": "Demo and pitch quality", "max_score": 10, "weight": 0.2 }
]
```

Weights must sum to 1.0.

## Endpoints

### `GET /api/v1/hackathons/:slug/rubric`

```
Auth: judge+ (anyone involved in judging can see criteria)
```

### `POST /api/v1/hackathons/:slug/rubric`

```
Auth: organizer or co_organizer
State: draft or active (cannot change rubric during judging)
```

```ts
const rubricSchema = z.array(z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  max_score: z.number().int().min(1).max(100).default(10),
  weight: z.number().min(0).max(1),
  sort_order: z.number().int().default(0),
})).refine(
  (criteria) => {
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    return Math.abs(totalWeight - 1.0) < 0.001;
  },
  { message: 'Weights must sum to 1.0' }
);
```

### `PATCH /api/v1/hackathons/:slug/rubric/:criterionId`

Update a single criterion. Only allowed before judging starts.

### `DELETE /api/v1/hackathons/:slug/rubric/:criterionId`

Remove a criterion. Only allowed before judging starts.

## DB Table

```sql
CREATE TABLE rubric_criteria (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_score INTEGER NOT NULL DEFAULT 10,
  weight REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Track-Specific Criteria (Optional)

If tracks have different judging needs, criteria can be scoped:

```ts
// rubric_criteria can have an optional track_id
track_id: z.string().uuid().nullable().optional(),
```

If `track_id` is null, the criterion applies to all tracks. If set, it only applies to teams in that track.

## Implementation Notes

- Rubric must have at least one criterion before transitioning to `judging`
- Changing the rubric after scores exist is blocked (would invalidate scores)
- `sort_order` controls display order in the judge UI
- Max score is per-criterion (judge scores 0 to `max_score`)
- Final weighted score = Σ (score / max_score × weight × 100)
