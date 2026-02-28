import type { Context } from 'hono';
import type { ZodSchema, ZodError } from 'zod';
import type { AppEnv } from '../types/env.js';

/**
 * Validates request body against a Zod schema.
 * Returns parsed data on success, or a 400 Response on failure.
 *
 * Usage:
 *   const result = await validateBody(c, schema);
 *   if (result instanceof Response) return result;
 *   // result is now typed as T
 */
export async function validateBody<T>(
  c: Context<AppEnv>,
  schema: ZodSchema<T>
): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        },
      },
      400
    );
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: formatZodErrors(result.error),
        },
      },
      400
    );
  }

  return result.data;
}

/**
 * Validates query parameters against a Zod schema.
 */
export function validateQuery<T>(
  c: Context<AppEnv>,
  schema: ZodSchema<T>
): T | Response {
  const raw = Object.fromEntries(new URL(c.req.url).searchParams);
  const result = schema.safeParse(raw);

  if (!result.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: formatZodErrors(result.error),
        },
      },
      400
    );
  }

  return result.data;
}

function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
