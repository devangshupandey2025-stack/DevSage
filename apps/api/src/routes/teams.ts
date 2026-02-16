import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { createDbClient, teams, teamMembers, users, commitLog } from '@devsage/db';
import { CreateTeamRequestSchema, JoinTeamRequestSchema, PaginationQuerySchema } from '@devsage/shared';
import { z } from 'zod';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonMiddleware } from '../middleware/hackathon.js';
import { requireRole, isRoleAtLeast } from '../middleware/role.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const UpdateTeamRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  trackId: z.string().optional().nullable(),
});

const TransferLeaderRequestSchema = z.object({
  userId: z.string().min(1),
});

const teamsRouter = new Hono<AuthAppEnv>();

teamsRouter.use('*', authMiddleware);
// Ensure hackathon is loaded on routes that include :slug before handlers
teamsRouter.use('/:slug/*', hackathonMiddleware);

/**
 * POST /:slug/teams — create a new team
 * Requires: authenticated user, hackathon must be active
 */
teamsRouter.post(
  '/:slug/teams',
  requireRole('anonymous'),
  zValidator('json', CreateTeamRequestSchema),
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required');
    }
    if (!user.ghid) {
      return errorResponse(c, 403, 'GITHUB_LINK_REQUIRED', 'Please link your GitHub account to use this feature.');
    }
    const hackathon = c.get('hackathon');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    if (hackathon.status !== 'active') {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Team creation only allowed when hackathon is active');
    }

    // Check max_teams limit
    if (hackathon.max_teams) {
      const teamCountResult = await db
        .select({ value: sql<number>`COUNT(*)` })
        .from(teams)
        .where(eq(teams.hackathon_id, hackathon.id))
        .get();
      const currentTeamCount = teamCountResult?.value ?? 0;
      if (currentTeamCount >= hackathon.max_teams) {
        return errorResponse(c, 409, 'MAX_TEAMS_REACHED', 'Maximum number of teams reached for this hackathon');
      }
    }

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
        description: body.description ?? '',
        track_id: body.trackId ?? null,
        invite_code: inviteCode,
        created_at: now,
        updated_at: now,
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
      eventType: 'team.create',
      entityType: 'team',
      entityId: teamId,
      metadata: { name: body.name },
    });

    const created = await db.select().from(teams).where(eq(teams.id, teamId)).get();

    return successResponse(c, created, undefined, 201);
  },
);

/**
 * GET /:slug/teams — list teams for a hackathon
 * Requires: participant+ role
 */
teamsRouter.get('/:slug/teams', requireRole('team_member'), async (c) => {
  const hackathon = c.get('hackathon');
  if (!hackathon) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');
  }
  const db = createDbClient(c.env.DB);
  const parsed = PaginationQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });
  const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };

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
teamsRouter.get('/:slug/teams/:teamId', requireRole('anonymous'), async (c) => {
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
  requireRole('anonymous'),
  zValidator('json', JoinTeamRequestSchema),
  async (c) => {
    const teamId = c.req.param('teamId');
    const user = c.get('user');
    if (!user) {
      return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required');
    }
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

    // Check hackathon status allows joining
    if (hackathon.status !== 'active') {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Cannot join teams when hackathon is not active');
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
      eventType: 'team.join',
      entityType: 'team',
      entityId: teamId,
    });

    return successResponse(c, team);
  },
);

/**
 * DELETE /:slug/teams/:teamId/members/:userId — remove a member or leave team.
 * Self-removal (leave): any team member can leave.
 * Removing another member: requires team_leader+ or admin+.
 */
teamsRouter.delete(
  '/:slug/teams/:teamId/members/:userId',
  requireRole('anonymous'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const targetUserId = c.req.param('userId');
    const user = c.get('user');
    if (!user) {
      return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required');
    }
    const hackathon = c.get('hackathon');
    const role = c.get('role');
    const db = createDbClient(c.env.DB);

    const team = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathon.id)))
      .get();

    if (!team) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
    }

    const isSelfRemoval = targetUserId === user.sub;
    const isAdmin = isRoleAtLeast(role, 'co_organizer');

    if (!isSelfRemoval && !isAdmin) {
      const isLeader = isRoleAtLeast(role, 'team_lead');
      if (!isLeader) {
        return errorResponse(c, 403, 'FORBIDDEN', 'Only team leader or co-organizer can remove other members');
      }
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
      eventType: isSelfRemoval ? 'team.leave' : 'team.member_remove',
      entityType: 'team',
      entityId: teamId,
      metadata: { removedUserId: targetUserId },
    });

     return successResponse(c, { removed: true });
   },
);

