import { Hono, type Context } from 'hono';
import type { AppEnv } from '../types/env.js';
import { signJWT, verifyJWT } from '../lib/jwt.js';
import {
  createRefreshToken,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllUserTokens,
  hashToken,
  generateFamilyId,
} from '../lib/refresh-token.js';
import {
  getAccessTokenCookie,
  getRefreshTokenCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} from '../lib/cookies.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import {
  buildGitHubAuthorizationUrl,
  buildGoogleAuthorizationUrl,
  consumeOAuthState,
  exchangeGitHubCodeForToken,
  exchangeGoogleCodeForToken,
  fetchGitHubUserProfile,
  fetchGoogleUserProfile,
  generateOAuthState,
  storeOAuthState,
  type OAuthStateRecord,
} from '../lib/oauth.js';
import { callbackUrl, linkGoogleToUser, upsertGitHubUser, type UserIdentity } from '../lib/user-service.js';

const auth = new Hono<AppEnv>();
auth.use('/*', rateLimitMiddleware('auth'));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type AppOrigin = 'participant' | 'platform' | 'admin' | 'judge';

function resolveAppOrigin(frontendOrigin: string, env: AppEnv['Bindings']): AppOrigin {
  if (frontendOrigin === env.ADMIN_URL) return 'admin';
  if (frontendOrigin === env.PLATFORM_URL) return 'platform';
  if (frontendOrigin === env.JUDGE_URL) return 'judge';
  return 'participant';
}

function resolveFrontendOrigin(origin: string | undefined, env: AppEnv['Bindings']): string {
  const allowed = [env.FRONTEND_URL, env.PLATFORM_URL, env.ADMIN_URL, env.JUDGE_URL];
  if (origin && allowed.includes(origin)) return origin;
  return env.FRONTEND_URL;
}

async function isPlatformAdmin(userId: string, db: D1Database): Promise<boolean> {
  const row = await db.prepare(
    'SELECT id FROM platform_admins WHERE user_id = ? LIMIT 1',
  ).bind(userId).first<{ id: string }>();
  return !!row;
}

