import type { MiddlewareHandler } from 'hono';
import type { AppEnv, UserContext } from '../types/env.js';
import { getAccessTokenCookie } from '../lib/cookies.js';
import { verifyJWT } from '../lib/jwt.js';
import { KV_TTL } from '../lib/constants.js';

type RawRoleRow = { slug: string | null; role: string };
type RawWorkspaceRow = { workspace_id: string; role: string };

/**
 * Build the full user context from DB queries (6 queries in parallel).
 * Result is cached in KV to avoid repeating this on every request.
 */
async function buildUserContext(
  db: D1Database,
  userId: string,
): Promise<UserContext | null> {
  const user = await db.prepare(
    `SELECT id, email, name, avatar_url, github_username, created_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
  ).bind(userId).first<{
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    github_username: string | null;
    created_at: string | null;
  }>();

  if (!user) return null;

  const [platformAdminRow, workspaceRows, organizerRows, judgeRows, teamRows] = await Promise.all([
    db.prepare(
      'SELECT id FROM platform_admins WHERE user_id = ? LIMIT 1',
    ).bind(user.id).first<{ id: string }>(),
    db.prepare(
      'SELECT workspace_id, role FROM workspace_members WHERE user_id = ?',
    ).bind(user.id).all<RawWorkspaceRow>(),
    db.prepare(
      `SELECT h.slug, o.role
       FROM organizer_roles o
       JOIN hackathons h ON h.id = o.hackathon_id
       WHERE o.user_id = ?`,
    ).bind(user.id).all<RawRoleRow>(),
    db.prepare(
      `SELECT h.slug, 'judge' AS role
       FROM judges j
       JOIN hackathons h ON h.id = j.hackathon_id
       WHERE j.user_id = ? AND j.invite_status = 'accepted'`,
    ).bind(user.id).all<RawRoleRow>(),
    db.prepare(
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
    hackathonRoles[slug] = [...roles];
  }

  return {
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
  };
}

/**
 * Global middleware: extracts and validates JWT from access_token cookie or Bearer header.
 * Sets c.set('user', ...) on success, c.set('user', null) on failure.
 *
 * Uses KV cache (30s TTL) to avoid 6 DB queries per authenticated request.
 * Cache is keyed by user ID and invalidated on TTL expiry.
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

  // Try KV cache first
  const cacheKey = `auth:ctx:${payload.sub}`;
  const cached = await c.env.KV.get(cacheKey);
  if (cached) {
    try {
      const userContext = JSON.parse(cached) as UserContext;
      c.set('user', userContext);
      return next();
    } catch {
      // Cache corrupted — fall through to DB
    }
  }

  // Cache miss — build from DB
  const userContext = await buildUserContext(c.env.DB, payload.sub);
  if (!userContext) {
    c.set('user', null);
    return next();
  }

  // Cache in KV (fire-and-forget)
  c.executionCtx?.waitUntil(
    c.env.KV.put(cacheKey, JSON.stringify(userContext), {
      expirationTtl: KV_TTL.AUTH_CONTEXT,
    }),
  );

  c.set('user', userContext);
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
