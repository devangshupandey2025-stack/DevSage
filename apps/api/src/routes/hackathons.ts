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
    return errorResponse(c, 404, 'HACKATHON_NOT_FOUND', 'Hackathon not found');
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

    const ext = body as Record<string, unknown>;
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
      submission_deadline: (ext.submissionDeadline as string) ?? null,
      judging_starts: body.judgingStarts ?? null,
      judging_ends: body.judgingEnds ?? null,
      min_team_size: body.minTeamSize ?? DEFAULT_MIN_TEAM_SIZE,
      max_team_size: body.maxTeamSize ?? DEFAULT_MAX_TEAM_SIZE,
      max_teams: body.maxTeams ?? null,
      allow_solo: (ext.allowSolo as number) ?? 1,
      submission_tag_pattern: body.submissionTagPattern ?? DEFAULT_SUBMISSION_TAG_PATTERN,
      max_submissions_per_team: (ext.maxSubmissionsPerTeam as number) ?? null,
      allow_resubmission: body.allowResubmission ?? 0,
      allow_late_submissions: (ext.allowLateSubmissions as number) ?? 0,
      require_readme: (ext.requireReadme as number) ?? 0,
      require_demo_url: (ext.requireDemoUrl as number) ?? 0,
      allow_registration_during_active: body.allowRegistrationDuringActive ?? 0,
      judges_per_submission: (ext.judgesPerSubmission as number) ?? 2,
      enable_ai_reviews: (ext.enableAiReviews as number) ?? 1,
      blind_judging: (ext.blindJudging as number) ?? 0,
      enable_audience_voting: (ext.enableAudienceVoting as number) ?? 0,
      registration_mode: body.registrationMode ?? 'open',
      allowed_email_domains: body.allowedEmailDomains ?? '[]',
      require_repo: body.requireRepo ?? 1,
      timezone: body.timezone ?? 'UTC',
      template_id: body.templateId ?? null,
      track_assignment_mode: ((ext.trackAssignmentMode as string) ?? 'team_choice') as 'organizer_assigned' | 'team_choice',
      landing_page_public: (ext.landingPagePublic as number) ?? 1,
      primary_color: (ext.primaryColor as string) ?? '#6366f1',
      secondary_color: (ext.secondaryColor as string) ?? null,
      custom_css: (ext.customCss as string) ?? null,
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
      updated_at: now,
    });

    const smStub = getStateMachineStub(c.env, id);
    const initResult = await fetchDO(smStub, DO_PATHS.INITIALIZE, {
      method: 'POST',
      body: {
        hackathonId: id,
        config: {
          startsAt: body.startsAt ?? null,
          submissionDeadline: (ext.submissionDeadline as string) ?? null,
          judgingStarts: body.judgingStarts ?? null,
          judgingEnds: body.judgingEnds ?? null,
          maxTeams: body.maxTeams ?? null,
          maxSubmissionsPerTeam: (ext.maxSubmissionsPerTeam as number) ?? null,
          allowResubmission: body.allowResubmission ?? 0,
          submissionTagPattern: body.submissionTagPattern ?? DEFAULT_SUBMISSION_TAG_PATTERN,
          allowRegistrationDuringActive: body.allowRegistrationDuringActive ?? 0,
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

    const draftOnlyKeys = new Set([
      'title', 'tagline', 'startsAt', 'submissionDeadline', 'judgingStarts', 'judgingEnds',
      'minTeamSize', 'maxTeamSize', 'maxTeams', 'allowSolo', 'submissionTagPattern',
      'maxSubmissionsPerTeam', 'allowResubmission', 'allowLateSubmissions', 'requireReadme',
      'requireDemoUrl', 'allowRegistrationDuringActive', 'judgesPerSubmission', 'enableAiReviews',
      'blindJudging', 'enableAudienceVoting', 'trackAssignmentMode', 'landingPagePublic',
      'primaryColor', 'secondaryColor', 'customCss', 'notifyAllOnDeadline',
      'showJudgeCommentsToParticipants', 'registrationMode', 'allowedEmailDomains',
      'requireRepo', 'timezone', 'tracks', 'prizes', 'settings',
    ]);
    const dateKeys = new Set(['startsAt', 'submissionDeadline', 'judgingStarts', 'judgingEnds']);

    if (hackathon.status !== 'draft') {
      const bodyKeys = Object.keys(body) as string[];
      const blockedKeys = bodyKeys.filter((k) => draftOnlyKeys.has(k));
      if (blockedKeys.length > 0) {
        const blockedDates = blockedKeys.filter((k) => dateKeys.has(k));
        if (blockedDates.length > 0) {
          return errorResponse(c, 400, 'DEADLINE_IMMUTABLE', `Cannot modify dates after draft: ${blockedDates.join(', ')}`);
        }
        return errorResponse(c, 400, 'INVALID_STATUS', `Can only modify these fields in draft status: ${blockedKeys.join(', ')}`);
      }
    }

    const effectiveStartsAt = (body as Record<string, unknown>).startsAt as string | undefined ?? hackathon.starts_at;
    const effectiveDeadline = (body as Record<string, unknown>).submissionDeadline as string | undefined ?? hackathon.submission_deadline;
    const effectiveJudgingStarts = (body as Record<string, unknown>).judgingStarts as string | undefined ?? hackathon.judging_starts;
    const effectiveJudgingEnds = (body as Record<string, unknown>).judgingEnds as string | undefined ?? hackathon.judging_ends;

    if (effectiveStartsAt && effectiveDeadline && effectiveStartsAt >= effectiveDeadline) {
      return errorResponse(c, 400, 'INVALID_DATE_ORDER', 'starts_at must be before submission_deadline');
    }
    if (effectiveDeadline && effectiveJudgingStarts && effectiveDeadline > effectiveJudgingStarts) {
      return errorResponse(c, 400, 'INVALID_DATE_ORDER', 'submission_deadline must be <= judging_starts');
    }
    if (effectiveJudgingStarts && effectiveJudgingEnds && effectiveJudgingStarts >= effectiveJudgingEnds) {
      return errorResponse(c, 400, 'INVALID_DATE_ORDER', 'judging_starts must be before judging_ends');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.tagline !== undefined) updateData.tagline = body.tagline;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.rulesMd !== undefined) updateData.rules_md = body.rulesMd;
    if (body.startsAt !== undefined) updateData.starts_at = body.startsAt;
    if ((body as Record<string, unknown>).submissionDeadline !== undefined) updateData.submission_deadline = (body as Record<string, unknown>).submissionDeadline;
    if (body.judgingStarts !== undefined) updateData.judging_starts = body.judgingStarts;
    if (body.judgingEnds !== undefined) updateData.judging_ends = body.judgingEnds;
    if (body.minTeamSize !== undefined) updateData.min_team_size = body.minTeamSize;
    if (body.maxTeamSize !== undefined) updateData.max_team_size = body.maxTeamSize;
    if (body.maxTeams !== undefined) updateData.max_teams = body.maxTeams;
    if ((body as Record<string, unknown>).allowSolo !== undefined) updateData.allow_solo = (body as Record<string, unknown>).allowSolo;
    if (body.submissionTagPattern !== undefined) updateData.submission_tag_pattern = body.submissionTagPattern;
    if ((body as Record<string, unknown>).maxSubmissionsPerTeam !== undefined) updateData.max_submissions_per_team = (body as Record<string, unknown>).maxSubmissionsPerTeam;
    if (body.allowResubmission !== undefined) updateData.allow_resubmission = body.allowResubmission;
    if ((body as Record<string, unknown>).allowLateSubmissions !== undefined) updateData.allow_late_submissions = (body as Record<string, unknown>).allowLateSubmissions;
    if ((body as Record<string, unknown>).requireReadme !== undefined) updateData.require_readme = (body as Record<string, unknown>).requireReadme;
    if ((body as Record<string, unknown>).requireDemoUrl !== undefined) updateData.require_demo_url = (body as Record<string, unknown>).requireDemoUrl;
    if (body.allowRegistrationDuringActive !== undefined) updateData.allow_registration_during_active = body.allowRegistrationDuringActive;
    if ((body as Record<string, unknown>).judgesPerSubmission !== undefined) updateData.judges_per_submission = (body as Record<string, unknown>).judgesPerSubmission;
    if ((body as Record<string, unknown>).enableAiReviews !== undefined) updateData.enable_ai_reviews = (body as Record<string, unknown>).enableAiReviews;
    if ((body as Record<string, unknown>).blindJudging !== undefined) updateData.blind_judging = (body as Record<string, unknown>).blindJudging;
    if ((body as Record<string, unknown>).enableAudienceVoting !== undefined) updateData.enable_audience_voting = (body as Record<string, unknown>).enableAudienceVoting;
    if ((body as Record<string, unknown>).primaryColor !== undefined) updateData.primary_color = (body as Record<string, unknown>).primaryColor;
    if ((body as Record<string, unknown>).secondaryColor !== undefined) updateData.secondary_color = (body as Record<string, unknown>).secondaryColor;
    if ((body as Record<string, unknown>).customCss !== undefined) updateData.custom_css = (body as Record<string, unknown>).customCss;
    if ((body as Record<string, unknown>).trackAssignmentMode !== undefined) updateData.track_assignment_mode = (body as Record<string, unknown>).trackAssignmentMode;
    if ((body as Record<string, unknown>).landingPagePublic !== undefined) updateData.landing_page_public = (body as Record<string, unknown>).landingPagePublic;
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
      return errorResponse(c, 400, 'DELETION_NOT_ALLOWED', 'Can only delete hackathons in draft status');
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
      allow_solo: hackathon.allow_solo,
      submission_tag_pattern: hackathon.submission_tag_pattern,
      max_submissions_per_team: hackathon.max_submissions_per_team,
      allow_resubmission: hackathon.allow_resubmission,
      allow_late_submissions: hackathon.allow_late_submissions,
      require_readme: hackathon.require_readme,
      require_demo_url: hackathon.require_demo_url,
      allow_registration_during_active: hackathon.allow_registration_during_active,
      judges_per_submission: hackathon.judges_per_submission,
      enable_ai_reviews: hackathon.enable_ai_reviews,
      blind_judging: hackathon.blind_judging,
      enable_audience_voting: hackathon.enable_audience_voting,
      notify_all_on_deadline: hackathon.notify_all_on_deadline,
      show_judge_comments_to_participants: hackathon.show_judge_comments_to_participants,
      registration_mode: hackathon.registration_mode,
      allowed_email_domains: hackathon.allowed_email_domains,
      require_repo: hackathon.require_repo,
      timezone: hackathon.timezone,
      template_id: hackathon.template_id,
      cloned_from_id: hackathon.id,
      track_assignment_mode: hackathon.track_assignment_mode,
      landing_page_public: hackathon.landing_page_public,
      primary_color: hackathon.primary_color,
      secondary_color: hackathon.secondary_color,
      logo_r2_key: hackathon.logo_r2_key,
      banner_r2_key: hackathon.banner_r2_key,
      favicon_r2_key: hackathon.favicon_r2_key,
      custom_css: hackathon.custom_css,
      tracks: hackathon.tracks,
      prizes: hackathon.prizes,
      settings: hackathon.settings,
      created_by: user.sub,
      created_at: now,
      updated_at: now,
    });

    await db.insert(organizerRoles).values({
      id: crypto.randomUUID(),
      hackathon_id: newId,
      user_id: user.sub,
      role: 'organizer',
      created_at: now,
      updated_at: now,
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
      return errorResponse(c, 400, 'TRANSFER_TARGET_NOT_CO_ORGANIZER', 'Transfer target must be a co-organizer');
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

/**
 * POST /:slug/assets — Upload hackathon branding asset (logo, banner, favicon)
 */
hackathons.post(
  '/:slug/assets',
  authMiddleware,
  requireRole('co_organizer'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    if (!c.env.R2) {
      return errorResponse(c, 503, 'R2_NOT_CONFIGURED', 'Asset storage is not configured');
    }

    const formData = await c.req.formData();
    const file = formData.get('file');
    const assetType = formData.get('type');

    if (!(file instanceof File)) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', 'File is required');
    }

    if (typeof assetType !== 'string' || !['logo', 'banner', 'favicon'].includes(assetType)) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', 'type must be one of: logo, banner, favicon');
    }

    const constraints: Record<string, { maxSize: number; allowedTypes: string[] }> = {
      logo: { maxSize: 2 * 1024 * 1024, allowedTypes: ['image/png', 'image/svg+xml', 'image/webp'] },
      banner: { maxSize: 5 * 1024 * 1024, allowedTypes: ['image/png', 'image/jpeg', 'image/webp'] },
      favicon: { maxSize: 256 * 1024, allowedTypes: ['image/png', 'image/x-icon'] },
    };

    const constraint = constraints[assetType];
    if (file.size > constraint.maxSize) {
      return errorResponse(c, 400, 'VALIDATION_ERROR',
        `${assetType} must be under ${Math.round(constraint.maxSize / 1024)}KB`);
    }

    if (!constraint.allowedTypes.includes(file.type)) {
      return errorResponse(c, 400, 'VALIDATION_ERROR',
        `${assetType} must be one of: ${constraint.allowedTypes.join(', ')}`);
    }

    const ext = file.name.split('.').pop() || 'bin';
    const r2Key = `hackathons/${hackathon.id}/${assetType}/${crypto.randomUUID()}.${ext}`;

    await c.env.R2.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const columnMap: Record<string, string> = {
      logo: 'logo_r2_key',
      banner: 'banner_r2_key',
      favicon: 'favicon_r2_key',
    };

    const updateData: Record<string, unknown> = {
      [columnMap[assetType]]: r2Key,
      updated_at: new Date().toISOString(),
    };

    await db
      .update(hackathonsTable)
      .set(updateData)
      .where(eq(hackathonsTable.id, hackathon.id));

    await insertAuditEvent(db, {
      hackathonId: hackathon.id,
      actorId: user.sub,
      actorType: 'user',
      action: 'hackathon.asset_upload',
      entityType: 'hackathon',
      entityId: hackathon.id,
      details: { assetType, r2Key, fileName: file.name, fileSize: file.size },
    });

    return successResponse(c, { type: assetType, r2_key: r2Key }, undefined, 201);
  },
);

export default hackathons;
