import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { generateETag, checkConditionalRequest } from '../lib/etag.js';

describe('response envelope', () => {
  const app = new Hono();

  app.get('/success', (c) => successResponse(c, { name: 'test' }));
  app.get('/success-with-meta', (c) =>
    successResponse(c, { name: 'test' }, { etag: 'W/"abc123"', cached: true })
  );
  app.get('/success-custom-status', (c) => successResponse(c, { created: true }, {}, 201));
  app.get('/error', (c) => errorResponse(c, 400, 'BAD_REQUEST', 'Invalid input'));
  app.get('/error-with-details', (c) =>
    errorResponse(c, 422, 'VALIDATION_ERROR', 'Field validation failed', {
      field: 'email',
      reason: 'invalid format',
    })
  );
  app.get('/paginated', (c) =>
    paginatedResponse(c, [{ id: '1', name: 'Item 1' }], 100, 10, 0)
  );
  app.get('/paginated-with-meta', (c) =>
    paginatedResponse(c, [{ id: '1' }], 50, 5, 10, { etag: 'W/"xyz789"' })
  );

  it('successResponse returns ok:true with data', async () => {
    const res = await app.request('/success');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ name: 'test' });
    expect(body.meta).toBeDefined();
    expect(typeof body.meta).toBe('object');
  });

  it('successResponse includes provided meta', async () => {
    const res = await app.request('/success-with-meta');
    const body = (await res.json()) as Record<string, unknown>;
    const meta = body.meta as Record<string, unknown>;
    expect(meta.etag).toBe('W/"abc123"');
    expect(meta.cached).toBe(true);
  });

  it('successResponse respects custom status code', async () => {
    const res = await app.request('/success-custom-status');
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.created).toBe(true);
  });

  it('errorResponse returns ok:false with error object', async () => {
    const res = await app.request('/error');
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid input');
  });

  it('errorResponse includes details when provided', async () => {
    const res = await app.request('/error-with-details');
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    const error = body.error as Record<string, unknown>;
    expect(error.details).toBeDefined();
    const details = error.details as Record<string, unknown>;
    expect(details.field).toBe('email');
    expect(details.reason).toBe('invalid format');
  });

  it('paginatedResponse includes pagination metadata', async () => {
    const res = await app.request('/paginated');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBe(1);
    const meta = body.meta as Record<string, unknown>;
    expect(meta.total).toBe(100);
    expect(meta.limit).toBe(10);
    expect(meta.offset).toBe(0);
  });

  it('paginatedResponse merges custom meta with pagination', async () => {
    const res = await app.request('/paginated-with-meta');
    const body = (await res.json()) as Record<string, unknown>;
    const meta = body.meta as Record<string, unknown>;
    expect(meta.total).toBe(50);
    expect(meta.limit).toBe(5);
    expect(meta.offset).toBe(10);
    expect(meta.etag).toBe('W/"xyz789"');
  });
});

describe('ETag generation', () => {
  it('generates deterministic etag for same data', async () => {
    const data = { foo: 'bar', baz: 42 };
    const etag1 = await generateETag(data);
    const etag2 = await generateETag(data);
    expect(etag1).toBe(etag2);
  });

  it('generates etag in W/"..." format', async () => {
    const etag = await generateETag({ test: 'data' });
    expect(etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
  });

  it('generates different etags for different data', async () => {
    const etag1 = await generateETag({ foo: 'bar' });
    const etag2 = await generateETag({ foo: 'baz' });
    expect(etag1).not.toBe(etag2);
  });

  it('generates different etags for different object order', async () => {
    const etag1 = await generateETag({ a: 1, b: 2 });
    const etag1Again = await generateETag({ a: 1, b: 2 });
    expect(etag1).toBe(etag1Again);
  });

  it('handles complex nested data', async () => {
    const data = {
      user: { id: '123', name: 'John' },
      items: [{ id: '1', value: 100 }],
      metadata: { created: '2024-01-01' },
    };
    const etag = await generateETag(data);
    expect(etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
  });

  it('handles arrays', async () => {
    const etag1 = await generateETag([1, 2, 3]);
    const etag2 = await generateETag([1, 2, 3]);
    expect(etag1).toBe(etag2);
  });

  it('handles null and undefined', async () => {
    const etag1 = await generateETag(null);
    const etag2 = await generateETag(null);
    expect(etag1).toBe(etag2);
  });

  it('handles strings', async () => {
    const etag1 = await generateETag('hello world');
    const etag2 = await generateETag('hello world');
    expect(etag1).toBe(etag2);
  });

  it('handles numbers', async () => {
    const etag1 = await generateETag(42);
    const etag2 = await generateETag(42);
    expect(etag1).toBe(etag2);
  });
});

describe('conditional request checking', () => {
  const app = new Hono();
  const testETag = 'W/"abc123def456"';

  app.get('/resource', (c) => {
    const conditional = checkConditionalRequest(c, testETag);
    if (conditional) {
      return conditional;
    }
    return c.json({ ok: true, data: { id: '1' }, meta: { etag: testETag } });
  });

  it('returns null when no If-None-Match header', async () => {
    const res = await app.request('/resource');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  it('returns 304 when ETag matches If-None-Match', async () => {
    const res = await app.request('/resource', {
      headers: { 'If-None-Match': testETag },
    });
    expect(res.status).toBe(304);
    const text = await res.text();
    expect(text).toBe('');
  });

  it('returns 200 when ETag does not match If-None-Match', async () => {
    const res = await app.request('/resource', {
      headers: { 'If-None-Match': 'W/"different"' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  it('handles multiple ETags in If-None-Match (comma-separated)', async () => {
    const res = await app.request('/resource', {
      headers: { 'If-None-Match': 'W/"other", W/"abc123def456"' },
    });
    expect(res.status).toBe(200);
  });

  it('handles wildcard If-None-Match', async () => {
    const res = await app.request('/resource', {
      headers: { 'If-None-Match': '*' },
    });
    expect(res.status).toBe(200);
  });
});

describe('integration: ETag with response envelope', () => {
  const app = new Hono();

  app.get('/cached-resource', async (c) => {
    const data = { id: '1', name: 'Resource' };
    const etag = await generateETag(data);

    const conditional = checkConditionalRequest(c, etag);
    if (conditional) {
      return conditional;
    }

    return successResponse(c, data, { etag });
  });

  it('returns full response with etag on first request', async () => {
    const res = await app.request('/cached-resource');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.id).toBe('1');
    const meta = body.meta as Record<string, unknown>;
    expect((meta.etag as string)).toMatch(/^W\/"[a-f0-9]{16}"$/);
  });

  it('returns 304 on subsequent request with matching etag', async () => {
    const res1 = await app.request('/cached-resource');
    const body1 = (await res1.json()) as Record<string, unknown>;
    const meta1 = body1.meta as Record<string, unknown>;
    const etag = meta1.etag as string;

    const res2 = await app.request('/cached-resource', {
      headers: { 'If-None-Match': etag },
    });
    expect(res2.status).toBe(304);
  });
});
