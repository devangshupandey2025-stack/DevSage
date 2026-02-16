# Phase Transitions

> Rules, preconditions, and side effects for each state transition.

## Transition Flow

```ts
// Route handler:
app.post('/hackathons/:slug/transition', authMiddleware, requireRole('organizer'), async (c) => {
  const { target_status, version } = await c.req.json();

  // 1. Get DO stub
  const stub = getDOStub(c.env.HACKATHON_SM, hackathonId);

  // 2. Request transition (DO validates)
  const result = await stub.fetch('/transition', {
    method: 'POST',
    body: JSON.stringify({ target_status, version, submission_deadline, judging_deadline }),
  });

  // 3. Update D1 (source of truth for reads)
  await db.update(hackathons)
    .set({ status: target_status, updated_at: now })
    .where(eq(hackathons.id, hackathonId));

  // 4. Side effects
  await executeTransitionSideEffects(c, hackathonId, currentStatus, target_status);

  // 5. Audit
  await insertAuditEvent(db, { ... });
});
```

## Preconditions

### draft → active

```ts
// Required:
// - submission_deadline is set and in the future
// - At least one team exists (warning, not blocking)
if (!state.submission_deadline) {
  return error(400, 'DEADLINE_REQUIRED', 'Set submission deadline before activating');
}
if (new Date(state.submission_deadline) <= new Date()) {
  return error(400, 'DEADLINE_IN_PAST', 'Submission deadline must be in the future');
}
```

### active → judging

```ts
// Either:
// - Submission deadline has passed (auto-triggered by alarm)
// - Organizer manually triggers (any time)
// On transition:
// - All pending submissions are finalized
// - No new submissions accepted
```

### judging → completed

```ts
// Required:
// - At least one score exists
const scoreCount = await db.select({ count: count() })
  .from(scores)
  .where(eq(scores.hackathon_id, hackathonId))
  .get();

if (scoreCount.count === 0) {
  return error(400, 'NO_SCORES', 'At least one score must be submitted');
}
```

### completed → archived

No preconditions.

### archived → completed

No preconditions. Allows un-archiving for score corrections.

## Side Effects

### draft → active

1. **Set alarm** on DO for `submission_deadline`
2. **Enqueue notification**: `hackathon.activated` → all team members
3. **Broadcast**: SSE event to platform dashboard

### active → judging

1. **Lock submissions**: All active submissions marked as `final`
2. **Cancel alarm**: Clear deadline alarm
3. **Set judging alarm** (if `judging_deadline` configured)
4. **Enqueue notification**: `hackathon.judging_started` → judges + team leads
5. **Post commit status**: "Submissions locked" on all linked repos

### judging → completed

1. **Compute leaderboard**: Aggregate scores → `round_results` table
2. **Enqueue notification**: `hackathon.completed` → all participants
3. **Post commit status**: Final scores on submission tags

### completed → archived

No side effects.

### archived → completed

No side effects (just re-enables score editing).

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `INVALID_TRANSITION` | 400 | Transition not in allowed set |
| `STATE_VERSION_CONFLICT` | 409 | Optimistic lock failure |
| `DEADLINE_REQUIRED` | 400 | draft→active without deadline |
| `DEADLINE_IN_PAST` | 400 | Deadline is not in the future |
| `NO_SCORES` | 400 | judging→completed without any scores |
