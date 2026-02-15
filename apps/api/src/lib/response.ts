import type { Context } from 'hono';

interface SuccessMeta {
  etag?: string;
  cached?: boolean;
  timestamp?: string;
}

interface PaginationMeta extends SuccessMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

interface CursorPaginationMeta extends SuccessMeta {
  limit: number;
  cursor: string | null;
  has_more: boolean;
}

export function successResponse<T>(
  c: Context,
  data: T,
  meta?: SuccessMeta,
  status = 200
) {
  return c.json({ ok: true, data, meta: meta ?? {} }, status as never);
}

export function errorResponse(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return c.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status as never
  );
}

export function paginatedResponse<T>(
  c: Context,
  data: T[],
  total: number,
  limit: number,
  offset: number,
  meta?: SuccessMeta
) {
  const paginationMeta: PaginationMeta = {
    total,
    limit,
    offset,
    has_more: offset + data.length < total,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  return c.json({ ok: true, data, meta: paginationMeta }, 200);
}

export function cursorPaginatedResponse<T>(
  c: Context,
  data: T[],
  limit: number,
  nextCursor: string | null,
  meta?: SuccessMeta
) {
  const cursorMeta: CursorPaginationMeta = {
    limit,
    cursor: nextCursor,
    has_more: nextCursor !== null,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  return c.json({ ok: true, data, meta: cursorMeta }, 200);
}

export function noContentResponse(c: Context) {
  return c.body(null, 204);
}
