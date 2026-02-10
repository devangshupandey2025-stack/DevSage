import { createDbClient, commitLog, forcePushEvents } from '@devsage/db';
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
    await db.insert(forcePushEvents).values({
      id: crypto.randomUUID(),
      team_id: team.id,
      hackathon_id: team.hackathon_id,
      before_sha: event.beforeSha,
      after_sha: event.headSha,
      branch: event.branch,
      commits_lost_count: 0,
      detected_at: now,
      webhook_delivery_id: event.deliveryId,
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
