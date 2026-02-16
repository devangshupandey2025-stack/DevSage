import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';

const teamRepos = new Hono<AppEnv>();
teamRepos.use('/*', hackathonContext);

// Link repo to team
teamRepos.post('/:teamId/repo', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  // Check permission (team_lead)
  const isLead = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?'
  ).bind(teamId, user.id, 'team_lead').first();

  if (!isLead) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only team lead can link a repo');
  }

  const body = await c.req.json<{ github_repo_url: string }>();
  if (!body.github_repo_url) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'github_repo_url is required');
  }

  // Parse URL
  const match = body.github_repo_url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invalid GitHub repo URL');
  }

  const [, owner, repo] = match;

  // Check if team already has a repo
  const existing = await c.env.DB.prepare(
    'SELECT id FROM team_repos WHERE team_id = ?'
  ).bind(teamId).first();

  if (existing) {
    return errorResponse(c, 409, 'REPO_ALREADY_LINKED', 'Team already has a linked repo');
  }

  const repoId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO team_repos (id, team_id, github_repo_url, github_owner, github_repo, linked_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(repoId, teamId, body.github_repo_url, owner, repo, user.id).run();

  // Add to pending installations for bot activation
  await c.env.DB.prepare(
    'INSERT INTO pending_installations (id, team_id, github_owner, github_repo) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), teamId, owner, repo).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      event_type: 'team.repo_linked',
      entity_type: 'team_repo',
      entity_id: repoId,
      metadata: { github_repo_url: body.github_repo_url },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM team_repos WHERE id = ?').bind(repoId).first();
  return successResponse(c, created, { status: 201 });
});

// Get team's repo
teamRepos.get('/:teamId/repo', async (c) => {
  const teamId = c.req.param('teamId');
  const repo = await c.env.DB.prepare(
    'SELECT * FROM team_repos WHERE team_id = ?'
  ).bind(teamId).first();

  if (!repo) return errorResponse(c, 404, 'NOT_FOUND', 'No repo linked');
  return successResponse(c, repo);
});

// Unlink repo
teamRepos.delete('/:teamId/repo', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  const isLead = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?'
  ).bind(teamId, user.id, 'team_lead').first();

  if (!isLead) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only team lead can unlink a repo');
  }

  await c.env.DB.prepare('DELETE FROM team_repos WHERE team_id = ?').bind(teamId).run();
  await c.env.DB.prepare('DELETE FROM pending_installations WHERE team_id = ?').bind(teamId).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      event_type: 'team.repo_unlinked',
      entity_type: 'team',
      entity_id: teamId,
    })
  );

  return successResponse(c, { unlinked: true });
});

export default teamRepos;
