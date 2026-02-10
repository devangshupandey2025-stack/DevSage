# Backend v2 — Learnings

## 2026-02-10 Session Start
- Starting from scratch: 0/34 tasks completed
- On `main` branch, no `dev` branch exists yet
- No prior sessions produced any work (5 sessions, 0 completed tasks)
- Existing branches: main, main-old, claude/fix-dev-pnpm-config-7j0cu

## Task 1 — Shared Zod Schemas v2
- 17 files changed: 6 rewritten, 9 new, 1 deleted, 1 barrel updated
- registration.ts deleted — downstream imports exist in `apps/api/src/routes/hackathons.ts`, `apps/api/src/routes/teams.ts`, and test files. These will break until later tasks update the API routes.
- SQLite integer booleans: used `z.number().int()` not `z.boolean()` for columns like `allowLateSubmissions`, `botActive`, `isForcePush`, `isLate`, `isFinal`, `notifiedOrganizer`
- JSON text columns (validationErrors, commitsLostShas, strengths, concerns, rawResponse, submissionsInvalidated, details): kept as `z.string().nullable().optional()` since stored as serialized JSON strings
- Hackathon request schemas (Create/Update) moved from api.ts → hackathon.ts; api.ts now holds team requests + ApiError/ApiSuccess envelope types
- JoinTeamRequestSchema changed from `joinCode` to `inviteCode` to match v2 column naming
- All `.js` extensions in barrel re-exports confirmed working with ESM strict
