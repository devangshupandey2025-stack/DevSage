# Audience Voting

> Public voting system for hackathon submissions.

## Overview

Allow audience members (authenticated users who aren't judges) to vote on submissions. Produces a "People's Choice" award alongside judge scores.

## Design

- One vote per user per hackathon (or per submission, configurable)
- Voting window: configurable by organizer (typically during `judging` state)
- Results visible after organizer publishes

## New Table

```sql
CREATE TABLE audience_votes (
  id TEXT PRIMARY KEY,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id),
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(hackathon_id, user_id)  -- one vote per user per hackathon
);
```

## Endpoints

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/hackathons/:slug/votes` | ✅ | — | Cast vote |
| DELETE | `/hackathons/:slug/votes` | ✅ | — | Remove vote |
| GET | `/hackathons/:slug/votes/results` | ✅ | co_organizer | Vote tallies |
| GET | `/hackathons/:slug/votes/mine` | ✅ | — | My vote |

## Voting Rules

```ts
// Validation before accepting vote
function canVote(user: User, hackathon: Hackathon): boolean {
  // Must be authenticated
  // Hackathon must be in 'judging' state (or custom voting window)
  // User must not be a judge (judges score, not vote)
  // Voting must be enabled in hackathon config
  // User hasn't already voted
}
```

## Hackathon Configuration

```ts
// hackathon settings
{
  audience_voting_enabled: boolean,
  audience_voting_start: string | null,  // ISO-8601
  audience_voting_end: string | null,    // ISO-8601
  vote_type: 'one_per_hackathon' | 'one_per_submission',
}
```

## Prerequisites

- Submissions system (Phase 1)
- Auth system (Phase 1)
- Frontend voting UI (submission cards with vote button)

## Notes

- Separate from judging — audience votes don't affect judge scores
- Anti-gaming: one vote per authenticated user, rate limited
- Results hidden until organizer publishes (prevent bandwagon effect)
- Optional feature — organizer enables per hackathon
