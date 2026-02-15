import { Hono } from 'hono';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { createDbClient, users, organizerRoles, platformAdmins, workspaceMembers, workspaceInvites, refreshTokens, deletionRequests, teamMembers, teams, hackathons, submissions, scores, auditEvents } from '@devsage/db';
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
import { upsertGitHubUser, linkGoogleToUser, callbackUrl, AccountMergeConflictError } from '../lib/user-service.js';
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

const hashEncoder = new TextEncoder();

async function hashToken(token: string): Promise<string> {
  const data = hashEncoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = '';
  for (const byte of hashArray) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

type AppOrigin = 'participant' | 'platform' | 'admin';

function parseDevice(ua: string): string {
  let browser = 'Unknown';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

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
  const location = c.req.header('cf-ipcountry') ?? undefined;
  const device = userAgent ? parseDevice(userAgent) : undefined;

  const refreshResult = await createRefreshToken(db, user.id, undefined, ipAddress, userAgent, device, location);

  const token = await signJWT(
    { sub: user.id, ghid: user.github_id ?? 0, ghu: user.github_username ?? '', fam: refreshResult.familyId },
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
    if (err instanceof AccountMergeConflictError) {
      const loginUrl = new URL('/login', stateRecord.frontendOrigin);
      loginUrl.searchParams.set('error', 'account_merge_conflict');
      loginUrl.searchParams.set('message', err.message);
      return c.redirect(loginUrl.toString(), 302);
    }
    console.error('Google OAuth failed:', err instanceof Error ? err.message : String(err));
    const loginUrl = new URL('/login', stateRecord.frontendOrigin);
    loginUrl.searchParams.set('error', 'oauth_failed');
    return c.redirect(loginUrl.toString(), 302);
  }
});

auth.get('/github/elevate', async (c) => {
  const token = getAccessTokenCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Unauthorized');
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const scope = c.req.query('scope');
  if (!scope) {
    return errorResponse(c, 400, 'MISSING_SCOPE', 'scope query parameter is required');
  }

  const returnTo = c.req.query('return_to');
  const state = generateOAuthState();
  const redirectUri = callbackUrl(c.req.url.replace('/github/elevate', '/callback/github'), 'github');
  const frontendOrigin = resolveFrontendOrigin(c.req.query('origin'), c.env);

  await storeOAuthState(c.env.KV, state, {
    provider: 'github',
    redirectUri,
    frontendOrigin,
    createdAt: new Date().toISOString(),
    elevate: true,
    scope,
    return_to: returnTo,
    user_id: payload.sub,
  });

  const baseScopes = 'read:user user:email';
  const combinedScopes = `${baseScopes} ${scope}`;
  const url = buildGitHubAuthorizationUrl(c.env.GITHUB_CLIENT_ID, redirectUri, state, combinedScopes);
  return c.redirect(url, 302);
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

    if (stateRecord.elevate && stateRecord.user_id) {
      const encryptedToken = btoa(JSON.stringify({ token: accessToken, encrypted_at: new Date().toISOString() }));
      const db = createDbClient(c.env.DB);
      await db
        .update(users)
        .set({ github_elevated_token: encryptedToken, updated_at: new Date().toISOString() })
        .where(eq(users.id, stateRecord.user_id));

      const redirectTarget = stateRecord.return_to
        ? new URL(stateRecord.return_to, stateRecord.frontendOrigin).toString()
        : new URL('/dashboard', stateRecord.frontendOrigin).toString();
      return c.redirect(redirectTarget, 302);
    }

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
    { sub: user.id, ghid: user.github_id ?? 0, ghu: user.github_username ?? '', fam: result.familyId },
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
  const now = new Date();
  const rawDeletionToken = crypto.randomUUID();
  const tokenHash = await hashToken(rawDeletionToken);
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  await db.insert(deletionRequests).values({
    id: crypto.randomUUID(),
    user_id: payload.sub,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_at: now.toISOString(),
  });

  await c.env.NOTIFICATION_QUEUE.send({
    type: 'account_deletion_confirm',
    user_id: payload.sub,
    token: rawDeletionToken,
  });

  return successResponse(c, { message: 'Check your email to confirm account deletion' }, undefined, 202);
});

