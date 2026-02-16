# 06 — Judging

> Rubric-based scoring by invited judges with configurable criteria, assignment algorithms, and leaderboard computation.

## Judging Flow

```
1. Organizer configures rubric (criteria + weights)
2. Organizer invites judges (email or link)
3. Judges accept invitations
4. Hackathon transitions to 'judging' phase
5. System assigns submissions to judges (round-robin)
6. Judges score each assigned submission
7. Organizer finalizes scores
8. Leaderboard computed
9. Results published
```

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-rubric-configuration.md](./01-rubric-configuration.md) | Criteria CRUD, scoring types, weights |
| [02-judge-management.md](./02-judge-management.md) | Invite, accept, assignment algorithms |
| [03-scoring.md](./03-scoring.md) | Score submission, validation, normalization |
| [04-leaderboard.md](./04-leaderboard.md) | Computation, caching, publication |
| [05-results-publication.md](./05-results-publication.md) | Finalize and announce results |
| [06-blind-mode.md](./06-blind-mode.md) | Identity hiding for unbiased judging |

## Dependencies

- `apps/api/src/routes/judging.ts`
- `apps/api/src/services/judging-service.ts`
- `packages/db/src/schema/judges.ts`
- `packages/db/src/schema/judge-assignments.ts`
- `packages/db/src/schema/rubric-criteria.ts`
- `packages/db/src/schema/scores.ts`
- `packages/db/src/schema/round-results.ts`
