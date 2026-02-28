import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { insertAuditEvent } from '../lib/audit.js';
import { hashPassword } from '../lib/password.js';
import {
  createRefreshToken,
  generateFamilyId,
} from '../lib/refresh-token.js';
import { signJWT } from '../lib/jwt.js';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from '../lib/cookies.js';
import { validateBody } from '../lib/validate.js';
import { z } from 'zod';

const judgeInviteAcceptSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  password: z.string().min(8).max(128).optional(),
});

const invites = new Hono<AppEnv>();

// Accept team invite
invites.post('/team/:token', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const token = c.req.param('token');

  const invite = await c.env.DB.prepare(
    `SELECT ti.id, ti.team_id, ti.email, ti.status, ti.expires_at, t.hackathon_id
     FROM team_invites ti
     JOIN teams t ON ti.team_id = t.id
     WHERE ti.invite_token = ?`
  ).bind(token).first<{
    id: string; team_id: string; email: string; status: string;
    expires_at: string; hackathon_id: string;
  }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Invite already used');
  if (new Date(invite.expires_at) < new Date()) return errorResponse(c, 410, 'INVITE_EXPIRED', 'Invite has expired');

  // Check if already on a team
  const existing = await c.env.DB.prepare(`
    SELECT t.id FROM teams t JOIN team_members tm ON tm.team_id = t.id
    WHERE t.hackathon_id = ? AND tm.user_id = ?
  `).bind(invite.hackathon_id, user.id).first();

  if (existing) return errorResponse(c, 409, 'ALREADY_ON_TEAM', 'Already on a team');

  // Accept
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE team_invites SET status = ? WHERE id = ?').bind('accepted', invite.id),
    c.env.DB.prepare('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), invite.team_id, user.id, 'member'),
  ]);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: invite.hackathon_id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'team.invite_accepted',
      entity_type: 'team',
      entity_id: invite.team_id,
    })
  );

  return successResponse(c, { accepted: true, team_id: invite.team_id });
});

// Get judge invite details
invites.get('/judge/:id/details', async (c) => {
  const judgeId = c.req.param('id');
  const invite = await c.env.DB.prepare(
    `SELECT j.id, j.invite_status as status,
            h.title as hackathon_name, h.slug as hackathon_slug,
            u.name as inviter_name
     FROM judges j
     JOIN hackathons h ON j.hackathon_id = h.id
     LEFT JOIN users u ON j.invited_by = u.id
     WHERE j.id = ?`
  ).bind(judgeId).first();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  return successResponse(c, invite);
});

// Accept judge invite (lookup by judge id)
invites.post('/judge/:id', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const judgeId = c.req.param('id');

  const invite = await c.env.DB.prepare(
    'SELECT id, hackathon_id, user_id, invite_status FROM judges WHERE id = ?'
  ).bind(judgeId).first<{ id: string; hackathon_id: string; user_id: string | null; invite_status: string }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.invite_status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Already responded');

  await c.env.DB.prepare(
    'UPDATE judges SET user_id = ?, invite_status = ?, responded_at = ? WHERE id = ?'
  ).bind(user.id, 'accepted', new Date().toISOString(), invite.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: invite.hackathon_id,
      actor_id: user.id,
      actor_type: 'user',
      action: 'judge.invite_accepted',
      entity_type: 'judge',
      entity_id: invite.id,
    })
  );

  return successResponse(c, { accepted: true, hackathon_id: invite.hackathon_id });
});

// Decline judge invite (lookup by judge id)
invites.post('/judge/:id/decline', async (c) => {
  const judgeId = c.req.param('id');

  const invite = await c.env.DB.prepare(
    'SELECT id, invite_status FROM judges WHERE id = ?'
  ).bind(judgeId).first<{ id: string; invite_status: string }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.invite_status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Already responded');

  await c.env.DB.prepare(
    'UPDATE judges SET invite_status = ? WHERE id = ?'
  ).bind('declined', invite.id).run();

  return successResponse(c, { declined: true });
});