auth.post('/account/delete-confirm', async (c) => {
  const body = await c.req.json<{ token?: string }>();
  if (!body.token) {
    return errorResponse(c, 400, 'DELETION_TOKEN_INVALID', 'Missing deletion token');
  }

  const tokenHash = await hashToken(body.token);
  const db = createDbClient(c.env.DB);

  const request = await db
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.token_hash, tokenHash))
    .get();

  if (!request || request.confirmed_at || new Date(request.expires_at) <= new Date()) {
    return errorResponse(c, 400, 'DELETION_TOKEN_INVALID', 'Invalid or expired deletion token');
  }

  const now = new Date().toISOString();
  const userId = request.user_id;

  await db
    .update(deletionRequests)
    .set({ confirmed_at: now })
    .where(eq(deletionRequests.id, request.id));

  await revokeAllUserTokens(db, userId);

  const anonymizedEmail = `deleted_${crypto.randomUUID()}@deleted.devsage.org`;
  await db
    .update(users)
    .set({
      display_name: 'Deleted User',
      email: anonymizedEmail,
      avatar_url: null,
      github_username: null,
      github_id: null,
      github_elevated_token: null,
      updated_at: now,
    })
    .where(eq(users.id, userId));

  await db
    .update(deletionRequests)
    .set({ completed_at: now })
    .where(eq(deletionRequests.id, request.id));

  const accessToken = getAccessTokenCookie(c);
  if (accessToken) {
    const jwtPayload = await verifyJWT(accessToken, c.env.JWT_SECRET);
    if (jwtPayload?.sub === userId) {
      const frontendUrl = resolveFrontendOrigin(c.req.header('Origin'), c.env);
      clearAccessTokenCookie(c, frontendUrl);
      clearRefreshTokenCookie(c, frontendUrl);
      clearLegacySessionCookie(c, frontendUrl);
    }
  }

  return successResponse(c, { message: 'Account deleted' });
});

auth.get('/sessions', async (c) => {
  const token = getAccessTokenCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Unauthorized');
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const db = createDbClient(c.env.DB);
  const now = new Date().toISOString();

  const rows = await db
    .select({
      family_id: refreshTokens.family_id,
      device: sql<string>`max(${refreshTokens.device})`,
      location: sql<string>`max(${refreshTokens.location})`,
      created_at: sql<string>`min(${refreshTokens.created_at})`,
      last_active_at: sql<string>`max(${refreshTokens.created_at})`,
    })
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.user_id, payload.sub),
        eq(refreshTokens.revoked, 0),
        gt(refreshTokens.expires_at, now),
      ),
    )
    .groupBy(refreshTokens.family_id)
    .all();

  const sessions = rows.map((row) => ({
    family_id: row.family_id,
    device: row.device ?? 'Unknown device',
    location: row.location ?? 'Unknown',
    created_at: row.created_at,
    last_active_at: row.last_active_at,
    is_current: row.family_id === payload.fam,
  }));

  return successResponse(c, { sessions });
});

auth.delete('/sessions/:familyId', async (c) => {
  const token = getAccessTokenCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Unauthorized');
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const familyId = c.req.param('familyId');

  if (familyId === payload.fam) {
    return errorResponse(c, 400, 'CANNOT_REVOKE_CURRENT', 'Use POST /auth/logout to end your current session');
  }

  const db = createDbClient(c.env.DB);

  const familyToken = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.family_id, familyId),
        eq(refreshTokens.user_id, payload.sub),
      ),
    )
    .get();

  if (!familyToken) {
    return errorResponse(c, 404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  await revokeTokenFamily(db, familyId);

  return successResponse(c, { message: 'Session revoked' });
});

auth.get('/account/export', async (c) => {
  const token = getAccessTokenCookie(c);
  if (!token) {
    return errorResponse(c, 401, 'NO_TOKEN', 'Unauthorized');
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return errorResponse(c, 401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const userId = payload.sub;
  const db = createDbClient(c.env.DB);

  const user = await db
    .select({
      id: users.id,
      github_username: users.github_username,
      display_name: users.display_name,
      email: users.email,
      avatar_url: users.avatar_url,
      created_at: users.created_at,
      updated_at: users.updated_at,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    return errorResponse(c, 404, 'USER_NOT_FOUND', 'User not found');
  }

  const membershipRows = await db
    .select({
      team_id: teamMembers.team_id,
      team_name: teams.name,
      role: teamMembers.role,
      joined_at: teamMembers.joined_at,
      hackathon_slug: hackathons.slug,
      hackathon_title: hackathons.title,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.team_id, teams.id))
    .innerJoin(hackathons, eq(teams.hackathon_id, hackathons.id))
    .where(eq(teamMembers.user_id, userId))
    .all();

  const teamIds = membershipRows.map((r) => r.team_id);

  const userSubmissions = teamIds.length > 0
    ? await db.select().from(submissions).where(inArray(submissions.team_id, teamIds)).all()
    : [];

  const submissionIds = userSubmissions.map((s) => s.id);

  const scoresReceived = submissionIds.length > 0
    ? await db.select().from(scores).where(inArray(scores.submission_id, submissionIds)).all()
    : [];

  const auditLog = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.actor_id, userId))
    .all();

  const exportData = {
    exported_at: new Date().toISOString(),
    user,
    team_memberships: membershipRows.map(({ team_id: _teamId, ...rest }) => rest),
    submissions: userSubmissions,
    scores_received: scoresReceived,
    audit_events: auditLog,
  };

  c.header('Content-Disposition', `attachment; filename="devsage-export-${userId}.json"`);
  return c.json(exportData);
});

export default auth;