async function checkLoginAccess(
  userId: string,
  appOrigin: AppOrigin,
  db: D1Database,
): Promise<{ allowed: boolean; reason?: string }> {
  if (appOrigin === 'participant') return { allowed: true };

  const admin = await isPlatformAdmin(userId, db);
  if (admin) return { allowed: true };

  if (appOrigin === 'admin') {
    return { allowed: false, reason: 'Platform admin access required' };
  }

  if (appOrigin === 'judge') {
    const judge = await db.prepare(
      `SELECT id FROM judges
       WHERE user_id = ? AND invite_status = 'accepted'
       LIMIT 1`,
    ).bind(userId).first<{ id: string }>();
    if (judge) return { allowed: true };
    return { allowed: false, reason: 'Judge access required' };
  }

  const workspaceAccess = await db.prepare(
    `SELECT id FROM workspace_members WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first<{ id: string }>();

  if (workspaceAccess) return { allowed: true };
  return { allowed: false, reason: 'Organizer access required. You need an accepted invite.' };
}

async function issueSessionCookies(c: Context<AppEnv>, user: UserIdentity): Promise<void> {
  const familyId = generateFamilyId();
  const refreshToken = await createRefreshToken(c.env.DB, user.id, familyId);
  const jwt = await signJWT(
    {
      sub: user.id,
      ghid: user.github_id ?? null,
      ghu: user.github_username ?? null,
      fam: familyId,
    },
    c.env.JWT_SECRET,
  );
  setAccessTokenCookie(c, jwt);
  setRefreshTokenCookie(c, refreshToken);
}

async function handleOAuthSuccess(
  c: Context<AppEnv>,
  user: UserIdentity,
  stateRecord: OAuthStateRecord,
) {
  const frontendOrigin = stateRecord.frontendOrigin;
  const appOrigin = resolveAppOrigin(frontendOrigin, c.env);

  const access = await checkLoginAccess(user.id, appOrigin, c.env.DB);
  if (!access.allowed) {
    const loginUrl = new URL('/login', frontendOrigin);
    loginUrl.searchParams.set('error', 'access_denied');
    loginUrl.searchParams.set('message', access.reason ?? 'Access denied');
    return c.redirect(loginUrl.toString(), 302);
  }

  await issueSessionCookies(c, user);

  const landingPath = appOrigin === 'admin' ? '/' : '/dashboard';
  return c.redirect(new URL(landingPath, frontendOrigin).toString(), 302);
}

auth.post('/register', async (c) => {
  const body = await c.req.json<{ email?: string; name?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const password = body.password;

  if (!email || !EMAIL_REGEX.test(email)) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Valid email is required');
  }
  if (!name) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Name is required');
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
  ).bind(email).first<{ id: string }>();
  if (existing) {
    return errorResponse(c, 409, 'CONFLICT', 'Email already registered');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(id, email, name, passwordHash, now, now).run();

  await issueSessionCookies(c, { id, github_id: null, github_username: null });

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: id,
      actor_type: 'user',
      action: 'auth.signup',
      entity_type: 'user',
      entity_id: id,
    }),
  );

  return successResponse(c, { id, email, name }, { status: 201 });
});

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Email and password are required');
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email, name, password_hash, avatar_url, github_id, github_username
     FROM users
     WHERE email = ?
     LIMIT 1`,
  ).bind(email).first<{
    id: string;
    email: string;
    name: string | null;
    password_hash: string | null;
    avatar_url: string | null;
    github_id: number | null;
    github_username: string | null;
  }>();

  if (!user || !user.password_hash) {
    return errorResponse(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return errorResponse(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const frontendOrigin = resolveFrontendOrigin(c.req.header('Origin'), c.env);
  const appOrigin = resolveAppOrigin(frontendOrigin, c.env);
  const access = await checkLoginAccess(user.id, appOrigin, c.env.DB);
  if (!access.allowed) {
    return errorResponse(c, 403, 'ACCESS_DENIED', access.reason ?? 'Access denied');
  }

  await issueSessionCookies(c, {
    id: user.id,
    github_id: user.github_id,
    github_username: user.github_username,
  });

  await c.env.DB.prepare(
    'UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?',
  ).bind(new Date().toISOString(), new Date().toISOString(), user.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.login',
      entity_type: 'user',
      entity_id: user.id,
    }),
  );

  return successResponse(c, {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    avatar_url: user.avatar_url,
  });
});

auth.get('/google', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return errorResponse(c, 500, 'AUTH_MISCONFIGURED', 'Google OAuth is not configured');
  }

  const state = generateOAuthState();
  const redirectUri = callbackUrl(c.req.url, 'google');
  const frontendOrigin = resolveFrontendOrigin(c.req.query('origin'), c.env);

  await storeOAuthState(c.env.KV, state, {
    provider: 'google',
    redirectUri,
    frontendOrigin,
    createdAt: new Date().toISOString(),
  });

  const url = buildGoogleAuthorizationUrl(c.env.GOOGLE_CLIENT_ID, redirectUri, state);
  return c.redirect(url, 302);
});

auth.get('/callback/google', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) {
    return errorResponse(c, 400, 'MISSING_OAUTH_PARAMS', 'Missing OAuth params');
  }

  const stateRecord = await consumeOAuthState(c.env.KV, state);
  if (!stateRecord || stateRecord.provider !== 'google') {
    return errorResponse(c, 400, 'INVALID_OAUTH_STATE', 'Invalid OAuth state');
  }

  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return errorResponse(c, 500, 'AUTH_MISCONFIGURED', 'Google OAuth is not configured');
  }

  try {
    const accessToken = await exchangeGoogleCodeForToken({
      code,
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri: stateRecord.redirectUri,
    });
    const profile = await fetchGoogleUserProfile(accessToken);
    const user = await linkGoogleToUser(c.env, profile);
    if (!user) {
      return c.redirect(new URL('/link-required', stateRecord.frontendOrigin).toString(), 302);
    }
    return handleOAuthSuccess(c, user, stateRecord);
  } catch (err) {
    console.error('Google OAuth failed:', err instanceof Error ? err.message : String(err));
    const loginUrl = new URL('/login', stateRecord.frontendOrigin);
    loginUrl.searchParams.set('error', 'oauth_failed');
    return c.redirect(loginUrl.toString(), 302);
  }
});

