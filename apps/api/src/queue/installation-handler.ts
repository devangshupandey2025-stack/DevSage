import { insertAuditEvent } from '../lib/audit.js';

interface InstallationEnv {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue;
}

export async function handleInstallationEvent(
  type: string,
  payload: Record<string, unknown>,
  env: InstallationEnv
): Promise<void> {
  const data = payload as {
    installation_id: number;
    sender: { login: string };
    repositories: Array<{ full_name: string; name: string }>;
  };

  if (type === 'github_installation' || type === 'github_installation_repos_added') {
    // Match repos to pending installations and activate
    for (const repo of data.repositories) {
      const [owner, name] = repo.full_name.split('/');

      // Check pending installations
      const pending = await env.DB.prepare(
        'SELECT id, team_id FROM pending_installations WHERE github_owner = ? AND github_repo = ?'
      ).bind(owner, name).first<{ id: string; team_id: string }>();

      if (!pending) continue;

      // Update team_repos with installation ID and activate bot
      await env.DB.prepare(
        'UPDATE team_repos SET github_installation_id = ?, bot_active = 1 WHERE team_id = ?'
      ).bind(data.installation_id, pending.team_id).run();

      // Remove pending installation
      await env.DB.prepare(
        'DELETE FROM pending_installations WHERE id = ?'
      ).bind(pending.id).run();

      // Get hackathon for audit
      const team = await env.DB.prepare(
        'SELECT hackathon_id FROM teams WHERE id = ?'
      ).bind(pending.team_id).first<{ hackathon_id: string }>();

      if (team) {
        await insertAuditEvent(env.DB, {
          hackathon_id: team.hackathon_id,
          actor_type: 'bot',
          event_type: 'team.bot_activated',
          entity_type: 'team_repo',
          entity_id: pending.team_id,
          metadata: { installation_id: data.installation_id, repo: repo.full_name },
        });
      }
    }
  } else if (type === 'github_installation_repos_removed') {
    // Deactivate bot for removed repos
    for (const repo of data.repositories) {
      const [owner, name] = repo.full_name.split('/');
      await env.DB.prepare(
        'UPDATE team_repos SET bot_active = 0, github_installation_id = NULL WHERE github_owner = ? AND github_repo = ?'
      ).bind(owner, name).run();
    }
  }
}
