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
    `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT, team_id TEXT, actor_id TEXT, actor_type TEXT NOT NULL, event_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata TEXT, ip_address TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS judges (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, invite_status TEXT DEFAULT 'pending' NOT NULL, invited_at TEXT NOT NULL, accepted_at TEXT, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judges_hackathon_id_user_id_unique ON judges (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, name TEXT NOT NULL, repo_full_name TEXT, repo_url TEXT, github_installation_id INTEGER, bot_active INTEGER DEFAULT 0 NOT NULL, invite_code TEXT, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE INDEX IF NOT EXISTS idx_teams_hackathon ON teams (hackathon_id)`,
    `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member' NOT NULL, joined_at TEXT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_id_user_id_unique ON team_members (team_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS platform_admins (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_user_id_unique ON platform_admins (user_id)`,
    `CREATE TABLE IF NOT EXISTS organizer_invites (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, invite_code TEXT NOT NULL, status TEXT DEFAULT 'pending' NOT NULL, invited_by TEXT NOT NULL, accepted_by TEXT, accepted_at TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (invited_by) REFERENCES users(id), FOREIGN KEY (accepted_by) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS organizer_invites_invite_code_unique ON organizer_invites (invite_code)`,
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
}

async function resetDb() {
  await env.DB.prepare('DELETE FROM audit_events').run();
  await env.DB.prepare('DELETE FROM organizer_invites').run();
  await env.DB.prepare('DELETE FROM platform_admins').run();
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
}) {
  await env.DB
    .prepare(
      `INSERT INTO hackathons (id, slug, title, registration_opens, registration_closes, submission_deadline, status, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
    .bind(
      params.id,
      params.slug,
      'Test Hackathon',
      now,
      now,
      now,
      params.status ?? 'active',
      params.createdBy,
      now,
      now,
    )
    .run();
}

async function insertTeam(id: string, hackathonId: string, name: string) {
  await env.DB
    .prepare(
      `INSERT INTO teams (id, hackathon_id, name, invite_code, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(id, hackathonId, name, crypto.randomUUID(), now)
    .run();
}

async function insertTeamMember(teamId: string, userId: string, role?: string) {
  await env.DB
    .prepare(
      `INSERT INTO team_members (id, team_id, user_id, role, joined_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(crypto.randomUUID(), teamId, userId, role ?? 'member', now)
    .run();
}

describe('submission routes', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('GET /api/v1/hackathons/:slug/submissions — list submissions', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const userId = crypto.randomUUID();
      await insertUser(userId, 7001);
      const hackathonId = crypto.randomUUID();
      await insertHackathon({ id: hackathonId, slug: 'sub-hack', createdBy: userId, status: 'active' });

      const response = await SELF.fetch('http://localhost/api/v1/hackathons/sub-hack/submissions');

      expect(response.status).toBe(401);
    });

    it('rejects users without participant+ role with 403', async () => {
      const ownerId = crypto.randomUUID();
      const outsiderId = crypto.randomUUID();
      await insertUser(ownerId, 7002);
      await insertUser(outsiderId, 7003);
      const hackathonId = crypto.randomUUID();
      await insertHackathon({ id: hackathonId, slug: 'sub-hack-role', createdBy: ownerId, status: 'active' });

      const response = await SELF.fetch('http://localhost/api/v1/hackathons/sub-hack-role/submissions', {
        headers: { Cookie: await authCookie(outsiderId, 7003, 'user-7003') },
      });

      expect(response.status).toBe(403);
    });

    it('authenticated participant can reach the submission endpoint', async () => {
      const ownerId = crypto.randomUUID();
      const memberId = crypto.randomUUID();
      await insertUser(ownerId, 7004);
      await insertUser(memberId, 7005);
      const hackathonId = crypto.randomUUID();
      await insertHackathon({ id: hackathonId, slug: 'sub-hack-ok', createdBy: ownerId, status: 'active' });
      const teamId = crypto.randomUUID();
      await insertTeam(teamId, hackathonId, 'Team Alpha');
      await insertTeamMember(teamId, memberId);

      const response = await SELF.fetch('http://localhost/api/v1/hackathons/sub-hack-ok/submissions', {
        headers: { Cookie: await authCookie(memberId, 7005, 'user-7005') },
      });

      expect([200, 404, 500]).toContain(response.status);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  describe('GET /api/v1/hackathons/:slug/submissions/:teamId — submission detail', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const userId = crypto.randomUUID();
      await insertUser(userId, 8001);
      const hackathonId = crypto.randomUUID();
      await insertHackathon({ id: hackathonId, slug: 'sub-detail', createdBy: userId, status: 'active' });

      const response = await SELF.fetch(`http://localhost/api/v1/hackathons/sub-detail/submissions/${crypto.randomUUID()}`);

      expect(response.status).toBe(401);
    });

    it('rejects users without participant+ role with 403', async () => {
      const ownerId = crypto.randomUUID();
      const outsiderId = crypto.randomUUID();
      await insertUser(ownerId, 8002);
      await insertUser(outsiderId, 8003);
      const hackathonId = crypto.randomUUID();
      const teamId = crypto.randomUUID();
      await insertHackathon({ id: hackathonId, slug: 'sub-detail-role', createdBy: ownerId, status: 'active' });
      await insertTeam(teamId, hackathonId, 'Team B');

      const response = await SELF.fetch(`http://localhost/api/v1/hackathons/sub-detail-role/submissions/${teamId}`, {
        headers: { Cookie: await authCookie(outsiderId, 8003, 'user-8003') },
      });

      expect(response.status).toBe(403);
    });

    it('returns 404 for nonexistent hackathon slug', async () => {
      const userId = crypto.randomUUID();
      await insertUser(userId, 8004);

      const response = await SELF.fetch(`http://localhost/api/v1/hackathons/nonexistent/submissions/${crypto.randomUUID()}`, {
        headers: { Cookie: await authCookie(userId, 8004, 'user-8004') },
      });

      expect(response.status).toBe(404);
    });
  });
});
