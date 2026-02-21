import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSchema, resetDb, authCookie, insertUser, insertWorkspace,
  insertWorkspaceMember, SEED, env,
} from './helpers.js';
import type { ApiResponse } from './helpers.js';

describe('workspace routes — /api/v1/workspaces', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  // ── POST / — create workspace ──────────────────────────────────

  it('creates a workspace and adds creator as owner', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);

    const res = await SELF.fetch('http://localhost/api/v1/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.srijan.id),
      },
      body: JSON.stringify({ name: 'My Workspace', slug: 'my-ws', type: 'organization' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as ApiResponse<{ id: string; slug: string; name: string }>;
    expect(body.ok).toBe(true);
    expect(body.data.slug).toBe('my-ws');
    expect(body.data.name).toBe('My Workspace');

    // Verify creator is an owner
    const member = await env.DB.prepare(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
    ).bind(body.data.id, SEED.srijan.id).first();
    expect(member?.role).toBe('owner');
  });

  it('rejects workspace creation without auth → 401', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope', slug: 'nope', type: 'personal' }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  it('rejects duplicate slug → 409 SLUG_TAKEN', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertWorkspace('ws-existing', 'taken-slug', SEED.srijan.id);

    const res = await SELF.fetch('http://localhost/api/v1/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.srijan.id),
      },
      body: JSON.stringify({ name: 'Dupe', slug: 'taken-slug', type: 'organization' }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('SLUG_TAKEN');
  });

  it('rejects missing required fields → 400', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);

    const res = await SELF.fetch('http://localhost/api/v1/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.srijan.id),
      },
      body: JSON.stringify({ name: 'Missing Slug' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  // ── GET / — list workspaces ────────────────────────────────────

  it('lists only workspaces user belongs to', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);

    await insertWorkspace('ws-1', 'ws-one', SEED.srijan.id);
    await insertWorkspaceMember('ws-1', SEED.srijan.id, 'owner');

    await insertWorkspace('ws-2', 'ws-two', SEED.organizer.id);
    await insertWorkspaceMember('ws-2', SEED.organizer.id, 'owner');

    const res = await SELF.fetch('http://localhost/api/v1/workspaces', {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Array<{ slug: string }>>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].slug).toBe('ws-one');
  });

  // ── GET /:workspaceId — get workspace details ──────────────────

  it('returns workspace details', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertWorkspace('ws-detail', 'detail-ws', SEED.srijan.id, 'Detail WS');
    await insertWorkspaceMember('ws-detail', SEED.srijan.id, 'owner');

    const res = await SELF.fetch('http://localhost/api/v1/workspaces/ws-detail', {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ id: string; name: string }>;
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('Detail WS');
  });

  it('returns 404 for non-existent workspace', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);

    const res = await SELF.fetch('http://localhost/api/v1/workspaces/non-existent-id', {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  // ── PATCH /:workspaceId — update workspace ─────────────────────

  it('updates workspace as owner', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertWorkspace('ws-upd', 'upd-ws', SEED.srijan.id, 'Old Name');
    await insertWorkspaceMember('ws-upd', SEED.srijan.id, 'owner');

    const res = await SELF.fetch('http://localhost/api/v1/workspaces/ws-upd', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.srijan.id, { workspaceRoles: { 'ws-upd': 'owner' } }),
      },
      body: JSON.stringify({ name: 'New Name', description: 'Updated desc' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ name: string; description: string }>;
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('New Name');
  });

  it('rejects update as non-owner/non-admin → 403', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertWorkspace('ws-noauth', 'noauth-ws', SEED.srijan.id);
    await insertWorkspaceMember('ws-noauth', SEED.srijan.id, 'owner');
    await insertWorkspaceMember('ws-noauth', SEED.participant.id, 'workspace_member');

    const res = await SELF.fetch('http://localhost/api/v1/workspaces/ws-noauth', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authCookie(SEED.participant.id, { workspaceRoles: { 'ws-noauth': 'workspace_member' } }),
      },
      body: JSON.stringify({ name: 'Hijacked' }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  // ── GET /:workspaceId/members — list members ───────────────────

  it('lists workspace members', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);
    await insertWorkspace('ws-mem', 'mem-ws', SEED.srijan.id);
    await insertWorkspaceMember('ws-mem', SEED.srijan.id, 'owner');
    await insertWorkspaceMember('ws-mem', SEED.organizer.id, 'workspace_member');

    const res = await SELF.fetch('http://localhost/api/v1/workspaces/ws-mem/members', {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Array<{ user_id: string; role: string }>>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(2);
  });

  // ── DELETE /:workspaceId/members/:userId — remove member ───────

  it('removes member as owner', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertWorkspace('ws-rm', 'rm-ws', SEED.srijan.id);
    await insertWorkspaceMember('ws-rm', SEED.srijan.id, 'owner');
    await insertWorkspaceMember('ws-rm', SEED.participant.id, 'workspace_member');

    const res = await SELF.fetch(
      `http://localhost/api/v1/workspaces/ws-rm/members/${SEED.participant.id}`, {
        method: 'DELETE',
        headers: { Authorization: await authCookie(SEED.srijan.id, { workspaceRoles: { 'ws-rm': 'owner' } }) },
      }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ removed: boolean }>;
    expect(body.ok).toBe(true);
    expect(body.data.removed).toBe(true);

    // Verify member is removed from DB
    const check = await env.DB.prepare(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
    ).bind('ws-rm', SEED.participant.id).first();
    expect(check).toBeNull();
  });

  it('rejects removing member as non-owner → 403', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertWorkspace('ws-rm2', 'rm2-ws', SEED.srijan.id);
    await insertWorkspaceMember('ws-rm2', SEED.srijan.id, 'owner');
    await insertWorkspaceMember('ws-rm2', SEED.participant.id, 'workspace_member');

    const res = await SELF.fetch(
      `http://localhost/api/v1/workspaces/ws-rm2/members/${SEED.srijan.id}`, {
        method: 'DELETE',
        headers: { Authorization: await authCookie(SEED.participant.id, { workspaceRoles: { 'ws-rm2': 'workspace_member' } }) },
      }
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('owner cannot remove self → 409', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertWorkspace('ws-self', 'self-ws', SEED.srijan.id);
    await insertWorkspaceMember('ws-self', SEED.srijan.id, 'owner');

    const res = await SELF.fetch(
      `http://localhost/api/v1/workspaces/ws-self/members/${SEED.srijan.id}`, {
        method: 'DELETE',
        headers: { Authorization: await authCookie(SEED.srijan.id, { workspaceRoles: { 'ws-self': 'owner' } }) },
      }
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('CANNOT_REMOVE_SELF');
  });
});
