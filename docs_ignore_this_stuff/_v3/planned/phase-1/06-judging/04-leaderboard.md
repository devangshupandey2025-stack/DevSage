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

  // Two-level aggregation: first averages each criterion across judges,
  // then sums weighted criterion scores. This handles partial scoring
  // correctly — a judge who scores 2/4 criteria only affects those
  // 2 criteria averages.
  const results = await db.all(sql`
    SELECT sub.team_id, t.name as team_name, sub.id as submission_id,
           SUM(criterion_avg) as avg_weighted_score,
           judges_scored
    FROM (
      -- Per-criterion averages (handles partial scoring correctly)
      SELECT s.submission_id, s.criterion_id,
             AVG(s.score * 1.0 / rc.max_score) * rc.weight * 100 as criterion_avg,
             COUNT(DISTINCT s.judge_id) as judges_scored
      FROM scores s
      JOIN rubric_criteria rc ON s.criterion_id = rc.id
      WHERE rc.hackathon_id = ${hackathonId}
      GROUP BY s.submission_id, s.criterion_id
    ) criteria_scores
    JOIN submissions sub ON criteria_scores.submission_id = sub.id
    JOIN teams t ON sub.team_id = t.id
    WHERE sub.hackathon_id = ${hackathonId}
      AND sub.is_current = 1
      ${roundId ? sql`AND sub.round_id = ${roundId}` : sql`AND sub.round_id IS NULL`}
    GROUP BY sub.team_id
    ORDER BY avg_weighted_score DESC
  `);

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
