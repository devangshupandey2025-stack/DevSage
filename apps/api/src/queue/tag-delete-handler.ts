import { insertAuditEvent } from '../lib/audit.js';

interface TagDeleteEnv {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue;
}

export async function handleTagDeleteEvent(
  payload: Record<string, unknown>,
  env: TagDeleteEnv
): Promise<void> {
  const data = payload as {
    tag_name: string;
    repository: { owner: string; name: string };
    sender: { login: string };
  };

  // Find submission by tag name + repo
  const result = await env.DB.prepare(`
    SELECT s.id, s.hackathon_id, s.team_id
    FROM submissions s
    JOIN teams t ON s.team_id = t.id
    JOIN team_repos tr ON tr.team_id = t.id
    WHERE s.tag_name = ?
      AND tr.github_owner = ?
      AND tr.github_repo = ?
      AND s.status != 'tag_deleted'
  `).bind(data.tag_name, data.repository.owner, data.repository.name)
    .first<{ id: string; hackathon_id: string; team_id: string }>();

  if (!result) return;

  // Mark as tag_deleted
  await env.DB.prepare(
    'UPDATE submissions SET status = ?, is_final = 0 WHERE id = ?'
  ).bind('tag_deleted', result.id).run();

  // Audit
  await insertAuditEvent(env.DB, {
    hackathon_id: result.hackathon_id,
    actor_type: 'bot',
    action: 'submission.tag_deleted',
    entity_type: 'submission',
    entity_id: result.id,
    details: { tag_name: data.tag_name, sender: data.sender.login },
  });

  // Notify organizers
  await env.NOTIFICATION_QUEUE.send({
    type: 'submission.tag_deleted',
    hackathon_id: result.hackathon_id,
    data: { team_id: result.team_id, submission_id: result.id, tag_name: data.tag_name },
  });
}
