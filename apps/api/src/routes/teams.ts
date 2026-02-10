import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, ne, sql } from 'drizzle-orm';
import {
  createDbClient,
  teams,
  teamMembers,
  registrations,
  hackathons as hackathonsTable,
  users,
} from '@devsage/db';
import { CreateTeamRequestSchema, JoinTeamRequestSchema } from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const teamsRouter = new Hono<AuthAppEnv>();

/**
 * Generate a random alphanumeric join code
 */
function generateJoinCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((v) => chars[v % chars.length])
    .join('');
}

// Apply auth middleware to all routes
teamsRouter.use('*', authMiddleware);

/**
 * POST /api/hackathons/:hackathonId/teams
 * Create a new team (participant only, hackathon must be REGISTRATION_OPEN or HACKING)
 */
teamsRouter.post(
  '/:hackathonId/teams',
  requireRole('participant'),
  zValidator('json', CreateTeamRequestSchema),
  async (c) => {
    const hackathonId = c.req.param('hackathonId');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    // Verify hackathon exists
    const hackathon = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, hackathonId))
      .get();

    if (!hackathon) {
      return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
    }

    // Check hackathon status allows team creation
    if (hackathon.status !== 'registration_open' && hackathon.status !== 'active') {
      return c.json(
        {
          error: 'Team creation not allowed in current hackathon status',
          code: 'INVALID_HACKATHON_STATUS',
        },
        400
      );
    }

    // Verify user is registered for this hackathon
    const registration = await db
      .select()
      .from(registrations)
      .where(
        and(eq(registrations.hackathon_id, hackathonId), eq(registrations.user_id, user.sub))
      )
      .get();

    if (!registration) {
      return c.json(
        { error: 'Not registered for this hackathon', code: 'NOT_REGISTERED' },
        403
      );
    }

    // Check if user is already on a team for this hackathon
    const existingMembership = await db
      .select({ teamId: teamMembers.team_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(and(eq(teams.hackathon_id, hackathonId), eq(teamMembers.user_id, user.sub)))
      .get();

    if (existingMembership) {
      return c.json(
        { error: 'Already on a team for this hackathon', code: 'ALREADY_ON_TEAM' },
        409
      );
    }

    // Generate unique join code (retry up to 5 times if collision)
    let joinCode: string | null = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts && !joinCode) {
      const candidate = generateJoinCode(8);
      const existing = await db
        .select()
        .from(teams)
        .where(eq(teams.join_code, candidate))
        .get();

      if (!existing) {
        joinCode = candidate;
      }
      attempts++;
    }

    if (!joinCode) {
      return c.json(
        { error: 'Failed to generate unique join code', code: 'JOIN_CODE_GENERATION_FAILED' },
        500
      );
    }

    // Create team and add creator as member atomically
    const teamId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await db.batch([
        db.insert(teams).values({
          id: teamId,
          hackathon_id: hackathonId,
          name: body.name,
          join_code: joinCode,
          captain_id: user.sub,
          created_at: now,
        }),
        db.insert(teamMembers).values({
          team_id: teamId,
          user_id: user.sub,
          joined_at: now,
        }),
      ]);
    } catch (error) {
      // Handle potential race conditions or constraint violations
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return c.json(
          { error: 'Team creation failed due to constraint violation', code: 'CONSTRAINT_VIOLATION' },
          409
        );
      }
      throw error;
    }

    // Fetch created team
    const createdTeam = await db.select().from(teams).where(eq(teams.id, teamId)).get();

    return c.json(createdTeam, 201);
  }
);

/**
 * POST /api/hackathons/:hackathonId/teams/join
 * Join a team by join code (participant only)
 */
teamsRouter.post(
  '/:hackathonId/teams/join',
  requireRole('participant'),
  zValidator('json', JoinTeamRequestSchema),
  async (c) => {
    const hackathonId = c.req.param('hackathonId');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    // Verify hackathon exists
    const hackathon = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, hackathonId))
      .get();

    if (!hackathon) {
      return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
    }

    // Check hackathon status allows team joining
    if (hackathon.status !== 'registration_open' && hackathon.status !== 'active') {
      return c.json(
        {
          error: 'Team joining not allowed in current hackathon status',
          code: 'INVALID_HACKATHON_STATUS',
        },
        400
      );
    }

    // Verify user is registered for this hackathon
    const registration = await db
      .select()
      .from(registrations)
      .where(
        and(eq(registrations.hackathon_id, hackathonId), eq(registrations.user_id, user.sub))
      )
      .get();

    if (!registration) {
      return c.json(
        { error: 'Not registered for this hackathon', code: 'NOT_REGISTERED' },
        403
      );
    }

    // Check if user is already on a team for this hackathon
    const existingMembership = await db
      .select({ teamId: teamMembers.team_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(and(eq(teams.hackathon_id, hackathonId), eq(teamMembers.user_id, user.sub)))
      .get();

    if (existingMembership) {
      return c.json(
        { error: 'Already on a team for this hackathon', code: 'ALREADY_ON_TEAM' },
        409
      );
    }

    // Find team by join code and verify it belongs to this hackathon
    const team = await db
      .select()
      .from(teams)
      .where(and(eq(teams.join_code, body.joinCode), eq(teams.hackathon_id, hackathonId)))
      .get();

    if (!team) {
      return c.json({ error: 'Invalid join code', code: 'INVALID_JOIN_CODE' }, 404);
    }

    // Check team size limit
    const currentSizeResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.team_id, team.id))
      .get();

    const currentSize = currentSizeResult?.count ?? 0;

    if (currentSize >= hackathon.max_team_size) {
      return c.json({ error: 'Team is full', code: 'TEAM_FULL' }, 409);
    }

    // Add user to team
    try {
      await db.insert(teamMembers).values({
        team_id: team.id,
        user_id: user.sub,
        joined_at: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return c.json(
          { error: 'Already a member of this team', code: 'DUPLICATE_MEMBERSHIP' },
          409
        );
      }
      throw error;
    }

    // Return team data
    return c.json(team, 200);
  }
);

