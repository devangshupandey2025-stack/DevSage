import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { ensureSchema, resetDb, authCookie, env, insertUser, insertPlatformAdmin, insertOrganizerRole, SEED } from './helpers.js';

// ── Helpers ──────────────────────────────────────────────────

/** POST JSON helper */
async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return SELF.fetch(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Clear the auth rate limit counter in KV to avoid cross-test interference */
async function clearRateLimit() {
  await env.KV.delete('rl:auth:unknown');
}

// ── Tests ────────────────────────────────────────────────────

describe('auth — /auth/me', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); await clearRateLimit(); });

  it('GET /auth/me returns user when authenticated', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    const cookie = await authCookie(SEED.srijan.id);

    const res = await SELF.fetch('http://localhost/auth/me', {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { user: { id: string; email: string; name: string } } };
    expect(body.ok).toBe(true);
    expect(body.data.user.id).toBe(SEED.srijan.id);
    expect(body.data.user.email).toBe(SEED.srijan.email);
  });

  it('GET /auth/me returns 401 when not authenticated', async () => {
    const res = await SELF.fetch('http://localhost/auth/me');

    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('GET /auth/me returns role flags correctly', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertPlatformAdmin(SEED.srijan.id);

    // Need a hackathon for organizer roles
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO workspaces (id, name, slug, type, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind('ws-test', 'Test', 'test', 'organization', SEED.srijan.id, now, now).run();
    await env.DB.prepare(
      `INSERT INTO hackathons (id, workspace_id, slug, title, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind('hack-test', 'ws-test', 'test-hack', 'Test', 'active', SEED.srijan.id, now, now).run();
    await insertOrganizerRole('hack-test', SEED.srijan.id, 'organizer');

    const cookie = await authCookie(SEED.srijan.id);
    const res = await SELF.fetch('http://localhost/auth/me', {
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { isPlatformAdmin: boolean; isOrganizer: boolean } };
    expect(body.data.isPlatformAdmin).toBe(true);
    expect(body.data.isOrganizer).toBe(true);
  });
});

describe('auth — /auth/logout', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); await clearRateLimit(); });

  it('POST /auth/logout returns success when authenticated', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    const cookie = await authCookie(SEED.srijan.id);

    const res = await SELF.fetch('http://localhost/auth/logout', {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { logged_out: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.logged_out).toBe(true);
  });

  it('POST /auth/logout returns 401 when not authenticated', async () => {
    const res = await SELF.fetch('http://localhost/auth/logout', {
      method: 'POST',
    });

    expect(res.status).toBe(401);
  });
});

describe('auth — Better Auth sign-up/sign-in (via /api/auth)', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); await clearRateLimit(); });

  it('POST /api/auth/sign-up/email creates a new user', async () => {
    const res = await postJson('/api/auth/sign-up/email', {
      email: 'new@example.com',
      password: 'strongpass123',
      name: 'New User',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { user?: { id: string; email: string }; token?: string };
    expect(body.user).toBeDefined();
    expect(body.user!.email).toBe('new@example.com');

    // Verify session cookie is set
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('better-auth.session_token');
  });

  it('POST /api/auth/sign-in/email logs in with correct credentials', async () => {
    // First sign up
    await postJson('/api/auth/sign-up/email', {
      email: 'login@example.com',
      password: 'correctpass1',
      name: 'Login User',
    });

    // Then sign in
    const res = await postJson('/api/auth/sign-in/email', {
      email: 'login@example.com',
      password: 'correctpass1',
    });

    expect(res.status).toBe(200);
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('better-auth.session_token');
  });

  it('POST /api/auth/sign-in/email rejects wrong password', async () => {
    // First sign up
    await postJson('/api/auth/sign-up/email', {
      email: 'wrongpw@example.com',
      password: 'correctpass1',
      name: 'User',
    });

    // Then try wrong password
    const res = await postJson('/api/auth/sign-in/email', {
      email: 'wrongpw@example.com',
      password: 'wrongpassword',
    });

    // Better Auth returns 401 or 400 for invalid credentials
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
