import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSchema, resetDb, authCookie,
  insertUser, insertPlatformAdmin,
  SEED, env,
} from './helpers.js';
import type { ApiResponse } from './helpers.js';

describe('platform admin middleware', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  it('returns 401 without auth', async () => {
    const res = await SELF.fetch('http://localhost/api/v1/admin/users');
    expect(res.status).toBe(401);
    const body = await res.json() as ApiResponse;
    expect(body.error?.code).toBe('AUTH_REQUIRED');
  });

  it('returns 403 for non-admin user', async () => {
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);

    const res = await SELF.fetch('http://localhost/api/v1/admin/users', {
      headers: { Cookie: await authCookie(SEED.participant.id) },
    });

    expect(res.status).toBe(403);
    const body = await res.json() as ApiResponse;
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('succeeds for platform admin user', async () => {
    await insertUser(SEED.admin.id, SEED.admin.email, SEED.admin.name);
    await insertPlatformAdmin(SEED.admin.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/users', {
      headers: { Cookie: await authCookie(SEED.admin.id) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ApiResponse;
    expect(body.ok).toBe(true);
  });

  it('protects multiple admin endpoints', async () => {
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    const cookie = await authCookie(SEED.participant.id);

    const endpoints = [
      'http://localhost/api/v1/admin/users',
      'http://localhost/api/v1/admin/hackathons',
      'http://localhost/api/v1/admin/admins',
      'http://localhost/api/v1/admin/stats',
    ];

    for (const url of endpoints) {
      const res = await SELF.fetch(url, { headers: { Cookie: cookie } });
      expect(res.status).toBe(403);
    }
  });

  it('admin can list platform admins', async () => {
    await insertUser(SEED.admin.id, SEED.admin.email, SEED.admin.name);
    await insertPlatformAdmin(SEED.admin.id);

    const res = await SELF.fetch('http://localhost/api/v1/admin/admins', {
      headers: { Cookie: await authCookie(SEED.admin.id) },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ApiResponse<unknown[]>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });
});
