import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types/env.js';

interface SubmitRequest {
  hackathonId: string;
  teamId: string;
  repoFullName: string;
  commitSha: string;
  deliveryId: string;
}

interface LinkRepoRequest {
  hackathonId: string;
  teamId: string;
  repoFullName: string;
}

interface SubmissionRecord {
  id: string;
  hackathonId: string;
  teamId: string;
  repoFullName: string;
  commitSha: string;
  submittedAt: string;
  status: 'pending' | 'accepted' | 'locked';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSubmitRequest(value: unknown): SubmitRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const { hackathonId, teamId, repoFullName, commitSha, deliveryId } = value;
  if (
    typeof hackathonId !== 'string' ||
    typeof teamId !== 'string' ||
    typeof repoFullName !== 'string' ||
    typeof commitSha !== 'string' ||
    typeof deliveryId !== 'string'
  ) {
    return null;
  }

  return { hackathonId, teamId, repoFullName, commitSha, deliveryId };
}

function parseLinkRepoRequest(value: unknown): LinkRepoRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const { hackathonId, teamId, repoFullName } = value;
  if (
    typeof hackathonId !== 'string' ||
    typeof teamId !== 'string' ||
    typeof repoFullName !== 'string'
  ) {
    return null;
  }

  return { hackathonId, teamId, repoFullName };
}

