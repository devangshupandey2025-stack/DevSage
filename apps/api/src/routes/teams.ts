import { Hono } from 'hono';
import type { Env } from '../types/env.js';

const teams = new Hono<{ Bindings: Env }>();

/**
 * Team routes stub - all return 501 Not Implemented
 * Future: Team CRUD, member management
 */

teams.get('/', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

teams.post('/', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

teams.get('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

teams.put('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

teams.delete('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

teams.post('/:id/members', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

teams.delete('/:id/members/:userId', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

export default teams;
