import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDbClient, users, organizerRoles } from '@devsage/db';
import type { Env } from '../types/env.js';
import { clearSessionCookie, getSessionCookie, setSessionCookie } from '../lib/cookies.js';
import { signJWT, verifyJWT } from '../lib/jwt.js';
import { errorResponse, successResponse } from '../lib/response.js';
import { upsertGitHubUser, linkGoogleToUser, callbackUrl } from '../lib/user-service.js';
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

const auth = new Hono<{ Bindings: Env }>();

auth.get('/google', async (c) => {
  const state = generateOAuthState();
  const redirectUri = callbackUrl(c.req.url, 'google');

  await storeOAuthState(c.env.KV, state, {
    provider: 'google',
    redirectUri,
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
      const linkUrl = new URL('/link-required', c.env.FRONTEND_URL).toString();
      return c.redirect(linkUrl, 302);
    }

    const token = await signJWT(
      { sub: user.id, ghid: user.github_id, ghu: user.github_username },
      c.env.JWT_SECRET
    );

    setSessionCookie(c, token, c.env.FRONTEND_URL);
    const dashboardUrl = new URL('/dashboard', c.env.FRONTEND_URL).toString();
    return c.redirect(dashboardUrl, 302);
  } catch (err) {
    console.error('Google OAuth failed:', err instanceof Error ? err.message : String(err));
    return errorResponse(c, 500, 'GOOGLE_OAUTH_FAILED', 'Google authentication failed. Please try again.');
  }
});

auth.get('/github', async (c) => {
  const state = generateOAuthState();
  const redirectUri = callbackUrl(c.req.url, 'github');

  await storeOAuthState(c.env.KV, state, {
    provider: 'github',
    redirectUri,
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
    const token = await signJWT(
      { sub: user.id, ghid: user.github_id, ghu: user.github_username },
      c.env.JWT_SECRET
    );

    setSessionCookie(c, token, c.env.FRONTEND_URL);
    const dashboardUrl = new URL('/dashboard', c.env.FRONTEND_URL).toString();
    return c.redirect(dashboardUrl, 302);
  } catch (err) {
    console.error('GitHub OAuth failed:', err instanceof Error ? err.message : String(err));
    return errorResponse(c, 500, 'GITHUB_OAUTH_FAILED', 'GitHub authentication failed. Please try again.');
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

  const roles = await db
    .select({
      hackathon_id: organizerRoles.hackathon_id,
      role: organizerRoles.role,
    })
    .from(organizerRoles)
    .where(eq(organizerRoles.user_id, user.id))
    .all();

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
  });
});

auth.post('/logout', (c) => {
  clearSessionCookie(c, c.env.FRONTEND_URL);
  return successResponse(c, { message: 'Logged out' });
});

export default auth;
