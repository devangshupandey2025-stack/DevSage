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
  await env.DB.prepare('DELETE FROM organizer_roles').run();
  await env.DB.prepare('DELETE FROM hackathons').run();
  await env.DB.prepare('DELETE FROM users').run();
}

async function insertUser(id: string, githubId: number, email?: string) {
  await env.DB
    .prepare(
      `INSERT INTO users (id, github_id, github_username, display_name, email, avatar_url, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
    .bind(id, githubId, `user-${githubId}`, `User ${githubId}`, email ?? `user-${githubId}@test.com`, null, now, now)
    .run();
}

async function insertPlatformAdmin(userId: string) {
  await env.DB
    .prepare(`INSERT INTO platform_admins (id, user_id, created_at) VALUES (?1, ?2, ?3)`)
    .bind(crypto.randomUUID(), userId, now)
    .run();
}

async function insertInvite(params: {
  id?: string;
  email: string;
  inviteCode: string;
  invitedBy: string;
  status?: string;
  expiresAt?: string;
}) {
  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB
    .prepare(
      `INSERT INTO organizer_invites (id, email, invite_code, status, invited_by, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(
      params.id ?? crypto.randomUUID(),
      params.email,
      params.inviteCode,
      params.status ?? 'pending',
      params.invitedBy,
      params.expiresAt ?? future,
      now,
    )
    .run();
}

describe('admin routes', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('POST /api/v1/admin/invites — create organizer invite', () => {
    it('platform admin creates invite successfully', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 1001);
      await insertPlatformAdmin(adminId);

      const response = await SELF.fetch('http://localhost/api/v1/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await authCookie(adminId, 1001, 'user-1001'),
        },
        body: JSON.stringify({ email: 'organizer@example.com' }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        ok: boolean;
        data: { id: string; email: string; invite_code: string; status: string };
      };
      expect(body.ok).toBe(true);
      expect(body.data.email).toBe('organizer@example.com');
      expect(body.data.status).toBe('pending');
      expect(body.data.invite_code).toBeTruthy();
    });

    it('rejects invalid email format', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 1002);
      await insertPlatformAdmin(adminId);

      const response = await SELF.fetch('http://localhost/api/v1/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await authCookie(adminId, 1002, 'user-1002'),
        },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVALID_EMAIL');
    });

    it('rejects duplicate invite for same email', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 1003);
      await insertPlatformAdmin(adminId);
      await insertInvite({ email: 'duplicate@example.com', inviteCode: 'code-1', invitedBy: adminId });

      const response = await SELF.fetch('http://localhost/api/v1/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await authCookie(adminId, 1003, 'user-1003'),
        },
        body: JSON.stringify({ email: 'duplicate@example.com' }),
      });

      expect(response.status).toBe(409);
      const body = (await response.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVITE_EXISTS');
    });

    it('rejects non-platform-admin user', async () => {
      const userId = crypto.randomUUID();
      await insertUser(userId, 1004);

      const response = await SELF.fetch('http://localhost/api/v1/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await authCookie(userId, 1004, 'user-1004'),
        },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(response.status).toBe(403);
      const body = (await response.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_PLATFORM_ADMIN');
    });

    it('rejects unauthenticated request', async () => {
      const response = await SELF.fetch('http://localhost/api/v1/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/admin/invites — list invites', () => {
    it('platform admin lists invites with pagination', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 2001);
      await insertPlatformAdmin(adminId);
      await insertInvite({ email: 'a@test.com', inviteCode: 'code-a', invitedBy: adminId });
      await insertInvite({ email: 'b@test.com', inviteCode: 'code-b', invitedBy: adminId });

      const response = await SELF.fetch('http://localhost/api/v1/admin/invites?limit=10&offset=0', {
        headers: { Cookie: await authCookie(adminId, 2001, 'user-2001') },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ok: boolean;
        data: Array<{ email: string }>;
        meta: { total: number; limit: number; offset: number };
      };
      expect(body.ok).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.meta.total).toBe(2);
    });

    it('rejects non-admin', async () => {
      const userId = crypto.randomUUID();
      await insertUser(userId, 2002);

      const response = await SELF.fetch('http://localhost/api/v1/admin/invites', {
        headers: { Cookie: await authCookie(userId, 2002, 'user-2002') },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/admin/invites/:id — revoke invite', () => {
    it('revokes a pending invite', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 3001);
      await insertPlatformAdmin(adminId);
      const inviteId = crypto.randomUUID();
      await insertInvite({ id: inviteId, email: 'revoke@test.com', inviteCode: 'revoke-code', invitedBy: adminId });

      const response = await SELF.fetch(`http://localhost/api/v1/admin/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { Cookie: await authCookie(adminId, 3001, 'user-3001') },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(body.ok).toBe(true);

      const invite = await env.DB
        .prepare('SELECT status FROM organizer_invites WHERE id = ?1')
        .bind(inviteId)
        .first();
      expect(invite?.status).toBe('revoked');
    });

    it('cannot revoke an accepted invite', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 3002);
      await insertPlatformAdmin(adminId);
      const inviteId = crypto.randomUUID();
      await insertInvite({
        id: inviteId,
        email: 'accepted@test.com',
        inviteCode: 'accepted-code',
        invitedBy: adminId,
        status: 'accepted',
      });

      const response = await SELF.fetch(`http://localhost/api/v1/admin/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { Cookie: await authCookie(adminId, 3002, 'user-3002') },
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('ALREADY_ACCEPTED');
    });

    it('returns 404 for nonexistent invite', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 3003);
      await insertPlatformAdmin(adminId);

      const response = await SELF.fetch(`http://localhost/api/v1/admin/invites/${crypto.randomUUID()}`, {
        method: 'DELETE',
        headers: { Cookie: await authCookie(adminId, 3003, 'user-3003') },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/admin/admins — list platform admins', () => {
    it('returns admin list with user details', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 4001, 'admin@test.com');
      await insertPlatformAdmin(adminId);

      const response = await SELF.fetch('http://localhost/api/v1/admin/admins', {
        headers: { Cookie: await authCookie(adminId, 4001, 'user-4001') },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ok: boolean;
        data: Array<{ user_id: string; display_name: string; github_username: string; email: string }>;
      };
      expect(body.ok).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0].user_id).toBe(adminId);
      expect(body.data[0].github_username).toBe('user-4001');
      expect(body.data[0].email).toBe('admin@test.com');
    });

    it('creates audit event when invite is created', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 4002);
      await insertPlatformAdmin(adminId);

      await SELF.fetch('http://localhost/api/v1/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: await authCookie(adminId, 4002, 'user-4002'),
        },
        body: JSON.stringify({ email: 'audit@test.com' }),
      });

      const audit = await env.DB
        .prepare(`SELECT event_type, actor_id FROM audit_events WHERE event_type = 'organizer_invite.create'`)
        .first();

      expect(audit).toBeTruthy();
      expect(audit?.actor_id).toBe(adminId);
    });
  });
});