auth.get('/github', async (c) => {
  if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
    return errorResponse(c, 500, 'AUTH_MISCONFIGURED', 'GitHub OAuth is not configured');
  }

  const state = generateOAuthState();
  const redirectUri = callbackUrl(c.req.url, 'github');
  const frontendOrigin = resolveFrontendOrigin(c.req.query('origin'), c.env);

  await storeOAuthState(c.env.KV, state, {
    provider: 'github',
    redirectUri,
    frontendOrigin,
    createdAt: new Date().toISOString(),
  });

  const url = buildGitHubAuthorizationUrl(c.env.GITHUB_CLIENT_ID, redirectUri, state);
  return c.redirect(url, 302);
});

auth.get('/callback/github', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) {
    return errorResponse(c, 400, 'MISSING_OAUTH_PARAMS', 'Missing OAuth params');
  }

  const stateRecord = await consumeOAuthState(c.env.KV, state);
  if (!stateRecord || stateRecord.provider !== 'github') {
    return errorResponse(c, 400, 'INVALID_OAUTH_STATE', 'Invalid OAuth state');
  }

  if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
    return errorResponse(c, 500, 'AUTH_MISCONFIGURED', 'GitHub OAuth is not configured');
  }

  try {
    const accessToken = await exchangeGitHubCodeForToken({
      code,
      clientId: c.env.GITHUB_CLIENT_ID,
      clientSecret: c.env.GITHUB_CLIENT_SECRET,
      redirectUri: stateRecord.redirectUri,
    });
    const profile = await fetchGitHubUserProfile(accessToken);
    const user = await upsertGitHubUser(c.env, profile);
    return handleOAuthSuccess(c, user, stateRecord);
  } catch (err) {
    console.error('GitHub OAuth failed:', err instanceof Error ? err.message : String(err));
    const loginUrl = new URL('/login', stateRecord.frontendOrigin);
    loginUrl.searchParams.set('error', 'oauth_failed');
    return c.redirect(loginUrl.toString(), 302);
  }
});

auth.post('/refresh', async (c) => {
  const token = getRefreshTokenCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'AUTH_REQUIRED', 'No refresh token');
  }

  const accessToken = getAccessTokenCookie(c);
  let userId: string | null = null;

  if (accessToken) {
    const payload = await verifyJWT(accessToken, c.env.JWT_SECRET);
    userId = payload?.sub ?? null;
  }

  if (!userId) {
    const tokenHash = await hashToken(token);
    const record = await c.env.DB.prepare(
      'SELECT user_id FROM refresh_tokens WHERE token_hash = ? LIMIT 1',
    ).bind(tokenHash).first<{ user_id: string }>();
    if (!record) {
      clearAuthCookies(c);
      return errorResponse(c, 401, 'AUTH_REQUIRED', 'Invalid refresh token');
    }
    userId = record.user_id;
  }

  const rotated = await rotateRefreshToken(c.env.DB, token, userId);
  if (!rotated) {
    clearAuthCookies(c);
    return errorResponse(c, 401, 'TOKEN_EXPIRED', 'Refresh token expired or revoked');
  }

  const user = await c.env.DB.prepare(
    `SELECT id, github_id, github_username
     FROM users
     WHERE id = ?
     LIMIT 1`,
  ).bind(userId).first<UserIdentity>();
  if (!user) {
    clearAuthCookies(c);
    return errorResponse(c, 401, 'AUTH_REQUIRED', 'User not found');
  }

  const jwt = await signJWT(
    { sub: user.id, ghid: user.github_id ?? null, ghu: user.github_username ?? null, fam: rotated.familyId },
    c.env.JWT_SECRET,
  );
  setAccessTokenCookie(c, jwt);
  setRefreshTokenCookie(c, rotated.token);

  return successResponse(c, { refreshed: true });
});

