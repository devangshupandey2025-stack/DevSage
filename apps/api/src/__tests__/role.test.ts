import { env as rawEnv } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDbClient } from '@devsage/db';
import type { Env } from '../types/env.js';
import type { AuthAppEnv } from '../types/auth.js';
import { isRoleAtLeast, requireRole, resolveRole, ROLE_HIERARCHY } from '../middleware/role.js';

const env = rawEnv as Env;

const now = new Date().toISOString();

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
    `CREATE INDEX IF NOT EXISTS idx_teams_hackathon ON teams (hackathon_id)`,
    `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member' NOT NULL, joined_at TEXT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_id_user_id_unique ON team_members (team_id, user_id)`,
  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
}

async function resetDb() {
  await env.DB.prepare('DELETE FROM organizer_roles').run();
  await env.DB.prepare('DELETE FROM judges').run();
  await env.DB.prepare('DELETE FROM team_members').run();
  await env.DB.prepare('DELETE FROM teams').run();
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

async function insertHackathon(id: string, slug: string, createdBy: string) {
  await env.DB
    .prepare(
      `INSERT INTO hackathons (id, slug, title, registration_opens, registration_closes, submission_deadline, status, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
    .bind(id, slug, 'Test Hackathon', now, now, now, 'draft', createdBy, now, now)
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

async function insertJudge(hackathonId: string, userId: string, inviteStatus: 'pending' | 'accepted' | 'declined') {
  await env.DB
    .prepare(
      `INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_at${inviteStatus === 'accepted' ? ', accepted_at' : ''})
       VALUES (?1, ?2, ?3, ?4, ?5${inviteStatus === 'accepted' ? ', ?6' : ''})`
    )
    .bind(
      crypto.randomUUID(), hackathonId, userId, inviteStatus, now,
      ...(inviteStatus === 'accepted' ? [now] : [])
    )
    .run();
}

async function insertTeamWithMember(hackathonId: string, userId: string, memberRole: 'leader' | 'member') {
  const teamId = crypto.randomUUID();
  await env.DB
    .prepare(
      `INSERT INTO teams (id, hackathon_id, name, created_at)
       VALUES (?1, ?2, ?3, ?4)`
    )
    .bind(teamId, hackathonId, `Team-${teamId.slice(0, 8)}`, now)
    .run();

  await env.DB
    .prepare(
      `INSERT INTO team_members (id, team_id, user_id, role, joined_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(crypto.randomUUID(), teamId, userId, memberRole, now)
    .run();
}

describe('role hierarchy - isRoleAtLeast', () => {
  it('owner is at least every role', () => {
    for (const role of ROLE_HIERARCHY) {
      expect(isRoleAtLeast('owner', role)).toBe(true);
    }
  });

  it('anonymous is only at least anonymous', () => {
    expect(isRoleAtLeast('anonymous', 'anonymous')).toBe(true);
    expect(isRoleAtLeast('anonymous', 'participant')).toBe(false);
    expect(isRoleAtLeast('anonymous', 'team_leader')).toBe(false);
    expect(isRoleAtLeast('anonymous', 'judge')).toBe(false);
    expect(isRoleAtLeast('anonymous', 'moderator')).toBe(false);
    expect(isRoleAtLeast('anonymous', 'admin')).toBe(false);
    expect(isRoleAtLeast('anonymous', 'owner')).toBe(false);
  });

  it('same role satisfies itself', () => {
    for (const role of ROLE_HIERARCHY) {
      expect(isRoleAtLeast(role, role)).toBe(true);
    }
  });

  it('higher roles satisfy lower requirements', () => {
    expect(isRoleAtLeast('admin', 'moderator')).toBe(true);
    expect(isRoleAtLeast('moderator', 'participant')).toBe(true);
    expect(isRoleAtLeast('judge', 'participant')).toBe(true);
    expect(isRoleAtLeast('team_leader', 'anonymous')).toBe(true);
  });

  it('lower roles do not satisfy higher requirements', () => {
    expect(isRoleAtLeast('participant', 'admin')).toBe(false);
    expect(isRoleAtLeast('judge', 'admin')).toBe(false);
    expect(isRoleAtLeast('moderator', 'owner')).toBe(false);
    expect(isRoleAtLeast('team_leader', 'judge')).toBe(false);
  });

  it('hierarchy has exactly 7 roles', () => {
    expect(ROLE_HIERARCHY).toHaveLength(7);
  });
});

describe('role resolution - resolveRole', () => {
  const hackathonId = 'hack-role-test';
  const userId = 'user-role-test';
  const creatorId = 'user-creator';

  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
    await insertUser(creatorId, 1);
    await insertUser(userId, 2);
    await insertHackathon(hackathonId, 'test-hack', creatorId);
  });

  it('returns owner for organizer_roles with owner role', async () => {
    await insertOrganizerRole(hackathonId, userId, 'owner');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('owner');
  });

  it('returns admin for organizer_roles with admin role', async () => {
    await insertOrganizerRole(hackathonId, userId, 'admin');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('admin');
  });

  it('returns moderator for organizer_roles with moderator role', async () => {
    await insertOrganizerRole(hackathonId, userId, 'moderator');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('moderator');
  });

  it('returns judge for accepted judge invite', async () => {
    await insertJudge(hackathonId, userId, 'accepted');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('judge');
  });

  it('does not return judge for pending invite', async () => {
    await insertJudge(hackathonId, userId, 'pending');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('anonymous');
  });

  it('does not return judge for declined invite', async () => {
    await insertJudge(hackathonId, userId, 'declined');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('anonymous');
  });

  it('returns team_leader for team member with leader role', async () => {
    await insertTeamWithMember(hackathonId, userId, 'leader');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('team_leader');
  });

  it('returns participant for team member with member role', async () => {
    await insertTeamWithMember(hackathonId, userId, 'member');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('participant');
  });

  it('returns anonymous for authenticated user with no role', async () => {
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('anonymous');
  });

  it('organizer role takes priority over judge', async () => {
    await insertOrganizerRole(hackathonId, userId, 'admin');
    await insertJudge(hackathonId, userId, 'accepted');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('admin');
  });

  it('judge takes priority over team membership', async () => {
    await insertJudge(hackathonId, userId, 'accepted');
    await insertTeamWithMember(hackathonId, userId, 'leader');
    const db = createDbClient(env.DB);
    const role = await resolveRole(userId, hackathonId, db);
    expect(role).toBe('judge');
  });
});

