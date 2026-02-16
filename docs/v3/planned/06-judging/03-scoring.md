# Scoring

> Judges submit scores per criterion for each assigned submission.

## Score Submission

### `POST /api/v1/hackathons/:slug/scores`

```
Auth: authMiddleware + requireRole('judge') (exact role check)
State: judging only
```

```ts
const scoreSchema = z.object({
  submission_id: z.string().uuid(),
  scores: z.array(z.object({
    criterion_id: z.string().uuid(),
    score: z.number().min(0),         // validated against criterion.max_score
  })),
  notes: z.string().max(2000).optional(), // private judge notes
});
```

**Implementation:**
1. Verify judge is assigned to this submission
2. Verify hackathon is in `judging` state
3. For each criterion:
   - Validate score ≤ `criterion.max_score`
   - Validate criterion belongs to this hackathon
4. Upsert scores (allows score updates)
5. Mark assignment as `scored`
6. Audit: `score.submitted`

```ts
for (const { criterion_id, score } of body.scores) {
  await db.insert(scoresTable)
    .values({
      id: crypto.randomUUID(),
      hackathon_id: hackathonId,
      submission_id: body.submission_id,
      judge_id: judgeId,
      criterion_id: criterion_id,
      score: score,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [scoresTable.judge_id, scoresTable.submission_id, scoresTable.criterion_id],
      set: { score, updated_at: new Date().toISOString() },
    });
}
```

## Scores Table

```sql
CREATE TABLE scores (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(judge_id, submission_id, criterion_id)
);
```

## Score Normalization

Weighted score per criterion:

```ts
// Per criterion: normalized = (score / max_score) * weight * 100
// Total = sum of all normalized scores

function computeWeightedTotal(scores: Score[], criteria: RubricCriterion[]): number {
  return scores.reduce((total, s) => {
    const criterion = criteria.find(c => c.id === s.criterion_id);
    if (!criterion) return total;
    return total + (s.score / criterion.max_score) * criterion.weight * 100;
  }, 0);
}
```

Example:
- Innovation: 8/10 × 0.3 × 100 = 24
- Technical: 9/10 × 0.3 × 100 = 27
- Design: 7/10 × 0.2 × 100 = 14
- Presentation: 6/10 × 0.2 × 100 = 12
- **Total: 77/100**

## Get Scores

### `GET /api/v1/hackathons/:slug/submissions/:id/scores`

```
Auth: organizer (all scores) or judge (own scores only)
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "submission_id": "uuid",
    "judges_scored": 3,
    "judges_total": 5,
    "criteria": [
      {
        "criterion_id": "uuid",
        "name": "Innovation",
        "scores": [8, 7, 9],
        "average": 8.0,
        "weighted": 24.0
      }
    ],
    "total_weighted": 77.0
  }
}
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `NOT_ASSIGNED` | 403 | Judge not assigned to this submission |
| `SCORE_OUT_OF_RANGE` | 400 | Score exceeds criterion max_score |
| `INVALID_CRITERION` | 400 | Criterion doesn't belong to hackathon |
| `JUDGING_NOT_ACTIVE` | 400 | Hackathon not in judging state |
