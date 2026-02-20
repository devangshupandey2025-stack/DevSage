import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthAppEnv } from '../types/env.js';

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            ok: z.literal(true),
            timestamp: z.string(),
          }),
        },
      },
      description: 'Health check response',
    },
  },
});

const app = new OpenAPIHono<AuthAppEnv>();

app.openapi(healthRoute, (c) => {
  return c.json({ ok: true as const, timestamp: new Date().toISOString() }, 200);
});

export default app;
