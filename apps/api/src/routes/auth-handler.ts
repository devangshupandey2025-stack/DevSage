import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { createAuth } from '../auth.js';

const authRoutes = new Hono<AppEnv>();

authRoutes.on(['GET', 'POST'], '/*', (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

export default authRoutes;
