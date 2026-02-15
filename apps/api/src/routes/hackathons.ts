import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, ne, desc, count, and } from 'drizzle-orm';
import { createDbClient, hackathons as hackathonsTable, organizerRoles } from '@devsage/db';
import {
  CreateHackathonRequestSchema,
  type HackathonStatus,
  UpdateHackathonRequestSchema,
  PaginationQuerySchema,
  StatusTransitionRequestSchema,
} from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { requireRole, resolveRole, isRoleAtLeast } from '../middleware/role.js';
import { requireOrganizer } from '../middleware/require-organizer.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { isRecord } from '../lib/utils.js';
import { getStateMachineStub, fetchDO } from '../lib/do-client.js';
import {
  DEFAULT_SUBMISSION_TAG_PATTERN,
  DEFAULT_MIN_TEAM_SIZE,
  DEFAULT_MAX_TEAM_SIZE,
  DO_PATHS,
} from '../lib/constants.js';

const CreateHackathonWithWorkspaceSchema = CreateHackathonRequestSchema.extend({
  workspaceId: z.string(),
});

const hackathons = new Hono<AuthAppEnv>();

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

hackathons.get('/', async (c) => {
  const db = createDbClient(c.env.DB);
  const parsed = PaginationQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });
  const { limit, offset } = parsed.success ? parsed.data : { limit: 10, offset: 0 };

  const whereCondition = ne(hackathonsTable.status, 'draft');

  const data = await db
    .select()
    .from(hackathonsTable)
    .where(whereCondition)
    .orderBy(desc(hackathonsTable.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select({ value: count() })
    .from(hackathonsTable)
    .where(whereCondition)
    .get();

  const total = totalResult?.value ?? 0;
  return paginatedResponse(c, data, total, limit, offset);
});

hackathons.get('/:slug', optionalAuth, async (c) => {
  const slug = c.req.param('slug');
  const db = createDbClient(c.env.DB);

  const hackathon = await db
    .select()
    .from(hackathonsTable)
    .where(eq(hackathonsTable.slug, slug))
    .get();

  if (!hackathon) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');
  }

  if (hackathon.status === 'draft') {
    const user = c.get('user');
    if (!user) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');
    }
    const role = await resolveRole(user.sub, hackathon.id, db, hackathon.workspace_id);
    if (!isRoleAtLeast(role, 'co_organizer')) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');
    }
  }

  return successResponse(c, hackathon);
});

hackathons.post(
  '/',
  authMiddleware,
  requireOrganizer,
  zValidator('json', CreateHackathonWithWorkspaceSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const slug = body.slug || generateSlug(body.title);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const existingSlug = await db
      .select({ id: hackathonsTable.id })
      .from(hackathonsTable)
      .where(eq(hackathonsTable.slug, slug))
      .get();

    if (existingSlug) {
      return errorResponse(c, 409, 'SLUG_TAKEN', `Slug "${slug}" is already in use`);
    }

    await db.insert(hackathonsTable).values({
      id,
      workspace_id: body.workspaceId,
      slug,
      title: body.title,
      tagline: body.tagline ?? null,
      description: body.description ?? null,
      rules_md: body.rulesMd ?? null,
      status: 'draft',
      starts_at: body.startsAt ?? null,
      judging_starts: body.judgingStarts ?? null,
      judging_ends: body.judgingEnds ?? null,
      min_team_size: body.minTeamSize ?? DEFAULT_MIN_TEAM_SIZE,
      max_team_size: body.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE,
      max_teams: body.maxTeams ?? null,
      submission_tag_pattern: body.submissionTagPattern ?? DEFAULT_SUBMISSION_TAG_PATTERN,
      allow_resubmission: body.allowResubmission ?? 0,
      allow_registration_during_active: body.allowRegistrationDuringActive ?? 0,
      registration_mode: body.registrationMode ?? 'open',
      allowed_email_domains: body.allowedEmailDomains ?? '[]',
      require_repo: body.requireRepo ?? 1,
      timezone: body.timezone ?? 'UTC',
      template_id: body.templateId ?? null,
      tracks: body.tracks ?? '[]',
      prizes: body.prizes ?? '[]',
      settings: body.settings ?? '{}',
      created_by: user.sub,
      created_at: now,
      updated_at: now,
    });

    await db.insert(organizerRoles).values({
      id: crypto.randomUUID(),
      hackathon_id: id,
      user_id: user.sub,
      role: 'organizer',
      created_at: now,
    });

    const smStub = getStateMachineStub(c.env, id);
    const initResult = await fetchDO(smStub, DO_PATHS.INITIALIZE, {
      method: 'POST',
      body: {
        hackathonId: id,
        config: {
          startsAt: body.startsAt ?? null,
          judgingStarts: body.judgingStarts ?? null,
          judgingEnds: body.judgingEnds ?? null,
          maxTeams: body.maxTeams ?? null,
          submissionTagPattern: body.submissionTagPattern ?? DEFAULT_SUBMISSION_TAG_PATTERN,
        },
      },
    });

    if (!initResult.ok) {
      await db.delete(hackathonsTable).where(eq(hackathonsTable.id, id));
      await db.delete(organizerRoles).where(eq(organizerRoles.hackathon_id, id));
      return errorResponse(
        c, 500, 'LIFECYCLE_INIT_FAILED', 'Failed to initialize hackathon state machine',
        isRecord(initResult.data) ? initResult.data as Record<string, unknown> : undefined,
      );
    }

    await insertAuditEvent(db, {
      hackathonId: id,
      actorId: user.sub,
      actorType: 'user',
      action: 'hackathon.create',
      entityType: 'hackathon',
      entityId: id,
      details: { slug, title: body.title, workspaceId: body.workspaceId },
    });

    const hackathon = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, id))
      .get();

    return successResponse(c, hackathon, undefined, 201);
  },
);

