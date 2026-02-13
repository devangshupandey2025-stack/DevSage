import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDbClient, users, organizerRoles, platformAdmins, organizerInvites } from '@devsage/db';
import type { Env } from '../types/env.js';
import { clearSessionCookie, getSessionCookie, setSessionCookie } from '../lib/cookies.js';
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

type AppOrigin = 'participant' | 'platform' | 'admin';

function resolveAppOrigin(frontendOrigin: string, env: Env): AppOrigin {
  if (frontendOrigin === env.ADMIN_URL) return 'admin';
  if (frontendOrigin === env.PLATFORM_URL) return 'platform';
  return 'participant';
}

function resolveFrontendOrigin(origin: string | undefined, env: Env): string {
  if (origin && [env.FRONTEND_URL, env.PLATFORM_URL, env.ADMIN_URL].includes(origin)) {
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

async function hasAcceptedOrganizerInvite(userId: string, env: Env): Promise<boolean> {
  const db = createDbClient(env.DB);
  const invite = await db
    .select({ id: organizerInvites.id })
    .from(organizerInvites)
    .where(
      and(
        eq(organizerInvites.accepted_by, userId),
        eq(organizerInvites.status, 'accepted'),
      ),
    )
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

  const hasInvite = await hasAcceptedOrganizerInvite(userId, env);
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

  const token = await signJWT(
    { sub: user.id, ghid: user.github_id, ghu: user.github_username },
    c.env.JWT_SECRET,
  );

  setSessionCookie(c, token, frontendOrigin);

  const dashboardUrl = new URL('/dashboard', frontendOrigin).toString();
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
  const token = getSessionCookie(c);
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

  const [roles, adminRecord, acceptedInvite] = await Promise.all([
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
      .select({ id: organizerInvites.id })
      .from(organizerInvites)
      .where(
        and(
          eq(organizerInvites.accepted_by, user.id),
          eq(organizerInvites.status, 'accepted'),
        ),
      )
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
    isOrganizer: !!acceptedInvite || !!adminRecord,
  });
});

auth.post('/logout', (c) => {
  clearSessionCookie(c, c.env.FRONTEND_URL);
  return successResponse(c, { message: 'Logged out' });
});

export default auth;
