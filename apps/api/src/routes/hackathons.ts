import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, ne, desc } from 'drizzle-orm';
import { createDbClient, hackathons as hackathonsTable, registrations, users } from '@devsage/db';
import {
  CreateHackathonRequestSchema,
  HACKATHON_STATUS_TRANSITIONS,
  type HackathonStatus,
  UpdateHackathonRequestSchema,
} from '@devsage/shared';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const hackathons = new Hono<AuthAppEnv>();

type TransitionLifecycleAction = 'openRegistration' | 'startHacking' | 'closeSubmissions' | 'complete';

interface TransitionLifecycleRequest {
  action: TransitionLifecycleAction;
  expectedVersion: number;
}

interface LifecycleStateResponse {
  hackathonId: string;
  status: HackathonStatus;
  registrationStart: string;
  hackingStart: string;
  submissionDeadline: string;
  transitionedAt: string;
  version: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHackathonStatus(value: unknown): value is HackathonStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HACKATHON_STATUS_TRANSITIONS, value);
}

function isTransitionLifecycleAction(value: unknown): value is TransitionLifecycleAction {
  return (
    value === 'openRegistration' ||
    value === 'startHacking' ||
    value === 'closeSubmissions' ||
    value === 'complete'
  );
}

function parseTransitionLifecycleRequest(value: unknown): TransitionLifecycleRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const { action, expectedVersion } = value;
  if (
    !isTransitionLifecycleAction(action) ||
    typeof expectedVersion !== 'number' ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion <= 0
  ) {
    return null;
  }

  return {
    action,
    expectedVersion,
  };
}

function parseLifecycleState(value: unknown): LifecycleStateResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    hackathonId,
    status,
    registrationStart,
    hackingStart,
    submissionDeadline,
    transitionedAt,
    version,
  } = value;

  if (
    typeof hackathonId !== 'string' ||
    !isHackathonStatus(status) ||
    typeof registrationStart !== 'string' ||
    typeof hackingStart !== 'string' ||
    typeof submissionDeadline !== 'string' ||
    typeof transitionedAt !== 'string' ||
    typeof version !== 'number' ||
    !Number.isInteger(version)
  ) {
    return null;
  }

  return {
    hackathonId,
    status,
    registrationStart,
    hackingStart,
    submissionDeadline,
    transitionedAt,
    version,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getLifecycleStub(env: AuthAppEnv['Bindings'], hackathonId: string) {
  const doId = env.HACKATHON_LIFECYCLE.idFromName(hackathonId);
  return env.HACKATHON_LIFECYCLE.get(doId);
}

async function syncHackathonStatus(
  db: ReturnType<typeof createDbClient>,
  hackathonId: string,
  status: HackathonStatus
): Promise<void> {
  await db
    .update(hackathonsTable)
    .set({
      status,
      updated_at: new Date().toISOString(),
    })
    .where(eq(hackathonsTable.id, hackathonId));
}

// Apply auth middleware to all routes
hackathons.use('*', authMiddleware);

/**
 * POST /api/hackathons
 * Create a new hackathon (organizer only)
 */
hackathons.post(
  '/',
  requireRole('organizer'),
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
      organizer_id: user.sub,
      status: 'draft',
      max_team_size: body.maxTeamSize,
      registration_start_date: body.registrationStartDate,
      hacking_start_date: body.hackingStartDate,
      submission_deadline: body.submissionDeadline,
      created_at: now,
      updated_at: now,
    });

    const lifecycleStub = getLifecycleStub(c.env, id);
    const initializeResponse = await lifecycleStub.fetch('http://do/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hackathonId: id,
        registrationStart: body.registrationStartDate,
        hackingStart: body.hackingStartDate,
        submissionDeadline: body.submissionDeadline,
      }),
    });

    if (!initializeResponse.ok) {
      const details = await readJson(initializeResponse);

      await db.delete(hackathonsTable).where(eq(hackathonsTable.id, id));

      return c.json(
        {
          error: 'Failed to initialize hackathon lifecycle',
          code: 'LIFECYCLE_INIT_FAILED',
          details,
        },
        500
      );
    }

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
    user.role === 'organizer'
      ? eq(hackathonsTable.organizer_id, user.sub)
      : ne(hackathonsTable.status, 'draft');

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
 * GET /api/hackathons/:id/lifecycle
 * Get durable lifecycle state for a hackathon
 */
