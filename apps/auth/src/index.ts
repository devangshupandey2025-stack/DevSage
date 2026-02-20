import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AuthEnv } from './types/env.js';
import { createAuth } from './auth.js';
import { getUserRoles } from './lib/roles.js';
import { signJWT } from './lib/jwt.js';

const app = new Hono<AuthEnv>();

// CORS for all frontend origins
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = [
        'https://devsage.org',
        'https://platform.devsage.org',
        'https://shikdd.devsage.org',
        'https://judge.devsage.org',
      ];
      if (allowed.includes(origin) || origin.startsWith('http://localhost:')) {
        return origin;
      }
      return '';
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    credentials: true,
    maxAge: 600,
  }),
);

// Health check
app.get('/', (c) => c.json({ service: 'devsage-auth', ok: true }));

// Mount Better Auth handler — handles all /api/auth/* routes
app.on(['POST', 'GET'], '/api/auth/**', async (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Custom token endpoint: issues role-enriched JWT for API consumption
app.get('/token', async (c) => {
  const auth = createAuth(c.env);
  const authSession = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!authSession) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const roles = await getUserRoles(c.env.DB, authSession.user.id);

  const token = await signJWT(
    {
      sub: authSession.user.id,
      email: authSession.user.email,
      name: authSession.user.name,
      image: authSession.user.image,
      platformAdmin: roles.platformAdmin,
      hackathonRoles: roles.hackathonRoles,
      workspaceRoles: roles.workspaceRoles,
    },
    c.env.JWT_SECRET,
    900, // 15 minutes
  );

  return c.json({ token });
});

export default {
  fetch: app.fetch,
};
