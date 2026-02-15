import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { createDbClient, teamRepos, teams, teamMembers, users } from '@devsage/db';
import { ConnectTeamRepoRequestSchema } from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonMiddleware } from '../middleware/hackathon.js';
import { requireRole, isRoleAtLeast } from '../middleware/role.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const PROVIDER_URLS: Record<string, string> = {
  github: 'https://github.com',
  gitlab: 'https://gitlab.com',
  bitbucket: 'https://bitbucket.org',
};

const teamReposRouter = new Hono<AuthAppEnv>();

teamReposRouter.use('*', authMiddleware);
teamReposRouter.use('/:slug/*', hackathonMiddleware);

teamReposRouter.post(
  '/:slug/teams/:teamId/repos',
  requireRole('team_lead'),
  zValidator('json', ConnectTeamRepoRequestSchema),
  async (c) => {
    const teamId = c.req.param('teamId');
    const user = c.get('user');
    const hackathon = c.get('hackathon');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    if (!user.ghid) {
      return errorResponse(c, 403, 'GITHUB_LINK_REQUIRED', 'Please link your GitHub account to use this feature.');
    }

    const userRecord = await db
      .select({ github_elevated_token: users.github_elevated_token })
      .from(users)
      .where(eq(users.id, user.sub))
      .get();

    if (!userRecord?.github_elevated_token) {
      return errorResponse(c, 403, 'GITHUB_SCOPE_REQUIRED', 'Additional GitHub permissions required.', {
        redirect_url: '/auth/github/elevate',
      });
    }

    const team = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathon.id)))
      .get();

    if (!team) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
    }

    const membership = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)))
      .get();

    if (!membership || membership.role !== 'leader') {
      const role = c.get('role');
      if (!isRoleAtLeast(role, 'co_organizer')) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Must be team leader or co-organizer to link repos');
      }
    }

    const existingRepo = await db
      .select({ id: teamRepos.id })
      .from(teamRepos)
      .where(and(
        eq(teamRepos.hackathon_id, hackathon.id),
        eq(teamRepos.repo_full_name, body.repoFullName),
      ))
      .get();

    if (existingRepo) {
      return errorResponse(c, 409, 'REPO_ALREADY_LINKED', 'Repository already linked in this hackathon');
    }

    const provider: 'github' | 'gitlab' | 'bitbucket' =
      body.provider === 'gitlab' ? 'gitlab' :
      body.provider === 'bitbucket' ? 'bitbucket' : 'github';
    const repoUrl = `${PROVIDER_URLS[provider]}/${body.repoFullName}`;

    const repoId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(teamRepos).values({
      id: repoId,
      team_id: teamId,
      hackathon_id: hackathon.id,
      provider,
      repo_full_name: body.repoFullName,
      repo_url: repoUrl,
      is_primary: 1,
      created_at: now,
    });

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'team_repo.link',
      entityType: 'team_repo',
      entityId: repoId,
      details: { teamId, repoFullName: body.repoFullName, provider },
    });

    const created = await db
      .select()
      .from(teamRepos)
      .where(eq(teamRepos.id, repoId))
      .get();

    return successResponse(c, created, undefined, 201);
  },
);

teamReposRouter.get(
  '/:slug/teams/:teamId/repos',
  requireRole('team_member'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);

    const team = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathon.id)))
      .get();

    if (!team) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
    }

    const repos = await db
      .select()
      .from(teamRepos)
      .where(eq(teamRepos.team_id, teamId))
      .all();

    return successResponse(c, repos);
  },
);

teamReposRouter.delete(
  '/:slug/teams/:teamId/repos/:repoId',
  requireRole('team_lead'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const repoId = c.req.param('repoId');
    const user = c.get('user');
    const hackathon = c.get('hackathon');
    const db = createDbClient(c.env.DB);

    const team = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathon.id)))
      .get();

    if (!team) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
    }

    const membership = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)))
      .get();

    if (!membership || membership.role !== 'leader') {
      const role = c.get('role');
      if (!isRoleAtLeast(role, 'co_organizer')) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Must be team leader or co-organizer to unlink repos');
      }
    }

    const repo = await db
      .select({ id: teamRepos.id, repo_full_name: teamRepos.repo_full_name })
      .from(teamRepos)
      .where(and(eq(teamRepos.id, repoId), eq(teamRepos.team_id, teamId)))
      .get();

    if (!repo) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Repository not found');
    }

    await db.delete(teamRepos).where(eq(teamRepos.id, repoId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'team_repo.unlink',
      entityType: 'team_repo',
      entityId: repoId,
      details: { teamId, repoFullName: repo.repo_full_name },
    });

    return successResponse(c, { removed: true });
  },
);

export default teamReposRouter;
