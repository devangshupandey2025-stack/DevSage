import { Hono } from 'hono';
import { createAuth } from '../auth.js';

const authRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  };
}>();

authRoutes.on(['GET', 'POST'], '/*', (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

export default authRoutes;