hackathons.get('/:id/lifecycle', async (c) => {
  const hackathonId = c.req.param('id');
  const db = createDbClient(c.env.DB);

  const hackathon = await db
    .select()
    .from(hackathonsTable)
    .where(eq(hackathonsTable.id, hackathonId))
    .get();

  if (!hackathon) {
    return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
  }

  const lifecycleStub = getLifecycleStub(c.env, hackathonId);
  const lifecycleResponse = await lifecycleStub.fetch('http://do/state');
  const payload = await readJson(lifecycleResponse);

  if (!lifecycleResponse.ok) {
    return Response.json(
      isRecord(payload)
        ? payload
        : {
            error: 'Failed to fetch lifecycle state',
            code: 'LIFECYCLE_FETCH_FAILED',
          },
      { status: lifecycleResponse.status }
    );
  }

  const state = parseLifecycleState(payload);
  if (!state) {
    return c.json(
      {
        error: 'Lifecycle service returned invalid payload',
        code: 'LIFECYCLE_INVALID_RESPONSE',
      },
      502
    );
  }

  if (state.hackathonId !== hackathonId) {
    return c.json(
      {
        error: 'Lifecycle state does not match hackathon id',
        code: 'LIFECYCLE_ID_MISMATCH',
      },
      502
    );
  }

  if (hackathon.status !== state.status) {
    await syncHackathonStatus(db, hackathonId, state.status);
  }

  return c.json(state);
});

/**
 * POST /api/hackathons/:id/transition
 * Transition hackathon lifecycle state (organizer owner only)
 */
hackathons.post(
  '/:id/transition',
  requireRole('organizer'),
  async (c) => {
    const hackathonId = c.req.param('id');
    const user = c.get('user');
    const db = createDbClient(c.env.DB);

    let bodyPayload: unknown;
    try {
      bodyPayload = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400);
    }

    const body = parseTransitionLifecycleRequest(bodyPayload);
    if (!body) {
      return c.json(
        {
          error: 'Expected { action, expectedVersion } with a valid action and positive integer expectedVersion',
          code: 'INVALID_BODY',
        },
        400
      );
    }

    const hackathon = await db
      .select()
      .from(hackathonsTable)
      .where(eq(hackathonsTable.id, hackathonId))
      .get();

    if (!hackathon) {
      return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
    }

    if (hackathon.organizer_id !== user.sub) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }

    const lifecycleStub = getLifecycleStub(c.env, hackathonId);
    const transitionResponse = await lifecycleStub.fetch('http://do/transition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: body.action,
        expectedVersion: body.expectedVersion,
      }),
    });

    const payload = await readJson(transitionResponse);

    if (!transitionResponse.ok) {
      return Response.json(
        isRecord(payload)
          ? payload
          : {
              error: 'Lifecycle transition failed',
              code: 'LIFECYCLE_TRANSITION_FAILED',
            },
        { status: transitionResponse.status }
      );
    }

    const state = parseLifecycleState(payload);
    if (!state) {
      return c.json(
        {
          error: 'Lifecycle service returned invalid payload',
          code: 'LIFECYCLE_INVALID_RESPONSE',
        },
        502
      );
    }

    if (state.hackathonId !== hackathonId) {
      return c.json(
        {
          error: 'Lifecycle state does not match hackathon id',
          code: 'LIFECYCLE_ID_MISMATCH',
        },
        502
      );
    }

    await syncHackathonStatus(db, hackathonId, state.status);

    return c.json(state);
  }
);

/**
 * PATCH /api/hackathons/:id
 * Update a hackathon (organizer owner only, DRAFT status only)
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
    if (hackathon.organizer_id !== user.sub) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }

    // Check status is DRAFT
    if (hackathon.status !== 'draft') {
      return c.json(
        { error: 'Cannot modify non-draft hackathon', code: 'INVALID_STATUS' },
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
 * Delete a hackathon (organizer owner only, DRAFT status only)
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
  if (hackathon.organizer_id !== user.sub) {
    return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
  }

  // Check status is DRAFT
    if (hackathon.status !== 'draft') {
      return c.json(
        { error: 'Cannot delete non-draft hackathon', code: 'INVALID_STATUS' },
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
  if (hackathon.status !== 'registration_open') {
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
 * List registrations for a hackathon (organizer owner only)
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

  if (hackathon.organizer_id !== user.sub) {
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
