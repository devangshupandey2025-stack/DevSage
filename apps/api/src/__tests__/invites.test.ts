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

async function insertInvite(params: {
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
      crypto.randomUUID(),
      params.email,
      params.inviteCode,
      params.status ?? 'pending',
      params.invitedBy,
      params.expiresAt ?? future,
      now,
    )
    .run();
}

describe('invite routes', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('GET /api/v1/invites/:code — lookup invite', () => {
    it('returns invite details for valid code', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 1001);
      await insertInvite({ email: 'org@test.com', inviteCode: 'valid-code-123', invitedBy: adminId });

      const response = await SELF.fetch('http://localhost/api/v1/invites/valid-code-123');

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ok: boolean;
        data: { email: string; status: string; expires_at: string };
      };
      expect(body.ok).toBe(true);
      expect(body.data.email).toBe('org@test.com');
      expect(body.data.status).toBe('pending');
    });

    it('returns 404 for invalid code', async () => {
      const response = await SELF.fetch('http://localhost/api/v1/invites/nonexistent-code');

      expect(response.status).toBe(404);
      const body = (await response.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('shows expired status when invite is past expiry', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 1002);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await insertInvite({
        email: 'expired@test.com',
        inviteCode: 'expired-code',
        invitedBy: adminId,
        expiresAt: pastDate,
      });

      const response = await SELF.fetch('http://localhost/api/v1/invites/expired-code');

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ok: boolean;
        data: { status: string };
      };
      expect(body.ok).toBe(true);
      expect(body.data.status).toBe('expired');
    });
  });

  describe('POST /api/v1/invites/:code/accept — accept invite', () => {
    it('accepts a pending invite', async () => {
      const adminId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await insertUser(adminId, 2001);
      await insertUser(userId, 2002);
      await insertInvite({ email: 'accept@test.com', inviteCode: 'accept-code', invitedBy: adminId });

      const response = await SELF.fetch('http://localhost/api/v1/invites/accept-code/accept', {
        method: 'POST',
        headers: { Cookie: await authCookie(userId, 2002, 'user-2002') },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; data: { message: string } };
      expect(body.ok).toBe(true);

      const invite = await env.DB
        .prepare(`SELECT status, accepted_by FROM organizer_invites WHERE invite_code = 'accept-code'`)
        .first();
      expect(invite?.status).toBe('accepted');
      expect(invite?.accepted_by).toBe(userId);
    });

    it('rejects expired invite with 410', async () => {
      const adminId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await insertUser(adminId, 2003);
      await insertUser(userId, 2004);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await insertInvite({
        email: 'exp@test.com',
        inviteCode: 'exp-code',
        invitedBy: adminId,
        expiresAt: pastDate,
      });

      const response = await SELF.fetch('http://localhost/api/v1/invites/exp-code/accept', {
        method: 'POST',
        headers: { Cookie: await authCookie(userId, 2004, 'user-2004') },
      });

      expect(response.status).toBe(410);
      const body = (await response.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('INVITE_EXPIRED');
    });

    it('rejects already-accepted invite with 404', async () => {
      const adminId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await insertUser(adminId, 2005);
      await insertUser(userId, 2006);
      await insertInvite({
        email: 'used@test.com',
        inviteCode: 'used-code',
        invitedBy: adminId,
        status: 'accepted',
      });

      const response = await SELF.fetch('http://localhost/api/v1/invites/used-code/accept', {
        method: 'POST',
        headers: { Cookie: await authCookie(userId, 2006, 'user-2006') },
      });

      expect(response.status).toBe(404);
    });

    it('rejects unauthenticated request', async () => {
      const adminId = crypto.randomUUID();
      await insertUser(adminId, 2007);
      await insertInvite({ email: 'noauth@test.com', inviteCode: 'noauth-code', invitedBy: adminId });

      const response = await SELF.fetch('http://localhost/api/v1/invites/noauth-code/accept', {
        method: 'POST',
      });

      expect(response.status).toBe(401);
    });

    it('creates audit event on acceptance', async () => {
      const adminId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      await insertUser(adminId, 2008);
      await insertUser(userId, 2009);
      await insertInvite({ email: 'audit@test.com', inviteCode: 'audit-code', invitedBy: adminId });

      await SELF.fetch('http://localhost/api/v1/invites/audit-code/accept', {
        method: 'POST',
        headers: { Cookie: await authCookie(userId, 2009, 'user-2009') },
      });

      const audit = await env.DB
        .prepare(`SELECT event_type, actor_id FROM audit_events WHERE event_type = 'organizer_invite.accept'`)
        .first();

      expect(audit).toBeTruthy();
      expect(audit?.actor_id).toBe(userId);
    });
  });
});
