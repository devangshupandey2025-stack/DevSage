# GitHub Repo Linking

> Team leads link their GitHub repository and activate the DevSage bot for webhook tracking.

## Flow

```
1. Team lead links repo URL
2. System validates repo exists and user has admin access
3. GitHub App installation checked (or initiated)
4. Webhook events start flowing
5. Team status updated to reflect repo linked
```

## Link Endpoint

### `POST /api/v1/hackathons/:slug/teams/:teamId/repos`

```
Auth: authMiddleware + requireRole('team_lead')
State: draft or active
```

```ts
const linkRepoSchema = z.object({
  github_repo_url: z.string().url().regex(/github\.com\/[\w-]+\/[\w.-]+/),
});
```

**Implementation:**
1. Parse owner/repo from URL
2. Verify repo exists via GitHub API (`GET /repos/{owner}/{repo}`)
3. Check user has admin access to the repo
4. Check repo not already linked to another team in this hackathon
5. Insert `team_repos` row
6. Check if GitHub App is installed on the repo
   - If installed: activate (set `bot_active = true`)
   - If not: store as `pending_installation`, prompt user to install

```sql
CREATE TABLE team_repos (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  github_repo_url TEXT NOT NULL,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  github_installation_id INTEGER,
  bot_active BOOLEAN NOT NULL DEFAULT FALSE,
  linked_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id)  -- one repo per team
);
```

## Bot Activation

When the GitHub App is installed on a repo:

1. GitHub sends `installation` webhook → queued to `WEBHOOK_QUEUE`
2. `installation-handler` processes: matches repo to `pending_installations`
3. Updates `team_repos.github_installation_id` and `bot_active = true`
4. From this point, push and tag events on the repo are tracked

```sql
CREATE TABLE pending_installations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Unlink Endpoint

### `DELETE /api/v1/hackathons/:slug/teams/:teamId/repos/:repoId`

```
Auth: team_lead or co_organizer+
State: draft or active
```

Removes the repo link. Does NOT uninstall the GitHub App.

## Validation Rules

- One repo per team (enforced by unique constraint)
- Same repo cannot be linked to multiple teams in the same hackathon
- Repo must be accessible (public or private with App installed)
- Only team lead or organizer can link/unlink

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `REPO_NOT_FOUND` | 404 | GitHub repo doesn't exist or no access |
| `REPO_ALREADY_LINKED` | 409 | Repo already linked to another team |
| `TEAM_ALREADY_HAS_REPO` | 409 | Team already has a linked repo |
| `APP_NOT_INSTALLED` | 400 | GitHub App not installed (returns install URL) |
| `INSUFFICIENT_REPO_ACCESS` | 403 | User doesn't have admin access to repo |