/**
 * PUT /:slug/teams/:teamId — update team details
 * Requires: team_lead
 */
teamsRouter.put(
  '/:slug/teams/:teamId',
  requireRole('team_lead'),
  zValidator('json', UpdateTeamRequestSchema),
  async (c) => {
    const teamId = c.req.param('teamId');
    const hackathon = c.get('hackathon');
    const user = c.get('user');
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

    const now = new Date().toISOString();

    await db
      .update(teams)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.trackId !== undefined && { track_id: body.trackId }),
        updated_at: now,
      })
      .where(eq(teams.id, teamId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'team.update',
      entityType: 'team',
      entityId: teamId,
      metadata: body,
    });

    const updated = await db.select().from(teams).where(eq(teams.id, teamId)).get();
    return successResponse(c, updated);
  },
);

/**
 * DELETE /:slug/teams/:teamId — dissolve team
 * Requires: team_lead (or co_organizer+)
 */
teamsRouter.delete(
  '/:slug/teams/:teamId',
  requireRole('team_lead'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    const team = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathon.id)))
      .get();

    if (!team) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
    }

    // Delete members first (cascade may not cover all cases)
    await db.delete(teamMembers).where(eq(teamMembers.team_id, teamId));
    await db.delete(teams).where(eq(teams.id, teamId));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'team.dissolve',
      entityType: 'team',
      entityId: teamId,
      metadata: { name: team.name },
    });

    return successResponse(c, { deleted: true });
  },
);

/**
 * POST /:slug/teams/:teamId/leave — leave a team (dedicated endpoint)
 */
teamsRouter.post(
  '/:slug/teams/:teamId/leave',
  requireRole('team_member'),
  async (c) => {
    const teamId = c.req.param('teamId');
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    if (!user) {
      return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required');
    }
    const db = createDbClient(c.env.DB);

    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)))
      .get();

    if (!membership) {
      return errorResponse(c, 404, 'NOT_FOUND', 'You are not a member of this team');
    }

    if (membership.role === 'leader') {
      return errorResponse(c, 400, 'LEADER_CANNOT_LEAVE', 'Team leader must transfer leadership before leaving');
    }

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'team.leave',
      entityType: 'team',
      entityId: teamId,
    });

    return successResponse(c, { left: true });
  },
);

/**
 * POST /:slug/teams/:teamId/transfer-leader — transfer team leadership
 * Requires: current team_lead
 */
teamsRouter.post(
  '/:slug/teams/:teamId/transfer-leader',
  requireRole('team_lead'),
  zValidator('json', TransferLeaderRequestSchema),
  async (c) => {
    const teamId = c.req.param('teamId');
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    if (body.userId === user.sub) {
      return errorResponse(c, 400, 'INVALID_TARGET', 'Cannot transfer leadership to yourself');
    }

    const targetMember = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, body.userId)))
      .get();

    if (!targetMember) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Target user is not a member of this team');
    }

    const now = new Date().toISOString();

    await db.batch([
      db.update(teamMembers).set({ role: 'member' }).where(
        and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)),
      ),
      db.update(teamMembers).set({ role: 'leader' }).where(
        and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, body.userId)),
      ),
    ]);

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      eventType: 'team.transfer_leader',
      entityType: 'team',
      entityId: teamId,
      metadata: { previousLeader: user.sub, newLeader: body.userId },
    });

    return successResponse(c, { transferred: true });
  },
);

/**
 * GET /:slug/teams/:teamId/commits — get commit log for team (cursor-paginated)
 */
teamsRouter.get(
  '/:slug/teams/:teamId/commits',
  requireRole('team_member'),
  async (c) => {
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

    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const cursor = c.req.query('cursor');

    let query = db
      .select()
      .from(commitLog)
      .where(eq(commitLog.team_id, teamId))
      .orderBy(sql`${commitLog.committed_at} DESC`)
      .limit(limit + 1);

    if (cursor) {
      query = db
        .select()
        .from(commitLog)
        .where(and(eq(commitLog.team_id, teamId), sql`${commitLog.committed_at} < ${cursor}`))
        .orderBy(sql`${commitLog.committed_at} DESC`)
        .limit(limit + 1);
    }

    const rows = await query.all();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && data.length > 0 ? (data[data.length - 1] as { committed_at: string }).committed_at : undefined;

    return c.json({
      ok: true,
      data,
      meta: {
        has_more: hasMore,
        next_cursor: nextCursor,
      },
    });
  },
);

export default teamsRouter;
