import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { generateInviteCode } from '../lib/utils.js';

const teams = new Hono<AppEnv>();

// All routes need hackathon context
teams.use('/*', hackathonContext);

// Get the authenticated user's team in this hackathon
teams.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;

  const membership = await c.env.DB.prepare(`
    SELECT t.*, tm.role as my_role
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE t.hackathon_id = ? AND tm.user_id = ?
  `).bind(hackathon.id, user.id).first();

  if (!membership) {
    return errorResponse(c, 404, 'NOT_ON_TEAM', 'You are not on any team in this hackathon');
  }

  const members = await c.env.DB.prepare(`
    SELECT tm.id, tm.user_id, tm.role, tm.joined_at,
           u.name, u.email, u.image
    FROM team_members tm
    JOIN user u ON tm.user_id = u.id
    WHERE tm.team_id = ?
    ORDER BY tm.joined_at ASC
  `).bind(membership.id).all();

  return successResponse(c, {
    team: membership,
    members: members.results || [],
    role: membership.my_role,
  });
});

// Create team (any authenticated user)
teams.post('/', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;

  if (hackathon.status !== 'active' && hackathon.status !== 'draft') {
    return errorResponse(c, 409, 'INVALID_STATE', 'Hackathon is not accepting new teams');
  }

  const body = await c.req.json<{ name: string; track_id?: string }>();
  if (!body.name) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Team name is required');
  }

  // Check if user is already on a team in this hackathon
  const existingTeam = await c.env.DB.prepare(`
    SELECT t.id FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE t.hackathon_id = ? AND tm.user_id = ?
  `).bind(hackathon.id, user.id).first();

  if (existingTeam) {
    return errorResponse(c, 409, 'ALREADY_ON_TEAM', 'You are already on a team in this hackathon');
  }

  // Check max_teams limit
  const teamCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM teams WHERE hackathon_id = ?'
  ).bind(hackathon.id).first<{ count: number }>();

  const maxTeams = await c.env.DB.prepare(
    'SELECT max_teams FROM hackathons WHERE id = ?'
  ).bind(hackathon.id).first<{ max_teams: number | null }>();

  if (maxTeams?.max_teams && (teamCount?.count ?? 0) >= maxTeams.max_teams) {
    return errorResponse(c, 409, 'MAX_TEAMS_REACHED', 'Maximum number of teams reached');
  }

  const teamId = crypto.randomUUID();
  const inviteCode = generateInviteCode();
  const now = new Date().toISOString();

  // Create team
  await c.env.DB.prepare(
    `INSERT INTO teams (id, hackathon_id, name, description, invite_code, track_id, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?, ?, ?)`
  ).bind(teamId, hackathon.id, body.name, inviteCode, body.track_id ?? null, now, now).run();

  // Add creator as leader
  await c.env.DB.prepare(
    'INSERT INTO team_members (id, team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), teamId, user.id, 'leader', now).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.created',
      entity_type: 'team',
      entity_id: teamId,
      details: { name: body.name },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(teamId).first();
  return successResponse(c, created, { status: 201 });
});

// List teams in hackathon
teams.get('/', async (c) => {
  const hackathon = c.get('hackathon')!;
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = parseInt(c.req.query('offset') ?? '0');

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(
      'SELECT * FROM teams WHERE hackathon_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(hackathon.id, limit, offset).all(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM teams WHERE hackathon_id = ?'
    ).bind(hackathon.id).first<{ total: number }>(),
  ]);

  return paginatedResponse(c, rows.results || [], count?.total ?? 0, limit, offset);
});

// Get team by ID
teams.get('/:teamId', async (c) => {
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  const team = await c.env.DB.prepare(
    'SELECT * FROM teams WHERE id = ? AND hackathon_id = ?'
  ).bind(teamId, hackathon.id).first();

  if (!team) return errorResponse(c, 404, 'NOT_FOUND', 'Team not found');
  return successResponse(c, team);
});

// Get team members
teams.get('/:teamId/members', async (c) => {
  const teamId = c.req.param('teamId');

  const members = await c.env.DB.prepare(`
    SELECT tm.id, tm.user_id, tm.role, tm.joined_at,
           u.name, u.email, u.image
    FROM team_members tm
    JOIN user u ON tm.user_id = u.id
    WHERE tm.team_id = ?
    ORDER BY tm.joined_at ASC
  `).bind(teamId).all();

  return successResponse(c, members.results || []);
});

// Join team via invite code
teams.post('/join', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ invite_code: string }>();

  if (!body.invite_code) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Invite code is required');
  }

  // Find team by invite code in this hackathon
  const team = await c.env.DB.prepare(
    'SELECT id, name, hackathon_id FROM teams WHERE invite_code = ? AND hackathon_id = ?'
  ).bind(body.invite_code, hackathon.id).first<{
    id: string; name: string; hackathon_id: string;
  }>();

  if (!team) {
    return errorResponse(c, 404, 'INVALID_INVITE_CODE', 'Invalid invite code');
  }

  // Check if already on a team
  const existingTeam = await c.env.DB.prepare(`
    SELECT t.id FROM teams t
    JOIN team_members tm ON tm.team_id = t.id
    WHERE t.hackathon_id = ? AND tm.user_id = ?
  `).bind(hackathon.id, user.id).first();

  if (existingTeam) {
    return errorResponse(c, 409, 'ALREADY_ON_TEAM', 'You are already on a team');
  }

  // Check team size limit
  const memberCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM team_members WHERE team_id = ?'
  ).bind(team.id).first<{ count: number }>();

  const hackathonData = await c.env.DB.prepare(
    'SELECT max_team_size FROM hackathons WHERE id = ?'
  ).bind(hackathon.id).first<{ max_team_size: number }>();

  if ((memberCount?.count ?? 0) >= (hackathonData?.max_team_size ?? 5)) {
    return errorResponse(c, 409, 'TEAM_FULL', 'Team has reached maximum size');
  }

  // Atomic join: INSERT with guards
  const memberId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO team_members (id, team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(memberId, team.id, user.id, 'member', new Date().toISOString()).run();

  // Notify
  c.executionCtx.waitUntil(
    c.env.NOTIFICATION_QUEUE.send({
      type: 'team_joined',
      hackathon_id: hackathon.id,
      actor_id: user.id,
      data: { team_id: team.id, team_name: team.name },
    })
  );

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.member_joined',
      entity_type: 'team',
      entity_id: team.id,
    })
  );

  return successResponse(c, { joined: true, team_id: team.id }, { status: 201 });
});

