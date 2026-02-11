import { createDbClient, commitLog, forcePushEvents, submissions } from '@devsage/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { NormalizedPushEvent } from '../lib/webhook-normalize.js';
import { insertAuditEvent } from '../lib/audit.js';
import type { Env } from '../types/env.js';

const MAX_COMMITS_PER_PUSH = 20;

interface TeamRow {
  id: string;
  hackathon_id: string;
}

export async function handlePush(event: NormalizedPushEvent, env: Env): Promise<void> {
  const team = await env.DB.prepare(
    'SELECT id, hackathon_id FROM teams WHERE repo_full_name = ? AND bot_active = 1'
  ).bind(event.repoFullName).first<TeamRow>();

  if (!team) return;

  const existing = await env.DB.prepare(
    'SELECT id FROM commit_log WHERE webhook_delivery_id = ? LIMIT 1'
  ).bind(event.deliveryId).first();

  if (existing) return;

  const db = createDbClient(env.DB);
  const boundedCommits = event.commits.slice(0, MAX_COMMITS_PER_PUSH);
  const now = new Date().toISOString();

  for (const commit of boundedCommits) {
    await db.insert(commitLog).values({
      id: crypto.randomUUID(),
      team_id: team.id,
      hackathon_id: team.hackathon_id,
      commit_sha: commit.sha,
      message: commit.message?.substring(0, 500) ?? null,
      author_username: commit.author?.substring(0, 100) ?? null,
      branch: event.branch,
      pushed_at: event.timestamp,
      is_force_push: event.forced ? 1 : 0,
      commits_in_push: event.commits.length,
      webhook_delivery_id: event.deliveryId,
      created_at: now,
    });
  }

  if (event.forced) {
    const forcePushId = crypto.randomUUID();
    const estimatedLost = Math.max(0, (event.size ?? 0) - event.commits.length);

    await db.insert(forcePushEvents).values({
      id: forcePushId,
      team_id: team.id,
      hackathon_id: team.hackathon_id,
      before_sha: event.beforeSha,
      after_sha: event.headSha,
      branch: event.branch,
      commits_lost_count: estimatedLost,
      detected_at: now,
      webhook_delivery_id: event.deliveryId,
    });

    const affectedSubmissions = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.team_id, team.id),
          inArray(submissions.status, ['received', 'validated', 'locked', 'under_review'])
        )
      );

    if (affectedSubmissions.length > 0) {
      await db
        .update(forcePushEvents)
        .set({
          action_taken: 'flagged',
          submissions_invalidated: JSON.stringify(affectedSubmissions.map((s) => s.id)),
        })
        .where(eq(forcePushEvents.id, forcePushId));
    }

    await env.NOTIFICATION_QUEUE.send({
      type: 'force_push_alert',
      hackathonId: team.hackathon_id,
      teamId: team.id,
      forcePushId,
      affectedSubmissionCount: affectedSubmissions.length,
    });

    await insertAuditEvent(db, {
      hackathonId: team.hackathon_id,
      actorType: 'bot',
      action: 'force_push.detected',
      entityType: 'team',
      entityId: team.id,
      details: { before: event.beforeSha, after: event.headSha, branch: event.branch },
    });
  }
}
