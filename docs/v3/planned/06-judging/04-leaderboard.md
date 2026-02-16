# Leaderboard

> Aggregate scores into ranked results per round.

## Computation

When scores exist, the leaderboard is computed on-demand:

```ts
async function computeLeaderboard(hackathonId: string, roundId: string | null) {
  // 1. Get all current submissions for this round
  // 2. For each submission, aggregate scores across all judges
  // 3. Compute weighted total per submission
  // 4. Rank by weighted total (descending)
  // 5. Handle ties (same score = same rank)

  const results = await db.select({
    team_id: submissions.team_id,
    team_name: teams.name,
    submission_id: submissions.id,
    avg_weighted_score: sql<number>`
      SUM(${scores.score} * 1.0 / ${rubricCriteria.max_score} * ${rubricCriteria.weight} * 100)
      / COUNT(DISTINCT ${scores.judge_id})
    `,
    judges_scored: sql<number>`COUNT(DISTINCT ${scores.judge_id})`,
  })
  .from(submissions)
  .innerJoin(teams, eq(submissions.team_id, teams.id))
  .innerJoin(scores, eq(submissions.id, scores.submission_id))
  .innerJoin(rubricCriteria, eq(scores.criterion_id, rubricCriteria.id))
  .where(and(
    eq(submissions.hackathon_id, hackathonId),
    eq(submissions.is_current, true),
    roundId ? eq(submissions.round_id, roundId) : isNull(submissions.round_id),
  ))
  .groupBy(submissions.team_id)
  .orderBy(desc(sql`avg_weighted_score`))
  .all();

  return results;
}
```

## Endpoint

### `GET /api/v1/hackathons/:slug/leaderboard`

```
Auth:
  - organizer/co_organizer/judge: always visible
  - team_member: only after results published (hackathon.settings.results_published = true)
  - anonymous: only after results published

Query: ?round_id=
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "published": false,
    "entries": [
      {
        "rank": 1,
        "team_id": "uuid",
        "team_name": "Team Alpha",
        "track": "Web Track",
        "total_score": 85.5,
        "judges_scored": 3,
        "criteria_scores": [
          { "name": "Innovation", "average": 9.0, "weighted": 27.0 }
        ]
      }
    ]
  }
}
```

## Caching

Leaderboard is computed on-the-fly but can be cached:

```ts
// KV cache key: leaderboard:{hackathonId}:{roundId}
// TTL: 60 seconds during judging (scores changing)
// TTL: 3600 seconds after completion (stable)
```

Cache is invalidated when a new score is submitted.

## Tie Breaking

Teams with the same total weighted score receive the same rank:

```ts
let currentRank = 1;
for (let i = 0; i < results.length; i++) {
  if (i > 0 && results[i].avg_weighted_score < results[i-1].avg_weighted_score) {
    currentRank = i + 1;
  }
  results[i].rank = currentRank;
}
```

## Implementation Notes

- Leaderboard is a read-only computed view, not a stored table
- `round_results` table stores finalized results after organizer confirms
- During judging, the leaderboard updates in near-real-time as judges submit scores
- Track-specific leaderboards: filter by `teams.track_id`
