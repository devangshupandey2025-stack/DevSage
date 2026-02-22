import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';
import { getAccessTokenCookie } from '../lib/cookies.js';
import { verifyJWT } from '../lib/jwt.js';

type RawRoleRow = { slug: string | null; role: string };
type RawWorkspaceRow = { workspace_id: string; role: string };

/**
 * Global middleware: extracts and validates JWT from access_token cookie.
 * Sets c.set('user', ...) on success, c.set('user', null) on failure.
 */
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cookieToken = getAccessTokenCookie(c);
  const header = c.req.header('Authorization');
  const headerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const token = cookieToken ?? headerToken;

  if (!token) {
    c.set('user', null);
    return next();
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload?.sub) {
    c.set('user', null);
    return next();
  }

  const payloadWorkspaceRoles = payload.workspaceRoles ?? {};
  const payloadHackathonRoles = payload.hackathonRoles ?? {};
  const payloadPlatformAdmin = payload.platformAdmin === true;
  const payloadEmail = payload.email ?? '';
  const payloadName = payload.name ?? 'User';
  const payloadImage = payload.image ?? null;

  // Backward-compatible path for legacy Bearer token callers (tests + transitional clients).
  if (!cookieToken) {
    c.set('user', {
      id: payload.sub,
      email: payloadEmail,
      name: payloadName,
      image: payloadImage,
      avatar_url: payloadImage,
      github_username: null,
      created_at: null,
      platformAdmin: payloadPlatformAdmin,
      hackathonRoles: payloadHackathonRoles,
      workspaceRoles: payloadWorkspaceRoles,
    });
    return next();
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email, name, avatar_url, github_username, created_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
  ).bind(payload.sub).first<{
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    github_username: string | null;
    created_at: string | null;
  }>();

  if (!user) {
    c.set('user', null);
    return next();
  }

  const [platformAdminRow, workspaceRows, organizerRows, judgeRows, teamRows] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id FROM platform_admins WHERE user_id = ? LIMIT 1',
    ).bind(user.id).first<{ id: string }>(),
    c.env.DB.prepare(
      'SELECT workspace_id, role FROM workspace_members WHERE user_id = ?',
    ).bind(user.id).all<RawWorkspaceRow>(),
    c.env.DB.prepare(
      `SELECT h.slug, o.role
       FROM organizer_roles o
       JOIN hackathons h ON h.id = o.hackathon_id
       WHERE o.user_id = ?`,
    ).bind(user.id).all<RawRoleRow>(),
    c.env.DB.prepare(
      `SELECT h.slug, 'judge' AS role
       FROM judges j
       JOIN hackathons h ON h.id = j.hackathon_id
       WHERE j.user_id = ? AND j.invite_status = 'accepted'`,
    ).bind(user.id).all<RawRoleRow>(),
    c.env.DB.prepare(
      `SELECT h.slug, tm.role
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       JOIN hackathons h ON h.id = t.hackathon_id
       WHERE tm.user_id = ?`,
    ).bind(user.id).all<RawRoleRow>(),
  ]);

  const workspaceRoles: Record<string, string> = {};
  for (const row of workspaceRows.results || []) {
    workspaceRoles[row.workspace_id] = row.role;
  }

  const hackathonRoleSets = new Map<string, Set<string>>();
  const allRoleRows = [
    ...(organizerRows.results || []),
    ...(judgeRows.results || []),
    ...(teamRows.results || []),
  ];

  for (const row of allRoleRows) {
    if (!row.slug) continue;
    if (!hackathonRoleSets.has(row.slug)) {
      hackathonRoleSets.set(row.slug, new Set());
    }
    hackathonRoleSets.get(row.slug)!.add(row.role);
  }

  const hackathonRoles: Record<string, string[]> = {};
  for (const [slug, roles] of hackathonRoleSets.entries()) {
    const existing = new Set(hackathonRoles[slug] || []);
    for (const role of roles) existing.add(role);
    hackathonRoles[slug] = [...existing];
  }

  c.set('user', {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    image: user.avatar_url,
    avatar_url: user.avatar_url,
    github_username: user.github_username,
    created_at: user.created_at,
    platformAdmin: !!platformAdminRow,
    hackathonRoles,
    workspaceRoles,
  });

  return next();
};

/**
 * Per-route middleware: requires authenticated user.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
      401,
    );
  }
  return next();
};