hackathons.put(
  '/:slug',
  authMiddleware,
  requireRole('co_organizer'),
  zValidator('json', UpdateHackathonRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    if (hackathon.status !== 'draft') {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Can only modify hackathons in draft status');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.tagline !== undefined) updateData.tagline = body.tagline;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.rulesMd !== undefined) updateData.rules_md = body.rulesMd;
    if (body.startsAt !== undefined) updateData.starts_at = body.startsAt;
    if (body.judgingStarts !== undefined) updateData.judging_starts = body.judgingStarts;
    if (body.judgingEnds !== undefined) updateData.judging_ends = body.judgingEnds;
    if (body.minTeamSize !== undefined) updateData.min_team_size = body.minTeamSize;
    if (body.maxTeamSize !== undefined) updateData.max_team_size = body.maxTeamSize;
    if (body.maxTeams !== undefined) updateData.max_teams = body.maxTeams;
    if (body.submissionTagPattern !== undefined) updateData.submission_tag_pattern = body.submissionTagPattern;
    if (body.allowResubmission !== undefined) updateData.allow_resubmission = body.allowResubmission;
    if (body.allowRegistrationDuringActive !== undefined) updateData.allow_registration_during_active = body.allowRegistrationDuringActive;
    if (body.notifyAllOnDeadline !== undefined) updateData.notify_all_on_deadline = body.notifyAllOnDeadline;
    if (body.showJudgeCommentsToParticipants !== undefined) updateData.show_judge_comments_to_participants = body.showJudgeCommentsToParticipants;
    if (body.registrationMode !== undefined) updateData.registration_mode = body.registrationMode;
    if (body.allowedEmailDomains !== undefined) updateData.allowed_email_domains = body.allowedEmailDomains;
    if (body.requireRepo !== undefined) updateData.require_repo = body.requireRepo;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.tracks !== undefined) updateData.tracks = body.tracks;
    if (body.prizes !== undefined) updateData.prizes = body.prizes;
    if (body.settings !== undefined) updateData.settings = body.settings;

    await db
      .update(hackathonsTable)
      .set(updateData)
      .where(eq(hackathonsTable.id, hackathon.id));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'hackathon.update',
      entityType: 'hackathon',
      entityId: hackathon.id,
      details: { updatedFields: Object.keys(body) },
    });

    const updated = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, hackathon.id))
      .get();

    return successResponse(c, updated);
  },
);

hackathons.patch(
  '/:slug/status',
  authMiddleware,
  requireRole('co_organizer'),
  zValidator('json', StatusTransitionRequestSchema),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const targetStatus = body.targetStatus;

    const smStub = getStateMachineStub(c.env, hackathon.id);
    const transitionResult = await fetchDO(smStub, DO_PATHS.TRANSITION, {
      method: 'POST',
      body: { targetStatus },
    });

    if (!transitionResult.ok) {
      const errPayload = isRecord(transitionResult.data) ? transitionResult.data : {};
      return errorResponse(
        c,
        transitionResult.status as 400,
        String(errPayload.code ?? 'TRANSITION_FAILED'),
        String(errPayload.error ?? 'Transition failed'),
      );
    }

    const payload = transitionResult.data;
    const newStatus = (isRecord(payload) && typeof payload.status === 'string' ? payload.status : targetStatus) as HackathonStatus;
    await db
      .update(hackathonsTable)
      .set({ status: newStatus, updated_at: new Date().toISOString() })
      .where(eq(hackathonsTable.id, hackathon.id));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'hackathon.transition',
      entityType: 'hackathon',
      entityId: hackathon.id,
      details: { from: hackathon.status, to: newStatus },
    });

    const updated = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, hackathon.id))
      .get();

    return successResponse(c, updated);
  },
);

