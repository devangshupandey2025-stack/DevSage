import { SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSchema, resetDb, authCookie, insertUser, insertNotification,
  SEED, env,
} from './helpers.js';
import type { ApiResponse } from './helpers.js';

describe('notification routes — /api/v1/notifications', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  const baseUrl = 'http://localhost/api/v1/notifications';

  // ── GET / — list notifications ─────────────────────────────────

  it('lists notifications for authenticated user', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertNotification({
      id: 'n-1', userId: SEED.srijan.id, type: 'info',
      title: 'Welcome', body: 'Welcome to DevSage',
    });
    await insertNotification({
      id: 'n-2', userId: SEED.srijan.id, type: 'alert',
      title: 'Deadline', body: 'Submission deadline approaching',
    });

    const res = await SELF.fetch(baseUrl, {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Array<{ id: string; title: string }>>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(2);
  });

  it('filters notifications by hackathon_id', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    const hackId = 'hack-filter-1';
    await insertNotification({
      id: 'n-h1', userId: SEED.srijan.id, hackathonId: hackId,
      type: 'info', title: 'Hack Notif',
    });
    await insertNotification({
      id: 'n-h2', userId: SEED.srijan.id,
      type: 'info', title: 'General Notif',
    });

    const res = await SELF.fetch(`${baseUrl}?hackathon_id=${hackId}`, {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Array<{ id: string; title: string }>>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].title).toBe('Hack Notif');
  });

  it('rejects listing without auth → 401', async () => {
    const res = await SELF.fetch(baseUrl);
    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  // ── GET /unread-count ──────────────────────────────────────────

  it('returns unread count', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertNotification({
      id: 'n-ur1', userId: SEED.srijan.id, type: 'info', title: 'Unread 1',
    });
    await insertNotification({
      id: 'n-ur2', userId: SEED.srijan.id, type: 'info', title: 'Unread 2',
    });
    await insertNotification({
      id: 'n-r1', userId: SEED.srijan.id, type: 'info', title: 'Read',
      readAt: new Date().toISOString(),
    });

    const res = await SELF.fetch(`${baseUrl}/unread-count`, {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ count: number }>;
    expect(body.ok).toBe(true);
    expect(body.data.count).toBe(2);
  });

  // ── PATCH /:notificationId/read — mark as read ─────────────────

  it('marks a notification as read', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertNotification({
      id: 'n-mark', userId: SEED.srijan.id, type: 'info', title: 'To Read',
    });

    const res = await SELF.fetch(`${baseUrl}/n-mark/read`, {
      method: 'PATCH',
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ read: boolean }>;
    expect(body.ok).toBe(true);
    expect(body.data.read).toBe(true);

    // Verify in DB
    const row = await env.DB.prepare(
      'SELECT read_at FROM in_app_notifications WHERE id = ?'
    ).bind('n-mark').first();
    expect(row?.read_at).toBeTruthy();
  });

  // ── PATCH /read-all — mark all as read ─────────────────────────

  it('marks all notifications as read', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertNotification({
      id: 'n-all1', userId: SEED.srijan.id, type: 'info', title: 'First',
    });
    await insertNotification({
      id: 'n-all2', userId: SEED.srijan.id, type: 'info', title: 'Second',
    });

    const res = await SELF.fetch(`${baseUrl}/read-all`, {
      method: 'PATCH',
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<{ read_all: boolean }>;
    expect(body.ok).toBe(true);
    expect(body.data.read_all).toBe(true);

    // Verify unread count is 0
    const countRes = await SELF.fetch(`${baseUrl}/unread-count`, {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });
    const countBody = (await countRes.json()) as ApiResponse<{ count: number }>;
    expect(countBody.data.count).toBe(0);
  });

  // ── unread count after marking ─────────────────────────────────

  it('unread count updates after marking notification as read', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertNotification({
      id: 'n-cnt1', userId: SEED.srijan.id, type: 'info', title: 'One',
    });
    await insertNotification({
      id: 'n-cnt2', userId: SEED.srijan.id, type: 'info', title: 'Two',
    });

    // Check initial count
    let countRes = await SELF.fetch(`${baseUrl}/unread-count`, {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });
    let countBody = (await countRes.json()) as ApiResponse<{ count: number }>;
    expect(countBody.data.count).toBe(2);

    // Mark one as read
    await SELF.fetch(`${baseUrl}/n-cnt1/read`, {
      method: 'PATCH',
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });

    // Check updated count
    countRes = await SELF.fetch(`${baseUrl}/unread-count`, {
      headers: { Authorization: await authCookie(SEED.srijan.id) },
    });
    countBody = (await countRes.json()) as ApiResponse<{ count: number }>;
    expect(countBody.data.count).toBe(1);
  });

  // ── cross-user isolation ───────────────────────────────────────

  it('cannot see other user\'s notifications', async () => {
    await insertUser(SEED.srijan.id, SEED.srijan.email, SEED.srijan.name);
    await insertUser(SEED.participant.id, SEED.participant.email, SEED.participant.name);
    await insertNotification({
      id: 'n-other', userId: SEED.srijan.id, type: 'info', title: 'Private',
    });

    const res = await SELF.fetch(baseUrl, {
      headers: { Authorization: await authCookie(SEED.participant.id) },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Array<{ id: string }>>;
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(0);
  });
});
