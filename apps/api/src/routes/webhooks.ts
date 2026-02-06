import { Hono } from 'hono';
import type { Env } from '../types/env.js';

const webhooks = new Hono<{ Bindings: Env }>();

/**
 * Webhook routes stub - all return 501 Not Implemented
 * Future: GitHub webhook ingestion, signature verification
 */

webhooks.post('/github', (c) => {
  return c.json({ error: 'Not Implemented' }, 501);
});

export default webhooks;
