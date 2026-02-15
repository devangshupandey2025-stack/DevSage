import type { MiddlewareHandler } from 'hono';
import type { DbClient } from '@devsage/db';
import { hackathons, organizerRoles, judges, teams, teamMembers, workspaceMembers } from '@devsage/db';
import { eq, and } from 'drizzle-orm';
import { createDbClient } from '@devsage/db';
import { errorResponse } from '../lib/response.js';
import type { AuthAppEnv } from '../types/auth.js';

export const ROLE_HIERARCHY = [
  'organizer',
  'co_organizer',
  'judge',
  'team_lead',
  'team_member',
  'anonymous',
] as const;

export type Role = (typeof ROLE_HIERARCHY)[number];

const ROLE_INDEX: Record<Role, number> = {
  organizer: 0,
  co_organizer: 1,
  judge: 2,
  team_lead: 3,
  team_member: 4,
  anonymous: 5,
};

export function isRoleAtLeast(actual: Role, minimum: Role): boolean {
  return ROLE_INDEX[actual] <= ROLE_INDEX[minimum];
}

const WORKSPACE_ROLE_DEFAULTS: Record<string, Role | null> = {
  workspace_owner: 'organizer',
  workspace_admin: 'co_organizer',
  workspace_member: null,
};

export async function resolveRole(
  userId: string,
  hackathonId: string,
  db: DbClient,
  workspaceId?: string | null,
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
    return membership.role === 'leader' ? 'team_lead' : 'team_member';
  }

  if (workspaceId) {
    const wsMember = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspace_id, workspaceId),
          eq(workspaceMembers.user_id, userId),
        ),
      )
      .get();

    if (wsMember) {
      const defaultRole = WORKSPACE_ROLE_DEFAULTS[wsMember.role];
      if (defaultRole) return defaultRole;
    }
  }

  return 'anonymous';
}

export const requireRole = (minRole: Role): MiddlewareHandler<AuthAppEnv> => {
  return async (c, next) => {
    try {
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

      const resolvedRole = await resolveRole(user.sub, hackathon.id, db, hackathon.workspace_id);

      c.set('role', resolvedRole);
      c.set('hackathon', hackathon);

      if (!isRoleAtLeast(resolvedRole, minRole)) {
        return errorResponse(c, 403, 'INSUFFICIENT_ROLE', `Requires ${minRole} role or higher`);
      }

      await next();
    } catch (err) {
      console.error('requireRole middleware error:', err instanceof Error ? err.message : String(err));
      return errorResponse(c, 500, 'ROLE_RESOLUTION_ERROR', 'Failed to resolve role');
    }
  };
};
