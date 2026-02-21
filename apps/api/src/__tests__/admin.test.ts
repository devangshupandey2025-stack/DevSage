import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import {
  ensureSchema, resetDb, authCookie,
  insertUser, insertWorkspace, insertHackathon,
  insertPlatformAdmin, insertTeam, insertSubmission,
  insertRound,
  SEED, env,
} from './helpers.js';

describe('admin routes', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  // ── Auth guards ─────────────────────────────────────────────

  it('GET /api/v1/admin/users — unauthenticated → 401', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/admin/users');

    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('GET /api/v1/admin/users — non-admin → 403', async () => {
    const { participant } = SEED;
    await insertUser(participant.id, participant.email, participant.name);

    const res = await SELF.fetch('http://localhost/api/v1/admin/users', {
      headers: { Authorization: await authCookie(participant.id) },
    });

    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // ── List users ──────────────────────────────────────────────

  it('GET /api/v1/admin/users — lists users as admin', async () => {
    const { admin, participant, organizer } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertPlatformAdmin(admin.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/users?limit=10&offset=0', {
      headers: { Authorization: await authCookie(admin.id, { platformAdmin: true }) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: Array<{ id: string; email: string }>;
      meta: { total: number; limit: number; offset: number; has_more: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(3);
    expect(body.meta.total).toBe(3);
    expect(body.meta.has_more).toBe(false);
  });

  it('GET /api/v1/admin/users — respects pagination', async () => {
    const { admin, participant, organizer } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertPlatformAdmin(admin.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/users?limit=1&offset=0', {
      headers: { Authorization: await authCookie(admin.id, { platformAdmin: true }) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: unknown[];
      meta: { total: number; limit: number; has_more: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.meta.total).toBe(3);
    expect(body.meta.has_more).toBe(true);
  });

  // ── List hackathons ─────────────────────────────────────────

  it('GET /api/v1/admin/hackathons — lists all hackathons as admin', async () => {
    const { admin, workspace } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertPlatformAdmin(admin.id);
    await insertWorkspace(workspace, 'test-ws', admin.id);
    await insertHackathon({ id: crypto.randomUUID(), workspaceId: workspace, slug: 'admin-h1', createdBy: admin.id, status: 'draft' });
    await insertHackathon({ id: crypto.randomUUID(), workspaceId: workspace, slug: 'admin-h2', createdBy: admin.id, status: 'active' });

    const res = await SELF.fetch('http://localhost/api/v1/admin/hackathons', {
      headers: { Authorization: await authCookie(admin.id, { platformAdmin: true }) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: Array<{ slug: string }>;
      meta: { total: number };
    };
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.meta.total).toBe(2);
  });

  // ── List admins ─────────────────────────────────────────────

  it('GET /api/v1/admin/admins — lists platform admins', async () => {
    const { admin, srijan } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertUser(srijan.id, srijan.email, srijan.name);
    await insertPlatformAdmin(admin.id);
    await insertPlatformAdmin(srijan.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/admins', {
      headers: { Authorization: await authCookie(admin.id, { platformAdmin: true }) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: Array<{ user_id: string; name: string; email: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(2);
    const ids = body.data.map((a) => a.user_id);
    expect(ids).toContain(admin.id);
    expect(ids).toContain(srijan.id);
  });

  // ── Add platform admin ──────────────────────────────────────

  it('POST /api/v1/admin/admins — add platform admin', async () => {
    const { admin, participant } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertPlatformAdmin(admin.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/admins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(admin.id, { platformAdmin: true }),
      },
      body: JSON.stringify({ user_id: participant.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; data: { id: string } };
    expect(body.ok).toBe(true);
    expect(body.data.id).toBeTruthy();

    // Verify in DB
    const record = await env.DB
      .prepare('SELECT user_id, created_by FROM platform_admins WHERE user_id = ?')
      .bind(participant.id).first<{ user_id: string; created_by: string }>();
    expect(record?.user_id).toBe(participant.id);
    expect(record?.created_by).toBe(admin.id);
  });

  it('POST /api/v1/admin/admins — duplicate admin → 409', async () => {
    const { admin, participant } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertPlatformAdmin(admin.id);
    await insertPlatformAdmin(participant.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/admins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(admin.id, { platformAdmin: true }),
      },
      body: JSON.stringify({ user_id: participant.id }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('ALREADY_ADMIN');
  });

  it('POST /api/v1/admin/admins — missing user_id → 400', async () => {
    const { admin } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertPlatformAdmin(admin.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/admins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(admin.id, { platformAdmin: true }),
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // ── Remove platform admin ──────────────────────────────────

  it('DELETE /api/v1/admin/admins/:userId — remove platform admin', async () => {
    const { admin, srijan } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertUser(srijan.id, srijan.email, srijan.name);
    await insertPlatformAdmin(admin.id);
    await insertPlatformAdmin(srijan.id);

    const res = await SELF.fetch(`http://localhost/api/v1/admin/admins/${srijan.id}`, {
      method: 'DELETE',
      headers: { Authorization: await authCookie(admin.id, { platformAdmin: true }) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { removed: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.removed).toBe(true);

    // Verify removed from DB
    const gone = await env.DB
      .prepare('SELECT id FROM platform_admins WHERE user_id = ?')
      .bind(srijan.id).first();
    expect(gone).toBeNull();
  });

  it('DELETE /api/v1/admin/admins/:userId — cannot remove self → 409', async () => {
    const { admin } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertPlatformAdmin(admin.id);

    const res = await SELF.fetch(`http://localhost/api/v1/admin/admins/${admin.id}`, {
      method: 'DELETE',
      headers: { Authorization: await authCookie(admin.id, { platformAdmin: true }) },
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('CANNOT_REMOVE_SELF');
  });

  // ── Stats ───────────────────────────────────────────────────

  it('GET /api/v1/admin/stats — returns system counts', async () => {
    const { admin, participant, workspace, hackathon, round, team } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertPlatformAdmin(admin.id);
    await insertWorkspace(workspace, 'test-ws', admin.id);
    await insertHackathon({ id: hackathon, workspaceId: workspace, slug: 'stats-hack', createdBy: admin.id });
    await insertRound({ id: round, hackathonId: hackathon });
    await insertTeam({ id: team, hackathonId: hackathon, name: 'Stats Team' });
    await insertSubmission({ id: crypto.randomUUID(), teamId: team, hackathonId: hackathon, roundId: round });

    const res = await SELF.fetch('http://localhost/api/v1/admin/stats', {
      headers: { Authorization: await authCookie(admin.id, { platformAdmin: true }) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: { users: number; hackathons: number; teams: number; submissions: number };
    };
    expect(body.ok).toBe(true);
    expect(body.data.users).toBe(2);
    expect(body.data.hackathons).toBe(1);
    expect(body.data.teams).toBe(1);
    expect(body.data.submissions).toBe(1);
  });

  // ── Audit backfill ──────────────────────────────────────────

  it('POST /api/v1/admin/audit/backfill — triggers backfill', async () => {
    const { admin } = SEED;
    await insertUser(admin.id, admin.email, admin.name);
    await insertPlatformAdmin(admin.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/audit/backfill', {
      method: 'POST',
      headers: { Authorization: await authCookie(admin.id, { platformAdmin: true }) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { processed: number } };
    expect(body.ok).toBe(true);
    expect(typeof body.data.processed).toBe('number');
  });
});
