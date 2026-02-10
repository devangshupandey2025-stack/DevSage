import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SELF, env as rawEnv } from 'cloudflare:test';
import type { Env } from '../types/env.js';
import { signJWT } from '../lib/jwt.js';

const env = rawEnv as Env;
const JWT_SECRET = 'dev-secret-key-min-32-chars-long!!';
const now = new Date().toISOString();

let hackathonId: string;
let hackathonSlug: string;
let adminUserId: string;
let adminToken: string;
let judgeUserId: string;
let judgeToken: string;

async function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, github_id INTEGER NOT NULL, google_id TEXT, github_username TEXT NOT NULL, display_name TEXT NOT NULL, email TEXT, avatar_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_unique ON users (github_id)`,
    `CREATE TABLE IF NOT EXISTS hackathons (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, description TEXT, rules_md TEXT, registration_opens TEXT NOT NULL, registration_closes TEXT NOT NULL, submission_deadline TEXT NOT NULL, judging_starts TEXT, judging_ends TEXT, min_team_size INTEGER DEFAULT 1 NOT NULL, max_team_size INTEGER DEFAULT 5 NOT NULL, max_teams INTEGER, submission_tag_pattern TEXT DEFAULT 'submission_v%' NOT NULL, max_submissions_per_team INTEGER, allow_late_submissions INTEGER DEFAULT 0 NOT NULL, primary_color TEXT DEFAULT '#6366f1', logo_r2_key TEXT, banner_r2_key TEXT, custom_subdomain TEXT, status TEXT DEFAULT 'draft' NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (created_by) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS hackathons_slug_unique ON hackathons (slug)`,
    `CREATE TABLE IF NOT EXISTS organizer_roles (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'admin' NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS organizer_roles_hackathon_id_user_id_unique ON organizer_roles (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS judges (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, user_id TEXT NOT NULL, invite_status TEXT DEFAULT 'pending' NOT NULL, invited_at TEXT NOT NULL, accepted_at TEXT, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS judges_hackathon_id_user_id_unique ON judges (hackathon_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT NOT NULL, name TEXT NOT NULL, repo_full_name TEXT, repo_url TEXT, github_installation_id INTEGER, bot_active INTEGER DEFAULT 0 NOT NULL, invite_code TEXT, created_at TEXT NOT NULL, FOREIGN KEY (hackathon_id) REFERENCES hackathons(id) ON DELETE CASCADE)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_code_unique ON teams (invite_code)`,
    `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member' NOT NULL, joined_at TEXT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_id_user_id_unique ON team_members (team_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, hackathon_id TEXT, actor_id TEXT, actor_type TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, ip_address TEXT, created_at TEXT NOT NULL)`,
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
}

async function resetDb() {
  await env.DB.prepare('DELETE FROM audit_events').run();
  await env.DB.prepare('DELETE FROM team_members').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM judges').run();
  await env.DB.prepare('DELETE FROM organizer_roles').run();
  await env.DB.prepare('DELETE FROM hackathons').run();
  await env.DB.prepare('DELETE FROM users').run();
}

beforeAll(async () => {
  await ensureSchema();
});

beforeEach(async () => {
  await resetDb();

  hackathonId = crypto.randomUUID();
  hackathonSlug = 'test-hackathon';
  adminUserId = crypto.randomUUID();
  judgeUserId = crypto.randomUUID();

  await env.DB
    .prepare(`INSERT INTO users (id, github_id, github_username, display_name, email, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(adminUserId, 12345, 'admin', 'Admin User', 'admin@example.com', now, now)
    .run();

  await env.DB
    .prepare(`INSERT INTO users (id, github_id, github_username, display_name, email, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
    .bind(judgeUserId, 67890, 'judge', 'Judge User', 'judge@example.com', now, now)
    .run();

  await env.DB
    .prepare(`INSERT INTO hackathons (id, slug, title, registration_opens, registration_closes, submission_deadline, status, max_team_size, created_by, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`)
    .bind(hackathonId, hackathonSlug, 'Test Hackathon', now, now, now, 'draft', 4, adminUserId, now, now)
    .run();

  await env.DB
    .prepare(`INSERT INTO organizer_roles (id, hackathon_id, user_id, role, created_at)
              VALUES (?1, ?2, ?3, ?4, ?5)`)
    .bind(crypto.randomUUID(), hackathonId, adminUserId, 'admin', now)
    .run();

  adminToken = await signJWT({ sub: adminUserId, ghid: 12345, ghu: 'admin' }, JWT_SECRET);
  judgeToken = await signJWT({ sub: judgeUserId, ghid: 67890, ghu: 'judge' }, JWT_SECRET);
});

describe('POST /:slug/judges — invite judge', () => {
  it('admin invites a judge successfully', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({ userId: judgeUserId }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: { user_id: string; invite_status: string } };
    expect(json.ok).toBe(true);
    expect(json.data.user_id).toBe(judgeUserId);
    expect(json.data.invite_status).toBe('pending');
  });

  it('returns 409 if judge already invited', async () => {
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(crypto.randomUUID(), hackathonId, judgeUserId, 'pending', now)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${adminToken}`,
      },
      body: JSON.stringify({ userId: judgeUserId }),
    });

    expect(response.status).toBe(409);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('DUPLICATE_INVITE');
  });

  it('returns 401 if not authenticated', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: judgeUserId }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 403 if user is not admin', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${judgeToken}`,
      },
      body: JSON.stringify({ userId: judgeUserId }),
    });

    expect(response.status).toBe(403);
  });
});

describe('GET /:slug/judges — list judges', () => {
  it('admin lists all judges with user details', async () => {
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at, accepted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(crypto.randomUUID(), hackathonId, judgeUserId, 'accepted', now, now)
      .run();

    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'GET',
      headers: { Cookie: `session=${adminToken}` },
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: Array<{ user: { id: string; display_name: string } }> };
    expect(json.ok).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].user.id).toBe(judgeUserId);
    expect(json.data[0].user.display_name).toBe('Judge User');
  });

  it('returns 403 if user is not admin', async () => {
    const response = await SELF.fetch(`http://api/api/v1/hackathons/${hackathonSlug}/judges`, {
      method: 'GET',
      headers: { Cookie: `session=${judgeToken}` },
    });

    expect(response.status).toBe(403);
  });
});

