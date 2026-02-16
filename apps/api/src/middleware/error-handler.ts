import type { ErrorHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown';
  console.error(`[${requestId}] Unhandled error:`, err.message, err.stack);

  return c.json(
    {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
};
