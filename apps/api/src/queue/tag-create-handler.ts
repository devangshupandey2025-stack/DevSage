import { createDbClient, submissions } from '@devsage/db';
import type { NormalizedTagCreateEvent } from '../lib/webhook-normalize.js';
import { insertAuditEvent } from '../lib/audit.js';
import type { Env } from '../types/env.js';

interface RepoMapping {
  hackathonId: string;
  teamId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function handleTagCreate(event: NormalizedTagCreateEvent, env: Env): Promise<void> {
  const mapping = await env.KV.get<RepoMapping>(`repo:${event.repoFullName}`, 'json');
  if (!mapping || typeof mapping.hackathonId !== 'string' || typeof mapping.teamId !== 'string') {
    return;
  }

  const db = createDbClient(env.DB);

  const existing = await env.DB.prepare(
    'SELECT id FROM submissions WHERE webhook_delivery_id = ? LIMIT 1'
  ).bind(event.deliveryId).first();

  if (existing) return;

  const doId = env.HACKATHON_SM.idFromName(mapping.hackathonId);
  const doStub = env.HACKATHON_SM.get(doId);

  const submissionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const doResponse = await doStub.fetch('http://do/accept-submission', {
    method: 'POST',
    body: JSON.stringify({
      teamId: mapping.teamId,
      submissionId,
      tagName: event.tagName,
      commitSha: event.sha,
      timestamp: event.timestamp,
      webhookDeliveryId: event.deliveryId,
    }),
  });

  const doResult = await doResponse.json();
  if (!isRecord(doResult)) return;

  const accepted = doResult.accepted === true;
  if (!accepted && doResponse.status !== 201) {
    await insertAuditEvent(db, {
      hackathonId: mapping.hackathonId,
      actorType: 'bot',
      action: 'submission.rejected',
      entityType: 'submission',
      entityId: submissionId,
      details: { tagName: event.tagName, reason: doResult.reason },
    });
    return;
  }

  await db.insert(submissions).values({
    id: submissionId,
    team_id: mapping.teamId,
    hackathon_id: mapping.hackathonId,
    tag_name: event.tagName,
    commit_sha: event.sha,
    commit_author: event.senderLogin?.substring(0, 100) ?? null,
    submitted_at: event.timestamp,
    received_at: now,
    is_late: 0,
    is_final: 0,
    version: 1,
    status: 'received',
    webhook_delivery_id: event.deliveryId,
  });

  await insertAuditEvent(db, {
    hackathonId: mapping.hackathonId,
    actorType: 'bot',
    action: 'submission.received',
    entityType: 'submission',
    entityId: submissionId,
    details: { tagName: event.tagName, commitSha: event.sha, teamId: mapping.teamId },
  });
}
