import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient, users, organizerRoles, platformAdmins, workspaceMembers, workspaceInvites } from '@devsage/db';
import type { Env } from '../types/env.js';
import {
  getAccessTokenCookie,
  setAccessTokenCookie,
  clearAccessTokenCookie,
  getRefreshTokenCookie,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  clearLegacySessionCookie,
} from '../lib/cookies.js';
import { signJWT, verifyJWT } from '../lib/jwt.js';
import { errorResponse, successResponse } from '../lib/response.js';
import { upsertGitHubUser, linkGoogleToUser, callbackUrl } from '../lib/user-service.js';
import type { OAuthStateRecord } from '../lib/oauth.js';
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
} from '../lib/oauth.js';
import type { Context } from 'hono';
import type { UserIdentity } from '../lib/user-service.js';
import { isAllowedOrigin } from '../lib/allowed-origin.js';
import {
  createRefreshToken,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllUserTokens,
} from '../lib/refresh-token.js';
import type { RotateResult } from '../lib/refresh-token.js';

type AppOrigin = 'participant' | 'platform' | 'admin';

function resolveAppOrigin(frontendOrigin: string, env: Env): AppOrigin {
  if (frontendOrigin === env.ADMIN_URL) return 'admin';
  if (frontendOrigin === env.PLATFORM_URL) return 'platform';
  return 'participant';
}

function resolveFrontendOrigin(origin: string | undefined, env: Env): string {
  if (origin && isAllowedOrigin(origin)) {
    return origin;
  }
  return env.FRONTEND_URL;
}

async function isPlatformAdmin(userId: string, env: Env): Promise<boolean> {
  const db = createDbClient(env.DB);
  const admin = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.user_id, userId))
    .get();
  return !!admin;
}

async function hasAcceptedWorkspaceInvite(userId: string, env: Env): Promise<boolean> {
  const db = createDbClient(env.DB);
  const invite = await db
    .select({ id: workspaceInvites.id })
    .from(workspaceInvites)
    .where(eq(workspaceInvites.accepted_by, userId))
    .get();
  return !!invite;
}

async function checkLoginAccess(
  userId: string,
  appOrigin: AppOrigin,
  env: Env,
): Promise<{ allowed: boolean; reason?: string }> {
  if (appOrigin === 'participant') return { allowed: true };

  const isAdmin = await isPlatformAdmin(userId, env);
  if (isAdmin) return { allowed: true };

  if (appOrigin === 'admin') {
    return { allowed: false, reason: 'Platform admin access required' };
  }

  const hasInvite = await hasAcceptedWorkspaceInvite(userId, env);
  if (hasInvite) return { allowed: true };

  return { allowed: false, reason: 'Organizer access required. You need an accepted invite.' };
}

async function handleOAuthSuccess(
  c: Context<{ Bindings: Env }>,
  user: UserIdentity,
  stateRecord: OAuthStateRecord,
) {
  const frontendOrigin = stateRecord.frontendOrigin;
  const appOrigin = resolveAppOrigin(frontendOrigin, c.env);

  const access = await checkLoginAccess(user.id, appOrigin, c.env);
  if (!access.allowed) {
    const loginUrl = new URL('/login', frontendOrigin);
    loginUrl.searchParams.set('error', 'access_denied');
    loginUrl.searchParams.set('message', access.reason ?? 'Access denied');
    return c.redirect(loginUrl.toString(), 302);
  }

  const db = createDbClient(c.env.DB);
  const ipAddress = c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for');
  const userAgent = c.req.header('User-Agent');

  const refreshResult = await createRefreshToken(db, user.id, undefined, ipAddress, userAgent);

  const token = await signJWT(
    { sub: user.id, ghid: user.github_id, ghu: user.github_username, fam: refreshResult.familyId },
    c.env.JWT_SECRET,
  );

  const landingPath = appOrigin === 'admin' ? '/' : '/dashboard';
  const dashboardUrl = new URL(landingPath, frontendOrigin).toString();

  setAccessTokenCookie(c, token, frontendOrigin);
  setRefreshTokenCookie(c, refreshResult.rawToken, frontendOrigin);

  return c.redirect(dashboardUrl, 302);
}

const auth = new Hono<{ Bindings: Env }>();