auth.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const token = getAccessTokenCookie(c);
  if (token) {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (payload?.fam) {
      await revokeTokenFamily(c.env.DB, payload.fam);
    }
  }

  clearAuthCookies(c);
  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.logout',
      entity_type: 'user',
      entity_id: user.id,
    }),
  );

  return successResponse(c, { logged_out: true });
});

auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathonRoles = user.hackathonRoles;
  const workspaceRoles = user.workspaceRoles;
  const roleLists = Object.values(hackathonRoles);
  const isOrganizer = roleLists.some((roles) => roles.includes('organizer') || roles.includes('co_organizer'))
    || Object.values(workspaceRoles).some((role) => role === 'owner' || role === 'admin');
  const isJudge = roleLists.some((roles) => roles.includes('judge'));

  return successResponse(c, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
    isPlatformAdmin: user.platformAdmin,
    isOrganizer,
    isJudge,
    hackathonRoles,
    workspaceRoles,
  });
});

auth.get('/sessions', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const sessions = await c.env.DB.prepare(
    `SELECT family_id, created_at, expires_at
     FROM refresh_tokens
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
     GROUP BY family_id
     ORDER BY created_at DESC`,
  ).bind(user.id, new Date().toISOString()).all<{
    family_id: string;
    created_at: string;
    expires_at: string;
  }>();
  return successResponse(c, sessions.results || []);
});

auth.delete('/sessions/:familyId', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const familyId = c.req.param('familyId');
  const exists = await c.env.DB.prepare(
    'SELECT id FROM refresh_tokens WHERE family_id = ? AND user_id = ? LIMIT 1',
  ).bind(familyId, user.id).first<{ id: string }>();

  if (!exists) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Session not found');
  }

  await revokeTokenFamily(c.env.DB, familyId);
  return successResponse(c, { revoked: true });
});

auth.delete('/sessions', authMiddleware, async (c) => {
  const user = c.get('user')!;
  await revokeAllUserTokens(c.env.DB, user.id);
  clearAuthCookies(c);
  return successResponse(c, { revoked_all: true });
});

auth.post('/delete-account', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const confirmationToken = crypto.randomUUID();
  const requestId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO deletion_requests (id, user_id, confirmation_token, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`,
  ).bind(requestId, user.id, confirmationToken, new Date().toISOString()).run();

  return successResponse(c, { confirmation_token: confirmationToken }, { status: 201 });
});

auth.post('/delete-account/confirm', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ confirmation_token?: string }>();
  if (!body.confirmation_token) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Confirmation token required');
  }

  const request = await c.env.DB.prepare(
    `SELECT id
     FROM deletion_requests
     WHERE user_id = ? AND confirmation_token = ? AND status = 'pending'
     LIMIT 1`,
  ).bind(user.id, body.confirmation_token).first<{ id: string }>();

  if (!request) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Invalid or expired confirmation');
  }

  await c.env.DB.prepare(
    `UPDATE deletion_requests
     SET status = 'confirmed', confirmed_at = ?
     WHERE id = ?`,
  ).bind(new Date().toISOString(), request.id).run();

  await revokeAllUserTokens(c.env.DB, user.id);
  clearAuthCookies(c);
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      actor_id: user.id,
      actor_type: 'user',
      action: 'auth.account_deleted',
      entity_type: 'user',
      entity_id: user.id,
    }),
  );

  return successResponse(c, { deleted: true });
});

export default auth;
