import type { MiddlewareHandler } from 'hono';
import type { AppEnv, HackathonRole } from '../types/env.js';
import { ROLE_HIERARCHY } from '../lib/constants.js';

/**
 * Resolves the user's role within the current hackathon context.
 * MUST be used after optionalAuth and hackathonContext middleware.
 * Uses single UNION ALL query (not 4 sequential queries).
 * Optional KV cache with 60s TTL.
 */
export async function resolveRole(
  db: D1Database,
  kv: KVNamespace,
  userId: string | undefined,
  hackathonId: string,
  workspaceId: string
): Promise<HackathonRole> {
  if (!userId) return 'anonymous';

  // Check KV cache
  const cacheKey = `role:${userId}:${hackathonId}`;
  const cached = await kv.get(cacheKey);
  if (cached) return cached as HackathonRole;

  // Single UNION ALL query for role resolution
  const result = await db.prepare(`
    SELECT role, priority FROM (
      SELECT role, 1 as priority FROM organizer_roles WHERE hackathon_id = ? AND user_id = ? AND role = 'organizer'
      UNION ALL
      SELECT role, 2 as priority FROM organizer_roles WHERE hackathon_id = ? AND user_id = ? AND role = 'co_organizer'
      UNION ALL
      SELECT 'judge' as role, 3 as priority FROM judges WHERE hackathon_id = ? AND user_id = ? AND invite_status = 'accepted'
      UNION ALL
      SELECT tm.role, CASE WHEN tm.role = 'leader' THEN 4 ELSE 5 END as priority
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE t.hackathon_id = ? AND tm.user_id = ?
      UNION ALL
      SELECT CASE WHEN wm.role IN ('owner', 'admin') THEN 'organizer' ELSE 'co_organizer' END as role,
             CASE WHEN wm.role IN ('owner', 'admin') THEN 6 ELSE 7 END as priority
        FROM workspace_members wm
        WHERE wm.workspace_id = ? AND wm.user_id = ?
    ) ORDER BY priority ASC LIMIT 1
  `).bind(
    hackathonId, userId,
    hackathonId, userId,
    hackathonId, userId,
    hackathonId, userId,
    workspaceId, userId
  ).first<{ role: HackathonRole; priority: number }>();

  const role: HackathonRole = result?.role ?? 'anonymous';

  // Cache in KV (60s TTL, fire-and-forget)
  await kv.put(cacheKey, role, { expirationTtl: 60 }).catch(() => {});

  return role;
}

/**
 * Middleware that requires minimum role level (hierarchy-based).
 * MUST be used after hackathonContext middleware has set hackathon context.
 */
export function requireRole(minRole: HackathonRole): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    const hackathon = c.get('hackathon');

    if (!hackathon) {
      return c.json(
        { ok: false, error: { code: 'HACKATHON_NOT_FOUND', message: 'Hackathon context required' } },
        404
      );
    }

    const role = await resolveRole(
      c.env.DB,
      c.env.KV,
      user?.id,
      hackathon.id,
      hackathon.workspace_id
    );

    c.set('role', role);

    const userLevel = ROLE_HIERARCHY[role] ?? 999;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 999;

    if (userLevel > requiredLevel) {
      return c.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        403
      );
    }

    return next();
  };
}

/**
 * Middleware that requires an exact role (not hierarchy-based).
 * E.g., only judges can score submissions.
 */
export function requireExactRole(...roles: HackathonRole[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    const hackathon = c.get('hackathon');

    if (!hackathon) {
      return c.json(
        { ok: false, error: { code: 'HACKATHON_NOT_FOUND', message: 'Hackathon context required' } },
        404
      );
    }

    const role = await resolveRole(
      c.env.DB,
      c.env.KV,
      user?.id,
      hackathon.id,
      hackathon.workspace_id
    );

    c.set('role', role);

    if (!roles.includes(role)) {
      return c.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        403
      );
    }

    return next();
  };
}
