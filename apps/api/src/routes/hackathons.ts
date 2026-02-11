import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, ne, desc, count } from 'drizzle-orm';
import { createDbClient, hackathons as hackathonsTable, organizerRoles } from '@devsage/db';
import {
  CreateHackathonRequestSchema,
  HACKATHON_STATUS_TRANSITIONS,
  type HackathonStatus,
  UpdateHackathonRequestSchema,
} from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';

const hackathons = new Hono<AuthAppEnv>();

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getStateMachineStub(env: AuthAppEnv['Bindings'], hackathonId: string) {
  const doId = env.HACKATHON_SM.idFromName(hackathonId);
  return env.HACKATHON_SM.get(doId);
}

hackathons.get('/', async (c) => {
  const db = createDbClient(c.env.DB);
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 10, 1), 100);
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0);

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

hackathons.get('/:slug', async (c) => {
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

  return successResponse(c, hackathon);
});

hackathons.post(
  '/',
  authMiddleware,
  zValidator('json', CreateHackathonRequestSchema),
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
      slug,
      title: body.title,
      description: body.description ?? null,
      rules_md: body.rulesMd ?? null,
      registration_opens: body.registrationOpens,
      registration_closes: body.registrationCloses,
      submission_deadline: body.submissionDeadline,
      judging_starts: body.judgingStarts ?? null,
      judging_ends: body.judgingEnds ?? null,
      min_team_size: body.minTeamSize ?? 1,
      max_team_size: body.maxTeamSize ?? 5,
      max_teams: body.maxTeams ?? null,
      submission_tag_pattern: body.submissionTagPattern ?? 'submission_v%',
      max_submissions_per_team: body.maxSubmissionsPerTeam ?? null,
      allow_late_submissions: body.allowLateSubmissions ?? 0,
      primary_color: body.primaryColor ?? '#6366f1',
      status: 'draft',
      created_by: user.sub,
      created_at: now,
      updated_at: now,
    });

    await db.insert(organizerRoles).values({
      id: crypto.randomUUID(),
      hackathon_id: id,
      user_id: user.sub,
      role: 'owner',
      created_at: now,
    });

    const smStub = getStateMachineStub(c.env, id);
    const initResponse = await smStub.fetch('http://do/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hackathonId: id,
        config: {
          registrationOpens: body.registrationOpens,
          registrationCloses: body.registrationCloses,
          submissionDeadline: body.submissionDeadline,
          judgingStarts: body.judgingStarts ?? null,
          judgingEnds: body.judgingEnds ?? null,
          maxTeams: body.maxTeams ?? null,
          maxSubmissionsPerTeam: body.maxSubmissionsPerTeam ?? null,
          allowLateSubmissions: body.allowLateSubmissions ?? 0,
          submissionTagPattern: body.submissionTagPattern ?? 'submission_v%',
        },
      }),
    });

    if (!initResponse.ok) {
      await db.delete(hackathonsTable).where(eq(hackathonsTable.id, id));
      await db.delete(organizerRoles).where(eq(organizerRoles.hackathon_id, id));
      const details = await readJson(initResponse);
      return errorResponse(
        c, 500, 'LIFECYCLE_INIT_FAILED', 'Failed to initialize hackathon state machine',
        isRecord(details) ? details as Record<string, unknown> : undefined,
      );
    }

    await insertAuditEvent(db, {
      hackathonId: id,
      actorId: user.sub,
      actorType: 'user',
      action: 'hackathon.create',
      entityType: 'hackathon',
      entityId: id,
      details: { slug, title: body.title },
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
  requireRole('admin'),
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
    if (body.description !== undefined) updateData.description = body.description;
    if (body.rulesMd !== undefined) updateData.rules_md = body.rulesMd;
    if (body.registrationOpens !== undefined) updateData.registration_opens = body.registrationOpens;
    if (body.registrationCloses !== undefined) updateData.registration_closes = body.registrationCloses;
    if (body.submissionDeadline !== undefined) updateData.submission_deadline = body.submissionDeadline;
    if (body.judgingStarts !== undefined) updateData.judging_starts = body.judgingStarts;
    if (body.judgingEnds !== undefined) updateData.judging_ends = body.judgingEnds;
    if (body.minTeamSize !== undefined) updateData.min_team_size = body.minTeamSize;
    if (body.maxTeamSize !== undefined) updateData.max_team_size = body.maxTeamSize;
    if (body.maxTeams !== undefined) updateData.max_teams = body.maxTeams;
    if (body.submissionTagPattern !== undefined) updateData.submission_tag_pattern = body.submissionTagPattern;
    if (body.maxSubmissionsPerTeam !== undefined) updateData.max_submissions_per_team = body.maxSubmissionsPerTeam;
    if (body.allowLateSubmissions !== undefined) updateData.allow_late_submissions = body.allowLateSubmissions;
    if (body.primaryColor !== undefined) updateData.primary_color = body.primaryColor;
    if (body.logoR2Key !== undefined) updateData.logo_r2_key = body.logoR2Key;
    if (body.bannerR2Key !== undefined) updateData.banner_r2_key = body.bannerR2Key;
    if (body.customSubdomain !== undefined) updateData.custom_subdomain = body.customSubdomain;

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
  requireRole('admin'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return errorResponse(c, 400, 'INVALID_BODY', 'Invalid JSON body');
    }

    if (!isRecord(body) || typeof body.targetStatus !== 'string') {
      return errorResponse(c, 400, 'INVALID_BODY', 'Expected { targetStatus }');
    }

    const targetStatus = body.targetStatus as string;
    if (!Object.prototype.hasOwnProperty.call(HACKATHON_STATUS_TRANSITIONS, targetStatus)) {
      return errorResponse(c, 400, 'INVALID_STATUS', `Unknown status: ${targetStatus}`);
    }

    const smStub = getStateMachineStub(c.env, hackathon.id);
    const transitionResponse = await smStub.fetch('http://do/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetStatus,
        expectedVersion: typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined,
      }),
    });

    const payload = await readJson(transitionResponse);

    if (!transitionResponse.ok) {
      const errPayload = isRecord(payload) ? payload : {};
      return errorResponse(
        c,
        transitionResponse.status as 400,
        String(errPayload.code ?? 'TRANSITION_FAILED'),
        String(errPayload.error ?? 'Transition failed'),
      );
    }

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
  requireRole('owner'),
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

export default hackathons;
