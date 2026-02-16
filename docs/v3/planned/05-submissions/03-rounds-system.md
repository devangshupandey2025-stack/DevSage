# Rounds System

> Optional multi-round submissions scoped to hackathon rounds.

## Overview

By default, a hackathon has a single implicit round. Organizers can configure multiple rounds for multi-stage competitions.

## How Rounds Work

```
Hackathon with 2 rounds:
  Round 1: "Preliminary" (deadline: Feb 20)
  Round 2: "Final" (deadline: Feb 27)

Team pushes tag during Round 1 window → submission scoped to Round 1
Team pushes tag during Round 2 window → submission scoped to Round 2
```

## Round Resolution

When a tag webhook arrives, the system determines which round the submission belongs to:

```ts
function resolveRound(hackathonRounds: Round[], submittedAt: Date): Round | null {
  // Find the active round (current time before deadline)
  // Rounds are ordered by round_number
  for (const round of hackathonRounds) {
    if (!round.submission_deadline) continue;
    if (submittedAt <= new Date(round.submission_deadline)) {
      return round;
    }
  }
  return null; // past all deadlines
}
```

If no rounds are configured, `round_id` is null (single-round hackathon).

## Elimination Rounds

Rounds can be marked as `is_elimination`:

- After an elimination round's judging, only advancing teams can submit in the next round
- Advancing teams are determined by `round_results` table (organizer marks teams as advancing)

```ts
// Check if team can submit in current round
if (currentRound.is_elimination && currentRound.round_number > 1) {
  const previousRound = rounds.find(r => r.round_number === currentRound.round_number - 1);
  const result = await db.select()
    .from(roundResults)
    .where(and(
      eq(roundResults.round_id, previousRound.id),
      eq(roundResults.team_id, teamId),
      eq(roundResults.advanced, true)
    ))
    .get();

  if (!result) return { accepted: false, reason: 'not_advanced' };
}
```

## Endpoints

```
GET  /api/v1/hackathons/:slug/rounds                    # List rounds
POST /api/v1/hackathons/:slug/rounds                    # Create round (organizer)
POST /api/v1/hackathons/:slug/rounds/:roundId/advance   # Mark advancing teams (organizer)
```

## DB Table

```sql
CREATE TABLE hackathon_rounds (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  round_number INTEGER NOT NULL,
  submission_deadline TEXT,
  is_elimination BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(hackathon_id, round_number)
);

CREATE TABLE round_results (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES hackathon_rounds(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rank INTEGER,
  total_score REAL,
  advanced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(round_id, team_id)
);
```

## Implementation Notes

- Single-round hackathons don't need any round configuration — everything works with `round_id = null`
- Round deadlines override the hackathon's global `submission_deadline`
- Elimination logic is opt-in per round (`is_elimination` flag)