describe('role middleware - requireRole', () => {
  const hackathonId = 'hack-mw-test';
  const slug = 'middleware-test';
  const creatorId = 'user-mw-creator';
  const userId = 'user-mw-test';

  beforeAll(async () => {
    await ensureSchema();
  });

  function buildTestApp() {
    const app = new Hono<AuthAppEnv>();

    app.get('/h/:slug/protected', requireRole('admin'), (c) => {
      return c.json({ ok: true, role: c.get('role') });
    });

    app.get('/h/:slug/public', requireRole('anonymous'), (c) => {
      return c.json({ ok: true, role: c.get('role') });
    });

    app.get('/h/:slug/member', requireRole('participant'), (c) => {
      return c.json({ ok: true, role: c.get('role') });
    });

    return app;
  }

  beforeEach(async () => {
    await resetDb();
    await insertUser(creatorId, 10);
    await insertUser(userId, 20);
    await insertHackathon(hackathonId, slug, creatorId);
  });

  it('returns 404 for non-existent hackathon slug', async () => {
    const app = buildTestApp();
    const res = await app.request(`http://localhost/h/nonexistent/protected`, {}, { DB: env.DB } as Env);

    expect(res.status).toBe(404);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when user role is insufficient', async () => {
    await insertOrganizerRole(hackathonId, userId, 'moderator');

    const app = buildTestApp();
    app.use('*', async (c, next) => {
      c.set('user', { sub: userId, ghid: 20, ghu: 'user-20' });
      await next();
    });

    const protectedApp = new Hono<AuthAppEnv>();
    protectedApp.use('*', async (c, next) => {
      c.set('user', { sub: userId, ghid: 20, ghu: 'user-20' });
      await next();
    });
    protectedApp.get('/h/:slug/protected', requireRole('admin'), (c) => {
      return c.json({ ok: true, role: c.get('role') });
    });

    const res = await protectedApp.request(
      `http://localhost/h/${slug}/protected`,
      {},
      { DB: env.DB } as Env
    );

    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('allows access when user role meets requirement', async () => {
    await insertOrganizerRole(hackathonId, userId, 'owner');

    const app = new Hono<AuthAppEnv>();
    app.use('*', async (c, next) => {
      c.set('user', { sub: userId, ghid: 20, ghu: 'user-20' });
      await next();
    });
    app.get('/h/:slug/protected', requireRole('admin'), (c) => {
      return c.json({ ok: true, role: c.get('role') });
    });

    const res = await app.request(
      `http://localhost/h/${slug}/protected`,
      {},
      { DB: env.DB } as Env
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; role: string };
    expect(body.ok).toBe(true);
    expect(body.role).toBe('owner');
  });

  it('returns 401 for unauthenticated user on protected route', async () => {
    const app = buildTestApp();
    const res = await app.request(
      `http://localhost/h/${slug}/member`,
      {},
      { DB: env.DB } as Env
    );

    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NO_TOKEN');
  });

  it('allows anonymous access to public endpoint', async () => {
    const app = buildTestApp();
    const res = await app.request(
      `http://localhost/h/${slug}/public`,
      {},
      { DB: env.DB } as Env
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; role: string };
    expect(body.ok).toBe(true);
    expect(body.role).toBe('anonymous');
  });
});
