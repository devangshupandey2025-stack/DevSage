import { createDbClient, submissions } from '@devsage/db';
import type { NormalizedTagCreateEvent } from '../lib/webhook-normalize.js';
import { matchSubmissionTag } from '../lib/submission-tag.js';
import { insertAuditEvent } from '../lib/audit.js';
import { postCommitStatus } from '../services/github.js';
import type { Env } from '../types/env.js';

interface TeamRow {
  id: string;
  hackathon_id: string;
}

interface HackathonRow {
  submission_tag_pattern: string;
  submission_deadline: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function handleTagCreate(event: NormalizedTagCreateEvent, env: Env): Promise<void> {
  const team = await env.DB.prepare(
    'SELECT id, hackathon_id FROM teams WHERE repo_full_name = ? AND bot_active = 1'
  ).bind(event.repoFullName).first<TeamRow>();

  if (!team) return;

  const hackathon = await env.DB.prepare(
    'SELECT submission_tag_pattern, submission_deadline FROM hackathons WHERE id = ?'
  ).bind(team.hackathon_id).first<HackathonRow>();

  if (!hackathon) return;

  const tagMatch = matchSubmissionTag(event.tagName, hackathon.submission_tag_pattern);
  if (!tagMatch.matches) return;

  const existing = await env.DB.prepare(
    'SELECT id FROM submissions WHERE webhook_delivery_id = ? LIMIT 1'
  ).bind(event.deliveryId).first();

  if (existing) return;

  const db = createDbClient(env.DB);
  const submissionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const doId = env.HACKATHON_SM.idFromName(team.hackathon_id);
  const doStub = env.HACKATHON_SM.get(doId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let doResponse: Response;
  try {
    doResponse = await doStub.fetch('http://do/accept-submission', {
      method: 'POST',
      body: JSON.stringify({
        teamId: team.id,
        submissionId,
        tagName: event.tagName,
        commitSha: event.sha,
        timestamp: event.timestamp,
        webhookDeliveryId: event.deliveryId,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const doResult = await doResponse.json();
  if (!isRecord(doResult)) return;

   const accepted = doResult.accepted === true;
   if (!accepted) {
     await insertAuditEvent(db, {
       hackathonId: team.hackathon_id,
       actorType: 'bot',
       action: 'submission.rejected',
       entityType: 'submission',
       entityId: submissionId,
       details: { tagName: event.tagName, reason: doResult.reason },
     });
     await postCommitStatus(env, {
       repoFullName: event.repoFullName,
       sha: event.sha,
       state: 'failure',
       description: `Submission rejected: ${doResult.reason}`,
       context: 'devsage/submission',
     });
     return;
   }

  const deadlineMs = Date.parse(hackathon.submission_deadline);
  const submittedMs = Date.parse(event.timestamp);
  const isLate = Number.isFinite(deadlineMs) && Number.isFinite(submittedMs) && submittedMs > deadlineMs ? 1 : 0;

  await db.insert(submissions).values({
    id: submissionId,
    team_id: team.id,
    hackathon_id: team.hackathon_id,
    tag_name: event.tagName,
    commit_sha: event.sha,
    commit_author: event.senderLogin?.substring(0, 100) ?? null,
    submitted_at: event.timestamp,
    received_at: now,
    is_late: isLate,
    is_final: 0,
    version: tagMatch.version ?? 1,
    status: 'received',
    webhook_delivery_id: event.deliveryId,
  });

  await env.NOTIFICATION_QUEUE.send({
    type: 'submission_received',
    teamId: team.id,
    hackathonId: team.hackathon_id,
    tagName: event.tagName,
    commitSha: event.sha,
  });

   await insertAuditEvent(db, {
     hackathonId: team.hackathon_id,
     actorType: 'bot',
     action: 'submission.received',
     entityType: 'submission',
     entityId: submissionId,
     details: {
       tagName: event.tagName,
       commitSha: event.sha,
       teamId: team.id,
       version: tagMatch.version,
       isLate: isLate === 1,
     },
   });

   await postCommitStatus(env, {
     repoFullName: event.repoFullName,
     sha: event.sha,
     state: 'success',
     description: `Submission ${event.tagName} received by DevSage`,
     context: 'devsage/submission',
   });
}