describe('POST /:slug/judges/:judgeId/respond — judge accepts or declines invite', () => {
  it('judge accepts invite', async () => {
    const judgeRecordId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'pending', now)
      .run();

    const response = await SELF.fetch(
      `http://api/api/v1/hackathons/${hackathonSlug}/judges/${judgeRecordId}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${judgeToken}`,
        },
        body: JSON.stringify({ accept: true }),
      },
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: { invite_status: string; accepted_at: string | null } };
    expect(json.ok).toBe(true);
    expect(json.data.invite_status).toBe('accepted');
    expect(json.data.accepted_at).toBeTruthy();
  });

  it('judge declines invite', async () => {
    const judgeRecordId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'pending', now)
      .run();

    const response = await SELF.fetch(
      `http://api/api/v1/hackathons/${hackathonSlug}/judges/${judgeRecordId}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${judgeToken}`,
        },
        body: JSON.stringify({ accept: false }),
      },
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; data: { invite_status: string; accepted_at: string | null } };
    expect(json.ok).toBe(true);
    expect(json.data.invite_status).toBe('declined');
    expect(json.data.accepted_at).toBeNull();
  });

  it('returns 403 if user is not the invited judge', async () => {
    const otherUserId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO users (id, github_id, github_username, display_name, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
      .bind(otherUserId, 99999, 'other', 'Other User', now, now)
      .run();
    const otherToken = await signJWT({ sub: otherUserId, ghid: 99999, ghu: 'other' }, JWT_SECRET);

    const judgeRecordId = crypto.randomUUID();
    await env.DB
      .prepare(`INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at)
                VALUES (?1, ?2, ?3, ?4, ?5)`)
      .bind(judgeRecordId, hackathonId, judgeUserId, 'pending', now)
      .run();

    const response = await SELF.fetch(
      `http://api/api/v1/hackathons/${hackathonSlug}/judges/${judgeRecordId}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${otherToken}`,
        },
        body: JSON.stringify({ accept: true }),
      },
    );

    expect(response.status).toBe(403);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 if judge record not found', async () => {
    const response = await SELF.fetch(
      `http://api/api/v1/hackathons/${hackathonSlug}/judges/${crypto.randomUUID()}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${judgeToken}`,
        },
        body: JSON.stringify({ accept: true }),
      },
    );

    expect(response.status).toBe(404);
  });
});
