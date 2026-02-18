import { SELF } from 'cloudflare:test';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { successResponse, errorResponse, paginatedResponse, cursorPaginatedResponse } from '../lib/response.js';
import { ensureSchema, resetDb } from './helpers.js';
import type { AppEnv } from '../types/env.js';

// Minimal Hono app wired to response helpers
const app = new Hono<AppEnv>();

app.get('/success', (c) => successResponse(c, { name: 'test' }));
app.get('/success-status', (c) => successResponse(c, { created: true }, { status: 201 }));
app.get('/success-meta', (c) =>
  successResponse(c, { name: 'test' }, { meta: { etag: 'W/"abc123"', cached: true } })
);
app.get('/error', (c) => errorResponse(c, 400, 'BAD_REQUEST', 'Invalid input'));
app.get('/error-details', (c) =>
  errorResponse(c, 422, 'VALIDATION_ERROR', 'Field validation failed', {
    field: 'email',
    reason: 'invalid format',
  })
);
app.get('/paginated', (c) =>
  paginatedResponse(c, [{ id: '1' }, { id: '2' }], 100, 10, 0)
);
app.get('/paginated-end', (c) =>
  paginatedResponse(c, [{ id: '10' }], 10, 10, 9)
);
app.get('/cursor', (c) =>
  cursorPaginatedResponse(c, [{ id: '1' }], 'next-cursor-abc')
);
app.get('/cursor-last', (c) =>
  cursorPaginatedResponse(c, [{ id: '1' }], null)
);

// ── Tests ────────────────────────────────────────────────────

describe('response helpers', () => {
  beforeAll(async () => { await ensureSchema(); });
  beforeEach(async () => { await resetDb(); });

  // ────── successResponse ──────

  it('successResponse returns ok:true with data and status 200', async () => {
    const res = await app.request('/success');
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { name: string } };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ name: 'test' });
  });

  it('successResponse respects custom status code', async () => {
    const res = await app.request('/success-status');
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; data: { created: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.created).toBe(true);
  });

  it('successResponse includes provided meta', async () => {
    const res = await app.request('/success-meta');
    const body = await res.json() as { ok: boolean; data: unknown; meta: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(body.meta).toBeDefined();
    expect(body.meta.etag).toBe('W/"abc123"');
    expect(body.meta.cached).toBe(true);
  });

  // ────── errorResponse ──────

  it('errorResponse returns ok:false with error object', async () => {
    const res = await app.request('/error');
    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('Invalid input');
  });

  it('errorResponse includes details when provided', async () => {
    const res = await app.request('/error-details');
    expect(res.status).toBe(422);
    const body = await res.json() as { ok: boolean; error: { code: string; details: { field: string; reason: string } } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.field).toBe('email');
    expect(body.error.details.reason).toBe('invalid format');
  });

  // ────── paginatedResponse ──────

  it('paginatedResponse includes meta with total, limit, offset, has_more', async () => {
    const res = await app.request('/paginated');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: unknown[];
      meta: { total: number; limit: number; offset: number; has_more: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(100);
    expect(body.meta.limit).toBe(10);
    expect(body.meta.offset).toBe(0);
    expect(body.meta.has_more).toBe(true);
  });

  it('paginatedResponse has_more is false when at end', async () => {
    const res = await app.request('/paginated-end');
    const body = await res.json() as { meta: { has_more: boolean; total: number; offset: number } };
    expect(body.meta.has_more).toBe(false);
    expect(body.meta.total).toBe(10);
    expect(body.meta.offset).toBe(9);
  });

  // ────── cursorPaginatedResponse ──────

  it('cursorPaginatedResponse includes next_cursor and has_more true', async () => {
    const res = await app.request('/cursor');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      data: unknown[];
      meta: { next_cursor: string | null; has_more: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta.next_cursor).toBe('next-cursor-abc');
    expect(body.meta.has_more).toBe(true);
  });

  it('cursorPaginatedResponse has_more false when no cursor (last page)', async () => {
    const res = await app.request('/cursor-last');
    const body = await res.json() as { meta: { next_cursor: string | null; has_more: boolean } };
    expect(body.meta.next_cursor).toBeNull();
    expect(body.meta.has_more).toBe(false);
  });
});
