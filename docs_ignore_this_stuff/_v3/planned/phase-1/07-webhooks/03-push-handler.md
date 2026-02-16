# Push Handler

> `apps/api/src/queue/push-handler.ts` — Log commits and track team activity.

## What It Does

When a team pushes code to their linked repo, this handler:
1. Matches the repo to a team
2. Logs commits to `commit_log` table
3. Detects force pushes and flags them
4. Updates team activity metrics

## Implementation

```ts
async function handlePush(event: PushEvent, env: Env) {
  // 1. Find team_repo
  const teamRepo = await env.DB.prepare(`
    SELECT tr.*, t.hackathon_id FROM team_repos tr
    JOIN teams t ON tr.team_id = t.id
    WHERE tr.github_owner = ? AND tr.github_repo = ? AND tr.bot_active = TRUE
  `).bind(event.repository.owner, event.repository.name).first();

  if (!teamRepo) return; // repo not linked

  // 2. Check hackathon is active
  const hackathon = await env.DB.prepare(`
    SELECT status FROM hackathons WHERE id = ?
  `).bind(teamRepo.hackathon_id).first();

  if (hackathon?.status !== 'active') return; // only track during active phase

  // 3. Log commits
  for (const commit of event.commits) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO commit_log (id, team_repo_id, commit_sha, commit_message, author_login, author_email, committed_at, pushed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).bind(
      crypto.randomUUID(),
      teamRepo.id,
      commit.sha,
      commit.message.substring(0, 500),
      commit.author.username,
      commit.author.email,
      commit.timestamp,
      event.timestamp,
    ).run();
  }

  // 4. Force push detection
  if (event.forced) {
    await env.DB.prepare(`
      INSERT INTO force_push_events (id, team_repo_id, before_sha, after_sha, ref, pusher_login, detected_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).bind(
      crypto.randomUUID(),
      teamRepo.id,
      event.before,
      event.after,
      event.ref,
      event.sender.login,
    ).run();

    // Notify organizers
    await env.NOTIFICATION_QUEUE.send({
      type: 'force_push_detected',
      hackathon_id: teamRepo.hackathon_id,
      team_id: teamRepo.team_id,
      detail: { ref: event.ref, before: event.before, after: event.after },
    });
  }
}
```

## Force Push Events Table

```sql
CREATE TABLE force_push_events (
  id TEXT PRIMARY KEY,
  team_repo_id TEXT NOT NULL REFERENCES team_repos(id) ON DELETE CASCADE,
  before_sha TEXT NOT NULL,
  after_sha TEXT NOT NULL,
  ref TEXT NOT NULL,
  pusher_login TEXT,
  detected_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

## Implementation Notes

- `INSERT OR IGNORE` on commit_log prevents duplicates if webhook is retried
- Only tracks pushes during `active` phase (no logging during draft)
- Commit messages truncated to 500 chars
- Force push notifications go to organizers only (not participants)
