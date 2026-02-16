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
for (const entry of leaderboard) {
  await db.insert(roundResults).values({
    id: crypto.randomUUID(),
    round_id: roundId,
    team_id: entry.team_id,
    rank: entry.rank,
    total_score: entry.total_score,
    advanced: false, // set by organizer for elimination rounds
    created_at: new Date().toISOString(),
  });
}
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
