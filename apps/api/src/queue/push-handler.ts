import { createDbClient, commitLog, forcePushEvents, submissions } from '@devsage/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { NormalizedPushEvent } from '../lib/webhook-normalize.js';
import { insertAuditEvent } from '../lib/audit.js';
import type { Env } from '../types/env.js';
import { MAX_COMMITS_PER_PUSH } from '../lib/constants.js';
import type { TeamRepoRow } from '../types/db-rows.js';

export async function handlePush(event: NormalizedPushEvent, env: Env): Promise<void> {
  const teamRepo = await env.DB.prepare(
    'SELECT id, team_id, hackathon_id, repo_full_name FROM team_repos WHERE repo_full_name = ? AND bot_active = 1'
  ).bind(event.repoFullName).first<TeamRepoRow>();

  if (!teamRepo) return;

  const existing = await env.DB.prepare(
    'SELECT id FROM commit_log WHERE webhook_delivery_id = ? LIMIT 1'
  ).bind(event.deliveryId).first();

  if (existing) return;

  const db = createDbClient(env.DB);
  const boundedCommits = event.commits.slice(0, MAX_COMMITS_PER_PUSH);
  const now = new Date().toISOString();

  try {
    for (const commit of boundedCommits) {
      await db.insert(commitLog).values({
        id: crypto.randomUUID(),
        team_id: teamRepo.team_id,
        hackathon_id: teamRepo.hackathon_id,
        sha: commit.sha,
        message: commit.message?.substring(0, 500) ?? '',
        author_name: commit.author?.substring(0, 100) ?? '',
        author_email: '',
        committed_at: commit.timestamp,
        url: `https://github.com/${event.repoFullName}/commit/${commit.sha}`,
        branch: event.branch,
        delivery_id: event.deliveryId,
        provider: 'github',
        created_at: now,
      });
    }
  } catch (error) {
    console.error('push-handler: failed to log commits:', {
      teamId: teamRepo.team_id,
      deliveryId: event.deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (event.forced) {
    const forcePushId = crypto.randomUUID();
    const estimatedLost = Math.max(0, (event.size ?? 0) - event.commits.length);

    const affectedSubmissions = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.team_id, teamRepo.team_id),
          inArray(submissions.status, ['received', 'validated', 'locked', 'under_review'])
        )
      );

    await db.insert(forcePushEvents).values({
      id: forcePushId,
      team_id: teamRepo.team_id,
      hackathon_id: teamRepo.hackathon_id,
      delivery_id: event.deliveryId,
      repo_full_name: event.repoFullName,
      branch: event.branch,
      before_sha: event.beforeSha,
      after_sha: event.headSha,
      estimated_lost_commits: estimatedLost,
      severity: affectedSubmissions.length > 0 ? 'critical' : 'warning',
      affected_submission_ids: JSON.stringify(affectedSubmissions.map((s) => s.id)),
      pusher_login: event.pusherName,
      provider: 'github',
      created_at: now,
    });

    await env.NOTIFICATION_QUEUE.send({
      type: 'force_push_alert',
      hackathonId: teamRepo.hackathon_id,
      teamId: teamRepo.team_id,
      forcePushId,
      affectedSubmissionCount: affectedSubmissions.length,
    });

    await insertAuditEvent(db, {
      hackathonId: teamRepo.hackathon_id,
      actorType: 'bot',
      eventType: 'force_push.detected',
      entityType: 'team',
      entityId: teamRepo.team_id,
      metadata: { before: event.beforeSha, after: event.headSha, branch: event.branch },
    });
  }
}
