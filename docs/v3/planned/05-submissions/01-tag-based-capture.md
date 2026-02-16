# Tag-Based Capture

> `apps/api/src/queue/tag-create-handler.ts` — Webhook-triggered pipeline from git tag to submission.

## Pipeline

```
GitHub tag_created webhook
  ↓
tag-create-handler (queue consumer)
  ↓
1. Find team_repo matching the repository
2. Extract tag name, commit SHA, timestamp
3. Match tag against pattern (e.g., submission-v*)
4. Determine round (if rounds configured)
5. Lock submission in DO (POST /accept-submission)
6. If accepted:
   a. Insert submission row in D1
   b. Insert commit_log entry
   c. Run validation pipeline
   d. Post commit status on GitHub
   e. Enqueue notification
7. If rejected:
   a. Post failure commit status
   b. Log reason
```

## Tag Pattern Matching

Default pattern: `submission-v*` (configurable per hackathon in settings).

```ts
// apps/api/src/lib/submission-tag.ts
function matchesTagPattern(tagName: string, pattern: string): boolean {
  // Convert glob to regex: 'submission-v*' → /^submission-v.*$/
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(tagName);
}
```

**Examples:**
- `submission-v1` ✅ matches `submission-v*`
- `submission-v2.1` ✅ matches `submission-v*`
- `release-v1` ❌ does not match `submission-v*`
- `submission-final` ✅ matches `submission-*`

## Webhook Payload (Normalized)

The `tag-create-handler` receives a normalized event:

```ts
interface TagCreatedEvent {
  type: 'tag_created';
  delivery_id: string;         // GitHub webhook delivery ID (idempotency)
  installation_id: number;
  repository: {
    owner: string;
    name: string;
    full_name: string;
  };
  tag: {
    name: string;              // e.g., 'submission-v1'
    sha: string;               // commit SHA the tag points to
  };
  sender: {
    login: string;
    id: number;
  };
  timestamp: string;           // ISO-8601
}
```

## Matching Tag to Team

```ts
// 1. Find team_repo by github_owner + github_repo
const teamRepo = await db.select()
  .from(teamRepos)
  .where(and(
    eq(teamRepos.github_owner, event.repository.owner),
    eq(teamRepos.github_repo, event.repository.name),
    eq(teamRepos.bot_active, true)
  ))
  .get();

if (!teamRepo) return; // repo not linked to any team

// 2. Get hackathon to check tag pattern
const team = await db.select().from(teams).where(eq(teams.id, teamRepo.team_id)).get();
const hackathon = await db.select().from(hackathons).where(eq(hackathons.id, team.hackathon_id)).get();

// 3. Check pattern
const pattern = hackathon.settings?.tag_pattern ?? 'submission-v*';
if (!matchesTagPattern(event.tag.name, pattern)) return; // not a submission tag
```

## Submission Row

```ts
await db.insert(submissions).values({
  id: crypto.randomUUID(),
  hackathon_id: hackathon.id,
  team_id: team.id,
  round_id: resolvedRoundId,    // null if single-round
  tag_name: event.tag.name,
  commit_sha: event.tag.sha,
  submitted_at: event.timestamp,
  status: 'pending_validation',  // → validated | failed_validation
  delivery_id: event.delivery_id,
  created_at: new Date().toISOString(),
});
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `TAG_NOT_MATCHED` | — | Tag doesn't match pattern (silent skip) |
| `REPO_NOT_LINKED` | — | Repo not associated with any team (silent skip) |
| `SUBMISSION_REJECTED` | — | DO rejected (deadline passed, limit exceeded) |
