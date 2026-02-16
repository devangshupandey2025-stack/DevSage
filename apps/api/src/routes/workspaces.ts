import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, count, desc, ne } from 'drizzle-orm';
import { createDbClient, workspaces, workspaceMembers, hackathons } from '@devsage/db';
import type { DbClient } from '@devsage/db';
import { CreateWorkspaceRequestSchema, PaginationQuerySchema } from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const WORKSPACE_ROLE_HIERARCHY = ['workspace_owner', 'workspace_admin', 'workspace_member'] as const;

function isWsRoleAtLeast(actual: string, minimum: string): boolean {
  const actualIdx = WORKSPACE_ROLE_HIERARCHY.indexOf(actual as (typeof WORKSPACE_ROLE_HIERARCHY)[number]);
  const minIdx = WORKSPACE_ROLE_HIERARCHY.indexOf(minimum as (typeof WORKSPACE_ROLE_HIERARCHY)[number]);
  if (actualIdx === -1 || minIdx === -1) return false;
  return actualIdx <= minIdx;
}

async function resolveWorkspaceAccess(
  db: DbClient,
  slug: string,
  userId: string,
) {
  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .get();

  if (!workspace) return null;

  const member = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspace_id, workspace.id),
        eq(workspaceMembers.user_id, userId),
      ),
    )
    .get();

  return { workspace, member: member ?? null };
}

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  website: z.string().url().nullable().optional(),
});

const InviteMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['workspace_admin', 'workspace_member']),
});

const workspacesRouter = new Hono<AuthAppEnv>();

workspacesRouter.post(
  '/',
  authMiddleware,
  zValidator('json', CreateWorkspaceRequestSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const existing = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, body.slug))
      .get();

    if (existing) {
      return errorResponse(c, 409, 'SLUG_TAKEN', `Slug "${body.slug}" is already in use`);
    }

    await db.insert(workspaces).values({
      id,
      name: body.name,
      slug: body.slug,
      description: body.description ?? '',
      website: body.website ?? null,
      created_by: user.sub,
      created_at: now,
      updated_at: now,
    });

    await db.insert(workspaceMembers).values({
      id: crypto.randomUUID(),
      workspace_id: id,
      user_id: user.sub,
      role: 'workspace_owner',
      invited_by: null,
      created_at: now,
      updated_at: now,
    });

    await insertAuditEvent(db, {
      actorId: user.sub,
      actorType: 'user',
      eventType: 'workspace.create',
      entityType: 'workspace',
      entityId: id,
      metadata: { slug: body.slug, name: body.name },
    });

    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .get();

    return successResponse(c, workspace, undefined, 201);
  },
);

workspacesRouter.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const results = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      description: workspaces.description,
      logo_url: workspaces.logo_url,
      website: workspaces.website,
      settings: workspaces.settings,
      created_by: workspaces.created_by,
      created_at: workspaces.created_at,
      updated_at: workspaces.updated_at,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspace_id))
    .where(eq(workspaceMembers.user_id, user.sub))
    .orderBy(desc(workspaces.created_at))
    .all();

  return successResponse(c, results);
});

workspacesRouter.get('/:slug', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);
  const slug = c.req.param('slug');

  const access = await resolveWorkspaceAccess(db, slug, user.sub);
  if (!access) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
  }
  if (!access.member) {
    return errorResponse(c, 403, 'NOT_WORKSPACE_MEMBER', 'You are not a member of this workspace');
  }

  return successResponse(c, access.workspace);
});

workspacesRouter.put(
  '/:slug',
  authMiddleware,
  zValidator('json', UpdateWorkspaceSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDbClient(c.env.DB);
    const slug = c.req.param('slug');
    const body = c.req.valid('json');

    const access = await resolveWorkspaceAccess(db, slug, user.sub);
    if (!access) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
    }
    if (!access.member || !isWsRoleAtLeast(access.member.role, 'workspace_admin')) {
      return errorResponse(c, 403, 'INSUFFICIENT_ROLE', 'Requires workspace_admin role or higher');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.website !== undefined) updateData.website = body.website;

    await db
      .update(workspaces)
      .set(updateData)
      .where(eq(workspaces.id, access.workspace.id));

    await insertAuditEvent(db, {
      actorId: user.sub,
      actorType: 'user',
      eventType: 'workspace.update',
      entityType: 'workspace',
      entityId: access.workspace.id,
      metadata: { updatedFields: Object.keys(body) },
    });

    const updated = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, access.workspace.id))
      .get();

    return successResponse(c, updated);
  },
);

