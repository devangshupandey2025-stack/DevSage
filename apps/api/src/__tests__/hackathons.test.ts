import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import {
  ensureSchema, resetDb, authCookie,
  insertUser, insertWorkspace, insertWorkspaceMember,
  insertHackathon, insertOrganizerRole, insertTeam,
  insertSubmission, insertRound,
  SEED, env,
} from './helpers.js';

describe('hackathon CRUD routes', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  // ── Create hackathon ────────────────────────────────────────

  it('POST create hackathon successfully', async () => {
    const { organizer, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertWorkspaceMember(workspace, organizer.id, 'owner');

    const res = await SELF.fetch(`http://localhost/api/v1/hackathons/workspaces/${workspace}/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(organizer.id, { workspaceRoles: { [workspace]: 'owner' } }),
      },
      body: JSON.stringify({ slug: 'hack-day', title: 'Hack Day' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; data: { slug: string; status: string; id: string } };
    expect(body.ok).toBe(true);
    expect(body.data.slug).toBe('hack-day');
    expect(body.data.status).toBe('draft');

    // Creator should be added as organizer
    const role = await env.DB
      .prepare('SELECT role FROM organizer_roles WHERE hackathon_id = ? AND user_id = ?')
      .bind(body.data.id, organizer.id).first<{ role: string }>();
    expect(role?.role).toBe('organizer');
  });

  it('POST create hackathon without auth → 401', async () => {
    const res = await SELF.fetch(`http://localhost/api/v1/hackathons/workspaces/${SEED.workspace}/hackathons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'no-auth', title: 'No Auth' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('POST create hackathon without workspace membership → 403', async () => {
    const { organizer, participant, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertWorkspaceMember(workspace, organizer.id, 'owner');
    // participant is NOT a workspace member

    const res = await SELF.fetch(`http://localhost/api/v1/hackathons/workspaces/${workspace}/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(participant.id),
      },
      body: JSON.stringify({ slug: 'forbidden-hack', title: 'Forbidden' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('POST create hackathon with regular workspace member (not owner/admin) → 403', async () => {
    const { organizer, participant, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertWorkspaceMember(workspace, organizer.id, 'owner');
    await insertWorkspaceMember(workspace, participant.id, 'workspace_member');

    const res = await SELF.fetch(`http://localhost/api/v1/hackathons/workspaces/${workspace}/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(participant.id, { workspaceRoles: { [workspace]: 'workspace_member' } }),
      },
      body: JSON.stringify({ slug: 'member-hack', title: 'Member Hack' }),
    });

    expect(res.status).toBe(403);
  });

  it('POST create hackathon with duplicate slug → 409', async () => {
    const { organizer, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertWorkspaceMember(workspace, organizer.id, 'owner');
    await insertHackathon({
      id: crypto.randomUUID(),
      workspaceId: workspace,
      slug: 'dup-slug',
      createdBy: organizer.id,
    });

    const res = await SELF.fetch(`http://localhost/api/v1/hackathons/workspaces/${workspace}/hackathons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(organizer.id, { workspaceRoles: { [workspace]: 'owner' } }),
      },
      body: JSON.stringify({ slug: 'dup-slug', title: 'Duplicate' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('SLUG_TAKEN');
  });

  // ── List hackathons ─────────────────────────────────────────

  it('GET /api/v1/hackathons — returns paginated results', async () => {
    const { organizer, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertHackathon({ id: crypto.randomUUID(), workspaceId: workspace, slug: 'list-h1', createdBy: organizer.id, status: 'active' });
    await insertHackathon({ id: crypto.randomUUID(), workspaceId: workspace, slug: 'list-h2', createdBy: organizer.id, status: 'active' });

    const res = await SELF.fetch('http://localhost/api/v1/hackathons?limit=10&offset=0');

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: unknown[]; meta: { total: number; limit: number; offset: number; has_more: boolean } };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.meta.total).toBe(2);
    expect(body.meta.has_more).toBe(false);
  });

  it('GET /api/v1/hackathons — filter by status', async () => {
    const { organizer, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertHackathon({ id: crypto.randomUUID(), workspaceId: workspace, slug: 'active-h', createdBy: organizer.id, status: 'active' });
    await insertHackathon({ id: crypto.randomUUID(), workspaceId: workspace, slug: 'draft-h', createdBy: organizer.id, status: 'draft' });

    const res = await SELF.fetch('http://localhost/api/v1/hackathons?status=active');

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: Array<{ slug: string; status: string }> };
    expect(body.ok).toBe(true);
    expect(body.data.every((h) => h.status === 'active')).toBe(true);
    expect(body.data.length).toBe(1);
  });

  // ── Get hackathon by slug ───────────────────────────────────

  it('GET /api/v1/hackathons/:slug — returns hackathon', async () => {
    const { organizer, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertHackathon({ id: SEED.hackathon, workspaceId: workspace, slug: 'my-hack', createdBy: organizer.id, status: 'active' });

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/my-hack');

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { slug: string; title: string } };
    expect(body.ok).toBe(true);
    expect(body.data.slug).toBe('my-hack');
  });

  it('GET /api/v1/hackathons/:slug — nonexistent → 404', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/hackathons/does-not-exist');

    expect(res.status).toBe(404);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('HACKATHON_NOT_FOUND');
  });

  // ── Update hackathon ────────────────────────────────────────

  it('PATCH /api/v1/hackathons/:slug — update as co_organizer', async () => {
    const { organizer, coOrganizer, workspace, hackathon } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertUser(coOrganizer.id, coOrganizer.email, coOrganizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertHackathon({ id: hackathon, workspaceId: workspace, slug: 'update-hack', createdBy: organizer.id });
    await insertOrganizerRole(hackathon, coOrganizer.id, 'co_organizer');

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/update-hack', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(coOrganizer.id),
      },
      body: JSON.stringify({ title: 'Updated Title', description: 'New desc' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { title: string; description: string } };
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe('Updated Title');
    expect(body.data.description).toBe('New desc');
  });

  it('PATCH /api/v1/hackathons/:slug — non-organizer → 403', async () => {
    const { organizer, participant, workspace, hackathon } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertHackathon({ id: hackathon, workspaceId: workspace, slug: 'no-update', createdBy: organizer.id });

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/no-update', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(participant.id),
      },
      body: JSON.stringify({ title: 'Should Fail' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // ── State transitions ───────────────────────────────────────

  it.skip('POST /api/v1/hackathons/:slug/transition — draft → active', async () => {
    // SKIPPED: Transition route delegates to Durable Object which requires DO initialization.
    // DB-inserted hackathons don't have DO state. DO transitions are tested in hackathon-state-machine.test.ts.
    const { organizer, workspace, hackathon } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertHackathon({ id: hackathon, workspaceId: workspace, slug: 'trans-hack', createdBy: organizer.id, status: 'draft' });
    await insertOrganizerRole(hackathon, organizer.id, 'organizer');

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/trans-hack/transition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(organizer.id),
      },
      body: JSON.stringify({ target_status: 'active', version: 0 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { status: string } };
    expect(body.ok).toBe(true);
  });

  it('POST /api/v1/hackathons/:slug/transition — missing params → 400', async () => {
    const { organizer, workspace, hackathon } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertHackathon({ id: hackathon, workspaceId: workspace, slug: 'bad-trans', createdBy: organizer.id, status: 'draft' });
    await insertOrganizerRole(hackathon, organizer.id, 'organizer');

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/bad-trans/transition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(organizer.id),
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/hackathons/:slug/transition — non-organizer → 403', async () => {
    const { organizer, participant, workspace, hackathon } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    await insertHackathon({ id: hackathon, workspaceId: workspace, slug: 'forbidden-trans', createdBy: organizer.id, status: 'draft' });

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/forbidden-trans/transition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(participant.id),
      },
      body: JSON.stringify({ target_status: 'active', version: 0 }),
    });

    expect(res.status).toBe(403);
  });

  // ── Delete hackathon ────────────────────────────────────────

  it('DELETE /api/v1/hackathons/:slug — delete draft hackathon', async () => {
    const { organizer, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    const hackId = crypto.randomUUID();
    await insertHackathon({ id: hackId, workspaceId: workspace, slug: 'del-hack', createdBy: organizer.id, status: 'draft' });
    await insertOrganizerRole(hackId, organizer.id, 'organizer');

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/del-hack', {
      method: 'DELETE',
      headers: { Authorization: await authCookie(organizer.id) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { deleted: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);

    // Confirm it's gone
    const gone = await env.DB.prepare('SELECT id FROM hackathons WHERE id = ?').bind(hackId).first();
    expect(gone).toBeNull();
  });

  it('DELETE /api/v1/hackathons/:slug — non-draft → 409', async () => {
    const { organizer, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    const hackId = crypto.randomUUID();
    await insertHackathon({ id: hackId, workspaceId: workspace, slug: 'active-del', createdBy: organizer.id, status: 'active' });
    await insertOrganizerRole(hackId, organizer.id, 'organizer');

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/active-del', {
      method: 'DELETE',
      headers: { Authorization: await authCookie(organizer.id) },
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_STATE');
  });

  it('DELETE /api/v1/hackathons/:slug — non-organizer → 403', async () => {
    const { organizer, participant, workspace } = SEED;
    await insertUser(organizer.id, organizer.email, organizer.name);
    await insertUser(participant.id, participant.email, participant.name);
    await insertWorkspace(workspace, 'test-ws', organizer.id);
    const hackId = crypto.randomUUID();
    await insertHackathon({ id: hackId, workspaceId: workspace, slug: 'no-del', createdBy: organizer.id, status: 'draft' });

    const res = await SELF.fetch('http://localhost/api/v1/hackathons/no-del', {
      method: 'DELETE',
      headers: { Authorization: await authCookie(participant.id) },
    });

    expect(res.status).toBe(403);
  });
});
