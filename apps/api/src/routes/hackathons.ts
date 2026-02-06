import { Hono } from 'hono';
import type { Env } from '../types/env.js';

const hackathons = new Hono<{ Bindings: Env }>();

/**
 * Hackathon routes stub - all return 501 Not Implemented
 * Future: CRUD operations for hackathons
 */

hackathons.get('/', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

hackathons.post('/', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

hackathons.get('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

hackathons.put('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

hackathons.delete('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

export default hackathons;
