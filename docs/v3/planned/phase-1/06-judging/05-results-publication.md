# Results Publication

> Finalizing and announcing hackathon results.

## Publication Flow

```
1. Organizer reviews leaderboard
2. Organizer clicks "Publish Results"
3. System stores results in round_results table
4. Hackathon settings updated: results_published = true
5. Leaderboard becomes visible to all participants
6. Notification sent to all participants
7. Commit statuses posted on GitHub (final ranking)
```

## Endpoints

### `POST /api/v1/hackathons/:slug/results/publish`

```
Auth: organizer only
State: completed (judging must be finished)
```

**Implementation:**
1. Compute final leaderboard
2. Insert rows into `round_results`:

```ts
// Publish results — chunked to respect D1's 100-parameter limit
const CHUNK_SIZE = 12; // 12 rows × ~8 cols = 96 params < 100 limit
const chunks: Promise<any>[] = [];

for (let i = 0; i < leaderboard.length; i += CHUNK_SIZE) {
  chunks.push(
    db.insert(roundResults).values(
      leaderboard.slice(i, i + CHUNK_SIZE).map((entry, idx) => ({
        id: crypto.randomUUID(),
        hackathonId,
        roundId,
        submissionId: entry.submission_id,
        teamId: entry.team_id,
        rank: i + idx + 1,
        totalScore: entry.total_score,
        publishedAt: new Date().toISOString(),
      }))
    )
  );
}
await db.batch(chunks);
```

3. Update hackathon settings: `results_published = true`
4. Enqueue notification: `hackathon.results_published`
5. Post commit status on each team's submission tag:

```ts
// POST /repos/{owner}/{repo}/statuses/{sha}
{
  state: 'success',
  description: `Rank #${rank} — Score: ${score}/100`,
  context: 'devsage/results',
}
```

6. Audit: `results.published`

### `POST /api/v1/hackathons/:slug/results/unpublish`

```
Auth: organizer only
```

Hides results from participants. Sets `results_published = false`. Scores remain — just visibility changes.

### `POST /api/v1/hackathons/:slug/rounds/:roundId/advance`

```
Auth: organizer only
```

For elimination rounds, mark which teams advance:

```ts
const advanceSchema = z.object({
  team_ids: z.array(z.string().uuid()).min(1),
});

// Updates round_results.advanced = true for specified teams
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `NO_SCORES_TO_PUBLISH` | 400 | No scores exist |
| `ALREADY_PUBLISHED` | 409 | Results already published |
| `NOT_COMPLETED` | 400 | Hackathon not in completed state |

## Implementation Notes

- Publishing is reversible (unpublish) — results are stored separately from visibility flag
- Commit status posting is best-effort (fail-open) — don't block publication on GitHub API errors
- Results are persisted in `round_results` for historical record (even if leaderboard can be recomputed)
