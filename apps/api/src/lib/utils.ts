/**
 * Shared utility functions used across the API codebase.
 *
 * These replace duplicated inline helpers that were scattered
 * across route handlers, queue handlers, and the Durable Object.
 */

/**
 * Type guard for plain objects. Used throughout the codebase for safe
 * runtime type narrowing on unknown values (DO responses, webhook payloads, etc.).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely parse a Response body as JSON, returning null on failure.
 * Prevents unhandled JSON parse errors from crashing request handlers.
 */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
