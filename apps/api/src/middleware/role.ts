import type { MiddlewareHandler } from 'hono';
import type { DbClient } from '@devsage/db';
import { hackathons, organizerRoles, judges, teams, teamMembers } from '@devsage/db';
import { eq, and } from 'drizzle-orm';
import { createDbClient } from '@devsage/db';
import { errorResponse } from '../lib/response.js';
import type { AuthAppEnv } from '../types/auth.js';

/** Highest privilege first: owner > admin > moderator > judge > team_leader > participant > anonymous */
export const ROLE_HIERARCHY = [
  'owner',
  'admin',
  'moderator',
  'judge',
  'team_leader',
  'participant',
  'anonymous',
] as const;

export type Role = (typeof ROLE_HIERARCHY)[number];

const ROLE_INDEX: Record<Role, number> = {
  owner: 0,
  admin: 1,
  moderator: 2,
  judge: 3,
  team_leader: 4,
  participant: 5,
  anonymous: 6,
};

export function isRoleAtLeast(actual: Role, minimum: Role): boolean {
  return ROLE_INDEX[actual] <= ROLE_INDEX[minimum];
}

/**
 * Resolution order (returns first match):
 * 1. organizer_roles → owner / admin / moderator
 * 2. judges (invite_status = 'accepted') → judge
 * 3. team_members JOIN teams → team_leader or participant
 * 4. Fallback → anonymous
 */
export async function resolveRole(
  userId: string,
  hackathonId: string,
  db: DbClient,
): Promise<Role> {
  const orgRole = await db
    .select({ role: organizerRoles.role })
    .from(organizerRoles)
    .where(
      and(
        eq(organizerRoles.hackathon_id, hackathonId),
        eq(organizerRoles.user_id, userId),
      ),
    )
    .get();

  if (orgRole) {
    return orgRole.role as Role;
  }

  const judgeRecord = await db
    .select({ id: judges.id })
    .from(judges)
    .where(
      and(
        eq(judges.hackathon_id, hackathonId),
        eq(judges.user_id, userId),
        eq(judges.invite_status, 'accepted'),
      ),
    )
    .get();

  if (judgeRecord) {
    return 'judge';
  }

  const membership = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.team_id, teams.id))
    .where(
      and(
        eq(teams.hackathon_id, hackathonId),
        eq(teamMembers.user_id, userId),
      ),
    )
    .get();

  if (membership) {
    return membership.role === 'leader' ? 'team_leader' : 'participant';
  }

  return 'anonymous';
}

export const requireRole = (minRole: Role): MiddlewareHandler<AuthAppEnv> => {
  return async (c, next) => {
    const slug = c.req.param('slug');
    if (!slug) {
      return errorResponse(c, 400, 'BAD_REQUEST', 'Missing hackathon slug');
    }
    const db = createDbClient(c.env.DB);

    const hackathon = await db
      .select()
      .from(hackathons)
      .where(eq(hackathons.slug, slug))
      .get();

    if (!hackathon) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');
    }

    const user = c.get('user');

    if (!user) {
      if (minRole === 'anonymous') {
        c.set('role', 'anonymous' as Role);
        c.set('hackathon', hackathon);
        await next();
        return;
      }
      return errorResponse(c, 401, 'NO_TOKEN', 'Authentication required');
    }

    const resolvedRole = await resolveRole(user.sub, hackathon.id, db);

    c.set('role', resolvedRole);
    c.set('hackathon', hackathon);

    if (!isRoleAtLeast(resolvedRole, minRole)) {
      return errorResponse(c, 403, 'INSUFFICIENT_ROLE', `Requires ${minRole} role or higher`);
    }

    await next();
  };
};
