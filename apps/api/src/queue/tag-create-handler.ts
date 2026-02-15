import { createDbClient, submissions } from '@devsage/db';
import type { NormalizedTagCreateEvent } from '../lib/webhook-normalize.js';
import { matchSubmissionTag } from '../lib/submission-tag.js';
import { insertAuditEvent } from '../lib/audit.js';
import { postCommitStatus } from '../services/github.js';
import type { Env } from '../types/env.js';
import { isRecord } from '../lib/utils.js';
import { getStateMachineStub, fetchDO } from '../lib/do-client.js';
import { DO_PATHS } from '../lib/constants.js';
import type { TeamRepoRow, HackathonRow, RoundRow } from '../types/db-rows.js';

export async function handleTagCreate(event: NormalizedTagCreateEvent, env: Env): Promise<void> {
  const teamRepo = await env.DB.prepare(
    'SELECT id, team_id, hackathon_id, repo_full_name FROM team_repos WHERE repo_full_name = ? AND bot_active = 1'
  ).bind(event.repoFullName).first<TeamRepoRow>();

  if (!teamRepo) return;

  const hackathon = await env.DB.prepare(
    'SELECT submission_tag_pattern FROM hackathons WHERE id = ?'
  ).bind(teamRepo.hackathon_id).first<HackathonRow>();

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

  const doStub = getStateMachineStub(env, teamRepo.hackathon_id);

  let doResult: Awaited<ReturnType<typeof fetchDO>>;
  try {
    doResult = await fetchDO(doStub, DO_PATHS.ACCEPT_SUBMISSION, {
      method: 'POST',
      body: {
        teamId: teamRepo.team_id,
        submissionId,
        tagName: event.tagName,
        commitSha: event.sha,
        timestamp: event.timestamp,
        webhookDeliveryId: event.deliveryId,
      },
    });
  } catch (error) {
    console.error('tag-create: DO fetch failed:', {
      hackathonId: teamRepo.hackathon_id,
      teamId: teamRepo.team_id,
      tag: event.tagName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!isRecord(doResult.data)) return;
  const doData = doResult.data;

  const accepted = doData.accepted === true;
  if (!accepted) {
    await insertAuditEvent(db, {
      hackathonId: teamRepo.hackathon_id,
      actorType: 'bot',
      action: 'submission.rejected',
      entityType: 'submission',
      entityId: submissionId,
      details: { tagName: event.tagName, reason: doData.reason },
    });
    await postCommitStatus(env, {
      repoFullName: event.repoFullName,
      sha: event.sha,
      state: 'failure',
      description: `Submission rejected: ${doData.reason}`,
      context: 'devsage/submission',
    });
    return;
  }

  const activeRound = await env.DB.prepare(
    `SELECT id, hackathon_id, round_number, status, submission_deadline FROM hackathon_rounds
     WHERE hackathon_id = ? AND status = 'active'
     ORDER BY round_number DESC LIMIT 1`
  ).bind(teamRepo.hackathon_id).first<RoundRow>();

  let isLate = 0;
  if (activeRound?.submission_deadline) {
    const deadlineMs = Date.parse(activeRound.submission_deadline);
    const submittedMs = Date.parse(event.timestamp);
    isLate = Number.isFinite(deadlineMs) && Number.isFinite(submittedMs) && submittedMs > deadlineMs ? 1 : 0;
  }

  const roundId = activeRound?.id ?? '';

  await db.insert(submissions).values({
    id: submissionId,
    team_id: teamRepo.team_id,
    hackathon_id: teamRepo.hackathon_id,
    tag_name: event.tagName,
    commit_sha: event.sha,
    commit_author: event.senderLogin?.substring(0, 100) ?? null,
    repo_full_name: event.repoFullName,
    round_id: roundId,
    provider: 'github',
    submitted_at: event.timestamp,
    received_at: now,
    is_late: isLate,
    is_final: 0,
    status: 'received',
    webhook_delivery_id: event.deliveryId,
  });

  await env.NOTIFICATION_QUEUE.send({
    type: 'submission_received',
    teamId: teamRepo.team_id,
    hackathonId: teamRepo.hackathon_id,
    tagName: event.tagName,
    commitSha: event.sha,
  });

  await insertAuditEvent(db, {
    hackathonId: teamRepo.hackathon_id,
    actorType: 'bot',
    action: 'submission.received',
    entityType: 'submission',
    entityId: submissionId,
    details: {
      tagName: event.tagName,
      commitSha: event.sha,
      teamId: teamRepo.team_id,
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
