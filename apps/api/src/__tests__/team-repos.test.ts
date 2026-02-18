import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSchema, resetDb, authCookie, insertUser, insertWorkspace,
  insertWorkspaceMember, insertHackathon, insertOrganizerRole,
  insertTeam, insertTeamMember, insertTeamRepo, SEED, env,
} from './helpers.js';
import type { ApiResponse } from './helpers.js';

describe('team-repo routes — /api/v1/hackathons/:slug/teams/:teamId/repo', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  async function seedTeamScenario() {
    await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
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
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Alpha Team' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');
  }

  function repoUrl(teamId: string) {
    return `http://localhost/api/v1/hackathons/${SEED.hackathonSlug}/teams/${teamId}/repo`;
  }

  // ── POST /:teamId/repo — link repo ─────────────────────────────

  it('links repo as team leader', async () => {
    await seedTeamScenario();

    const res = await SELF.fetch(repoUrl(SEED.team), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(SEED.lead.id),
      },
      body: JSON.stringify({ github_repo_url: 'https://github.com/test-org/test-repo' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as ApiResponse<{
      id: string; team_id: string; github_owner: string; github_repo: string;
    }>;
    expect(body.ok).toBe(true);
    expect(body.data.team_id).toBe(SEED.team);
    expect(body.data.github_owner).toBe('test-org');
    expect(body.data.github_repo).toBe('test-repo');
  });

  it('rejects linking repo as non-leader → 403', async () => {
    await seedTeamScenario();

    const res = await SELF.fetch(repoUrl(SEED.team), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(SEED.participant.id),
      },
      body: JSON.stringify({ github_repo_url: 'https://github.com/other/repo' }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('rejects linking repo without auth → 401', async () => {
    await seedTeamScenario();

    const res = await SELF.fetch(repoUrl(SEED.team), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_repo_url: 'https://github.com/anon/repo' }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  it('rejects invalid github URL → 400', async () => {
    await seedTeamScenario();

    const res = await SELF.fetch(repoUrl(SEED.team), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(SEED.lead.id),
      },
      body: JSON.stringify({ github_repo_url: 'not-a-url' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  // ── GET /:teamId/repo — get repo ───────────────────────────────

  it('returns linked repo', async () => {
    await seedTeamScenario();
    await insertTeamRepo({
      id: 'repo-1', teamId: SEED.team, owner: 'my-org', repo: 'my-repo',
      linkedBy: SEED.lead.id,
    });

    const res = await SELF.fetch(repoUrl(SEED.team));

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{
      github_owner: string; github_repo: string; github_repo_url: string;
    }>;
    expect(body.ok).toBe(true);
    expect(body.data.github_owner).toBe('my-org');
    expect(body.data.github_repo).toBe('my-repo');
    expect(body.data.github_repo_url).toBe('https://github.com/my-org/my-repo');
  });

  it('returns 404 when no repo is linked', async () => {
    await seedTeamScenario();

    const res = await SELF.fetch(repoUrl(SEED.team));

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  // ── DELETE /:teamId/repo — unlink repo ─────────────────────────

  it('unlinks repo as leader', async () => {
    await seedTeamScenario();
    await insertTeamRepo({
      id: 'repo-del', teamId: SEED.team, owner: 'del-org', repo: 'del-repo',
      linkedBy: SEED.lead.id,
    });

    const res = await SELF.fetch(repoUrl(SEED.team), {
      method: 'DELETE',
      headers: { Cookie: await authCookie(SEED.lead.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ unlinked: boolean }>;
    expect(body.ok).toBe(true);
    expect(body.data.unlinked).toBe(true);

    // Verify deletion
    const check = await env.DB.prepare(
      'SELECT id FROM team_repos WHERE team_id = ?'
    ).bind(SEED.team).first();
    expect(check).toBeNull();
  });

  it('rejects unlinking repo as non-leader → 403', async () => {
    await seedTeamScenario();
    await insertTeamRepo({
      id: 'repo-prot', teamId: SEED.team, owner: 'prot-org', repo: 'prot-repo',
      linkedBy: SEED.lead.id,
    });

    const res = await SELF.fetch(repoUrl(SEED.team), {
      method: 'DELETE',
      headers: { Cookie: await authCookie(SEED.participant.id) },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('FORBIDDEN');
  });
});
