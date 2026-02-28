# Judging System

Priority: HIGH — core workflow for judges and event leads.

## Source Docs
- `role-judge.md` — Judge flow, scoring, conflicts, leaderboard
- `role-event-lead.md` — Rubric config, judge assignment, aggregation, incomplete judging

## Current State

**Working**:
- Rubric CRUD (create, read, update criteria)
- Score submission (per-criterion, per-judge)
- Leaderboard computation (two-level aggregation)
- Judge assignment (manual + round-robin auto-assign)
- Judge invite flow (email invite → setup → accept)
- Judge portal (list assigned hackathons, assignments)

**Missing/Broken**:
- Scoring time window enforcement (GAP-004)
- Scoring window extension by Event Lead
- Judge guidelines enforcement (GAP-005)
- Conflict of interest declarations
- Multi-round judging workflow with per-round rubrics
- Incomplete judging handling
- Outlier detection (30% deviation from **median**)
- Blind judging (judges can't see other judges' scores)
- Score locking after window close

## Implementation Plan

### 1. Scoring Time Windows — GAP-004

**Schema**: `hackathon_rounds` already has `scoring_opens_at` and `scoring_closes_at` columns (added in migration 0002).

**Note**: These columns exist in D1 but NOT in the Drizzle schema `.ts` files. Update `packages/db/src/schema/hackathon-rounds.ts` for documentation accuracy.

**What to build**:
1. In `POST /api/v1/hackathons/:slug/judging/scores`: check current time against round's scoring window
2. Return `403 SCORING_WINDOW_CLOSED` if outside window
3. Block score UPDATES (PATCH) after window closes too — not just creates
4. In judge portal: show countdown timer, disable scoring UI outside window

```typescript
// In judging.ts score submission handler
// Note: ISO-8601 string comparison works because the format is lexicographically sortable
const round = await env.DB.prepare(
  'SELECT scoring_opens_at, scoring_closes_at FROM hackathon_rounds WHERE id = ?'
).bind(roundId).first();

const now = new Date().toISOString();
if (round.scoring_opens_at && now < round.scoring_opens_at) {
  return errorResponse(c, 'SCORING_NOT_OPEN', 'Scoring has not started yet', 403);
}
if (round.scoring_closes_at && now > round.scoring_closes_at) {
  return errorResponse(c, 'SCORING_WINDOW_CLOSED', 'Scoring window has ended', 403);
}
```

### 2. Scoring Window Extension

**From `role-event-lead.md`**: Event Lead can extend the scoring window after it has opened.

**Endpoint**: `PATCH /api/v1/hackathons/:slug/rounds/:roundId/scoring-window`
- Body: `{ scoring_closes_at: string }` (new close time, must be in the future)
- Requires: organizer role
- Validation: new close time > current time, new close time > current close time
- Audit log the change
- Queue notification to judges with pending assignments: "Scoring window extended"

### 3. Conflict of Interest Declarations

**From `role-judge.md`**: Judges must declare conflicts before scoring.

**Schema additions** (new migration 0004):
```sql
CREATE TABLE judge_conflicts (
  id TEXT PRIMARY KEY,
  judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  declared_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(judge_id, team_id)
);
CREATE INDEX idx_judge_conflicts_judge ON judge_conflicts(judge_id);
CREATE INDEX idx_judge_conflicts_team ON judge_conflicts(team_id);
```

**Note on FK**: The `judge_id` references `judges(id)` which is the per-hackathon judge record (not `users.id`). This is correct because conflicts are hackathon-scoped. Queries that need the user identity should JOIN through `judges.user_id`.

**Endpoints**:
- `POST /api/v1/hackathons/:slug/judging/conflicts` — declare conflict (judge role)
- `GET /api/v1/hackathons/:slug/judging/conflicts` — list judge's conflicts (judge role)
- `GET /api/v1/hackathons/:slug/judging/conflicts/all` — list all conflicts (organizer role)

**Enforcement**: In the score submission handler, check conflicts BEFORE accepting scores:
```typescript
const conflict = await env.DB.prepare(
  'SELECT id FROM judge_conflicts WHERE judge_id = ? AND team_id = ?'
).bind(judgeId, teamId).first();
if (conflict) {
  return errorResponse(c, 'CONFLICT_OF_INTEREST', 'You have declared a conflict with this team', 403);
}
```

Also auto-exclude conflicted teams from auto-assignment in `assignSubmissionsRoundRobin()`.

### 4. Blind Judging Enforcement

**From `role-judge.md`**: Judges cannot see other judges' individual scores.

**What to enforce**:
1. `GET /api/v1/hackathons/:slug/judging/leaderboard` — for judges, return only aggregate scores (no per-judge breakdown). Organizers see full breakdown.
2. Score submission responses should not include other judges' scores
3. Assignment detail should not leak other judges' score data

```typescript
// In leaderboard endpoint
const isOrganizer = hackathonRoles.includes('organizer') || hackathonRoles.includes('co_organizer');
if (!isOrganizer) {
  // Strip individual judge scores, return only aggregates
  leaderboard = leaderboard.map(entry => ({
    ...entry,
    judgeScores: undefined, // Remove per-judge breakdown
  }));
}
```

### 5. Per-Round Rubrics

**From `role-event-lead.md`**: "Rubric can differ between rounds."

**Current**: `rubric_criteria` has a `round` column (default 1) — the schema already supports per-round rubrics.

**What's missing**: The rubric CRUD endpoints don't filter by round.

**Fix**:
1. `POST /api/v1/hackathons/:slug/judging/rubric` — add optional `round` param (default 1)
2. `GET /api/v1/hackathons/:slug/judging/rubric?round=2` — filter by round
3. On round initialization: if no rubric exists for that round, copy from previous round
4. Score submission: validate criteria against the round-specific rubric

