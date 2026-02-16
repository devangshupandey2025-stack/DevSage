# Installation Handler

> `apps/api/src/queue/installation-handler.ts` — GitHub App install/uninstall events.

## App Installed

When a user installs the DevSage GitHub App on their repo:

```ts
async function handleInstallation(event: InstallationEvent, env: Env) {
  if (event.action === 'created') {
    // Match repos to pending installations
    for (const repo of event.repositories) {
      const [owner, name] = repo.full_name.split('/');

      const pending = await env.DB.prepare(`
        SELECT id, team_id FROM pending_installations
        WHERE github_owner = ? AND github_repo = ?
      `).bind(owner, name).first();

      if (pending) {
        // Activate bot on team_repo
        await env.DB.prepare(`
          UPDATE team_repos
          SET github_installation_id = ?, bot_active = TRUE
          WHERE team_id = ? AND github_owner = ? AND github_repo = ?
        `).bind(event.installation_id, pending.team_id, owner, name).run();

        // Clean up pending
        await env.DB.prepare(`DELETE FROM pending_installations WHERE id = ?`)
          .bind(pending.id).run();

        // Notify team lead
        await env.NOTIFICATION_QUEUE.send({
          type: 'bot.activated',
          team_id: pending.team_id,
        });
      }
    }
  }

  if (event.action === 'deleted') {
    // App uninstalled — deactivate all team_repos with this installation
    await env.DB.prepare(`
      UPDATE team_repos
      SET bot_active = FALSE, github_installation_id = NULL
      WHERE github_installation_id = ?
    `).bind(event.installation_id).run();
  }
}
```

## Pending Installations Table

```sql
CREATE TABLE pending_installations (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Created when a team links a repo but the GitHub App isn't installed yet.

## Flow

```
Team links repo → App installed? 
  → Yes: bot_active = true immediately
  → No: Create pending_installation → User prompted to install App
        → Installation webhook fires → Match to pending → Activate
```

## Implementation Notes

- Installation events may include multiple repositories — iterate over all
- If no pending_installation matches, the installation is for a repo not linked to any team (ignore)
- Uninstalling the App deactivates all team_repos using that installation — no more webhooks
- Installation ID is stored on `team_repos` for making authenticated GitHub API calls
