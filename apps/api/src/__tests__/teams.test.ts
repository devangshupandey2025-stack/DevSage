import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import {
  ensureSchema, resetDb, authCookie,
  insertUser, insertWorkspace, insertWorkspaceMember,
  insertHackathon, insertOrganizerRole,
  insertTeam, insertTeamMember,
  SEED, env,
} from './helpers.js';

const slug = SEED.hackathonSlug;
const base = `/api/v1/hackathons/${slug}/teams`;

async function seedHackathonContext(status: string = 'active') {
  await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);
  await insertWorkspace(SEED.workspace, 'devsage', SEED.organizer.id);
  await insertWorkspaceMember(SEED.workspace, SEED.organizer.id, 'owner');
  await insertHackathon({
    id: SEED.hackathon,
    workspaceId: SEED.workspace,
    slug,
    createdBy: SEED.organizer.id,
    status,
  });
  await insertOrganizerRole(SEED.hackathon, SEED.organizer.id, 'organizer');
}

describe('Teams API', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  // ── 1. Create team successfully ────────────────────────────
  it('creates a team successfully', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);

    const res = await SELF.fetch(`http://localhost${base}`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.lead.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alpha Team' }),
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { ok: boolean; data: { id: string; name: string; invite_code: string } };
    expect(json.ok).toBe(true);
    expect(json.data.name).toBe('Alpha Team');
    expect(json.data.invite_code).toBeTruthy();
  });

  // ── 2. Create team without auth → 401 ─────────────────────
  it('rejects team creation without auth', async () => {
    await seedHackathonContext('active');

    const res = await SELF.fetch(`http://localhost${base}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth Team' }),
    });

    expect(res.status).toBe(401);
  });

  // ── 3. List teams ─────────────────────────────────────────
  it('lists teams for a hackathon', async () => {
    await seedHackathonContext('active');
    await insertTeam({ id: 'team-list-1', hackathonId: SEED.hackathon, name: 'Team A' });
    await insertTeam({ id: 'team-list-2', hackathonId: SEED.hackathon, name: 'Team B' });

    const res = await SELF.fetch(`http://localhost${base}`);

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: unknown[] };
    expect(json.ok).toBe(true);
    expect(json.data.length).toBe(2);
  });

  // ── 4. Get team by ID ─────────────────────────────────────
  it('gets a team by ID', async () => {
    await seedHackathonContext('active');
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Seed Team' });

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}`);

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: { id: string; name: string } };
    expect(json.ok).toBe(true);
    expect(json.data.id).toBe(SEED.team);
    expect(json.data.name).toBe('Seed Team');
  });

  // ── 5. Get team members ───────────────────────────────────
  it('gets team members', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Seed Team' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}/members`);

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: Array<{ user_id: string; role: string }> };
    expect(json.ok).toBe(true);
    expect(json.data.length).toBe(2);
    const roles = json.data.map(m => m.role);
    expect(roles).toContain('leader');
    expect(roles).toContain('member');
  });

  // ── 6. Join team with invite code ─────────────────────────
  it('joins a team with invite code', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Join Team', inviteCode: 'JOIN1234' });

    const res = await SELF.fetch(`http://localhost${base}/join`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.participant.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: 'JOIN1234' }),
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { ok: boolean; data: { joined: boolean; team_id: string } };
    expect(json.ok).toBe(true);
    expect(json.data.joined).toBe(true);
    expect(json.data.team_id).toBe(SEED.team);
  });

  // ── 7. Join team when already on a team → error ───────────
  it('rejects join when already on a team', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Existing Team' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
    await insertTeam({ id: 'team-other', hackathonId: SEED.hackathon, name: 'Other Team', inviteCode: 'OTHER123' });

    const res = await SELF.fetch(`http://localhost${base}/join`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.lead.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: 'OTHER123' }),
    });

    expect(res.status).toBe(409);
    const json = await res.json() as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('ALREADY_ON_TEAM');
  });

  // ── 8. Update team as leader ──────────────────────────────
  it('updates a team as leader', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Old Name' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}`, {
      method: 'PATCH',
      headers: { Authorization: await authCookie(SEED.lead.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: { name: string } };
    expect(json.ok).toBe(true);
    expect(json.data.name).toBe('New Name');
  });

  // ── 9. Update team as non-leader → forbidden ─────────────
  it('rejects team update from non-leader', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Team X' });
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}`, {
      method: 'PATCH',
      headers: { Authorization: await authCookie(SEED.participant.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });

    expect(res.status).toBe(403);
    const json = await res.json() as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  // ── 10. Remove member as leader ───────────────────────────
  it('removes a member as leader', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Removal Team' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}/members/${SEED.participant.id}`, {
      method: 'DELETE',
      headers: { Authorization: await authCookie(SEED.lead.id) },
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: { removed: boolean } };
    expect(json.ok).toBe(true);
    expect(json.data.removed).toBe(true);

    const check = await env.DB.prepare(
      'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?'
    ).bind(SEED.team, SEED.participant.id).first();
    expect(check).toBeNull();
  });

  // ── 11. Leave team as member ──────────────────────────────
  it('lets a member leave the team', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Leave Team' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}/leave`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.participant.id) },
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: { left: boolean } };
    expect(json.ok).toBe(true);
    expect(json.data.left).toBe(true);
  });

  // ── 12. Transfer leadership ───────────────────────────────
  it('transfers leadership to another member', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Transfer Team' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}/transfer`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.lead.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_leader_id: SEED.participant.id }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: { transferred: boolean } };
    expect(json.ok).toBe(true);
    expect(json.data.transferred).toBe(true);

    const newLeader = await env.DB.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).bind(SEED.team, SEED.participant.id).first<{ role: string }>();
    expect(newLeader?.role).toBe('leader');

    const oldLeader = await env.DB.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).bind(SEED.team, SEED.lead.id).first<{ role: string }>();
    expect(oldLeader?.role).toBe('member');
  });

  // ── 13. Dissolve team as leader ───────────────────────────
  it('dissolves a team as leader', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Dissolve Team' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}/dissolve`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.lead.id) },
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: { dissolved: boolean } };
    expect(json.ok).toBe(true);
    expect(json.data.dissolved).toBe(true);

    const team = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(SEED.team).first();
    expect(team).toBeNull();
    const members = await env.DB.prepare('SELECT id FROM team_members WHERE team_id = ?').bind(SEED.team).all();
    expect(members.results.length).toBe(0);
  });

  // ── 14. Create team when hackathon not active → error ─────
  it('rejects team creation when hackathon is in judging state', async () => {
    await seedHackathonContext('judging');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);

    const res = await SELF.fetch(`http://localhost${base}`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.lead.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Late Team' }),
    });

    expect(res.status).toBe(409);
    const json = await res.json() as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('INVALID_STATE');
  });

  // ── 15. Leader cannot leave without transferring ──────────
  it('prevents leader from leaving without transferring', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Lead Team' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}/leave`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.lead.id) },
    });

    expect(res.status).toBe(409);
    const json = await res.json() as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('CANNOT_LEAVE_AS_LEAD');
  });

  // ── 16. Create team when already on a team → error ────────
  it('rejects team creation when user is already on a team', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Existing' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');

    const res = await SELF.fetch(`http://localhost${base}`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.lead.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second Team' }),
    });

    expect(res.status).toBe(409);
    const json = await res.json() as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('ALREADY_ON_TEAM');
  });

  // ── 17. Dissolve team as non-leader → forbidden ───────────
  it('rejects dissolve from non-leader', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertTeam({ id: SEED.team, hackathonId: SEED.hackathon, name: 'Undissolvable' });
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');

    const res = await SELF.fetch(`http://localhost${base}/${SEED.team}/dissolve`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.participant.id) },
    });

    expect(res.status).toBe(403);
    const json = await res.json() as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  // ── 18. Join team with invalid invite code → 404 ──────────
  it('rejects join with invalid invite code', async () => {
    await seedHackathonContext('active');
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);

    const res = await SELF.fetch(`http://localhost${base}/join`, {
      method: 'POST',
      headers: { Authorization: await authCookie(SEED.participant.id), 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: 'INVALID0' }),
    });

    expect(res.status).toBe(404);
    const json = await res.json() as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('INVALID_INVITE_CODE');
  });
});