export class SubmissionDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS submissions (
          id TEXT PRIMARY KEY,
          hackathon_id TEXT NOT NULL,
          team_id TEXT NOT NULL,
          repo_full_name TEXT NOT NULL,
          commit_sha TEXT NOT NULL,
          submitted_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'accepted',
          UNIQUE(hackathon_id, team_id)
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS deliveries (
          delivery_id TEXT PRIMARY KEY,
          processed_at TEXT NOT NULL
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS linked_repos (
          hackathon_id TEXT NOT NULL,
          team_id TEXT NOT NULL,
          repo_full_name TEXT NOT NULL,
          linked_at TEXT NOT NULL,
          PRIMARY KEY(hackathon_id, team_id)
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/submit') {
      return this.handleSubmit(request);
    }

    if (request.method === 'POST' && url.pathname === '/link-repo') {
      return this.handleLinkRepo(request);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/submissions/')) {
      const hackathonId = url.pathname.slice('/submissions/'.length);
      return this.handleGetSubmissions(hackathonId);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/submission/')) {
      const parts = url.pathname.split('/');
      const hackathonId = parts[2];
      const teamId = parts[3];
      if (!hackathonId || !teamId) {
        return Response.json({ error: 'Expected /submission/:hackathonId/:teamId', code: 'INVALID_PATH' }, { status: 400 });
      }

      return this.handleGetSubmission(hackathonId, teamId);
    }

    return Response.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  private getSubmission(hackathonId: string, teamId: string): SubmissionRecord | null {
    const row = this.ctx.storage.sql
      .exec(
        `
        SELECT
          id,
          hackathon_id AS hackathonId,
          team_id AS teamId,
          repo_full_name AS repoFullName,
          commit_sha AS commitSha,
          submitted_at AS submittedAt,
          status
        FROM submissions
        WHERE hackathon_id = ? AND team_id = ?
        LIMIT 1
      `,
        hackathonId,
        teamId
      )
      .toArray()[0];

    if (!isRecord(row)) {
      return null;
    }

    const { id, teamId: rowTeamId, hackathonId: rowHackathonId, repoFullName, commitSha, submittedAt, status } = row;
    if (
      typeof id !== 'string' ||
      typeof rowHackathonId !== 'string' ||
      typeof rowTeamId !== 'string' ||
      typeof repoFullName !== 'string' ||
      typeof commitSha !== 'string' ||
      typeof submittedAt !== 'string' ||
      (status !== 'pending' && status !== 'accepted' && status !== 'locked')
    ) {
      throw new Error('Invalid submissions row shape');
    }

    return {
      id,
      hackathonId: rowHackathonId,
      teamId: rowTeamId,
      repoFullName,
      commitSha,
      submittedAt,
      status,
    };
  }

  private async handleSubmit(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const payload = parseSubmitRequest(body);
    if (!payload) {
      return Response.json(
        {
          error: 'Expected { hackathonId, teamId, repoFullName, commitSha, deliveryId }',
          code: 'INVALID_BODY',
        },
        { status: 400 }
      );
    }

    const linkedRepo = this.ctx.storage.sql
      .exec(
        `
          SELECT repo_full_name AS repoFullName
          FROM linked_repos
          WHERE hackathon_id = ? AND team_id = ?
          LIMIT 1
        `,
        payload.hackathonId,
        payload.teamId
      )
      .toArray()[0];

    if (!isRecord(linkedRepo) || linkedRepo.repoFullName !== payload.repoFullName) {
      return Response.json({ error: 'Repository is not linked for this team', code: 'REPO_NOT_LINKED' }, { status: 403 });
    }

    const existingDelivery = this.ctx.storage.sql
      .exec(
        `
          SELECT delivery_id
          FROM deliveries
          WHERE delivery_id = ?
          LIMIT 1
        `,
        payload.deliveryId
      )
      .toArray()[0];

    if (isRecord(existingDelivery) && typeof existingDelivery.delivery_id === 'string') {
      return Response.json({ message: 'Delivery already processed', code: 'ALREADY_PROCESSED' }, { status: 200 });
    }

    const existingSubmission = this.getSubmission(payload.hackathonId, payload.teamId);
    if (existingSubmission?.status === 'locked') {
      return Response.json({ error: 'Submission is locked', code: 'SUBMISSION_LOCKED' }, { status: 409 });
    }

    const submissionId = existingSubmission?.id ?? crypto.randomUUID();
    const submittedAt = new Date().toISOString();

    this.ctx.storage.sql.exec(
      `
        INSERT OR REPLACE INTO submissions (
          id,
          hackathon_id,
          team_id,
          repo_full_name,
          commit_sha,
          submitted_at,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, 'accepted')
      `,
      submissionId,
      payload.hackathonId,
      payload.teamId,
      payload.repoFullName,
      payload.commitSha,
      submittedAt
    );

    this.ctx.storage.sql.exec(
      `
        INSERT INTO deliveries (delivery_id, processed_at)
        VALUES (?, ?)
      `,
      payload.deliveryId,
      submittedAt
    );

    return Response.json({ message: 'Submission accepted' }, { status: 201 });
  }

  private async handleLinkRepo(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
    }

    const payload = parseLinkRepoRequest(body);
    if (!payload) {
      return Response.json(
        { error: 'Expected { hackathonId, teamId, repoFullName }', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    const linkedAt = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `
        INSERT OR REPLACE INTO linked_repos (hackathon_id, team_id, repo_full_name, linked_at)
        VALUES (?, ?, ?, ?)
      `,
      payload.hackathonId,
      payload.teamId,
      payload.repoFullName,
      linkedAt
    );

    return Response.json({ message: 'Repository linked' }, { status: 200 });
  }

  private handleGetSubmissions(hackathonId: string): Response {
    const rows = this.ctx.storage.sql
      .exec(
        `
          SELECT
            id,
            hackathon_id AS hackathonId,
            team_id AS teamId,
            repo_full_name AS repoFullName,
            commit_sha AS commitSha,
            submitted_at AS submittedAt,
            status
          FROM submissions
          WHERE hackathon_id = ?
          ORDER BY submitted_at DESC
        `,
        hackathonId
      )
      .toArray();

    const submissions: SubmissionRecord[] = [];
    for (const row of rows) {
      if (!isRecord(row)) {
        continue;
      }

      const { id, teamId, hackathonId: rowHackathonId, repoFullName, commitSha, submittedAt, status } = row;
      if (
        typeof id !== 'string' ||
        typeof teamId !== 'string' ||
        typeof rowHackathonId !== 'string' ||
        typeof repoFullName !== 'string' ||
        typeof commitSha !== 'string' ||
        typeof submittedAt !== 'string' ||
        (status !== 'pending' && status !== 'accepted' && status !== 'locked')
      ) {
        throw new Error('Invalid submissions row shape');
      }

      submissions.push({
        id,
        teamId,
        hackathonId: rowHackathonId,
        repoFullName,
        commitSha,
        submittedAt,
        status,
      });
    }

    return Response.json({ data: submissions, total: submissions.length });
  }

  private handleGetSubmission(hackathonId: string, teamId: string): Response {
    const submission = this.getSubmission(hackathonId, teamId);
    if (!submission) {
      return Response.json({ error: 'Submission not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    return Response.json(submission);
  }
}