hackathons.delete(
  '/:slug',
  authMiddleware,
  requireRole('organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    if (hackathon.status !== 'draft') {
      return errorResponse(c, 400, 'INVALID_STATUS', 'Can only delete hackathons in draft status');
    }

    await db.delete(hackathonsTable).where(eq(hackathonsTable.id, hackathon.id));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'hackathon.delete',
      entityType: 'hackathon',
      entityId: hackathon.id,
    });

    return c.body(null, 204);
  },
);

/**
 * GET /:slug/my-role — Get the current user's resolved role for this hackathon
 */
hackathons.get(
  '/:slug/my-role',
  authMiddleware,
  requireRole('anonymous'),
  async (c) => {
    const role = c.get('role');
    const hackathon = c.get('hackathon');
    return successResponse(c, {
      hackathon_id: hackathon.id,
      slug: hackathon.slug,
      role,
    });
  },
);

/**
 * POST /:slug/clone — Clone a hackathon as a new draft
 */
hackathons.post(
  '/:slug/clone',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    const body = await c.req.json<{ title?: string }>().catch(() => ({ title: undefined }));
    const newTitle = body.title || `${hackathon.title} (Copy)`;
    const newSlug = generateSlug(newTitle) + '-' + crypto.randomUUID().slice(0, 6);
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(hackathonsTable).values({
      id: newId,
      workspace_id: hackathon.workspace_id,
      slug: newSlug,
      title: newTitle,
      tagline: hackathon.tagline,
      description: hackathon.description,
      rules_md: hackathon.rules_md,
      status: 'draft',
      min_team_size: hackathon.min_team_size,
      max_team_size: hackathon.max_team_size,
      max_teams: hackathon.max_teams,
      submission_tag_pattern: hackathon.submission_tag_pattern,
      allow_resubmission: hackathon.allow_resubmission,
      allow_registration_during_active: hackathon.allow_registration_during_active,
      notify_all_on_deadline: hackathon.notify_all_on_deadline,
      show_judge_comments_to_participants: hackathon.show_judge_comments_to_participants,
      registration_mode: hackathon.registration_mode,
      allowed_email_domains: hackathon.allowed_email_domains,
      require_repo: hackathon.require_repo,
      timezone: hackathon.timezone,
      tracks: hackathon.tracks,
      prizes: hackathon.prizes,
      settings: hackathon.settings,
      created_by: user.sub,
      created_at: now,
      updated_at: now,
    });

    // Copy the organizer role for the current user
    await db.insert(organizerRoles).values({
      id: crypto.randomUUID(),
      hackathon_id: newId,
      user_id: user.sub,
      role: 'organizer',
      created_at: now,
    });

    await insertAuditEvent(db, {
      hackathonId: newId,
      actorId: user.sub,
      actorType: 'user',
      action: 'hackathon.clone',
      entityType: 'hackathon',
      entityId: newId,
      changes: { before: {}, after: { cloned_from: hackathon.id } },
    });

    const created = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, newId))
      .get();

    return successResponse(c, created, undefined, 201);
  },
);

/**
 * POST /:slug/transfer-ownership — Transfer organizer ownership to a co_organizer
 */
hackathons.post(
  '/:slug/transfer-ownership',
  authMiddleware,
  requireRole('organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    const body = await c.req.json<{ target_user_id: string }>();
    if (!body.target_user_id) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', 'target_user_id is required');
    }

    // Verify target is a co_organizer of this hackathon
    const targetRole = await db
      .select()
      .from(organizerRoles)
      .where(and(
        eq(organizerRoles.hackathon_id, hackathon.id),
        eq(organizerRoles.user_id, body.target_user_id),
        eq(organizerRoles.role, 'co_organizer'),
      ))
      .get();

    if (!targetRole) {
      return errorResponse(c, 400, 'INVALID_TARGET', 'Target user must be a co_organizer of this hackathon');
    }

    const now = new Date().toISOString();

    // Promote target to organizer
    await db
      .update(organizerRoles)
      .set({ role: 'organizer' })
      .where(and(
        eq(organizerRoles.hackathon_id, hackathon.id),
        eq(organizerRoles.user_id, body.target_user_id),
      ));

    // Demote current owner to co_organizer
    await db
      .update(organizerRoles)
      .set({ role: 'co_organizer' })
      .where(and(
        eq(organizerRoles.hackathon_id, hackathon.id),
        eq(organizerRoles.user_id, user.sub),
      ));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'hackathon.transfer_ownership',
      entityType: 'hackathon',
      entityId: hackathon.id,
      changes: {
        before: { owner: user.sub },
        after: { owner: body.target_user_id },
      },
    });

    return successResponse(c, { message: 'Ownership transferred' });
  },
);

export default hackathons;
