import type { Context } from 'hono';
import type { Env } from '../types/env.js';

/**
 * Global error handler - returns structured JSON errors
 */
export function errorHandler(err: Error, c: Context<{ Bindings: Env }>) {
  console.error('Error:', err);
  
  return c.json(
    {
      error: err.message || 'Internal Server Error',
      code: 'INTERNAL_ERROR'
    },
    500
  );
}
