import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { signJWT, verifyJWT } from '../lib/jwt.js';
import { hashPassword } from '../lib/password.js';
import { ensureSchema, resetDb, authCookie, env, JWT_SECRET, insertUser, SEED } from './helpers.js';

// ── Helpers ──────────────────────────────────────────────────

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Build a JWT with arbitrary payload and sign it with HMAC-SHA256 */
async function signArbitraryToken(payload: unknown, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${signingInput}.${encodedSignature}`;
}

/** POST JSON helper */
async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return SELF.fetch(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

/** Insert a user with a real hashed password (for login tests without hitting register endpoint) */
async function insertUserWithPassword(id: string, email: string, name: string, password: string) {
  const hash = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, email, name, hash, new Date().toISOString()).run();
}

/** Clear the auth rate limit counter in KV to avoid cross-test interference */
async function clearRateLimit() {
  await env.KV.delete('rl:auth:unknown');
}

// ── Tests ────────────────────────────────────────────────────

describe('auth — authenticated endpoints', () => {
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

  it('POST /auth/logout clears auth cookies', async () => {
    const userId = 'logout-user-0000-000000000001';
    await insertUser(userId, 'logout@example.com', 'Logout User');
    const cookie = await authCookie(userId);

    const res = await SELF.fetch('http://localhost/auth/logout', {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { logged_out: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.logged_out).toBe(true);

    const cookies = res.headers.get('Set-Cookie') ?? '';
    expect(cookies).toContain('access_token=');
  });
});

describe('auth — register', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); await clearRateLimit(); });

  it('registers a new user successfully', async () => {
    const res = await postJson('/auth/register', {
      email: 'new@example.com',
      password: 'strongpass123',
      name: 'New User',
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; data: { id: string; email: string; name: string } };
    expect(body.ok).toBe(true);
    expect(body.data.email).toBe('new@example.com');
    expect(body.data.name).toBe('New User');
    expect(body.data.id).toBeDefined();

    const cookies = res.headers.get('Set-Cookie') ?? '';
    expect(cookies).toContain('access_token=');
  });

  it('rejects duplicate email with 409', async () => {
    await insertUserWithPassword('dup-id-001', 'dup@example.com', 'First', 'strongpass123');

    const res = await postJson('/auth/register', {
      email: 'dup@example.com',
      password: 'strongpass123',
      name: 'Second',
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('rejects invalid email with 400', async () => {
    const res = await postJson('/auth/register', {
      email: 'not-an-email',
      password: 'strongpass123',
      name: 'User',
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects weak password (< 8 chars) with 400', async () => {
    const res = await postJson('/auth/register', {
      email: 'weak@example.com',
      password: 'short',
      name: 'User',
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('8');
  });
});

describe('auth — login', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); await clearRateLimit(); });

  it('logs in successfully with correct credentials', async () => {
    await insertUserWithPassword('login-id-001', 'login@example.com', 'Login User', 'correctpass1');

    const res = await postJson('/auth/login', {
      email: 'login@example.com',
      password: 'correctpass1',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { id: string; email: string; name: string } };
    expect(body.ok).toBe(true);
    expect(body.data.email).toBe('login@example.com');
    expect(body.data.name).toBe('Login User');

    const cookies = res.headers.get('Set-Cookie') ?? '';
    expect(cookies).toContain('access_token=');
  });

  it('rejects login with wrong password with 401', async () => {
    await insertUserWithPassword('wrongpw-id-001', 'wrongpw@example.com', 'User', 'correctpass1');

    const res = await postJson('/auth/login', {
      email: 'wrongpw@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login for nonexistent user with 401', async () => {
    const res = await postJson('/auth/login', {
      email: 'nobody@example.com',
      password: 'somepassword1',
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('JWT verification', () => {
  it('signJWT produces a valid 3-part token', async () => {
    const token = await signJWT({ sub: crypto.randomUUID(), fam: crypto.randomUUID() }, JWT_SECRET);
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyJWT accepts token signed with same secret', async () => {
    const userId = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const token = await signJWT({ sub: userId, fam: familyId }, JWT_SECRET);

    const verified = await verifyJWT(token, JWT_SECRET);

    expect(verified).not.toBeNull();
    expect(verified!.sub).toBe(userId);
    expect(verified!.fam).toBe(familyId);
    expect(typeof verified!.iat).toBe('number');
    expect(typeof verified!.exp).toBe('number');
  });

  it('verifyJWT rejects expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: crypto.randomUUID(), fam: crypto.randomUUID(), iat: now - 3600, exp: now - 1 };
    const token = await signArbitraryToken(payload, JWT_SECRET);

    const verified = await verifyJWT(token, JWT_SECRET);
    expect(verified).toBeNull();
  });

  it('verifyJWT rejects malformed token (wrong number of parts)', async () => {
    expect(await verifyJWT('not.a.jwt.token.extra', JWT_SECRET)).toBeNull();
    expect(await verifyJWT('only-two-parts.token', JWT_SECRET)).toBeNull();
    expect(await verifyJWT('', JWT_SECRET)).toBeNull();
  });

  it('verifyJWT rejects token signed with different secret', async () => {
    const token = await signJWT({ sub: crypto.randomUUID(), fam: crypto.randomUUID() }, JWT_SECRET);
    const verified = await verifyJWT(token, 'different-secret-key-min-32-chars!!');
    expect(verified).toBeNull();
  });

  it('token with sub+fam is accepted (minimal valid payload)', async () => {
    const userId = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: userId, fam: familyId, iat: now, exp: now + 900 };
    const token = await signArbitraryToken(payload, JWT_SECRET);

    const verified = await verifyJWT(token, JWT_SECRET);
    expect(verified).not.toBeNull();
    expect(verified!.sub).toBe(userId);
    expect(verified!.fam).toBe(familyId);
  });
});
