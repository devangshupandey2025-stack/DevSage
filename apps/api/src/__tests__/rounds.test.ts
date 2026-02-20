import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSchema, resetDb, authCookie, insertUser, insertWorkspace,
  insertWorkspaceMember, insertHackathon, insertOrganizerRole,
  insertRound, SEED, env,
} from './helpers.js';
import type { ApiResponse } from './helpers.js';

describe('round routes — /api/v1/hackathons/:slug/rounds', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  async function seedHackathonWithOrganizer() {
    await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);
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

  const baseUrl = `http://localhost/api/v1/hackathons/${SEED.hackathonSlug}/rounds`;

  // ── POST / — create round ─────────────────────────────────────

  it('creates a round as organizer', async () => {
    await seedHackathonWithOrganizer();

    const res = await SELF.fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.organizer.id),
      },
      body: JSON.stringify({ name: 'Round 1', round_number: 1, type: 'standard' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as ApiResponse<{ id: string; name: string; round_number: number; status: string }>;
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('Round 1');
    expect(body.data.round_number).toBe(1);
    expect(body.data.status).toBe('upcoming');
  });

  it('creates round as co_organizer', async () => {
    await seedHackathonWithOrganizer();
    await insertUser(SEED.coOrganizer.id, SEED.coOrganizer.email, SEED.coOrganizer.name);
    await insertOrganizerRole(SEED.hackathon, SEED.coOrganizer.id, 'co_organizer');

    const res = await SELF.fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.coOrganizer.id),
      },
      body: JSON.stringify({ name: 'Round 2', round_number: 2 }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as ApiResponse<{ name: string }>;
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('Round 2');
  });

  it('rejects round creation without auth → 401', async () => {
    await seedHackathonWithOrganizer();

    const res = await SELF.fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthed', round_number: 1 }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  it('rejects round creation as non-organizer → 403', async () => {
    await seedHackathonWithOrganizer();

    const res = await SELF.fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.participant.id),
      },
      body: JSON.stringify({ name: 'Forbidden', round_number: 1 }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  // ── GET / — list rounds ────────────────────────────────────────

  it('lists rounds for hackathon', async () => {
    await seedHackathonWithOrganizer();
    await insertRound({ id: 'r-1', hackathonId: SEED.hackathon, name: 'Round A', roundNumber: 1 });
    await insertRound({ id: 'r-2', hackathonId: SEED.hackathon, name: 'Round B', roundNumber: 2 });

    const res = await SELF.fetch(baseUrl);

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Array<{ name: string; round_number: number }>>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0].round_number).toBe(1);
    expect(body.data[1].round_number).toBe(2);
  });

  // ── PATCH /:roundId — update round ─────────────────────────────

  it('updates round as organizer', async () => {
    await seedHackathonWithOrganizer();
    await insertRound({ id: 'r-upd', hackathonId: SEED.hackathon, name: 'Old Name', roundNumber: 1 });

    const res = await SELF.fetch(`${baseUrl}/r-upd`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.organizer.id),
      },
      body: JSON.stringify({ name: 'New Name', status: 'active' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ name: string; status: string }>;
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('New Name');
    expect(body.data.status).toBe('active');
  });

  // ── DELETE /:roundId — delete round ────────────────────────────

  it('deletes round as organizer', async () => {
    await seedHackathonWithOrganizer();
    await insertRound({ id: 'r-del', hackathonId: SEED.hackathon, name: 'Doomed', roundNumber: 1 });

    const res = await SELF.fetch(`${baseUrl}/r-del`, {
      method: 'DELETE',
      headers: { Authorization: await authCookie(SEED.organizer.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);

    // Verify deletion
    const check = await env.DB.prepare('SELECT id FROM hackathon_rounds WHERE id = ?').bind('r-del').first();
    expect(check).toBeNull();
  });

  it('rejects delete as non-organizer → 403', async () => {
    await seedHackathonWithOrganizer();
    await insertRound({ id: 'r-nodel', hackathonId: SEED.hackathon, name: 'Protected', roundNumber: 1 });

    const res = await SELF.fetch(`${baseUrl}/r-nodel`, {
      method: 'DELETE',
      headers: { Authorization: await authCookie(SEED.participant.id) },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  // ── round_number auto-increment ────────────────────────────────

  it('supports multiple rounds with distinct round_numbers', async () => {
    await seedHackathonWithOrganizer();

    for (let i = 1; i <= 3; i++) {
      const res = await SELF.fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: await authCookie(SEED.organizer.id),
        },
        body: JSON.stringify({ name: `Round ${i}`, round_number: i }),
      });
      expect(res.status).toBe(201);
    }

    const listRes = await SELF.fetch(baseUrl);
    const listBody = (await listRes.json()) as ApiResponse<Array<{ round_number: number }>>;
    expect(listBody.data.length).toBe(3);
    expect(listBody.data.map(r => r.round_number)).toEqual([1, 2, 3]);
  });
});