// Update team (leader or co_organizer+)
teams.patch('/:teamId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  // Check permission (team lead or organizer)
  const isLead = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?'
  ).bind(teamId, user.id, 'leader').first();

  if (!isLead) {
    // Check if organizer via JWT hackathon roles
    const slug = c.get('hackathon')?.slug;
    const roles = slug ? (user.hackathonRoles[slug] || []) : [];
    const isOrg = roles.includes('organizer') || roles.includes('co_organizer');
    if (!isOrg) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Only team lead or organizers can update team');
    }
  }

  const body = await c.req.json<{ name?: string; track_id?: string | null }>();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
  if (body.track_id !== undefined) { updates.push('track_id = ?'); values.push(body.track_id); }

  if (updates.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'No valid fields to update');
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(teamId);

  await c.env.DB.prepare(
    `UPDATE teams SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(teamId).first();
  return successResponse(c, updated);
});

// Remove team member (leader or organizer)
teams.delete('/:teamId/members/:userId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');
  const targetUserId = c.req.param('userId');

  // Check permission
  const isLead = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?'
  ).bind(teamId, user.id, 'leader').first();

  if (!isLead) {
    // Check if organizer via JWT hackathon roles
    const slug = c.get('hackathon')?.slug;
    const roles = slug ? (user.hackathonRoles[slug] || []) : [];
    const isOrg = roles.includes('organizer') || roles.includes('co_organizer');
    if (!isOrg) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Only team lead or organizers can remove members');
    }
  }

  // Can't remove self as lead (must transfer first)
  if (targetUserId === user.id) {
    return errorResponse(c, 409, 'CANNOT_REMOVE_SELF', 'Transfer leadership before leaving');
  }

  await c.env.DB.prepare(
    'DELETE FROM team_members WHERE team_id = ? AND user_id = ?'
  ).bind(teamId, targetUserId).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.member_removed',
      entity_type: 'team',
      entity_id: teamId,
      details: { removed_user_id: targetUserId },
    })
  );

  return successResponse(c, { removed: true });
});

// Leave team (team member)
teams.post('/:teamId/leave', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  const membership = await c.env.DB.prepare(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).bind(teamId, user.id).first<{ role: string }>();

  if (!membership) {
    return errorResponse(c, 404, 'NOT_FOUND', 'You are not a member of this team');
  }

  if (membership.role === 'leader') {
    return errorResponse(c, 409, 'CANNOT_LEAVE_AS_LEAD', 'Transfer leadership before leaving');
  }

  await c.env.DB.prepare(
    'DELETE FROM team_members WHERE team_id = ? AND user_id = ?'
  ).bind(teamId, user.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.member_left',
      entity_type: 'team',
      entity_id: teamId,
    })
  );

  return successResponse(c, { left: true });
});

// Transfer leadership
teams.post('/:teamId/transfer', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');
  const body = await c.req.json<{ new_leader_id: string }>();

  if (!body.new_leader_id) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'new_leader_id is required');
  }

  // Verify current user is team lead
  const isLead = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?'
  ).bind(teamId, user.id, 'leader').first();

  if (!isLead) {
    return errorResponse(c, 403, 'FORBIDDEN', 'Only team lead can transfer leadership');
  }

  // Verify target is on the team
  const target = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?'
  ).bind(teamId, body.new_leader_id).first();

  if (!target) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Target user is not on this team');
  }

  // Batch: demote current lead + promote new lead
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?')
      .bind('member', teamId, user.id),
    c.env.DB.prepare('UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?')
      .bind('leader', teamId, body.new_leader_id),
  ]);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.leadership_transferred',
      entity_type: 'team',
      entity_id: teamId,
      details: { new_leader_id: body.new_leader_id },
    })
  );

  return successResponse(c, { transferred: true });
});

// Dissolve team (leader or organizer)
teams.post('/:teamId/dissolve', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const teamId = c.req.param('teamId');

  const isLead = await c.env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?'
  ).bind(teamId, user.id, 'leader').first();

  if (!isLead) {
    // Check if organizer via JWT hackathon roles
    const slug = c.get('hackathon')?.slug;
    const roles = slug ? (user.hackathonRoles[slug] || []) : [];
    const isOrg = roles.includes('organizer') || roles.includes('co_organizer');
    if (!isOrg) {
      return errorResponse(c, 403, 'FORBIDDEN', 'Only team lead or organizers can dissolve team');
    }
  }

  // Delete team members first, then the team
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(teamId),
    c.env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(teamId),
  ]);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.dissolved',
      entity_type: 'team',
      entity_id: teamId,
    })
  );

  return successResponse(c, { dissolved: true });
});

export default teams;
