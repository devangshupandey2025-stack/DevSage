import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../types/env.js';

interface SuccessResponseOptions {
  status?: ContentfulStatusCode;
  meta?: Record<string, unknown>;
}

export function successResponse<T>(c: Context<AppEnv>, data: T, options: SuccessResponseOptions = {}) {
  const { status = 200, meta } = options;
  return c.json({ ok: true as const, data, ...(meta ? { meta } : {}) }, status);
}

export function errorResponse(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return c.json({ ok: false as const, error: { code, message, ...(details ? { details } : {}) } }, status);
}

export function paginatedResponse<T>(
  c: Context<AppEnv>,
  data: T[],
  total: number,
  limit: number,
  offset: number
) {
  return c.json({
    ok: true,
    data,
    meta: {
      total,
      limit,
      offset,
      has_more: offset + data.length < total,
    },
  });
}

export function cursorPaginatedResponse<T>(
  c: Context<AppEnv>,
  data: T[],
  nextCursor: string | null
) {
  return c.json({
    ok: true,
    data,
    meta: {
      next_cursor: nextCursor,
      has_more: nextCursor !== null,
    },
  });
}
