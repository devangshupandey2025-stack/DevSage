import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, ne, desc } from 'drizzle-orm';
import { createDbClient, hackathons as hackathonsTable, registrations, users } from '@devsage/db';
import { CreateHackathonRequestSchema, UpdateHackathonRequestSchema } from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const hackathons = new Hono<AuthAppEnv>();

// Apply auth middleware to all routes
hackathons.use('*', authMiddleware);

/**
 * POST /api/hackathons
 * Create a new hackathon (organiser only)
 */
hackathons.post(
  '/',
  requireRole('organiser'),
  zValidator('json', CreateHackathonRequestSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(hackathonsTable).values({
      id,
      title: body.title,
      description: body.description,
      organiser_id: user.sub,
      status: 'DRAFT',
      max_team_size: body.maxTeamSize,
      registration_start_date: body.registrationStartDate,
      hacking_start_date: body.hackingStartDate,
      submission_deadline: body.submissionDeadline,
      created_at: now,
      updated_at: now,
    });

    const hackathon = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, id))
      .get();

    return c.json(hackathon, 201);
  }
);

/**
 * GET /api/hackathons
 * List hackathons (role-aware visibility)
 * - Organisers: see only their own hackathons
 * - Participants: see all non-DRAFT hackathons
 */
hackathons.get('/', async (c) => {
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  const limit = Number(c.req.query('limit')) || 10;
  const offset = Number(c.req.query('offset')) || 0;

  const whereCondition =
    user.role === 'organiser'
      ? eq(hackathonsTable.organiser_id, user.sub)
      : ne(hackathonsTable.status, 'DRAFT');

  const data = await db
    .select()
    .from(hackathonsTable)
    .where(whereCondition)
    .orderBy(desc(hackathonsTable.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = await db
    .select()
    .from(hackathonsTable)
    .where(whereCondition)
    .all();

  return c.json({ data, total: totalResult.length });
});

/**
 * GET /api/hackathons/:id
 * Get a single hackathon by ID
 */
hackathons.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = createDbClient(c.env.DB);

  const hackathon = await db
    .select()
    .from(hackathonsTable)
    .where(eq(hackathonsTable.id, id))
    .get();

  if (!hackathon) {
    return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
  }

  return c.json(hackathon);
});

/**
 * PATCH /api/hackathons/:id
 * Update a hackathon (organiser owner only, DRAFT status only)
 */
hackathons.patch(
  '/:id',
  zValidator('json', UpdateHackathonRequestSchema),
  async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const body = c.req.valid('json');
    const db = createDbClient(c.env.DB);

    // Check if hackathon exists
    const hackathon = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, id))
      .get();

    if (!hackathon) {
      return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
    }

    // Check ownership
    if (hackathon.organiser_id !== user.sub) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }

    // Check status is DRAFT
    if (hackathon.status !== 'DRAFT') {
      return c.json(
        { error: 'Cannot modify non-DRAFT hackathon', code: 'INVALID_STATUS' },
        400
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.registrationStartDate !== undefined) {
      updateData.registration_start_date = body.registrationStartDate;
    }
    if (body.hackingStartDate !== undefined) {
      updateData.hacking_start_date = body.hackingStartDate;
    }
    if (body.submissionDeadline !== undefined) {
      updateData.submission_deadline = body.submissionDeadline;
    }
    if (body.maxTeamSize !== undefined) {
      updateData.max_team_size = body.maxTeamSize;
    }

    await db
      .update(hackathonsTable)
      .set(updateData)
      .where(eq(hackathonsTable.id, id));

    const updated = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, id))
      .get();

    return c.json(updated);
  }
);

/**
 * DELETE /api/hackathons/:id
 * Delete a hackathon (organiser owner only, DRAFT status only)
 */
hackathons.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  // Check if hackathon exists
  const hackathon = await db
    .select()
    .from(hackathonsTable)
    .where(eq(hackathonsTable.id, id))
    .get();

  if (!hackathon) {
    return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
  }

  // Check ownership
  if (hackathon.organiser_id !== user.sub) {
    return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
  }

  // Check status is DRAFT
  if (hackathon.status !== 'DRAFT') {
    return c.json(
      { error: 'Cannot delete non-DRAFT hackathon', code: 'INVALID_STATUS' },
      400
    );
  }

  await db.delete(hackathonsTable).where(eq(hackathonsTable.id, id));

  return c.body(null, 204);
});

/**
 * POST /api/hackathons/:id/register
 * Register for a hackathon (participant role, REGISTRATION_OPEN status)
 */
hackathons.post('/:id/register', requireRole('participant'), async (c) => {
  const hackathonId = c.req.param('id');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  // Check hackathon exists
  const hackathon = await db
    .select()
    .from(hackathonsTable)
    .where(eq(hackathonsTable.id, hackathonId))
    .get();

  if (!hackathon) {
    return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
  }

  // Check status is REGISTRATION_OPEN
  if (hackathon.status !== 'REGISTRATION_OPEN') {
    return c.json(
      { error: 'Registration not open', code: 'REGISTRATION_CLOSED' },
      400
    );
  }

  // Insert registration
  try {
    const registrationId = crypto.randomUUID();
    await db.insert(registrations).values({
      id: registrationId,
      hackathon_id: hackathonId,
      user_id: user.sub,
      registered_at: new Date().toISOString(),
    });

    return c.body(null, 201);
  } catch (error) {
    // Check for unique constraint violation (duplicate registration)
    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed')
    ) {
      return c.json(
        { error: 'Already registered', code: 'DUPLICATE_REGISTRATION' },
        409
      );
    }
    throw error;
  }
});

/**
 * GET /api/hackathons/:id/registrations
 * List registrations for a hackathon (organiser owner only)
 */
hackathons.get('/:id/registrations', async (c) => {
  const hackathonId = c.req.param('id');
  const user = c.get('user');
  const db = createDbClient(c.env.DB);

  // Check hackathon exists and ownership
  const hackathon = await db
    .select()
    .from(hackathonsTable)
    .where(eq(hackathonsTable.id, hackathonId))
    .get();

  if (!hackathon) {
    return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
  }

  if (hackathon.organiser_id !== user.sub) {
    return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
  }

  // Fetch registrations with user details
  const registrationList = await db
    .select({
      user: users,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.user_id, users.id))
    .where(eq(registrations.hackathon_id, hackathonId))
    .all();

  return c.json(registrationList.map((r) => r.user));
});

export default hackathons;
