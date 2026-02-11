import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { createDbClient, users } from '@devsage/db';
import type { Env } from '../types/env.js';
import { clearSessionCookie, getSessionCookie, setSessionCookie } from '../lib/cookies.js';
import { signJWT, verifyJWT } from '../lib/jwt.js';
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

async function upsertOAuthUser(c: { env: Env }, user: {
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: 'google' | 'github';
  providerId: string;
}) {
  const db = createDbClient(c.env.DB);
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.email, user.email), eq(users.provider, user.provider)))
    .get();

  if (existing) {
    await db
      .update(users)
      .set({
        name: user.name,
        avatar_url: user.avatarUrl,
        provider_id: user.providerId,
        updated_at: now,
      })
      .where(eq(users.id, existing.id));

    return {
      id: existing.id,
      email: user.email,
      role: existing.role,
    };
  }

  const created = {
    id: crypto.randomUUID(),
    email: user.email,
    name: user.name,
    avatar_url: user.avatarUrl,
    provider: user.provider,
    provider_id: user.providerId,
    role: 'participant' as const,
    created_at: now,
    updated_at: now,
  };

  await db.insert(users).values(created);

  return {
    id: created.id,
    email: created.email,
    role: created.role,
  };
}

function callbackUrl(requestUrl: string, provider: 'google' | 'github'): string {
  return new URL(`/auth/callback/${provider}`, requestUrl).toString();
}

function authError(c: { json: (input: unknown, status?: number) => Response }, error: string, code: string, status = 400) {
  return c.json({ error, code }, status);
}

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
    return authError(c, 'Missing OAuth params', 'MISSING_OAUTH_PARAMS');
  }

  const stateRecord = await consumeOAuthState(c.env.KV, state);
  if (!stateRecord || stateRecord.provider !== 'google') {
    return authError(c, 'Invalid OAuth state', 'INVALID_OAUTH_STATE');
  }

  try {
    console.error('[Google OAuth] Step 1: Exchanging code for token...');
    console.error('[Google OAuth] redirectUri:', stateRecord.redirectUri);
    const accessToken = await exchangeGoogleCodeForToken({
      code,
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri: stateRecord.redirectUri,
    });
    console.error('[Google OAuth] Step 2: Got access token, fetching profile...');

    const profile = await fetchGoogleUserProfile(accessToken);
    console.error('[Google OAuth] Step 3: Got profile:', profile.email);

    const user = await upsertOAuthUser(c, profile);
    console.error('[Google OAuth] Step 4: Upserted user:', user.id);

    const token = await signJWT(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      c.env.JWT_SECRET
    );
    console.error('[Google OAuth] Step 5: JWT signed, setting cookie...');

    setSessionCookie(c, token, c.env.FRONTEND_URL);
    const dashboardUrl = new URL('/dashboard', c.env.FRONTEND_URL).toString();
    console.error('[Google OAuth] Step 6: Cookie set, redirecting to', dashboardUrl);
    return c.redirect(dashboardUrl, 302);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Google OAuth callback error:', msg, err);
    return c.json({ error: msg, code: 'GOOGLE_OAUTH_FAILED' }, 400);
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
    return authError(c, 'Missing OAuth params', 'MISSING_OAUTH_PARAMS');
  }

  const stateRecord = await consumeOAuthState(c.env.KV, state);
  if (!stateRecord || stateRecord.provider !== 'github') {
    return authError(c, 'Invalid OAuth state', 'INVALID_OAUTH_STATE');
  }

  try {
    const accessToken = await exchangeGitHubCodeForToken({
      code,
      clientId: c.env.GITHUB_CLIENT_ID,
      clientSecret: c.env.GITHUB_CLIENT_SECRET,
      redirectUri: stateRecord.redirectUri,
    });

    const profile = await fetchGitHubUserProfile(accessToken);
    const user = await upsertOAuthUser(c, profile);
    const token = await signJWT(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      c.env.JWT_SECRET
    );

    setSessionCookie(c, token, c.env.FRONTEND_URL);
    const dashboardUrl = new URL('/dashboard', c.env.FRONTEND_URL).toString();
    return c.redirect(dashboardUrl, 302);
  } catch {
    return authError(c, 'GitHub OAuth failed', 'GITHUB_OAUTH_FAILED');
  }
});

auth.get('/me', async (c) => {
  const token = getSessionCookie(c);
  if (!token) {
    return authError(c, 'Unauthorized', 'NO_TOKEN', 401);
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return authError(c, 'Invalid token', 'INVALID_TOKEN', 401);
  }

  return c.json({
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    },
  });
});

auth.post('/logout', (c) => {
  clearSessionCookie(c, c.env.FRONTEND_URL);
  return c.json({ ok: true });
});

export default auth;
