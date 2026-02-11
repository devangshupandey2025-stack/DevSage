import { SELF, env as rawEnv } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { signJWT } from '../lib/jwt.js';
import type { Env } from '../types/env.js';

const env = rawEnv as Env;

const JWT_SECRET = 'dev-secret-key-min-32-chars-long!!';
const now = new Date().toISOString();

async function authCookie(userId: string, ghid: number, ghu: string): Promise<string> {
  const token = await signJWT({ sub: userId, ghid, ghu }, JWT_SECRET);
  return `session=${token}`;
}

async function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, github_id INTEGER NOT NULL, google_id TEXT, github_username TEXT NOT NULL, display_name TEXT NOT NULL, email TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_unique ON users (github_id)`,
    `CREATE TABLE IF NOT EXISTS hackathons (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT, rules_md TEXT, registration_opens TEXT NOT NULL, registration_closes TEXT NOT NULL, submission_deadline TEXT NOT NULL, judging_starts TEXT, judging_ends TEXT, min_team_size INTEGER DEFAULT 1 NOT NULL, max_team_size INTEGER DEFAULT 5 NOT NULL, max_teams INTEGER, submission_tag_pattern TEXT DEFAULT 'submission_v%' NOT NULL, max_submissions_per_team INTEGER, allow_late_submissions INTEGER DEFAULT 0 NOT NULL, primary_color TEXT DEFAULT '#6366f1', logo_r2_key TEXT, banner_r2_key TEXT, custom_subdomain TEXT, status TEXT DEFAULT 'draft' NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (created_by) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS hackathons_slug_unique ON hackathons (slug)`,
    `CREATE TABLE IF NOT EXISTS organizer_roles (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'admin' NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS organizer_roles_hackathon_id_user_id_unique ON organizer_roles (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT, actor_id TEXT, actor_type TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, ip_address TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS judges (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, invite_status TEXT DEFAULT 'pending' NOT NULL, invited_at TEXT NOT NULL, accepted_at TEXT, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judges_hackathon_id_user_id_unique ON judges (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, name TEXT NOT NULL, repo_full_name TEXT, repo_url TEXT, github_installation_id INTEGER, bot_active INTEGER DEFAULT 0 NOT NULL, invite_code TEXT, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_code_unique ON teams (invite_code)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_hackathon_name_unique ON teams (hackathon_id, name)`,
    `CREATE INDEX IF NOT EXISTS idx_teams_hackathon ON teams (hackathon_id)`,
    `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member' NOT NULL, joined_at TEXT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_id_user_id_unique ON team_members (team_id, user_id)`,
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
}

async function resetDb() {
  await env.DB.prepare('DELETE FROM audit_events').run();
  await env.DB.prepare('DELETE FROM team_members').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM organizer_roles').run();
  await env.DB.prepare('DELETE FROM judges').run();
  await env.DB.prepare('DELETE FROM hackathons').run();
  await env.DB.prepare('DELETE FROM users').run();
}

async function insertUser(id: string, githubId: number) {
  await env.DB
    .prepare(
      `INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(id, githubId, `user-${githubId}`, `User ${githubId}`, now, now)
    .run();
}

async function insertHackathon(params: {
  id: string;
  slug: string;
  createdBy: string;
  status?: string;
  maxTeamSize?: number;
  minTeamSize?: number;
}) {
  await env.DB
    .prepare(
      `INSERT INTO hackathons (id, slug, title, registration_opens, registration_closes, submission_deadline, status, max_team_size, min_team_size, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
    )
    .bind(
      params.id,
      params.slug,
      'Test Hackathon',
      now,
      now,
      now,
      params.status ?? 'registration_open',
      params.maxTeamSize ?? 5,
      params.minTeamSize ?? 1,
      params.createdBy,
      now,
      now,
    )
    .run();
}

async function insertOrganizerRole(hackathonId: string, userId: string, role: 'owner' | 'admin' | 'moderator') {
  await env.DB
    .prepare(
      `INSERT INTO organizer_roles (id, hackathon_id, user_id, role, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(crypto.randomUUID(), hackathonId, userId, role, now)
    .run();
}

interface TeamData {
  id: string;
  name: string;
  invite_code: string;
  hackathon_id: string;
  created_at: string;
}

interface TeamResponse {
   ok: boolean;
   data: TeamData & { repo_full_name?: string };
}

interface ErrorResponse {
  ok: boolean;
  error: { code: string; message: string };
}

interface ListResponse {
  ok: boolean;
  data: Array<Record<string, unknown>>;
  meta: { total: number; limit: number; offset: number };
}

interface TeamDetailResponse {
  ok: boolean;
  data: {
    id: string;
    name: string;
    invite_code: string;
    members: Array<{
      user_id: string;
      role: string;
      display_name: string;
    }>;
  };
}

const BASE = 'http://localhost/api/v1/hackathons';

describe('team routes v2', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  // ─── CREATE TEAM ─────────────────────────────────────────

  it('POST /:slug/teams — creates team with invite_code', async () => {
    const ownerId = crypto.randomUUID();
    const participantId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'create-team-hack';

    await insertUser(ownerId, 1001);
    await insertUser(participantId, 1002);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, participantId, 'admin');

    const response = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(participantId, 1002, 'user-1002'),
      },
      body: JSON.stringify({ name: 'Builders' }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as TeamResponse;
    expect(body.ok).toBe(true);
    expect(typeof body.data.invite_code).toBe('string');
    expect(body.data.invite_code.length).toBe(8);

    // Verify creator is team_leader
    const member = await env.DB
      .prepare(`SELECT role FROM team_members WHERE team_id = ?1 AND user_id = ?2`)
      .bind(body.data.id, participantId)
      .first();
    expect(member?.role).toBe('leader');

    // Verify audit event
    const audit = await env.DB
      .prepare(`SELECT action FROM audit_events WHERE entity_id = ?1`)
      .bind(body.data.id)
      .first();
    expect(audit?.action).toBe('team.create');
  });

  it('POST /:slug/teams — rejects when hackathon not in registration_open', async () => {
    const ownerId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'draft-hack';

    await insertUser(ownerId, 2001);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId, status: 'draft' });
    await insertOrganizerRole(hackathonId, ownerId, 'owner');

    const response = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(ownerId, 2001, 'user-2001'),
      },
      body: JSON.stringify({ name: 'Draft Team' }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_STATUS');
  });

  it('POST /:slug/teams — rejects without auth', async () => {
    const ownerId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'noauth-hack';

    await insertUser(ownerId, 2002);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });

    const response = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth Team' }),
    });

    expect(response.status).toBe(401);
  });

  it('POST /:slug/teams — rejects if user already on a team', async () => {
    const ownerId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'dup-team-hack';

    await insertUser(ownerId, 3001);
    await insertUser(userId, 3002);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, userId, 'admin');

    // Create first team
    const resp1 = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(userId, 3002, 'user-3002'),
      },
      body: JSON.stringify({ name: 'Team One' }),
    });
    expect(resp1.status).toBe(201);

    // Try to create second team
    const resp2 = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(userId, 3002, 'user-3002'),
      },
      body: JSON.stringify({ name: 'Team Two' }),
    });

    expect(resp2.status).toBe(409);
    const body = (await resp2.json()) as ErrorResponse;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('ALREADY_ON_TEAM');
  });

  // ─── LIST TEAMS ──────────────────────────────────────────

  it('GET /:slug/teams — lists teams with pagination', async () => {
    const ownerId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'list-teams-hack';

    await insertUser(ownerId, 4001);
    await insertUser(userId, 4002);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, ownerId, 'owner');
    await insertOrganizerRole(hackathonId, userId, 'admin');

    // Create a team
    await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(userId, 4002, 'user-4002'),
      },
      body: JSON.stringify({ name: 'Listers' }),
    });

    const response = await SELF.fetch(`${BASE}/${slug}/teams`, {
      headers: {
        Cookie: await authCookie(ownerId, 4001, 'user-4001'),
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as ListResponse;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.total).toBe(1);
  });

  // ─── GET TEAM DETAIL ─────────────────────────────────────

  it('GET /:slug/teams/:teamId — returns team with members', async () => {
    const ownerId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'detail-hack';

    await insertUser(ownerId, 5001);
    await insertUser(userId, 5002);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, userId, 'admin');

    const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(userId, 5002, 'user-5002'),
      },
      body: JSON.stringify({ name: 'Detailers' }),
    });
    const created = (await createResp.json()) as TeamResponse;
    const teamId = created.data.id;

    const response = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}`, {
      headers: {
        Cookie: await authCookie(userId, 5002, 'user-5002'),
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as TeamDetailResponse;
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(teamId);
    expect(Array.isArray(body.data.members)).toBe(true);
    expect(body.data.members.length).toBe(1);
    expect(body.data.members[0].role).toBe('leader');
  });

  it('GET /:slug/teams/:teamId — returns 404 for nonexistent team', async () => {
    const ownerId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'no-team-hack';

    await insertUser(ownerId, 5003);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, ownerId, 'owner');

    const response = await SELF.fetch(`${BASE}/${slug}/teams/nonexistent-id`, {
      headers: {
        Cookie: await authCookie(ownerId, 5003, 'user-5003'),
      },
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as ErrorResponse;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  // ─── JOIN TEAM ───────────────────────────────────────────

  it('POST /:slug/teams/:teamId/join — joins team via invite code', async () => {
    const ownerId = crypto.randomUUID();
    const leaderId = crypto.randomUUID();
    const joinerId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'join-hack';

    await insertUser(ownerId, 6001);
    await insertUser(leaderId, 6002);
    await insertUser(joinerId, 6003);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, leaderId, 'admin');
    await insertOrganizerRole(hackathonId, joinerId, 'admin');

    // Create team
    const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(leaderId, 6002, 'user-6002'),
      },
      body: JSON.stringify({ name: 'Joinables' }),
    });
    const created = (await createResp.json()) as TeamResponse;
    const teamId = created.data.id;
    const inviteCode = created.data.invite_code;

    // Join team
    const joinResp = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(joinerId, 6003, 'user-6003'),
      },
      body: JSON.stringify({ inviteCode }),
    });

    expect(joinResp.status).toBe(200);
    const joinBody = (await joinResp.json()) as TeamResponse;
    expect(joinBody.ok).toBe(true);

    // Verify member was added with 'member' role
    const member = await env.DB
      .prepare(`SELECT role FROM team_members WHERE team_id = ?1 AND user_id = ?2`)
      .bind(teamId, joinerId)
      .first();
    expect(member?.role).toBe('member');

    // Verify audit event
    const audit = await env.DB
      .prepare(`SELECT action FROM audit_events WHERE action = 'team.join' AND entity_id = ?1`)
      .bind(teamId)
      .first();
    expect(audit?.action).toBe('team.join');
  });

  it('POST /:slug/teams/:teamId/join — rejects invalid invite code', async () => {
    const ownerId = crypto.randomUUID();
    const leaderId = crypto.randomUUID();
    const joinerId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'bad-code-hack';

    await insertUser(ownerId, 6101);
    await insertUser(leaderId, 6102);
    await insertUser(joinerId, 6103);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, leaderId, 'admin');
    await insertOrganizerRole(hackathonId, joinerId, 'admin');

    // Create team
    const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(leaderId, 6102, 'user-6102'),
      },
      body: JSON.stringify({ name: 'BadCode' }),
    });
    const created = (await createResp.json()) as TeamResponse;
    const teamId = created.data.id;

    const joinResp = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(joinerId, 6103, 'user-6103'),
      },
      body: JSON.stringify({ inviteCode: 'WRONGCOD' }),
    });

    expect(joinResp.status).toBe(403);
    const body = (await joinResp.json()) as ErrorResponse;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_INVITE_CODE');
  });

  // ─── TEAM SIZE ENFORCEMENT ───────────────────────────────

  it('POST /:slug/teams/:teamId/join — rejects when team is full', async () => {
    const ownerId = crypto.randomUUID();
    const leaderId = crypto.randomUUID();
    const member1Id = crypto.randomUUID();
    const member2Id = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'full-team-hack';

    await insertUser(ownerId, 7001);
    await insertUser(leaderId, 7002);
    await insertUser(member1Id, 7003);
    await insertUser(member2Id, 7004);
    // max_team_size = 2 (leader + 1 member = full)
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId, maxTeamSize: 2 });
    await insertOrganizerRole(hackathonId, leaderId, 'admin');
    await insertOrganizerRole(hackathonId, member1Id, 'admin');
    await insertOrganizerRole(hackathonId, member2Id, 'admin');

    // Create team
    const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(leaderId, 7002, 'user-7002'),
      },
      body: JSON.stringify({ name: 'SmallTeam' }),
    });
    const created = (await createResp.json()) as TeamResponse;
    const teamId = created.data.id;
    const inviteCode = created.data.invite_code;

    // First join — should succeed (size = 2, max = 2)
    const join1 = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(member1Id, 7003, 'user-7003'),
      },
      body: JSON.stringify({ inviteCode }),
    });
    expect(join1.status).toBe(200);

    // Second join — should be rejected (team full: size would be 3, max = 2)
    const join2 = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(member2Id, 7004, 'user-7004'),
      },
      body: JSON.stringify({ inviteCode }),
    });

    expect(join2.status).toBe(409);
    const body = (await join2.json()) as ErrorResponse;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('TEAM_FULL');
  });

  // ─── REMOVE MEMBER ──────────────────────────────────────

  it('DELETE /:slug/teams/:teamId/members/:userId — leader removes member', async () => {
    const ownerId = crypto.randomUUID();
    const leaderId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'remove-hack';

    await insertUser(ownerId, 8001);
    await insertUser(leaderId, 8002);
    await insertUser(memberId, 8003);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, leaderId, 'admin');
    await insertOrganizerRole(hackathonId, memberId, 'admin');

    // Create team
    const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(leaderId, 8002, 'user-8002'),
      },
      body: JSON.stringify({ name: 'Removers' }),
    });
    const created = (await createResp.json()) as TeamResponse;
    const teamId = created.data.id;
    const inviteCode = created.data.invite_code;

    // Add member
    await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(memberId, 8003, 'user-8003'),
      },
      body: JSON.stringify({ inviteCode }),
    });

    // Leader removes member
    const removeResp = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
      headers: {
        Cookie: await authCookie(leaderId, 8002, 'user-8002'),
      },
    });

    expect(removeResp.status).toBe(200);
    const removeBody = (await removeResp.json()) as { ok: boolean };
    expect(removeBody.ok).toBe(true);

    // Verify member is gone
    const remaining = await env.DB
      .prepare(`SELECT COUNT(*) as cnt FROM team_members WHERE team_id = ?1`)
      .bind(teamId)
      .first();
    expect(remaining?.cnt).toBe(1); // Only leader remains
  });

  it('DELETE /:slug/teams/:teamId/members/:userId — admin can remove member', async () => {
    const ownerId = crypto.randomUUID();
    const leaderId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'admin-remove-hack';

    await insertUser(ownerId, 8101);
    await insertUser(leaderId, 8102);
    await insertUser(memberId, 8103);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, ownerId, 'owner');
    await insertOrganizerRole(hackathonId, leaderId, 'admin');
    await insertOrganizerRole(hackathonId, memberId, 'admin');

    // Create team
    const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(leaderId, 8102, 'user-8102'),
      },
      body: JSON.stringify({ name: 'AdminRemove' }),
    });
    const created = (await createResp.json()) as TeamResponse;
    const teamId = created.data.id;
    const inviteCode = created.data.invite_code;

    // Add member
    await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(memberId, 8103, 'user-8103'),
      },
      body: JSON.stringify({ inviteCode }),
    });

    // Owner (admin+) removes member
    const removeResp = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
      headers: {
        Cookie: await authCookie(ownerId, 8101, 'user-8101'),
      },
    });

    expect(removeResp.status).toBe(200);
  });

  it('DELETE /:slug/teams/:teamId/members/:userId — non-leader member cannot remove others', async () => {
    const ownerId = crypto.randomUUID();
    const leaderId = crypto.randomUUID();
    const member1Id = crypto.randomUUID();
    const member2Id = crypto.randomUUID();
    const hackathonId = crypto.randomUUID();
    const slug = 'no-remove-hack';

    await insertUser(ownerId, 8201);
    await insertUser(leaderId, 8202);
    await insertUser(member1Id, 8203);
    await insertUser(member2Id, 8204);
    await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
    await insertOrganizerRole(hackathonId, leaderId, 'admin');
    await insertOrganizerRole(hackathonId, member1Id, 'moderator');
    await insertOrganizerRole(hackathonId, member2Id, 'moderator');

    // Create team
    const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(leaderId, 8202, 'user-8202'),
      },
      body: JSON.stringify({ name: 'NoRemove' }),
    });
    const created = (await createResp.json()) as TeamResponse;
    const teamId = created.data.id;
    const inviteCode = created.data.invite_code;

    // Add member1 and member2
    await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(member1Id, 8203, 'user-8203'),
      },
      body: JSON.stringify({ inviteCode }),
    });
    await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(member2Id, 8204, 'user-8204'),
      },
      body: JSON.stringify({ inviteCode }),
    });

    // member1 (not leader) tries to remove member2
    const removeResp = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/members/${member2Id}`, {
      method: 'DELETE',
      headers: {
        Cookie: await authCookie(member1Id, 8203, 'user-8203'),
      },
    });

     expect(removeResp.status).toBe(403);
     const body = (await removeResp.json()) as ErrorResponse;
     expect(body.ok).toBe(false);
     expect(body.error.code).toBe('FORBIDDEN');
   });

   it('POST /:slug/teams/:teamId/repo — leader connects repo successfully', async () => {
     const ownerId = crypto.randomUUID();
     const leaderId = crypto.randomUUID();
     const hackathonId = crypto.randomUUID();
     const slug = 'repo-connect-hack';

     await insertUser(ownerId, 9001);
     await insertUser(leaderId, 9002);
     await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
     await insertOrganizerRole(hackathonId, leaderId, 'admin');

     const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leaderId, 9002, 'user-9002'),
       },
       body: JSON.stringify({ name: 'RepoTeam' }),
     });
     const created = (await createResp.json()) as TeamResponse;
     const teamId = created.data.id;

     const repoResp = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/repo`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leaderId, 9002, 'user-9002'),
       },
       body: JSON.stringify({ repoFullName: 'owner/repo-name' }),
     });

     expect(repoResp.status).toBe(200);
     const repoBody = (await repoResp.json()) as TeamResponse;
     expect(repoBody.ok).toBe(true);
     expect(repoBody.data.repo_full_name).toBe('owner/repo-name');

     const team = await env.DB
       .prepare(`SELECT repo_full_name FROM teams WHERE id = ?1`)
       .bind(teamId)
       .first();
     expect(team?.repo_full_name).toBe('owner/repo-name');

     const audit = await env.DB
       .prepare(`SELECT action FROM audit_events WHERE action = 'repo.connect' AND entity_id = ?1`)
       .bind(teamId)
       .first();
     expect(audit?.action).toBe('repo.connect');
   });

   it('POST /:slug/teams/:teamId/repo — member cannot connect repo (403)', async () => {
     const ownerId = crypto.randomUUID();
     const leaderId = crypto.randomUUID();
     const memberId = crypto.randomUUID();
     const hackathonId = crypto.randomUUID();
     const slug = 'repo-forbidden-hack';

     await insertUser(ownerId, 9101);
     await insertUser(leaderId, 9102);
     await insertUser(memberId, 9103);
     await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
     await insertOrganizerRole(hackathonId, leaderId, 'admin');
     await insertOrganizerRole(hackathonId, memberId, 'admin');

     const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leaderId, 9102, 'user-9102'),
       },
       body: JSON.stringify({ name: 'RepoTeamForbid' }),
     });
     const created = (await createResp.json()) as TeamResponse;
     const teamId = created.data.id;
     const inviteCode = created.data.invite_code;

     await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/join`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(memberId, 9103, 'user-9103'),
       },
       body: JSON.stringify({ inviteCode }),
     });

     const repoResp = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/repo`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(memberId, 9103, 'user-9103'),
       },
       body: JSON.stringify({ repoFullName: 'owner/repo-name' }),
     });

     expect(repoResp.status).toBe(403);
     const body = (await repoResp.json()) as ErrorResponse;
     expect(body.ok).toBe(false);
     expect(body.error.code).toBe('FORBIDDEN');
   });

   it('POST /:slug/teams/:teamId/repo — rejects duplicate repo in same hackathon (409)', async () => {
     const ownerId = crypto.randomUUID();
     const leader1Id = crypto.randomUUID();
     const leader2Id = crypto.randomUUID();
     const hackathonId = crypto.randomUUID();
     const slug = 'repo-dup-hack';

     await insertUser(ownerId, 9201);
     await insertUser(leader1Id, 9202);
     await insertUser(leader2Id, 9203);
     await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
     await insertOrganizerRole(hackathonId, leader1Id, 'admin');
     await insertOrganizerRole(hackathonId, leader2Id, 'admin');

     const create1 = await SELF.fetch(`${BASE}/${slug}/teams`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leader1Id, 9202, 'user-9202'),
       },
       body: JSON.stringify({ name: 'Team1' }),
     });
     const team1 = (await create1.json()) as TeamResponse;
     const team1Id = team1.data.id;

     const create2 = await SELF.fetch(`${BASE}/${slug}/teams`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leader2Id, 9203, 'user-9203'),
       },
       body: JSON.stringify({ name: 'Team2' }),
     });
     const team2 = (await create2.json()) as TeamResponse;
     const team2Id = team2.data.id;

     const repo1 = await SELF.fetch(`${BASE}/${slug}/teams/${team1Id}/repo`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leader1Id, 9202, 'user-9202'),
       },
       body: JSON.stringify({ repoFullName: 'org/shared-repo' }),
     });
     expect(repo1.status).toBe(200);

     const repo2 = await SELF.fetch(`${BASE}/${slug}/teams/${team2Id}/repo`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leader2Id, 9203, 'user-9203'),
       },
       body: JSON.stringify({ repoFullName: 'org/shared-repo' }),
     });

     expect(repo2.status).toBe(409);
     const body = (await repo2.json()) as ErrorResponse;
     expect(body.ok).toBe(false);
     expect(body.error.code).toBe('REPO_ALREADY_CONNECTED');
   });

   it('POST /:slug/teams/:teamId/repo — rejects invalid repo format', async () => {
     const ownerId = crypto.randomUUID();
     const leaderId = crypto.randomUUID();
     const hackathonId = crypto.randomUUID();
     const slug = 'repo-bad-format-hack';

     await insertUser(ownerId, 9301);
     await insertUser(leaderId, 9302);
     await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });
     await insertOrganizerRole(hackathonId, leaderId, 'admin');

     const createResp = await SELF.fetch(`${BASE}/${slug}/teams`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leaderId, 9302, 'user-9302'),
       },
       body: JSON.stringify({ name: 'RepoFormat' }),
     });
     const created = (await createResp.json()) as TeamResponse;
     const teamId = created.data.id;

     const repoResp = await SELF.fetch(`${BASE}/${slug}/teams/${teamId}/repo`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         Cookie: await authCookie(leaderId, 9302, 'user-9302'),
       },
       body: JSON.stringify({ repoFullName: 'invalid-no-slash' }),
     });

     expect(repoResp.status).toBe(400);
   });

   it('POST /:slug/teams/:teamId/repo — rejects without auth', async () => {
     const ownerId = crypto.randomUUID();
     const hackathonId = crypto.randomUUID();
     const slug = 'repo-noauth-hack';

     await insertUser(ownerId, 9401);
     await insertHackathon({ id: hackathonId, slug, createdBy: ownerId });

     const response = await SELF.fetch(`${BASE}/${slug}/teams/fake-team-id/repo`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ repoFullName: 'org/repo' }),
     });

     expect(response.status).toBe(401);
   });
});
