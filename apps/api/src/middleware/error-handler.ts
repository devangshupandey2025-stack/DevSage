import type { Context } from 'hono';
import type { Env } from '../types/env.js';

/**
 * Global error handler - returns structured JSON errors.
 * Envelope matches standard: { ok: false, error: { code, message } }
 */
export function errorHandler(err: Error, c: Context<{ Bindings: Env }>) {
  const status = 'status' in err && typeof err.status === 'number' ? err.status : 500;
  const message = err.message || 'Internal Server Error';

  // Log with structured context (console.error is allowed per convention)
  console.error('Unhandled error:', { message, status, stack: err.stack });

  return c.json(
    {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: status === 500 ? 'Internal Server Error' : message,
      },
    },
    status as 500,
  );
}
