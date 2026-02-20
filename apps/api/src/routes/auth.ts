import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { createAuth } from '../auth.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';

const auth = new Hono<AppEnv>();

auth.use('/*', rateLimitMiddleware('auth'));

// ── POST /login ──────────────────────────────────────────────
auth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Email and password are required');
  }

  const ba = createAuth(c.env);

  // Call Better Auth's sign-in handler internally to get the session cookie
  const baRes = await ba.handler(new Request(
    `${c.env.BETTER_AUTH_URL}/api/auth/sign-in/email`,
    {
      method: 'POST',
      headers: c.req.raw.headers,
      body: JSON.stringify({ email, password }),
    }
  ));

  // Forward Set-Cookie so the browser stores the session
  const setCookie = baRes.headers.get('set-cookie');
  if (setCookie) {
    c.header('Set-Cookie', setCookie);
  }

  if (!baRes.ok) {
    return errorResponse(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const data = await baRes.json() as { user: { id: string; email: string; name: string } };

  // Update last_login_at
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), data.user.id).run()
  );

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: data.user.id,
      actor_type: 'user',
      action: 'auth.login',
      entity_type: 'user',
      entity_id: data.user.id,
    })
  );

  return successResponse(c, {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
  });
});

// ── GET /me ──────────────────────────────────────────────────
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')!;

  const adminRow = await c.env.DB.prepare(
    'SELECT id FROM platform_admins WHERE user_id = ? LIMIT 1'
  ).bind(user.id).first<{ id: string }>();
  const isPlatformAdmin = !!adminRow;

  const orgRow = await c.env.DB.prepare(
    'SELECT id FROM organizer_roles WHERE user_id = ? LIMIT 1'
  ).bind(user.id).first<{ id: string }>();
  const isOrganizer = !!orgRow;

  return successResponse(c, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      github_username: user.github_username,
      created_at: user.created_at,
    },
    roles: [],
    isPlatformAdmin,
    isOrganizer,
  });
});

// ── POST /refresh ────────────────────────────────────────────
// Better Auth uses session cookies — no manual token rotation needed.
// This endpoint exists so the web client's refresh call doesn't 404.
auth.post('/refresh', async (c) => {
  const user = c.get('user');
  if (!user) {
    return errorResponse(c, 401, 'AUTH_REQUIRED', 'No valid session');
  }
  return successResponse(c, { refreshed: true });
});

// ── POST /logout ─────────────────────────────────────────────
auth.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const ba = createAuth(c.env);

  try {
    const rawRes = await ba.handler(new Request(
      `${c.env.BETTER_AUTH_URL}/api/auth/sign-out`,
      { method: 'POST', headers: c.req.raw.headers }
    ));
    const setCookie = rawRes.headers.get('set-cookie');
    if (setCookie) {
      c.header('Set-Cookie', setCookie);
    }
  } catch {
    // Even if BA signOut fails, we still want to log and return success
  }

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.logout',
      entity_type: 'user',
      entity_id: user.id,
    })
  );

  return successResponse(c, { logged_out: true });
});

// ── GET /sessions ────────────────────────────────────────────
auth.get('/sessions', authMiddleware, async (c) => {
  const user = c.get('user')!;

  const sessions = await c.env.DB.prepare(
    `SELECT id, createdAt, expiresAt, ipAddress, userAgent
     FROM session
     WHERE userId = ? AND expiresAt > ?
     ORDER BY createdAt DESC`
  ).bind(user.id, Math.floor(Date.now() / 1000)).all<{
    id: string; createdAt: number; expiresAt: number; ipAddress: string | null; userAgent: string | null;
  }>();

  return successResponse(c, sessions.results || []);
});

// ── DELETE /sessions/:sessionId ──────────────────────────────
auth.delete('/sessions/:sessionId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('sessionId');

  const exists = await c.env.DB.prepare(
    'SELECT id FROM session WHERE id = ? AND userId = ? LIMIT 1'
  ).bind(sessionId, user.id).first();

  if (!exists) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Session not found');
  }

  await c.env.DB.prepare('DELETE FROM session WHERE id = ?').bind(sessionId).run();
  return successResponse(c, { revoked: true });
});

// ── DELETE /sessions ─────────────────────────────────────────
auth.delete('/sessions', authMiddleware, async (c) => {
  const user = c.get('user')!;
  await c.env.DB.prepare('DELETE FROM session WHERE userId = ?').bind(user.id).run();
  return successResponse(c, { revoked_all: true });
});

// ── POST /delete-account ─────────────────────────────────────
auth.post('/delete-account', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const confirmationToken = crypto.randomUUID();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO deletion_requests (id, user_id, confirmation_token) VALUES (?, ?, ?)'
  ).bind(id, user.id, confirmationToken).run();

  return successResponse(c, { confirmation_token: confirmationToken }, { status: 201 });
});

// ── POST /delete-account/confirm ─────────────────────────────
auth.post('/delete-account/confirm', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ confirmation_token: string }>();

  if (!body.confirmation_token) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Confirmation token required');
  }

  const request = await c.env.DB.prepare(
    'SELECT id FROM deletion_requests WHERE user_id = ? AND confirmation_token = ? AND status = ?'
  ).bind(user.id, body.confirmation_token, 'pending').first<{ id: string }>();

  if (!request) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Invalid or expired confirmation');
  }

  await c.env.DB.prepare(
    'UPDATE deletion_requests SET status = ?, confirmed_at = ? WHERE id = ?'
  ).bind('confirmed', new Date().toISOString(), request.id).run();

  // Sign out of Better Auth
  try {
    const ba = createAuth(c.env);
    await ba.handler(new Request(
      `${c.env.BETTER_AUTH_URL}/api/auth/sign-out`,
      { method: 'POST', headers: c.req.raw.headers }
    ));
  } catch {
    // best-effort
  }

  // Delete from BA user table
  await c.env.DB.prepare('DELETE FROM user WHERE id = ?').bind(user.id).run();

  // Delete from legacy users table (CASCADE handles related data)
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.account_deleted',
      entity_type: 'user',
      entity_id: user.id,
    })
  );

  return successResponse(c, { deleted: true });
});

export default auth;
