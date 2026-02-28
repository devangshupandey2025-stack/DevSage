# Service Layer Extraction

Priority: MEDIUM — architectural improvement, not blocking features.

## Problem

All business logic lives in route handlers (fat controllers). Routes are 300-800 lines with inline SQL, validation, authorization, and business rules mixed together.

## Target Architecture

```
Route Handler (thin)
  → Validates input (Zod)
  → Calls service method
  → Returns response envelope

Service (business logic)
  → Orchestrates operations
  → Calls repository methods
  → Emits audit events
  → Queues notifications

Repository (data access)
  → Raw SQL queries
  → Returns typed results
  → Handles D1 quirks
```

## Extraction Priority

Extract services in order of code complexity and change frequency:

### 1. HackathonService (`src/services/hackathon-service.ts`)
Extract from: `routes/hackathons.ts` (357 lines)
Methods:
- `createHackathon(input, userId)` — creation + DO init + audit
- `createFromTemplate(input, templateId, userId)` — template application + batch inserts
- `updateHackathon(slug, input, userId)` — update + audit
- `transitionState(slug, targetState, userId)` — state machine + DO sync
- `listHackathons(filters, pagination)` — listing with role-based visibility

### 2. TeamService (`src/services/team-service.ts`)
Extract from: `routes/teams.ts` (605 lines)
Methods:
- `createTeam(hackathonId, input, userId)` — creation + member add
- `seedTeams(hackathonId, mode, data, userId)` — Mode A/B seeding
- `inviteMember(teamId, email, userId)` — invite + notification
- `transferLeadership(teamId, newLeaderId, userId)` — role swap + audit
- `eliminateTeam(teamId, roundId, userId)` — status change + notification (NEW)
- `disbandTeam(teamId, userId)` — member removal + audit (NEW)
- `disqualifyTeam(teamId, reason, userId)` — with required reason + audit (NEW)

### 3. JudgingService (`src/services/judging-service.ts`) — already exists, extend it
Add methods:
- `submitScores(hackathonId, judgeId, submissionId, scores[])` — batch insert + validation
- `enforceTimeWindow(hackathonId, roundId)` — check `scoring_opens_at` / `scoring_closes_at`
- `handleIncompleteJudging(hackathonId, roundId)` — from role-event-lead.md
- `checkConflict(judgeId, teamId)` — block scoring for conflicted teams
- `enforceBlindJudging(judgeId, query)` — filter out other judges' individual scores

### 4. SubmissionService (`src/services/submission-service.ts`)
Extract from: `routes/submissions.ts` (479 lines)
Methods:
- `createSubmission(hackathonId, teamId, tagData)` — creation + DO lock
- `processWebhookSubmission(event)` — tag handler + validation
- `getSubmissionWithAnalysis(submissionId)` — enrich with AI review

### 5. WorkspaceService (`src/services/workspace-service.ts`)
Extract from: `routes/workspaces.ts` (409 lines)
Methods:
- `createWorkspace(input, userId)` — creation + owner membership
- `inviteMember(workspaceId, email, role, userId)` — invite + notification
- `deleteWorkspace(workspaceId, userId)` — soft delete + cascade (NEW)
- `transferOwnership(workspaceId, newOwnerId, userId)` — role swap (NEW)
- `enforceOwnerMax(workspaceId)` — max 2 owners per workspace (NEW)

## Implementation Rules

1. **One service per route file** — maintain 1:1 mapping
2. **Services receive `env` parameter** — for D1, KV, DO, Queue access
3. **Services throw typed errors** — `AppError(code, message, status)`
4. **Route handlers catch and respond** — via error-handler middleware
5. **Minimal cross-service calls** — prefer flat dependency graph. Where a service needs data from another domain (e.g., judging needs team data), pass it as a parameter from the route handler rather than importing another service. This keeps services independently testable.
6. **Audit logging inside services** — not in routes
7. **Extract incrementally** — one service at a time, test after each

## Migration Strategy

For each route file:
1. Create `src/services/{name}-service.ts`
2. Move business logic into service methods
3. Update route to call service
4. Run existing tests — they should pass without changes (integration tests)
5. Add unit tests for service methods (mock D1)

**Important**: New features built AFTER Phase 3 (billing, remaining gaps) should use the service layer pattern from the start. Don't create new fat controllers.

## Repository Pattern (Optional, Phase 2)

If raw SQL becomes unwieldy, add a thin repository layer:
```
src/repositories/
  hackathon-repo.ts    — findBySlug, create, update, listWithPagination
  team-repo.ts         — findByHackathon, findByUser, batchInsert
  score-repo.ts        — batchInsertScores, aggregateBySubmission
```

This is optional — only do it if services still have too much SQL inline.
