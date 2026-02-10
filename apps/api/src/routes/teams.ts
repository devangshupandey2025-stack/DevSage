import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { createDbClient, teams, teamMembers, users } from '@devsage/db';
import { CreateTeamRequestSchema, JoinTeamRequestSchema } from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, isRoleAtLeast } from '../middleware/role.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const teamsRouter = new Hono<AuthAppEnv>();

teamsRouter.use('*', authMiddleware);

/**
 * POST /:slug/teams — create a new team
 * Requires: participant+ role, hackathon must be registration_open
 */
teamsRouter.post(
  '/:slug/teams',
  requireRole('participant'),
  zValidator('json', CreateTeamRequestSchema),
  async (c) => {
    const user = c.get('user');
    const hackathon = c.get('hackathon');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    if (hackathon.status !== 'registration_open') {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Team creation only allowed during registration');
    }

    // Check if user is already on a team for this hackathon
    const existingMembership = await db
      .select({ teamId: teamMembers.team_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(and(eq(teams.hackathon_id, hackathon.id), eq(teamMembers.user_id, user.sub)))
      .get();

    if (existingMembership) {
      return errorResponse(c, 409, 'ALREADY_ON_TEAM', 'Already on a team for this hackathon');
    }

    const teamId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const inviteCode = crypto.randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    await db.batch([
      db.insert(teams).values({
        id: teamId,
        hackathon_id: hackathon.id,
        name: body.name,
        invite_code: inviteCode,
        created_at: now,
      }),
      db.insert(teamMembers).values({
        id: memberId,
        team_id: teamId,
        user_id: user.sub,
        role: 'leader',
        joined_at: now,
      }),
    ]);

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'team.create',
      entityType: 'team',
      entityId: teamId,
      details: { name: body.name },
    });

    const created = await db.select().from(teams).where(eq(teams.id, teamId)).get();

    return successResponse(c, created, undefined, 201);
  },
);

/**
 * GET /:slug/teams — list teams for a hackathon
 * Requires: participant+ role
 */
teamsRouter.get('/:slug/teams', requireRole('participant'), async (c) => {
  const hackathon = c.get('hackathon');
  const db = createDbClient(c.env.DB);
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0);

  const data = await db
    .select()
    .from(teams)
    .where(eq(teams.hackathon_id, hackathon.id))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(teams)
    .where(eq(teams.hackathon_id, hackathon.id))
    .get();

  const total = totalResult?.value ?? 0;

  return paginatedResponse(c, data, total, limit, offset);
});

/**
 * GET /:slug/teams/:teamId — get team detail with members
 * Requires: participant+ role
 */
teamsRouter.get('/:slug/teams/:teamId', requireRole('participant'), async (c) => {
  const teamId = c.req.param('teamId');
  const hackathon = c.get('hackathon');
  const db = createDbClient(c.env.DB);

  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathon.id)))
    .get();

  if (!team) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
  }

  const members = await db
    .select({
      user_id: teamMembers.user_id,
      role: teamMembers.role,
      joined_at: teamMembers.joined_at,
      display_name: users.display_name,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.user_id))
    .where(eq(teamMembers.team_id, teamId))
    .all();

  return successResponse(c, { ...team, members });
});

/**
 * POST /:slug/teams/:teamId/join — join a team via invite code
 * Requires: participant+ role
 */
teamsRouter.post(
  '/:slug/teams/:teamId/join',
  requireRole('participant'),
  zValidator('json', JoinTeamRequestSchema),
  async (c) => {
    const teamId = c.req.param('teamId');
    const user = c.get('user');
    const hackathon = c.get('hackathon');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const team = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathon.id)))
      .get();

    if (!team) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
    }

    if (team.invite_code !== body.inviteCode) {
      return errorResponse(c, 403, 'INVALID_INVITE_CODE', 'Invalid invite code');
    }

    // Check if user is already on a team for this hackathon
    const existingMembership = await db
      .select({ teamId: teamMembers.team_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(and(eq(teams.hackathon_id, hackathon.id), eq(teamMembers.user_id, user.sub)))
      .get();

    if (existingMembership) {
      return errorResponse(c, 409, 'ALREADY_ON_TEAM', 'Already on a team for this hackathon');
    }

    const sizeResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.team_id, teamId))
      .get();

    const currentSize = sizeResult?.count ?? 0;

    if (currentSize >= hackathon.max_team_size) {
      return errorResponse(c, 409, 'TEAM_FULL', 'Team is full');
    }

    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(teamMembers).values({
      id: memberId,
      team_id: teamId,
      user_id: user.sub,
      role: 'member',
      joined_at: now,
    });

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'team.join',
      entityType: 'team',
      entityId: teamId,
    });

    return successResponse(c, team);
  },
);

/**
 * DELETE /:slug/teams/:teamId/members/:userId — remove a member
 * Requires: participant+ role, but only team leader or admin+ can actually remove
 */
teamsRouter.delete(
  '/:slug/teams/:teamId/members/:userId',
  requireRole('participant'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const targetUserId = c.req.param('userId');
    const user = c.get('user');
    const hackathon = c.get('hackathon');
    const role = c.get('role');
    const db = createDbClient(c.env.DB);

    // Verify team exists and belongs to this hackathon
    const team = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathon.id)))
      .get();

    if (!team) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
    }

    const actorMembership = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)))
      .get();

    const isLeader = actorMembership?.role === 'leader';
    const isAdmin = isRoleAtLeast(role, 'admin');

    if (!isLeader && !isAdmin) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Only team leader or admin can remove members');
    }

    const targetMembership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, targetUserId)))
      .get();

    if (!targetMembership) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Member not found');
    }

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, targetUserId)));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'team.member_remove',
      entityType: 'team',
      entityId: teamId,
      details: { removedUserId: targetUserId },
    });

    return successResponse(c, { removed: true });
  },
);

export default teamsRouter;