invites.get('/judge/token/:token', async (c) => {
  const token = c.req.param('token');

  const invite = await c.env.DB.prepare(
    `SELECT j.id, j.invite_status, j.email, j.user_id,
            h.id as hackathon_id, h.title as hackathon_name, h.slug as hackathon_slug,
            u.name as inviter_name
     FROM judges j
     JOIN hackathons h ON j.hackathon_id = h.id
     LEFT JOIN users u ON j.invited_by = u.id
     WHERE j.invite_token = ?`
  ).bind(token).first<{
    id: string;
    invite_status: string;
    email: string;
    user_id: string | null;
    hackathon_id: string;
    hackathon_name: string;
    hackathon_slug: string;
    inviter_name: string | null;
  }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.invite_status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Invite already responded');

  const userExists = invite.user_id !== null;

  return successResponse(c, {
    id: invite.id,
    hackathon_id: invite.hackathon_id,
    hackathon_name: invite.hackathon_name,
    hackathon_slug: invite.hackathon_slug,
    inviter_name: invite.inviter_name,
    email: invite.email,
    user_exists: userExists,
    status: invite.invite_status,
  });
});

invites.post('/judge/token/:token/accept', async (c) => {
  const token = c.req.param('token');
  const body = await validateBody(c, judgeInviteAcceptSchema);
  if (body instanceof Response) return body;

  const invite = await c.env.DB.prepare(
    `SELECT j.id, j.invite_status, j.email, j.user_id, j.hackathon_id
     FROM judges j
     WHERE j.invite_token = ?`
  ).bind(token).first<{
    id: string;
    invite_status: string;
    email: string;
    user_id: string | null;
    hackathon_id: string;
  }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.invite_status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Invite already responded');

  let userId = invite.user_id;
  const now = new Date().toISOString();

  if (!userId) {
    if (!body.name || !body.password) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name and password required for new account');
    }

    if (body.password.length < 8) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', 'Password must be at least 8 characters');
    }

    userId = crypto.randomUUID();
    const passwordHash = await hashPassword(body.password);

    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(userId, invite.email, body.name, passwordHash, now, now).run();

    c.executionCtx.waitUntil(
      insertAuditEvent(c.env.DB, {
        hackathon_id: invite.hackathon_id,
        actor_id: userId,
        actor_type: 'user',
        action: 'auth.signup',
        entity_type: 'user',
        entity_id: userId,
      })
    );
  }

  await c.env.DB.prepare(
    'UPDATE judges SET user_id = ?, invite_status = ?, responded_at = ? WHERE id = ?'
  ).bind(userId, 'accepted', now, invite.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: invite.hackathon_id,
      actor_id: userId,
      actor_type: 'user',
      action: 'judge.invite_accepted',
      entity_type: 'judge',
      entity_id: invite.id,
    })
  );

  const familyId = generateFamilyId();
  const refreshToken = await createRefreshToken(c.env.DB, userId, familyId);
  const jwt = await signJWT(
    {
      sub: userId,
      ghid: null,
      ghu: null,
      fam: familyId,
    },
    c.env.JWT_SECRET,
  );
  setAccessTokenCookie(c, jwt);
  setRefreshTokenCookie(c, refreshToken);

  return successResponse(c, {
    accepted: true,
    hackathon_id: invite.hackathon_id,
    user_created: invite.user_id === null,
  });
});

invites.post('/judge/token/:token/decline', async (c) => {
  const token = c.req.param('token');

  const invite = await c.env.DB.prepare(
    'SELECT id, invite_status FROM judges WHERE invite_token = ?'
  ).bind(token).first<{ id: string; invite_status: string }>();

  if (!invite) return errorResponse(c, 404, 'NOT_FOUND', 'Invite not found');
  if (invite.invite_status !== 'pending') return errorResponse(c, 409, 'INVITE_USED', 'Already responded');

  await c.env.DB.prepare(
    'UPDATE judges SET invite_status = ? WHERE id = ?'
  ).bind('declined', invite.id).run();

  return successResponse(c, { declined: true });
});

export default invites;
