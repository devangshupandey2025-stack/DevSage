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

**Implementation:**

```ts
// Bulk invite — chunked to respect D1's 100-parameter limit
const CHUNK_SIZE = 12; // 12 judges × ~8 cols = 96 params < 100 limit
const judgeRows = emails.map(email => ({
  id: crypto.randomUUID(),
  hackathonId,
  email,
  inviteToken: crypto.randomUUID(),
  inviteStatus: 'pending',
  createdAt: new Date().toISOString(),
}));

const chunks = [];
for (let i = 0; i < judgeRows.length; i += CHUNK_SIZE) {
  chunks.push(db.insert(judges).values(judgeRows.slice(i, i + CHUNK_SIZE)));
}
await db.batch(chunks);
```

> **D1 Parameter Limit:** D1 limits queries to 100 bound parameters. With ~8 columns per judge, chunk inserts to ≤12 rows per statement.

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
  const assignments = submissions.map(submission => {
    const eligibleJudges = filterByTrack(judges, submission.team.track_id);
    const assignment = {
      id: crypto.randomUUID(),
      judgeId: eligibleJudges[judgeIndex % eligibleJudges.length].id,
      submissionId: submission.id,
      hackathonId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    judgeIndex++;
    return assignment;
  });

  const CHUNK_SIZE = 16; // ~6 cols × 16 = 96 < 100
  const chunks = [];
  for (let i = 0; i < assignments.length; i += CHUNK_SIZE) {
    chunks.push(db.insert(judgeAssignments).values(assignments.slice(i, i + CHUNK_SIZE)));
  }
  await db.batch(chunks);
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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
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