workspacesRouter.delete('/:slug', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);
  const slug = c.req.param('slug');

  const access = await resolveWorkspaceAccess(db, slug, user.sub);
  if (!access) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
  }
  if (!access.member || access.member.role !== 'workspace_owner') {
    return errorResponse(c, 403, 'INSUFFICIENT_ROLE', 'Only workspace owner can delete the workspace');
  }

  const activeHackathon = await db
    .select({ id: hackathons.id })
    .from(hackathons)
    .where(
      and(
        eq(hackathons.workspace_id, access.workspace.id),
        ne(hackathons.status, 'archived'),
        ne(hackathons.status, 'completed'),
      ),
    )
    .limit(1)
    .get();

  if (activeHackathon) {
    return errorResponse(c, 400, 'HAS_ACTIVE_HACKATHONS', 'Cannot delete workspace with active hackathons');
  }

  await db.delete(workspaces).where(eq(workspaces.id, access.workspace.id));

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'workspace.delete',
    entityType: 'workspace',
    entityId: access.workspace.id,
  });

  return c.body(null, 204);
});

workspacesRouter.post(
  '/:slug/members',
  authMiddleware,
  zValidator('json', InviteMemberSchema),
  async (c) => {
    const user = c.get('user');
    const db = createDbClient(c.env.DB);
    const slug = c.req.param('slug');
    const body = c.req.valid('json');

    const access = await resolveWorkspaceAccess(db, slug, user.sub);
    if (!access) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
    }
    if (!access.member || !isWsRoleAtLeast(access.member.role, 'workspace_admin')) {
      return errorResponse(c, 403, 'INSUFFICIENT_ROLE', 'Requires workspace_admin role or higher');
    }

    const existingMember = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspace_id, access.workspace.id),
          eq(workspaceMembers.user_id, body.userId),
        ),
      )
      .get();

    if (existingMember) {
      return errorResponse(c, 409, 'ALREADY_MEMBER', 'User is already a member of this workspace');
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await db.insert(workspaceMembers).values({
      id,
      workspace_id: access.workspace.id,
      user_id: body.userId,
      role: body.role,
      invited_by: user.sub,
      created_at: now,
      updated_at: now,
    });

    await insertAuditEvent(db, {
      actorId: user.sub,
      actorType: 'user',
      eventType: 'workspace.member_added',
      entityType: 'workspace_member',
      entityId: id,
      metadata: { userId: body.userId, role: body.role, workspace_id: access.workspace.id },
    });

    return successResponse(c, { id, userId: body.userId, role: body.role }, undefined, 201);
  },
);

workspacesRouter.get('/:slug/members', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);
  const slug = c.req.param('slug');

  const access = await resolveWorkspaceAccess(db, slug, user.sub);
  if (!access) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
  }
  if (!access.member) {
    return errorResponse(c, 403, 'NOT_WORKSPACE_MEMBER', 'You are not a member of this workspace');
  }

  const members = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspace_id, access.workspace.id))
    .all();

  return successResponse(c, members);
});

workspacesRouter.delete('/:slug/members/:userId', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);
  const slug = c.req.param('slug');
  const targetUserId = c.req.param('userId');

  const access = await resolveWorkspaceAccess(db, slug, user.sub);
  if (!access) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
  }
  if (!access.member || !isWsRoleAtLeast(access.member.role, 'workspace_admin')) {
    return errorResponse(c, 403, 'INSUFFICIENT_ROLE', 'Requires workspace_admin role or higher');
  }

  const targetMember = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspace_id, access.workspace.id),
        eq(workspaceMembers.user_id, targetUserId),
      ),
    )
    .get();

  if (!targetMember) {
    return errorResponse(c, 404, 'MEMBER_NOT_FOUND', 'Member not found');
  }

  if (targetMember.role === 'workspace_owner') {
    return errorResponse(c, 403, 'CANNOT_LEAVE_AS_OWNER', 'Cannot remove workspace owner');
  }

  await db
    .delete(workspaceMembers)
    .where(eq(workspaceMembers.id, targetMember.id));

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'workspace.member_removed',
    entityType: 'workspace_member',
    entityId: targetMember.id,
    metadata: { userId: targetUserId, workspace_id: access.workspace.id },
  });

  return c.body(null, 204);
});