### 6. Multi-Round Judging Workflow

**From `role-event-lead.md`**: Hackathons can have multiple rounds. Each round has its own rubric, time window, and judge assignments.

**Flow**:
```
Round 1: All teams scored → Event Lead reviews → Eliminates bottom teams
Round 2: Remaining teams scored (possibly different rubric/judges) → Repeat
Final Round: Winners determined
```

**What to build**:
1. `POST /api/v1/hackathons/:slug/rounds/:roundId/initialize`:
   - Copy eligible teams from previous round's `round_results` (status != 'eliminated')
   - Create judge assignments for this round
   - Set `is_initialized = true`
2. `POST /api/v1/hackathons/:slug/rounds/:roundId/advance-teams` (already exists, extend):
   - Mark eliminated teams in `round_results` with `status = 'eliminated'`
   - Notify eliminated teams (email + in_app) — requires notification system (see `06-notifications.md`)
   - Queue notifications for advancing teams
3. `POST /api/v1/hackathons/:slug/rounds/:roundId/eliminate`:
   - Body: `{ teamIds: string[], reason?: string }`
   - Sets `round_results.status = 'eliminated'` for specified teams
   - Audit log with reason

### 7. Incomplete Judging Handling

**From `role-event-lead.md`**: When not all judges have scored, event leads need options.

**Endpoints** (add to `routes/judging.ts`):
- `GET /api/v1/hackathons/:slug/judging/progress` — scoring completion stats per judge
  - Returns: `{ judgeId, email, name, assigned, completed, pending }`
- `POST /api/v1/hackathons/:slug/judging/assignments/:assignmentId/reassign` — reassign to different judge
  - Body: `{ newJudgeId: string }`
- `POST /api/v1/hackathons/:slug/rounds/:roundId/finalize` — accept partial scores and compute leaderboard

**Judge reminder**: `POST /api/v1/hackathons/:slug/judging/remind` — organizer triggers email reminder to judges with pending assignments.

**Progress query**:
```sql
SELECT
  j.id as judge_id, j.email,
  COUNT(ja.id) as assigned,
  COUNT(CASE WHEN ja.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN ja.status != 'completed' THEN 1 END) as pending
FROM judges j
JOIN judge_assignments ja ON ja.judge_id = j.id
WHERE ja.hackathon_id = ? AND ja.round = ?
GROUP BY j.id
```

### 8. Outlier Detection

**From `role-event-lead.md`**: Flag scores that deviate >30% from the **median** per submission.

**Implementation** (in `judging-service.ts`):
```typescript
function detectOutliers(scores: { judgeId: string; total: number }[]): string[] {
  if (scores.length < 3) return []; // Need at least 3 scores for meaningful outlier detection

  // Calculate median
  const sorted = [...scores].sort((a, b) => a.total - b.total);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1].total + sorted[mid].total) / 2
    : sorted[mid].total;

  const threshold = median * 0.3;
  return scores
    .filter(s => Math.abs(s.total - median) > threshold)
    .map(s => s.judgeId);
}
```

Surface outliers in:
- `GET /api/v1/hackathons/:slug/judging/leaderboard` — add `outlier_judges` array to each entry (organizer view only)
- Platform UI: highlight outlier scores for event lead review

### 9. Judge Guidelines — GAP-005

**Schema**: `hackathons.judge_guidelines` column already exists (added in migration 0002).

**What's missing**: No enforcement that judges have read guidelines before scoring.

**Schema change** (migration 0004):
```sql
ALTER TABLE judges ADD COLUMN guidelines_acknowledged_at TEXT;
```

**Endpoints**:
1. `POST /api/v1/hackathons/:slug/judging/acknowledge-guidelines` — judge acknowledges reading
2. Score submission handler: check `guidelines_acknowledged_at IS NOT NULL` before accepting scores
3. Judge portal: show guidelines modal on first visit, block scoring until acknowledged

### 10. Conflicting Role Prevention

**From `role-event-lead.md`**: "A user cannot hold conflicting roles on the same hackathon."

**Enforcement**: When adding a user to a hackathon in any role, check they don't already hold a conflicting one:
- A judge cannot also be an organizer on the same hackathon
- A participant (team member) cannot also be a judge on the same hackathon

Add validation in:
- `POST /api/v1/hackathons/:slug/organizers` — check not a judge/participant
- Judge invite acceptance — check not an organizer/participant
- Team join — check not a judge/organizer

## Schema Changes Summary (migration 0004)

```sql
-- Judge conflicts
CREATE TABLE judge_conflicts ( ... );  -- see section 3

-- Guidelines acknowledgment
ALTER TABLE judges ADD COLUMN guidelines_acknowledged_at TEXT;

-- Disqualification reason
ALTER TABLE teams ADD COLUMN disqualification_reason TEXT;
```

## Tests to Add

- [ ] Score rejected outside time window
- [ ] Score accepted inside time window
- [ ] Score update blocked after window close
- [ ] Scoring window extension works
- [ ] Conflict declaration prevents scoring
- [ ] Conflict auto-excludes from assignment
- [ ] Blind judging: judge can't see other judges' scores
- [ ] Per-round rubric CRUD
- [ ] Multi-round initialization copies eligible teams
- [ ] Eliminated teams notified
- [ ] Outlier detection uses median, not mean
- [ ] Guidelines acknowledgment blocks scoring
- [ ] Incomplete judging progress endpoint
- [ ] Judge reminder endpoint sends notifications
- [ ] Conflicting role prevention