auth.get('/google', async (c) => {
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
      const linkUrl = new URL('/link-required', stateRecord.frontendOrigin).toString();
      return c.redirect(linkUrl, 302);
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

auth.get('/me', async (c) => {
  try {
    const token = getAccessTokenCookie(c);
    if (!token) {
      return errorResponse(c, 401, 'NO_TOKEN', 'Unauthorized');
    }

    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload) {
      return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid or expired token');
    }

    const db = createDbClient(c.env.DB);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .get();

    if (!user) {
      return errorResponse(c, 404, 'USER_NOT_FOUND', 'User not found');
    }

    const [roles, adminRecord, workspaceMembership] = await Promise.all([
      db
        .select({
          hackathon_id: organizerRoles.hackathon_id,
          role: organizerRoles.role,
        })
        .from(organizerRoles)
        .where(eq(organizerRoles.user_id, user.id))
        .all(),
      db
        .select({ id: platformAdmins.id })
        .from(platformAdmins)
        .where(eq(platformAdmins.user_id, user.id))
        .get(),
      db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.user_id, user.id))
        .get(),
    ]);

    return successResponse(c, {
      user: {
        id: user.id,
        github_id: user.github_id,
        github_username: user.github_username,
        display_name: user.display_name,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
      roles,
      isPlatformAdmin: !!adminRecord,
      isOrganizer: !!workspaceMembership || !!adminRecord,
    });
  } catch (err) {
    console.error('/me endpoint error:', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

auth.post('/refresh', async (c) => {
  const rawToken = getRefreshTokenCookie(c);
  if (!rawToken) {
    return errorResponse(c, 401, 'NO_REFRESH_TOKEN', 'No refresh token provided');
  }

  const db = createDbClient(c.env.DB);
  const ipAddress = c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for');
  const userAgent = c.req.header('User-Agent');

  const result: RotateResult = await rotateRefreshToken(db, rawToken, ipAddress, userAgent);

  if (!result.ok) {
    const frontendUrl = resolveFrontendOrigin(c.req.header('Origin'), c.env);
    clearAccessTokenCookie(c, frontendUrl);
    clearRefreshTokenCookie(c, frontendUrl);
    return errorResponse(c, 401, result.code, 'Refresh token invalid');
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, result.userId))
    .get();

  if (!user) {
    return errorResponse(c, 401, 'USER_NOT_FOUND', 'User no longer exists');
  }

  const accessToken = await signJWT(
    { sub: user.id, ghid: user.github_id, ghu: user.github_username, fam: result.familyId },
    c.env.JWT_SECRET,
  );

  const frontendUrl = resolveFrontendOrigin(c.req.header('Origin'), c.env);
  setAccessTokenCookie(c, accessToken, frontendUrl);
  setRefreshTokenCookie(c, result.newToken.rawToken, frontendUrl);

  return successResponse(c, { message: 'Token refreshed' });
});

auth.post('/logout', async (c) => {
  const origin = c.req.header('Origin');
  const frontendUrl = resolveFrontendOrigin(origin, c.env);

  const token = getAccessTokenCookie(c);
  if (token) {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (payload?.fam) {
      const db = createDbClient(c.env.DB);
      await revokeTokenFamily(db, payload.fam);
    }
  }

  clearAccessTokenCookie(c, frontendUrl);
  clearRefreshTokenCookie(c, frontendUrl);
  clearLegacySessionCookie(c, frontendUrl);

  return successResponse(c, { message: 'Logged out' });
});

auth.post('/logout-all', async (c) => {
  const token = getAccessTokenCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Unauthorized');
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const db = createDbClient(c.env.DB);
  await revokeAllUserTokens(db, payload.sub);

  const frontendUrl = resolveFrontendOrigin(c.req.header('Origin'), c.env);
  clearAccessTokenCookie(c, frontendUrl);
  clearRefreshTokenCookie(c, frontendUrl);
  clearLegacySessionCookie(c, frontendUrl);

  return successResponse(c, { message: 'All sessions revoked' });
});

/**
 * DELETE /auth/account — Delete account (GDPR)
 * Revokes all tokens, clears cookies, and soft-deletes the user.
 */
auth.delete('/account', async (c) => {
  const token = getAccessTokenCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Unauthorized');
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const db = createDbClient(c.env.DB);

  // Revoke all sessions
  await revokeAllUserTokens(db, payload.sub);

  // Anonymize user record (GDPR soft-delete)
  const now = new Date().toISOString();
  const anonymizedEmail = `deleted_${crypto.randomUUID()}@deleted.devsage.org`;
  await db
    .update(users)
    .set({
      display_name: 'Deleted User',
      email: anonymizedEmail,
      avatar_url: null,
      github_username: `deleted_${payload.sub.slice(0, 8)}`,
      updated_at: now,
    })
    .where(eq(users.id, payload.sub));

  const frontendUrl = resolveFrontendOrigin(c.req.header('Origin'), c.env);
  clearAccessTokenCookie(c, frontendUrl);
  clearRefreshTokenCookie(c, frontendUrl);
  clearLegacySessionCookie(c, frontendUrl);

  return successResponse(c, { message: 'Account deleted' });
});

export default auth;
