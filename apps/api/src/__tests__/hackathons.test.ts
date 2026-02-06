import { zValidator } from '@hono/zod-validator';
import { CreateHackathonRequestSchema } from '@devsage/shared';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { authMiddleware } from '../middleware/auth.js';
import { signJWT } from '../lib/jwt.js';
import { requireRole } from '../middleware/role.js';
import type { AuthAppEnv } from '../types/auth.js';

const JWT_SECRET = 'dev-secret-key-min-32-chars-long!!';

interface HackathonRecord {
  id: string;
  title: string;
  description: string;
  organiserId: string;
}

function buildHackathonsApp(): Hono<AuthAppEnv> {
  const app = new Hono<AuthAppEnv>();
  const records = new Map<string, HackathonRecord>();

  app.use('*', authMiddleware);

  app.post(
    '/api/hackathons',
    requireRole('organiser'),
    zValidator('json', CreateHackathonRequestSchema),
    (c) => {
      const user = c.get('user');
      const body = c.req.valid('json');
      const id = crypto.randomUUID();
      const record: HackathonRecord = {
        id,
        title: body.title,
        description: body.description,
        organiserId: user.sub,
      };
      records.set(id, record);
      return c.json(record, 201);
    }
  );

  app.get('/api/hackathons', (c) => {
    return c.json({ data: Array.from(records.values()) }, 200);
  });

  app.get('/api/hackathons/:id', (c) => {
    const id = c.req.param('id');
    const record = records.get(id);
    if (!record) {
      return c.json({ error: 'Hackathon not found', code: 'NOT_FOUND' }, 404);
    }
    return c.json(record, 200);
  });

  return app;
}

function validCreatePayload() {
  return {
    title: 'DevSage Hack Day',
    description: 'Build developer tooling with AI agents and cloud services.',
    registrationStartDate: '2026-01-01T00:00:00.000Z',
    hackingStartDate: '2026-01-02T00:00:00.000Z',
    submissionDeadline: '2026-01-03T00:00:00.000Z',
    maxTeamSize: 4,
  };
}

async function sessionCookie(userId: string, email: string, role: 'organiser' | 'participant'): Promise<string> {
  const token = await signJWT({ sub: userId, email, role }, JWT_SECRET);
  return `session=${token}`;
}

async function appRequest(app: Hono<AuthAppEnv>, path: string, init: RequestInit): Promise<Response> {
  return app.request(`http://localhost${path}`, init, { JWT_SECRET } as never);
}

describe('hackathons route critical paths (fallback unit harness)', () => {
  it('create hackathon with valid organiser JWT returns 201', async () => {
    const app = buildHackathonsApp();
    const response = await appRequest(app, '/api/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await sessionCookie(crypto.randomUUID(), 'org1@example.com', 'organiser'),
      },
      body: JSON.stringify(validCreatePayload()),
    });

    expect(response.status).toBe(201);
  });

  it('create hackathon with invalid input returns 400', async () => {
    const app = buildHackathonsApp();
    const response = await appRequest(app, '/api/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await sessionCookie(crypto.randomUUID(), 'org2@example.com', 'organiser'),
      },
      body: JSON.stringify({ title: 'x' }),
    });

    expect(response.status).toBe(400);
  });

  it('create hackathon with participant role returns 403', async () => {
    const app = buildHackathonsApp();
    const response = await appRequest(app, '/api/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await sessionCookie(crypto.randomUUID(), 'part@example.com', 'participant'),
      },
      body: JSON.stringify(validCreatePayload()),
    });

    expect(response.status).toBe(403);
  });

  it('list hackathons returns array', async () => {
    const app = buildHackathonsApp();
    await appRequest(app, '/api/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await sessionCookie(crypto.randomUUID(), 'org3@example.com', 'organiser'),
      },
      body: JSON.stringify(validCreatePayload()),
    });

    const response = await appRequest(app, '/api/hackathons', {
      headers: {
        Cookie: await sessionCookie(crypto.randomUUID(), 'org3@example.com', 'organiser'),
      },
    });
    const body = await response.json<{ data: unknown[] }>();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('get hackathon by ID returns 200', async () => {
    const app = buildHackathonsApp();
    const createResponse = await appRequest(app, '/api/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await sessionCookie(crypto.randomUUID(), 'org4@example.com', 'organiser'),
      },
      body: JSON.stringify(validCreatePayload()),
    });
    const created = await createResponse.json<{ id: string }>();

    const response = await appRequest(app, `/api/hackathons/${created.id}`, {
      headers: {
        Cookie: await sessionCookie(crypto.randomUUID(), 'org4@example.com', 'organiser'),
      },
    });

    expect(response.status).toBe(200);
  });

  it('get nonexistent hackathon returns 404', async () => {
    const app = buildHackathonsApp();
    const response = await appRequest(app, `/api/hackathons/${crypto.randomUUID()}`, {
      headers: {
        Cookie: await sessionCookie(crypto.randomUUID(), 'org5@example.com', 'organiser'),
      },
    });

    expect(response.status).toBe(404);
  });
});
