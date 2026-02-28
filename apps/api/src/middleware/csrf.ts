import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';
import { isAllowedOrigin } from '../lib/allowed-origin.js';

/**
 * CSRF protection for cookie-based authentication.
 * Validates the Origin header on state-changing requests to ensure
 * they come from allowed origins. Non-browser clients (no Origin header)
 * are allowed through since they can't carry cookies cross-site.
 */
export function csrfProtection(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const method = c.req.method;

    // Only check state-changing methods that could be "simple" CORS requests
    if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
      return next();
    }

    // Webhook routes use signature verification instead of CSRF
    const path = c.req.path;
    if (path.startsWith('/webhooks')) {
      return next();
    }

    // Check Origin header — browsers always send this on cross-origin requests
    const origin = c.req.header('origin');

    // No Origin = non-browser client (curl, Postman, server-to-server)
    // These can't exploit CSRF since they don't send cookies automatically
    if (!origin) {
      return next();
    }

    // Validate origin against allowed list
    if (!isAllowedOrigin(origin, c.env)) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'CSRF_VALIDATION_FAILED',
            message: 'Request origin not allowed',
          },
        },
        403
      );
    }

    return next();
  };
}
