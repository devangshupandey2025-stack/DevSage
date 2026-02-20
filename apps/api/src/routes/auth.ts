import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { createAuth } from '../auth.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';

const auth = new Hono<AppEnv>();

auth.use('/*', rateLimitMiddleware('auth'));

// ── /me — role-enriched user info ──────────────────────────────
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

// ── /logout — sign out via Better Auth + audit ────────────────
auth.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const ba = createAuth(c.env);

  try {
    // Revoke the session server-side; BA's signOut returns { success: boolean }.
    // We also call the handler directly to get Set-Cookie clearing headers.
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

// ── /delete-account — request account deletion ────────────────
auth.post('/delete-account', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const confirmationToken = crypto.randomUUID();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO deletion_requests (id, user_id, confirmation_token) VALUES (?, ?, ?)'
  ).bind(id, user.id, confirmationToken).run();

  return successResponse(c, { confirmation_token: confirmationToken }, { status: 201 });
});

// ── /delete-account/confirm — confirm deletion ────────────────
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

  // Mark as confirmed
  await c.env.DB.prepare(
    'UPDATE deletion_requests SET status = ?, confirmed_at = ? WHERE id = ?'
  ).bind('confirmed', new Date().toISOString(), request.id).run();

  // Sign out of Better Auth
  try {
    await createAuth(c.env).api.signOut({ headers: c.req.raw.headers });
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
