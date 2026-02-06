import { Hono } from 'hono';
import type { Env } from '../types/env.js';

const submissions = new Hono<{ Bindings: Env }>();

/**
 * Submission routes stub - all return 501 Not Implemented
 * Future: Submission CRUD, GitHub repo linking
 */

submissions.get('/', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

submissions.post('/', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

submissions.get('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

submissions.put('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

submissions.delete('/:id', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

export default submissions;
