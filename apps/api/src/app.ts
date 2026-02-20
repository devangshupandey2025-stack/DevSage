import { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthAppEnv } from './types/env.js';
import { AppError } from './lib/errors.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { corsMiddleware } from './middleware/cors.js';
import { optionalAuth } from './middleware/auth.js';

export function createApp() {
  const app = new OpenAPIHono<AuthAppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: result.error.flatten(),
            },
          },
          422,
        );
      }
    },
  });

  // Global middleware: CORS → Request ID → Auth → routes
  app.use('*', corsMiddleware);
  app.use('*', requestIdMiddleware);
  app.use('*', optionalAuth);

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        {
          ok: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        err.statusCode as 400,
      );
    }

    console.error('Unhandled error:', err);
    return c.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500,
    );
  });

  return app;
}
