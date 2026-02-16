import { matchesTagPattern } from '../lib/submission-tag.js';
import { getTagSha, postCommitStatus } from '../services/github.js';
import { insertAuditEvent } from '../lib/audit.js';

interface TagCreateEnv {
  DB: D1Database;
  KV: KVNamespace;
  HACKATHON_SM: DurableObjectNamespace;
  NOTIFICATION_QUEUE: Queue;
}

export async function handleTagCreateEvent(
  payload: Record<string, unknown>,
  queueMsg: Record<string, unknown>,
  env: TagCreateEnv
): Promise<void> {
  const data = payload as {
    tag_name: string;
    sha: string;
    repository: { owner: string; name: string; full_name: string };
    sender: { login: string };
  };

  const { tag_name, repository, sender } = data;

  // Find team repo
  const teamRepo = await env.DB.prepare(
    'SELECT tr.id, tr.team_id, tr.github_installation_id FROM team_repos tr WHERE tr.github_owner = ? AND tr.github_repo = ?'
  ).bind(repository.owner, repository.name).first<{
    id: string; team_id: string; github_installation_id: number | null;
  }>();

  if (!teamRepo) return;

  // Get team and hackathon info
  const team = await env.DB.prepare(
    'SELECT t.id, t.hackathon_id, h.status, h.settings FROM teams t JOIN hackathons h ON t.hackathon_id = h.id WHERE t.id = ?'
  ).bind(teamRepo.team_id).first<{
    id: string; hackathon_id: string; status: string; settings: string | null;
  }>();

  if (!team || team.status !== 'active') return;

  // Check tag pattern
  const settings = team.settings ? JSON.parse(team.settings) : {};
  const tagPattern = settings.tag_pattern as string | undefined;
  if (!matchesTagPattern(tag_name, tagPattern)) return;

  // Get tag SHA (may not be in payload for create events)
  let sha = data.sha;
  if (!sha && teamRepo.github_installation_id) {
    const token = await env.KV.get(`gh:install:${teamRepo.github_installation_id}`);
    if (token) {
      const resolved = await getTagSha(repository.owner, repository.name, tag_name, token);
      if (resolved) sha = resolved;
    }
  }
  if (!sha) sha = 'unknown';

  // Lock submission in DO (exactly-once)
  const submissionId = crypto.randomUUID();
  const submissionKey = `${team.id}:${tag_name}`;

  const doId = env.HACKATHON_SM.idFromName(team.hackathon_id);
  const stub = env.HACKATHON_SM.get(doId);
  const doRes = await stub.fetch(new Request('http://do/accept-submission', {
    method: 'POST',
    body: JSON.stringify({ submission_key: submissionKey, submission_id: submissionId, team_id: team.id }),
  }));

  const doResult = await doRes.json() as { ok: boolean; data: { accepted: boolean; reason?: string } };
  if (!doResult.ok || !doResult.data.accepted) return;

  // Mark previous submissions as not current (resubmission)
  await env.DB.prepare(
    'UPDATE submissions SET is_current = 0 WHERE team_id = ? AND hackathon_id = ? AND is_current = 1'
  ).bind(team.id, team.hackathon_id).run();

  // Insert submission into D1
  const deliveryId = queueMsg.delivery_id as string | undefined;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO submissions (id, hackathon_id, team_id, tag_name, commit_sha, submitted_at, delivery_id, is_current)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  ).bind(submissionId, team.hackathon_id, team.id, tag_name, sha, now, deliveryId ?? null).run();

  // Audit
  await insertAuditEvent(env.DB, {
    hackathon_id: team.hackathon_id,
    actor_type: 'bot',
    event_type: 'submission.created',
    entity_type: 'submission',
    entity_id: submissionId,
    metadata: { tag_name, commit_sha: sha, sender: sender.login },
  });

  // Notify
  await env.NOTIFICATION_QUEUE.send({
    type: 'submission.received',
    hackathon_id: team.hackathon_id,
    data: { team_id: team.id, submission_id: submissionId, tag_name },
  });
}