/**
 * POST /api/hackathons/:hackathonId/teams/:teamId/leave
 * Leave a team (participant only)
 */
teamsRouter.post('/:hackathonId/teams/:teamId/leave', requireRole('participant'), async (c) => {
  const hackathonId = c.req.param('hackathonId');
  const teamId = c.req.param('teamId');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  // Verify team exists and belongs to this hackathon
  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathonId)))
    .get();

  if (!team) {
    return c.json({ error: 'Team not found', code: 'NOT_FOUND' }, 404);
  }

  // Verify user is a member of this team
  const membership = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)))
    .get();

  if (!membership) {
    return c.json({ error: 'Not a member of this team', code: 'NOT_MEMBER' }, 403);
  }

  // Check if user is captain
  const isCaptain = team.captain_id === user.sub;

  if (isCaptain) {
    // Get other members
    const otherMembers = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), ne(teamMembers.user_id, user.sub)))
      .all();

    if (otherMembers.length > 0) {
      // Assign first other member as new captain
      await db
        .update(teams)
        .set({ captain_id: otherMembers[0].user_id })
        .where(eq(teams.id, teamId));

      // Remove leaving captain from team
      await db
        .delete(teamMembers)
        .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)));
    } else {
      // Last member leaving - delete team (will cascade to team_members via FK)
      await db.delete(teams).where(eq(teams.id, teamId));
    }
  } else {
    // Non-captain leaving - just remove from team
    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)));
  }

  return c.json({ message: 'Successfully left team' }, 200);
});

/**
 * GET /api/hackathons/:hackathonId/teams
 * List teams for a hackathon (role-aware visibility)
 */
teamsRouter.get('/:hackathonId/teams', async (c) => {
  const hackathonId = c.req.param('hackathonId');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  // Verify hackathon exists
  const hackathon = await db
    .select()
    .from(hackathonsTable)
    .where(eq(hackathonsTable.id, hackathonId))
    .get();

  if (!hackathon) {
    return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
  }

  // Get all teams for this hackathon
  const allTeams = await db.select().from(teams).where(eq(teams.hackathon_id, hackathonId)).all();

  if (user.role === 'organizer') {
    // Check if user is the organizer of this hackathon
    if (hackathon.organizer_id !== user.sub) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }

    // Organiser sees all teams with member counts
    const teamsWithCounts = await Promise.all(
      allTeams.map(async (team) => {
        const countResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(teamMembers)
          .where(eq(teamMembers.team_id, team.id))
          .get();

        return {
          ...team,
          memberCount: countResult?.count ?? 0,
        };
      })
    );

    return c.json({ data: teamsWithCounts, total: teamsWithCounts.length });
  } else {
    // Participant: Find their team if they have one
    const userTeamMembership = await db
      .select({ teamId: teamMembers.team_id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.team_id))
      .where(and(eq(teams.hackathon_id, hackathonId), eq(teamMembers.user_id, user.sub)))
      .get();

    // Return basic team info for all teams, but full details only for user's team
    const teamsData = allTeams.map((team) => {
      const isUserTeam = userTeamMembership?.teamId === team.id;
      if (isUserTeam) {
        // Return full team details for user's team
        return team;
      } else {
        // Return only name for other teams (hide join code)
        return {
          id: team.id,
          name: team.name,
          hackathonId: team.hackathon_id,
        };
      }
    });

    return c.json({ data: teamsData, total: teamsData.length });
  }
});

/**
 * GET /api/hackathons/:hackathonId/teams/:teamId
 * Get team details with all members (team members or organizer only)
 */
teamsRouter.get('/:hackathonId/teams/:teamId', async (c) => {
  const hackathonId = c.req.param('hackathonId');
  const teamId = c.req.param('teamId');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  // Verify team exists and belongs to this hackathon
  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathonId)))
    .get();

  if (!team) {
    return c.json({ error: 'Team not found', code: 'NOT_FOUND' }, 404);
  }

  // Verify hackathon exists
  const hackathon = await db
    .select()
    .from(hackathonsTable)
    .where(eq(hackathonsTable.id, hackathonId))
    .get();

  if (!hackathon) {
    return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
  }

  // Check authorization: must be team member or hackathon organizer
  const isMember = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, user.sub)))
    .get();

  const isOrganiser = user.role === 'organizer' && hackathon.organizer_id === user.sub;

  if (!isMember && !isOrganiser) {
    return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
  }

  // Fetch all team members with user details
  const teamMembersData = await db
    .select({
      userId: teamMembers.user_id,
      joinedAt: teamMembers.joined_at,
      name: users.name,
      email: users.email,
      avatar: users.avatar_url,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.user_id))
    .where(eq(teamMembers.team_id, teamId))
    .all();

  return c.json({
    ...team,
    members: teamMembersData,
  });
});

export default teamsRouter;
