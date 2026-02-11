import type { Context } from 'hono';

interface SuccessMeta {
  etag?: string;
  cached?: boolean;
}

interface PaginationMeta extends SuccessMeta {
  total: number;
  limit: number;
  offset: number;
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
    ...meta,
  };
  return c.json({ ok: true, data, meta: paginationMeta }, 200);
}
