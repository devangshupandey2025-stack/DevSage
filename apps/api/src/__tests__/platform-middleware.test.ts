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

async function insertUser(id: string, githubId: number) {
  await env.DB
    .prepare(
      `INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(id, githubId, `user-${githubId}`, `User ${githubId}`, now, now)
    .run();
}

async function insertPlatformAdmin(userId: string) {
  await env.DB
    .prepare(`INSERT INTO platform_admins (id, user_id, created_at) VALUES (?1, ?2, ?3)`)
    .bind(crypto.randomUUID(), userId, now)
    .run();
}

async function insertAcceptedInvite(userId: string, invitedBy: string) {
  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB
    .prepare(
      `INSERT INTO organizer_invites (id, email, invite_code, status, invited_by, accepted_by, accepted_at, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
    .bind(
      crypto.randomUUID(),
      `invite-${Date.now()}@test.com`,
      crypto.randomUUID(),
      'accepted',
      invitedBy,
      userId,
      now,
      future,
      now,
    )
    .run();
}

function createHackathonPayload(slug: string) {
  return {
    slug,
    title: `Test Hack ${slug}`,
    registrationOpens: '2026-01-01T00:00:00.000Z',
    registrationCloses: '2026-01-05T00:00:00.000Z',
    submissionDeadline: '2026-01-10T00:00:00.000Z',
  };
}

describe('platform middleware — requireOrganizer gate on hackathon creation', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('platform admin can create a hackathon', async () => {
    const adminId = crypto.randomUUID();
    await insertUser(adminId, 5001);
    await insertPlatformAdmin(adminId);

    const response = await SELF.fetch('http://localhost/api/v1/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(adminId, 5001, 'user-5001'),
      },
      body: JSON.stringify(createHackathonPayload('admin-hack')),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { ok: boolean; data: { slug: string } };
    expect(body.ok).toBe(true);
    expect(body.data.slug).toBe('admin-hack');
  });

  it('user with accepted invite can create a hackathon', async () => {
    const adminId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    await insertUser(adminId, 5002);
    await insertUser(orgId, 5003);
    await insertPlatformAdmin(adminId);
    await insertAcceptedInvite(orgId, adminId);

    const response = await SELF.fetch('http://localhost/api/v1/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(orgId, 5003, 'user-5003'),
      },
      body: JSON.stringify(createHackathonPayload('org-hack')),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { ok: boolean; data: { slug: string } };
    expect(body.ok).toBe(true);
    expect(body.data.slug).toBe('org-hack');
  });

  it('regular user without invite is rejected with 403', async () => {
    const userId = crypto.randomUUID();
    await insertUser(userId, 5004);

    const response = await SELF.fetch('http://localhost/api/v1/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(userId, 5004, 'user-5004'),
      },
      body: JSON.stringify(createHackathonPayload('no-access')),
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_ORGANIZER');
  });

  it('user with pending (not accepted) invite is rejected', async () => {
    const adminId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await insertUser(adminId, 5005);
    await insertUser(userId, 5006);
    await insertPlatformAdmin(adminId);

    const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB
      .prepare(
        `INSERT INTO organizer_invites (id, email, invite_code, status, invited_by, expires_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      )
      .bind(crypto.randomUUID(), 'pending@test.com', crypto.randomUUID(), 'pending', adminId, future, now)
      .run();

    const response = await SELF.fetch('http://localhost/api/v1/hackathons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: await authCookie(userId, 5006, 'user-5006'),
      },
      body: JSON.stringify(createHackathonPayload('pending-invite')),
    });

    expect(response.status).toBe(403);
  });

  it('unauthenticated request is rejected with 401', async () => {
    const response = await SELF.fetch('http://localhost/api/v1/hackathons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createHackathonPayload('unauth-hack')),
    });

    expect(response.status).toBe(401);
  });
});

describe('platform middleware — requirePlatformAdmin gate on admin routes', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('platform admin can access admin routes', async () => {
    const adminId = crypto.randomUUID();
    await insertUser(adminId, 6001);
    await insertPlatformAdmin(adminId);

    const response = await SELF.fetch('http://localhost/api/v1/admin/admins', {
      headers: { Cookie: await authCookie(adminId, 6001, 'user-6001') },
    });

    expect(response.status).toBe(200);
  });

  it('non-admin user is rejected from admin routes', async () => {
    const userId = crypto.randomUUID();
    await insertUser(userId, 6002);

    const response = await SELF.fetch('http://localhost/api/v1/admin/admins', {
      headers: { Cookie: await authCookie(userId, 6002, 'user-6002') },
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('NOT_PLATFORM_ADMIN');
  });

  it('unauthenticated request is rejected from admin routes', async () => {
    const response = await SELF.fetch('http://localhost/api/v1/admin/admins');

    expect(response.status).toBe(401);
  });

  it('user with accepted organizer invite but not platform admin is rejected from admin routes', async () => {
    const adminId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    await insertUser(adminId, 6003);
    await insertUser(orgId, 6004);
    await insertPlatformAdmin(adminId);
    await insertAcceptedInvite(orgId, adminId);

    const response = await SELF.fetch('http://localhost/api/v1/admin/admins', {
      headers: { Cookie: await authCookie(orgId, 6004, 'user-6004') },
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('NOT_PLATFORM_ADMIN');
  });
});
