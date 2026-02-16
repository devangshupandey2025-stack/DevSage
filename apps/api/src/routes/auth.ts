import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from '../types/env.js';
import { signJWT, verifyJWT } from '../lib/jwt.js';
import { createRefreshToken, rotateRefreshToken, revokeTokenFamily, revokeAllUserTokens, hashToken, generateFamilyId } from '../lib/refresh-token.js';
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from '../lib/cookies.js';
import { getGitHubAuthUrl, getGoogleAuthUrl, exchangeGitHubCode, exchangeGoogleCode, getGitHubUserInfo, getGoogleUserInfo } from '../lib/oauth.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';

const auth = new Hono<AppEnv>();

// Rate limit all auth endpoints
auth.use('/*', rateLimitMiddleware('auth'));

// GitHub OAuth
auth.get('/github', async (c) => {
  const state = crypto.randomUUID();
  const redirectUri = `${c.env.API_URL}/auth/github/callback`;

  await c.env.KV.put(`oauth:state:${state}`, 'github', { expirationTtl: 600 });

  const url = getGitHubAuthUrl(c.env.GITHUB_CLIENT_ID, state, redirectUri);
  return c.redirect(url);
});

auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=missing_params`);
  }

  // Verify state
  const storedState = await c.env.KV.get(`oauth:state:${state}`);
  if (storedState !== 'github') {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=invalid_state`);
  }
  await c.env.KV.delete(`oauth:state:${state}`);

  try {
    const accessToken = await exchangeGitHubCode(code, c.env.GITHUB_CLIENT_ID, c.env.GITHUB_CLIENT_SECRET);
    const userInfo = await getGitHubUserInfo(accessToken);

    const { user, isNew } = await findOrCreateUser(c.env.DB, {
      email: userInfo.email,
      name: userInfo.name,
      avatar_url: userInfo.avatar_url,
      github_id: userInfo.github_id,
      github_username: userInfo.github_username,
      auth_provider: 'github',
    });

    // Issue tokens
    const familyId = generateFamilyId();
    const refreshToken = await createRefreshToken(c.env.DB, user.id, familyId);
    const jwt = await signJWT({
      sub: user.id,
      ghid: user.github_id,
      ghu: user.github_username,
      fam: familyId,
    }, c.env.JWT_SECRET);

    setAccessTokenCookie(c, jwt);
    setRefreshTokenCookie(c, refreshToken);

    // Update last login
    await c.env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), user.id).run();

    // Audit
    c.executionCtx.waitUntil(
      insertAuditEvent(c.env.DB, {
        actor_id: user.id,
        actor_type: 'user',
        event_type: isNew ? 'auth.signup' : 'auth.login',
        entity_type: 'user',
        entity_id: user.id,
        metadata: { provider: 'github' },
      })
    );

    return c.redirect(`${c.env.FRONTEND_URL}/auth/callback`);
  } catch (err) {
    console.error('GitHub OAuth error:', err instanceof Error ? err.message : err);
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=oauth_failed`);
  }
});

// Google OAuth
auth.get('/google', async (c) => {
  const state = crypto.randomUUID();
  const redirectUri = `${c.env.API_URL}/auth/google/callback`;

  await c.env.KV.put(`oauth:state:${state}`, 'google', { expirationTtl: 600 });

  const url = getGoogleAuthUrl(c.env.GOOGLE_CLIENT_ID, state, redirectUri);
  return c.redirect(url);
});

auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=missing_params`);
  }

  const storedState = await c.env.KV.get(`oauth:state:${state}`);
  if (storedState !== 'google') {
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=invalid_state`);
  }
  await c.env.KV.delete(`oauth:state:${state}`);

  try {
    const redirectUri = `${c.env.API_URL}/auth/google/callback`;
    const accessToken = await exchangeGoogleCode(code, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, redirectUri);
    const userInfo = await getGoogleUserInfo(accessToken);

    const { user, isNew } = await findOrCreateUser(c.env.DB, {
      email: userInfo.email,
      name: userInfo.name,
      avatar_url: userInfo.avatar_url,
      google_id: userInfo.google_id,
      auth_provider: 'google',
    });

    const familyId = generateFamilyId();
    const refreshToken = await createRefreshToken(c.env.DB, user.id, familyId);
    const jwt = await signJWT({
      sub: user.id,
      ghid: user.github_id ?? null,
      ghu: user.github_username ?? null,
      fam: familyId,
    }, c.env.JWT_SECRET);

    setAccessTokenCookie(c, jwt);
    setRefreshTokenCookie(c, refreshToken);

    await c.env.DB.prepare(
      'UPDATE users SET last_login_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), user.id).run();

    c.executionCtx.waitUntil(
      insertAuditEvent(c.env.DB, {
        actor_id: user.id,
        actor_type: 'user',
        event_type: isNew ? 'auth.signup' : 'auth.login',
        entity_type: 'user',
        entity_id: user.id,
        metadata: { provider: 'google' },
      })
    );

    return c.redirect(`${c.env.FRONTEND_URL}/auth/callback`);
  } catch (err) {
    console.error('Google OAuth error:', err instanceof Error ? err.message : err);
    return c.redirect(`${c.env.FRONTEND_URL}/auth/error?reason=oauth_failed`);
  }
});

// Refresh token
auth.post('/refresh', async (c) => {
  const token = getCookie(c, 'refresh_token');
  if (!token) {
    return errorResponse(c, 401, 'AUTH_REQUIRED', 'No refresh token');
  }

  // Get user from current access token (may be expired but that's ok, we check refresh token)
  const accessToken = getCookie(c, 'access_token');
  let userId: string | null = null;

  if (accessToken) {
    // Try to decode even if expired — we just need the sub claim
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
    // Try to find user from refresh token hash
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

  // Get user data for new JWT
  const user = await c.env.DB.prepare(
    'SELECT id, github_id, github_username FROM users WHERE id = ?'
  ).bind(userId).first<{ id: string; github_id: number | null; github_username: string | null }>();

  if (!user) {
    clearAuthCookies(c);
    return errorResponse(c, 401, 'AUTH_REQUIRED', 'User not found');
  }

  const jwt = await signJWT({
    sub: user.id,
    ghid: user.github_id,
    ghu: user.github_username,
    fam: result.familyId,
  }, c.env.JWT_SECRET);

  setAccessTokenCookie(c, jwt);
  setRefreshTokenCookie(c, result.token);

  return successResponse(c, { refreshed: true });
});

// Logout
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

// Get current user
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')!;
  return successResponse(c, user);
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

// Helper: find or create user with account linking
async function findOrCreateUser(
  db: D1Database,
  info: {
    email: string; name: string; avatar_url: string | null;
    github_id?: number; github_username?: string;
    google_id?: string; auth_provider: 'github' | 'google';
  }
): Promise<{ user: { id: string; github_id: number | null; github_username: string | null }; isNew: boolean }> {
  // Try to find by provider-specific ID first
  let existing: { id: string; github_id: number | null; github_username: string | null } | null = null;

  if (info.github_id) {
    existing = await db.prepare(
      'SELECT id, github_id, github_username FROM users WHERE github_id = ?'
    ).bind(info.github_id).first();
  } else if (info.google_id) {
    existing = await db.prepare(
      'SELECT id, github_id, github_username FROM users WHERE google_id = ?'
    ).bind(info.google_id).first();
  }

  if (existing) {
    return { user: existing, isNew: false };
  }

  // Try to find by email (account linking)
  existing = await db.prepare(
    'SELECT id, github_id, github_username FROM users WHERE email = ?'
  ).bind(info.email).first();

  if (existing) {
    // Link additional provider
    if (info.github_id) {
      await db.prepare(
        'UPDATE users SET github_id = ?, github_username = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?'
      ).bind(info.github_id, info.github_username ?? null, info.avatar_url, existing.id).run();
      existing.github_id = info.github_id;
      existing.github_username = info.github_username ?? null;
    } else if (info.google_id) {
      await db.prepare(
        'UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?'
      ).bind(info.google_id, info.avatar_url, existing.id).run();
    }
    return { user: existing, isNew: false };
  }

  // Create new user
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO users (id, email, name, github_id, github_username, google_id, avatar_url, auth_provider)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, info.email, info.name,
    info.github_id ?? null, info.github_username ?? null,
    info.google_id ?? null, info.avatar_url,
    info.auth_provider
  ).run();

  return {
    user: { id, github_id: info.github_id ?? null, github_username: info.github_username ?? null },
    isNew: true,
  };
}

export default auth;