workspacesRouter.get('/:slug/hackathons', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);
  const slug = c.req.param('slug');
  const parsed = PaginationQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });
  const { limit, offset } = parsed.success ? parsed.data : { limit: 10, offset: 0 };

  const access = await resolveWorkspaceAccess(db, slug, user.sub);
  if (!access) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
  }
  if (!access.member) {
    return errorResponse(c, 403, 'NOT_WORKSPACE_MEMBER', 'You are not a member of this workspace');
  }

  const data = await db
    .select()
    .from(hackathons)
    .where(eq(hackathons.workspace_id, access.workspace.id))
    .orderBy(desc(hackathons.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ value: count() })
    .from(hackathons)
    .where(eq(hackathons.workspace_id, access.workspace.id))
    .get();

  return paginatedResponse(c, data, totalResult?.value ?? 0, limit, offset);
});

/**
 * PUT /:slug/members/:userId — update a member's role
 */
workspacesRouter.put('/:slug/members/:userId', authMiddleware, async (c) => {
  const user = c.get('user');
  const targetUserId = c.req.param('userId');
  const slug = c.req.param('slug');
  const db = createDbClient(c.env.DB);

  const body = await c.req.json<{ role: string }>();
  const validRoles = ['workspace_admin', 'workspace_member'] as const;
  if (!body.role || !validRoles.includes(body.role as (typeof validRoles)[number])) {
    return errorResponse(c, 400, 'INVALID_ROLE', `Role must be one of: ${validRoles.join(', ')}`);
  }

  const access = await resolveWorkspaceAccess(db, slug, user.sub);
  if (!access) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
  }
  if (!access.member || !isWsRoleAtLeast(access.member.role, 'workspace_admin')) {
    return errorResponse(c, 403, 'INSUFFICIENT_ROLE', 'Requires workspace_admin role or higher');
  }

  const targetMember = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspace_id, access.workspace.id), eq(workspaceMembers.user_id, targetUserId)))
    .get();

  if (!targetMember) {
    return errorResponse(c, 404, 'MEMBER_NOT_FOUND', 'Member not found');
  }

  if (targetMember.role === 'workspace_owner') {
    return errorResponse(c, 403, 'CANNOT_CHANGE_OWNER_ROLE', 'Cannot change the owner role. Use transfer instead.');
  }

  await db
    .update(workspaceMembers)
    .set({ role: body.role as 'workspace_admin' | 'workspace_member' })
    .where(eq(workspaceMembers.id, targetMember.id));

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'workspace.member_role_updated',
    entityType: 'workspace_member',
    entityId: targetMember.id,
    metadata: { userId: targetUserId, previousRole: targetMember.role, newRole: body.role },
  });

  return successResponse(c, { updated: true, role: body.role });
});

/**
 * POST /:slug/transfer — transfer workspace ownership
 */
workspacesRouter.post('/:slug/transfer', authMiddleware, async (c) => {
  const user = c.get('user');
  const slug = c.req.param('slug');
  const db = createDbClient(c.env.DB);

  const body = await c.req.json<{ userId: string }>();
  if (!body.userId) {
    return errorResponse(c, 400, 'MISSING_USER_ID', 'userId is required');
  }

  const access = await resolveWorkspaceAccess(db, slug, user.sub);
  if (!access) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Workspace not found');
  }
  if (!access.member || access.member.role !== 'workspace_owner') {
    return errorResponse(c, 403, 'NOT_OWNER', 'Only the workspace owner can transfer ownership');
  }

  const newOwnerMember = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspace_id, access.workspace.id), eq(workspaceMembers.user_id, body.userId)))
    .get();

  if (!newOwnerMember) {
    return errorResponse(c, 404, 'MEMBER_NOT_FOUND', 'Target user is not a member of this workspace');
  }

  const now = new Date().toISOString();
  await db.batch([
    db.update(workspaceMembers).set({ role: 'workspace_admin' }).where(
      and(eq(workspaceMembers.workspace_id, access.workspace.id), eq(workspaceMembers.user_id, user.sub)),
    ),
    db.update(workspaceMembers).set({ role: 'workspace_owner' }).where(
      and(eq(workspaceMembers.workspace_id, access.workspace.id), eq(workspaceMembers.user_id, body.userId)),
    ),
    db.update(workspaces).set({ created_by: body.userId, updated_at: now }).where(eq(workspaces.id, access.workspace.id)),
  ]);

  await insertAuditEvent(db, {
    actorId: user.sub,
    actorType: 'user',
    eventType: 'workspace.transfer_ownership',
    entityType: 'workspace',
    entityId: access.workspace.id,
    metadata: { previousOwner: user.sub, newOwner: body.userId },
  });

  return successResponse(c, { transferred: true });
});

export default workspacesRouter;
