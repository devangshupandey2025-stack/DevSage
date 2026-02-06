import { Hono } from 'hono';
import type { Env } from '../types/env.js';

const auth = new Hono<{ Bindings: Env }>();

/**
 * Auth routes stub - all return 501 Not Implemented
 * Future: Implement OAuth2 flows (Google, GitHub)
 */

auth.get('/login', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

auth.get('/login/google', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

auth.get('/callback/google', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

auth.get('/login/github', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

auth.get('/callback/github', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

auth.post('/logout', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

export default auth;
