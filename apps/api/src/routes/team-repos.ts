import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { validateBody } from '../lib/validate.js';
import { linkRepoSchema } from '@devsage/shared';

const teamRepos = new Hono<AppEnv>();
teamRepos.use('/*', hackathonContext);

// Transform DB team_repo row to API response format
function transformRepoResponse(row: Record<string, unknown>) {
  const fullName = String(row.repo_full_name ?? '');
  const [owner = '', repo = ''] = fullName.split('/');
  return {
    ...row,
    github_owner: owner,
    github_repo: repo,
    github_repo_url: row.repo_url ?? `https://github.com/${fullName}`,
  };
}

// Link repo to team
teamRepos.post('/:teamId/repo', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  // Check permission (leader)
  const isLead = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?'
  ).bind(teamId, user.id, 'leader').first();

  if (!isLead) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only team lead can link a repo');
  }

  const body = await validateBody(c, linkRepoSchema);
  if (body instanceof Response) return body;

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
    `INSERT INTO team_repos (id, team_id, hackathon_id, provider, repo_full_name, repo_url, installation_id, bot_active, is_primary, created_at)
     VALUES (?, ?, ?, 'github', ?, ?, '', 0, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
  ).bind(repoId, teamId, hackathon.id, `${owner}/${repo}`, body.github_repo_url).run();

  // Add to pending installations for bot activation
  try {
    await c.env.DB.prepare(
      `INSERT INTO pending_installations (id, provider, repo_full_name, installation_id, installed_by, created_at)
       VALUES (?, 'github', ?, '', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
    ).bind(crypto.randomUUID(), `${owner}/${repo}`, user.id).run();
  } catch (_e) {
    // Non-critical — bot activation can be retried later
  }

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.repo_linked',
      entity_type: 'team_repo',
      entity_id: repoId,
      details: { github_repo_url: body.github_repo_url },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM team_repos WHERE id = ?').bind(repoId).first();
  return successResponse(c, created ? transformRepoResponse(created as Record<string, unknown>) : created, { status: 201 });
});

// Get team's repo
teamRepos.get('/:teamId/repo', async (c) => {
  const teamId = c.req.param('teamId');
  const repo = await c.env.DB.prepare(
    'SELECT * FROM team_repos WHERE team_id = ?'
  ).bind(teamId).first();

  if (!repo) return errorResponse(c, 404, 'NOT_FOUND', 'No repo linked');
  return successResponse(c, transformRepoResponse(repo as Record<string, unknown>));
});

// Unlink repo
teamRepos.delete('/:teamId/repo', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  const isLead = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?'
  ).bind(teamId, user.id, 'leader').first();

  if (!isLead) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only team lead can unlink a repo');
  }

  const repo = await c.env.DB.prepare('SELECT repo_full_name FROM team_repos WHERE team_id = ?').bind(teamId).first<{repo_full_name?: string}>();
  await c.env.DB.prepare('DELETE FROM team_repos WHERE team_id = ?').bind(teamId).run();
  if (repo?.repo_full_name) {
    await c.env.DB.prepare('DELETE FROM pending_installations WHERE repo_full_name = ?').bind(repo.repo_full_name).run();
  }

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.repo_unlinked',
      entity_type: 'team',
      entity_id: teamId,
    })
  );

  return successResponse(c, { unlinked: true });
});

export default teamRepos;
