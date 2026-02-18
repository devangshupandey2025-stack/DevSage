import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types/env.js';
import { signJWT, verifyJWT } from '../lib/jwt.js';
import { createRefreshToken, rotateRefreshToken, revokeTokenFamily, revokeAllUserTokens, hashToken, generateFamilyId } from '../lib/refresh-token.js';
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from '../lib/cookies.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';

const auth = new Hono<AppEnv>();

auth.use('/*', rateLimitMiddleware('auth'));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

auth.post('/register', async (c) => {
  const body = await c.req.json<{ email?: string; name?: string; password?: string }>();

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const password = body.password;

  if (!email || !EMAIL_REGEX.test(email)) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Valid email is required');
  }
  if (!name || name.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name is required');
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first<{ id: string }>();

  if (existing) {
    return errorResponse(c, 409, 'CONFLICT', 'Email already registered');
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)'
  ).bind(id, email, name, passwordHash).run();

  const familyId = generateFamilyId();
  const refreshToken = await createRefreshToken(c.env.DB, id, familyId);
  const jwt = await signJWT({ sub: id, fam: familyId }, c.env.JWT_SECRET);

  setAccessTokenCookie(c, jwt);
  setRefreshTokenCookie(c, refreshToken);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: id,
      actor_type: 'user',
      event_type: 'auth.signup',
      entity_type: 'user',
      entity_id: id,
    })
  );

  return successResponse(c, { id, email, name }, { status: 201 });
});

auth.post('/login', async (c) => {
  try {
    const body = await c.req.json<{ email?: string; password?: string }>();

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', 'Email and password are required');
    }

    const user = await c.env.DB.prepare(
      'SELECT id, email, name, password_hash, avatar_url FROM users WHERE email = ?'
    ).bind(email).first<{ id: string; email: string; name: string; password_hash: string; avatar_url: string | null }>();

    if (!user) {
      return errorResponse(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const familyId = generateFamilyId();
    const refreshToken = await createRefreshToken(c.env.DB, user.id, familyId);
    const jwt = await signJWT({ sub: user.id, fam: familyId }, c.env.JWT_SECRET);

    setAccessTokenCookie(c, jwt);
    setRefreshTokenCookie(c, refreshToken);

    await c.env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), user.id).run();

    c.executionCtx.waitUntil(
      insertAuditEvent(c.env.DB, {
        actor_id: user.id,
        actor_type: 'user',
        event_type: 'auth.login',
        entity_type: 'user',
        entity_id: user.id,
      })
    );

    return successResponse(c, { id: user.id, email: user.email, name: user.name });
  } catch (err) {
    console.error('Login handler error:', err);

    const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development'
      || Boolean((c as any).env && (c as any).env.JWT_SECRET && (c as any).env.JWT_SECRET.startsWith('dev'));

    if (isDev) {
      return errorResponse(c, 500, 'INTERNAL_ERROR', err instanceof Error ? err.message : String(err), { details: err?.stack ?? String(err) });
    }

    return errorResponse(c, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});

auth.post('/refresh', async (c) => {
  const token = getCookie(c, 'refresh_token');
  if (!token) {
    return errorResponse(c, 401, 'AUTH_REQUIRED', 'No refresh token');
  }

  const accessToken = getCookie(c, 'access_token');
  let userId: string | null = null;

  if (accessToken) {
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadStr);
        userId = payload.sub;
      }
    } catch {
      // Ignore decode errors
    }
  }

  if (!userId) {
    const tokenHash = await hashToken(token);
    const record = await c.env.DB.prepare(
      'SELECT user_id FROM refresh_tokens WHERE token_hash = ?'
    ).bind(tokenHash).first<{ user_id: string }>();
    if (!record) {
      clearAuthCookies(c);
      return errorResponse(c, 401, 'AUTH_REQUIRED', 'Invalid refresh token');
    }
    userId = record.user_id;
  }

  const result = await rotateRefreshToken(c.env.DB, token, userId);
  if (!result) {
    clearAuthCookies(c);
    return errorResponse(c, 401, 'TOKEN_EXPIRED', 'Refresh token expired or revoked');
  }

  const user = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string }>();

  if (!user) {
    clearAuthCookies(c);
    return errorResponse(c, 401, 'AUTH_REQUIRED', 'User not found');
  }

  const jwt = await signJWT({
    sub: user.id,
    fam: result.familyId,
  }, c.env.JWT_SECRET);

  setAccessTokenCookie(c, jwt);
  setRefreshTokenCookie(c, result.token);

  return successResponse(c, { refreshed: true });
});

auth.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const accessToken = getCookie(c, 'access_token');

  if (accessToken) {
    const payload = await verifyJWT(accessToken, c.env.JWT_SECRET);
    if (payload) {
      await revokeTokenFamily(c.env.DB, payload.fam);
    }
  }

  clearAuthCookies(c);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      event_type: 'auth.logout',
      entity_type: 'user',
      entity_id: user.id,
    })
  );

  return successResponse(c, { logged_out: true });
});

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
      created_at: user.created_at,
    },
    roles: [],
    isPlatformAdmin,
    isOrganizer,
  });
});

// List sessions
auth.get('/sessions', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const sessions = await c.env.DB.prepare(
    `SELECT family_id, created_at, expires_at
     FROM refresh_tokens
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
     GROUP BY family_id
     ORDER BY created_at DESC`
  ).bind(user.id, new Date().toISOString()).all<{
    family_id: string; created_at: string; expires_at: string;
  }>();

  return successResponse(c, sessions.results || []);
});

// Revoke specific session
auth.delete('/sessions/:familyId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const familyId = c.req.param('familyId');

  // Verify this family belongs to the user
  const exists = await c.env.DB.prepare(
    'SELECT id FROM refresh_tokens WHERE family_id = ? AND user_id = ? LIMIT 1'
  ).bind(familyId, user.id).first();

  if (!exists) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Session not found');
  }

  await revokeTokenFamily(c.env.DB, familyId);
  return successResponse(c, { revoked: true });
});

// Revoke all sessions
auth.delete('/sessions', authMiddleware, async (c) => {
  const user = c.get('user')!;
  await revokeAllUserTokens(c.env.DB, user.id);
  clearAuthCookies(c);
  return successResponse(c, { revoked_all: true });
});

// Request account deletion
auth.post('/delete-account', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const confirmationToken = crypto.randomUUID();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO deletion_requests (id, user_id, confirmation_token) VALUES (?, ?, ?)'
  ).bind(id, user.id, confirmationToken).run();

  // In production: send confirmation email
  // For now, return the token directly
  return successResponse(c, { confirmation_token: confirmationToken }, { status: 201 });
});

// Confirm account deletion
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

  // Revoke all tokens
  await revokeAllUserTokens(c.env.DB, user.id);
  clearAuthCookies(c);

  // Delete user (CASCADE handles related data)
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      event_type: 'auth.account_deleted',
      entity_type: 'user',
      entity_id: user.id,
    })
  );

  return successResponse(c, { deleted: true });
});

export default auth;
