import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resolveRole } from '../middleware/role.js';
import {
  ensureSchema, resetDb, authCookie,
  insertUser, insertWorkspace, insertWorkspaceMember,
  insertHackathon, insertOrganizerRole, insertTeam,
  insertTeamMember, insertJudge,
  SEED, env,
} from './helpers.js';

const hackathonId = SEED.hackathon;
const workspaceId = SEED.workspace;

async function seedBase() {
  await insertUser(SEED.organizer.id, SEED.organizer.email, SEED.organizer.name);
  await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
  await insertWorkspace(workspaceId, 'devsage', SEED.organizer.id);
  await insertHackathon({
    id: hackathonId, workspaceId, slug: SEED.hackathonSlug,
    createdBy: SEED.organizer.id, status: 'active',
  });
}

describe('role resolution — resolveRole', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => {
    await resetDb();
    // Clear KV role cache for all seed users
    const userIds = [SEED.organizer.id, SEED.participant.id, SEED.judge.id, SEED.lead.id];
    for (const uid of userIds) {
      await env.KV.delete(`role:${uid}:${hackathonId}`);
    }
  });

  it('returns anonymous for null userId', async () => {
    await seedBase();
    const role = await resolveRole(env.DB, env.KV, undefined, hackathonId, workspaceId);
    expect(role).toBe('anonymous');
  });

  it('returns organizer for organizer_roles organizer entry', async () => {
    await seedBase();
    await insertOrganizerRole(hackathonId, SEED.organizer.id, 'organizer');
    const role = await resolveRole(env.DB, env.KV, SEED.organizer.id, hackathonId, workspaceId);
    expect(role).toBe('organizer');
  });

  it('returns co_organizer for organizer_roles co_organizer entry', async () => {
    await seedBase();
    await insertOrganizerRole(hackathonId, SEED.participant.id, 'co_organizer');
    const role = await resolveRole(env.DB, env.KV, SEED.participant.id, hackathonId, workspaceId);
    expect(role).toBe('co_organizer');
  });

  it('returns judge for accepted judge invite', async () => {
    await seedBase();
    await insertUser(SEED.judge.id, SEED.judge.email, SEED.judge.name);
    await insertJudge({ id: 'j-1', hackathonId, userId: SEED.judge.id, inviteStatus: 'accepted', invitedBy: SEED.organizer.id });
    const role = await resolveRole(env.DB, env.KV, SEED.judge.id, hackathonId, workspaceId);
    expect(role).toBe('judge');
  });

  it('does not return judge for pending invite', async () => {
    await seedBase();
    await insertUser(SEED.judge.id, SEED.judge.email, SEED.judge.name);
    await insertJudge({ id: 'j-2', hackathonId, userId: SEED.judge.id, inviteStatus: 'pending', invitedBy: SEED.organizer.id });
    const role = await resolveRole(env.DB, env.KV, SEED.judge.id, hackathonId, workspaceId);
    expect(role).toBe('anonymous');
  });

  it('returns leader for team member with leader role', async () => {
    await seedBase();
    await insertUser(SEED.lead.id, SEED.lead.email, SEED.lead.name);
    await insertTeam({ id: SEED.team, hackathonId, name: 'Alpha' });
    await insertTeamMember(SEED.team, SEED.lead.id, 'leader');
    const role = await resolveRole(env.DB, env.KV, SEED.lead.id, hackathonId, workspaceId);
    expect(role).toBe('leader');
  });

  it('returns member for team member with member role', async () => {
    await seedBase();
    await insertTeam({ id: SEED.team, hackathonId, name: 'Alpha' });
    await insertTeamMember(SEED.team, SEED.participant.id, 'member');
    const role = await resolveRole(env.DB, env.KV, SEED.participant.id, hackathonId, workspaceId);
    expect(role).toBe('member');
  });

  it('workspace owner gets organizer via fallback', async () => {
    await seedBase();
    await insertWorkspaceMember(workspaceId, SEED.organizer.id, 'owner');
    const role = await resolveRole(env.DB, env.KV, SEED.organizer.id, hackathonId, workspaceId);
    expect(role).toBe('organizer');
  });

  it('organizer beats judge when user has both', async () => {
    await seedBase();
    await insertOrganizerRole(hackathonId, SEED.organizer.id, 'organizer');
    await insertJudge({ id: 'j-dual', hackathonId, userId: SEED.organizer.id, inviteStatus: 'accepted', invitedBy: SEED.organizer.id });
    const role = await resolveRole(env.DB, env.KV, SEED.organizer.id, hackathonId, workspaceId);
    expect(role).toBe('organizer');
  });

  it('caches role in KV on second call', async () => {
    await seedBase();
    await insertOrganizerRole(hackathonId, SEED.organizer.id, 'organizer');

    const role1 = await resolveRole(env.DB, env.KV, SEED.organizer.id, hackathonId, workspaceId);
    expect(role1).toBe('organizer');

    // Remove from DB — KV cache should still return organizer
    await env.DB.prepare('DELETE FROM organizer_roles WHERE hackathon_id = ? AND user_id = ?')
      .bind(hackathonId, SEED.organizer.id).run();

    const role2 = await resolveRole(env.DB, env.KV, SEED.organizer.id, hackathonId, workspaceId);
    expect(role2).toBe('organizer');
  });

  it('returns anonymous for authenticated user with no roles', async () => {
    await seedBase();
    const role = await resolveRole(env.DB, env.KV, SEED.participant.id, hackathonId, workspaceId);
    expect(role).toBe('anonymous');
  });
});
