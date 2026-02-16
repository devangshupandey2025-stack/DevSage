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
// Atomic score submission — all criteria + assignment status in one batch
await db.batch([
  ...body.scores.map(s =>
    db.insert(scoresTable).values({
      id: crypto.randomUUID(),
      hackathon_id: hackathonId,
      submission_id: body.submission_id,
      judge_id: judgeId,
      criterion_id: s.criterion_id,
      score: s.score,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [scoresTable.judge_id, scoresTable.submission_id, scoresTable.criterion_id],
      set: { score: s.score, updated_at: new Date().toISOString() },
    })
  ),
  db.update(judgeAssignments)
    .set({ status: 'scored', updated_at: new Date().toISOString() })
    .where(eq(judgeAssignments.id, assignment.id)),
]);
```

> **Atomicity:** Uses `db.batch()` for atomicity — D1 does not support SQL transactions. All score upserts and the assignment status update succeed or fail together.

> **Concurrency:** The `judge_assignments` update should include an `updatedAt` check for optimistic locking:
> `.where(and(eq(judgeAssignments.id, assignment.id), eq(judgeAssignments.updatedAt, assignment.updatedAt)))`
> If the update affects 0 rows, return `409 Conflict` — another request modified the assignment concurrently.

## Scores Table

```sql
CREATE TABLE scores (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE RESTRICT,
  score REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(judge_id, submission_id, criterion_id)
);
```

> **Data Protection:** Scores use `ON DELETE RESTRICT` for the criterion foreign key — deleting a criterion that has scores is blocked. The application must check for existing scores before allowing criterion deletion, or require archiving instead of deletion.

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

## Edge Cases

- **Judge scores the same submission twice.** The upsert (`onConflictDoUpdate`) updates the existing score row. No duplicates created.
- **Judge tries to score a submission they're not assigned to.** Return 403 `NOT_ASSIGNED`.
- **Hackathon transitions out of 'judging' while a judge is scoring.** Reject with 400 `JUDGING_NOT_ACTIVE`. The state check happens at request time, not at page load.
- **Score submitted for a criterion from a different hackathon.** Reject with 400 `INVALID_CRITERION`. The criterion-to-hackathon relationship is validated before insert.
- **Partial score submission (not all criteria covered).** Allow it. Mark the judge assignment as `in_progress`, not `scored`. The judge can return and complete the remaining criteria later.
- **Weight normalization: weights don't sum to 1.0.** Normalize at computation time, not at input time. This avoids forcing organizers to recalculate weights when adding or removing criteria.

## Done When

- [ ] POST /scores creates/updates scores for assigned submission
- [ ] Validation: score <= max_score, criterion belongs to hackathon
- [ ] Upsert works (re-scoring updates, doesn't duplicate)
- [ ] 403 for unassigned submissions
- [ ] 400 for non-judging state
- [ ] Weighted score computation is correct
- [ ] Audit event logged: score.submitted
- [ ] Unit test: scoring, re-scoring, validation errors
