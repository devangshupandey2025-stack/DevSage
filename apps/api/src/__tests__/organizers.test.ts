import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSchema, resetDb, authCookie, insertUser, insertWorkspace,
  insertWorkspaceMember, insertHackathon, insertOrganizerRole,
  SEED, env,
} from './helpers.js';
import type { ApiResponse } from './helpers.js';

describe('organizer routes — /api/v1/hackathons/:slug/organizers', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  async function seedHackathonWithOrganizer() {
    await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);
    await insertUser(SEED.coOrganizer.id, SEED.coOrganizer.email, SEED.coOrganizer.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertWorkspace(SEED.workspace, 'devsage', SEED.organizer.id);
    await insertWorkspaceMember(SEED.workspace, SEED.organizer.id, 'owner');
    await insertHackathon({
      id: SEED.hackathon,
      workspaceId: SEED.workspace,
      slug: SEED.hackathonSlug,
      createdBy: SEED.organizer.id,
      status: 'active',
    });
    await insertOrganizerRole(SEED.hackathon, SEED.organizer.id, 'organizer');
  }

  const baseUrl = `http://localhost/api/v1/hackathons/${SEED.hackathonSlug}/organizers`;

  // ── GET / — list organizers ────────────────────────────────────

  it('lists organizers as organizer', async () => {
    await seedHackathonWithOrganizer();
    await insertOrganizerRole(SEED.hackathon, SEED.coOrganizer.id, 'co_organizer');

    const res = await SELF.fetch(baseUrl, {
      headers: { Authorization: await authCookie(SEED.organizer.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Array<{ user_id: string; role: string; name: string }>>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(2);
    const roles = body.data.map(o => o.role);
    expect(roles).toContain('organizer');
    expect(roles).toContain('co_organizer');
  });

  it('lists organizers as co_organizer', async () => {
    await seedHackathonWithOrganizer();
    await insertOrganizerRole(SEED.hackathon, SEED.coOrganizer.id, 'co_organizer');

    const res = await SELF.fetch(baseUrl, {
      headers: { Authorization: await authCookie(SEED.coOrganizer.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Array<{ user_id: string }>>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(2);
  });

  it('rejects listing organizers as non-organizer → 403', async () => {
    await seedHackathonWithOrganizer();

    const res = await SELF.fetch(baseUrl, {
      headers: { Authorization: await authCookie(SEED.participant.id) },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  // ── POST / — add organizer ─────────────────────────────────────

  it('adds organizer role as organizer', async () => {
    await seedHackathonWithOrganizer();

    const res = await SELF.fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.organizer.id),
      },
      body: JSON.stringify({ user_id: SEED.coOrganizer.id, role: 'co_organizer' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as ApiResponse<{ id: string; role: string }>;
    expect(body.ok).toBe(true);
    expect(body.data.role).toBe('co_organizer');

    // Verify in DB
    const row = await env.DB.prepare(
      'SELECT role FROM organizer_roles WHERE hackathon_id = ? AND user_id = ?'
    ).bind(SEED.hackathon, SEED.coOrganizer.id).first();
    expect(row?.role).toBe('co_organizer');
  });

  it('rejects adding organizer as co_organizer → 403', async () => {
    await seedHackathonWithOrganizer();
    await insertOrganizerRole(SEED.hackathon, SEED.coOrganizer.id, 'co_organizer');

    const res = await SELF.fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.coOrganizer.id),
      },
      body: JSON.stringify({ user_id: SEED.participant.id, role: 'co_organizer' }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  it('rejects duplicate organizer → 409 ALREADY_ORGANIZER', async () => {
    await seedHackathonWithOrganizer();
    await insertOrganizerRole(SEED.hackathon, SEED.coOrganizer.id, 'co_organizer');

    const res = await SELF.fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.organizer.id),
      },
      body: JSON.stringify({ user_id: SEED.coOrganizer.id, role: 'co_organizer' }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('ALREADY_ORGANIZER');
  });

  // ── DELETE /:roleId — remove organizer ─────────────────────────

  it('removes organizer role', async () => {
    await seedHackathonWithOrganizer();
    const roleId = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO organizer_roles (id, hackathon_id, user_id, role) VALUES (?, ?, ?, ?)'
    ).bind(roleId, SEED.hackathon, SEED.coOrganizer.id, 'co_organizer').run();

    const res = await SELF.fetch(`${baseUrl}/${roleId}`, {
      method: 'DELETE',
      headers: { Authorization: await authCookie(SEED.organizer.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ removed: boolean }>;
    expect(body.ok).toBe(true);
    expect(body.data.removed).toBe(true);

    // Verify removal
    const check = await env.DB.prepare(
      'SELECT id FROM organizer_roles WHERE id = ?'
    ).bind(roleId).first();
    expect(check).toBeNull();
  });

  it('returns 404 when removing non-existent role', async () => {
    await seedHackathonWithOrganizer();

    const res = await SELF.fetch(`${baseUrl}/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: await authCookie(SEED.organizer.id) },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('NOT_FOUND');
  });
});
