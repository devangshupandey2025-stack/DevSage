import type { ErrorHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown';
  console.error(`[${requestId}] Unhandled error:`, err?.message ?? String(err), err?.stack ?? '');

  // Include error details in responses during local development to aid debugging.
  const isDev = c.env.NODE_ENV === 'development'
    || Boolean(c.env.JWT_SECRET && c.env.JWT_SECRET.startsWith('dev'));

  const body: any = {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? (err?.message ?? 'Internal error') : 'An unexpected error occurred',
    },
  };

  if (isDev) {
    body.error.detail = err?.stack ?? String(err);
    body.requestId = requestId;
  }

  return c.json(body, 500);
};
