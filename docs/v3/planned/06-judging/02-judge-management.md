# Judge Management

> Inviting judges, accepting invitations, and assigning submissions to judges.

## Inviting Judges

### `POST /api/v1/hackathons/:slug/judges`

```
Auth: organizer or co_organizer
```

```ts
const inviteJudgeSchema = z.object({
  email: z.string().email(),
  track_ids: z.array(z.string().uuid()).optional(), // specific tracks (optional)
});
```

**Implementation:**
1. Check if email already invited for this hackathon
2. Create `judges` row with `invite_status: 'pending'`
3. Generate invite token
4. Send invitation email via `NOTIFICATION_QUEUE`

### `POST /api/v1/hackathons/:slug/judges/bulk`

Bulk invite via array of emails:

```ts
const bulkInviteSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
});
```

## Accepting Invitation

### `POST /api/v1/invites/judge/:token/accept`

```
Auth: authMiddleware (must be logged in)
```

1. Find judge row by `invite_token`
2. Link `user_id` to the judge row
3. Set `invite_status: 'accepted'`, `accepted_at: now`
4. If `track_ids` specified, create `judge_tracks` rows

## Judge Assignment

When hackathon transitions to `judging`, submissions are assigned to judges:

### Round-Robin Algorithm

```ts
async function assignSubmissions(hackathonId: string, roundId: string | null) {
  const judges = await db.select().from(judgesTable)
    .where(and(
      eq(judgesTable.hackathon_id, hackathonId),
      eq(judgesTable.invite_status, 'accepted')
    )).all();

  const submissions = await db.select().from(submissionsTable)
    .where(and(
      eq(submissionsTable.hackathon_id, hackathonId),
      roundId ? eq(submissionsTable.round_id, roundId) : isNull(submissionsTable.round_id),
      eq(submissionsTable.is_current, true)
    )).all();

  // Round-robin: each judge gets roughly equal submissions
  let judgeIndex = 0;
  for (const submission of submissions) {
    // Filter judges by track (if track-specific)
    const eligibleJudges = filterByTrack(judges, submission.team.track_id);

    await db.insert(judgeAssignments).values({
      id: crypto.randomUUID(),
      judge_id: eligibleJudges[judgeIndex % eligibleJudges.length].id,
      submission_id: submission.id,
      hackathon_id: hackathonId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    judgeIndex++;
  }
}
```

### `judge_assignments` Table

```sql
CREATE TABLE judge_assignments (
  id TEXT PRIMARY KEY,
  judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scored', 'skipped')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(judge_id, submission_id)
);
```

### `judge_tracks` Table

```sql
CREATE TABLE judge_tracks (
  id TEXT PRIMARY KEY,
  judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES hackathon_tracks(id) ON DELETE CASCADE,
  UNIQUE(judge_id, track_id)
);
```

## Endpoints

```
GET    /api/v1/hackathons/:slug/judges               # List judges (organizer+)
POST   /api/v1/hackathons/:slug/judges               # Invite judge
DELETE /api/v1/hackathons/:slug/judges/:judgeId       # Remove judge
GET    /api/v1/hackathons/:slug/judges/me/assignments # My assignments (judge)
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `JUDGE_ALREADY_INVITED` | 409 | Email already invited |
| `INVITE_NOT_FOUND` | 404 | Invalid invite token |
| `NO_JUDGES_AVAILABLE` | 400 | No accepted judges when assigning |
