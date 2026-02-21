import type { PushEvent } from '../lib/webhook-normalize.js';
import { insertAuditEvent } from '../lib/audit.js';

interface PushEnv {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue;
}

export async function handlePushEvent(
  payload: Record<string, unknown>,
  env: PushEnv
): Promise<void> {
  const data = payload as unknown as PushEvent;
  const { repository, commits, forced, before, after, ref, pusher } = data;

  // Find team repo
  const teamRepo = await env.DB.prepare(
    'SELECT id, team_id FROM team_repos WHERE github_owner = ? AND github_repo = ?'
  ).bind(repository.owner, repository.name).first<{ id: string; team_id: string }>();

  if (!teamRepo) return; // Not a tracked repo

  // Log commits (chunk to stay under D1 100 param limit)
  if (commits && commits.length > 0) {
    const CHUNK_SIZE = 10; // 10 columns per row × 10 rows = 100 params
    for (let i = 0; i < commits.length; i += CHUNK_SIZE) {
      const chunk = commits.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = chunk.flatMap(c => [
        crypto.randomUUID(),
        teamRepo.id,
        c.sha,
        c.message.slice(0, 500),
        c.author.username ?? null,
        c.author.email,
        c.timestamp,
        new Date().toISOString(),
      ]);

      await env.DB.prepare(
        `INSERT INTO commit_log (id, team_repo_id, commit_sha, message, author_login, author_email, committed_at, pushed_at) VALUES ${placeholders}`
      ).bind(...values).run();
    }
  }

  // Detect force push
  if (forced) {
    const fpId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO force_push_events (id, team_repo_id, before_sha, after_sha, ref, pusher_login, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(fpId, teamRepo.id, before, after, ref, pusher.login, new Date().toISOString()).run();

    // Get hackathon_id for notifications
    const team = await env.DB.prepare(
      'SELECT hackathon_id FROM teams WHERE id = ?'
    ).bind(teamRepo.team_id).first<{ hackathon_id: string }>();

    if (team) {
      await env.NOTIFICATION_QUEUE.send({
        type: 'force_push_detected',
        hackathon_id: team.hackathon_id,
        data: {
          team_id: teamRepo.team_id,
          ref,
          pusher_login: pusher.login,
          before_sha: before,
          after_sha: after,
        },
      });

      await insertAuditEvent(env.DB, {
        hackathon_id: team.hackathon_id,
        actor_type: 'bot',
        action: 'webhook.force_push',
        entity_type: 'team_repo',
        entity_id: teamRepo.id,
        details: { ref, pusher: pusher.login, before, after },
      });
    }
  }
}
