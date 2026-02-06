import { Hono } from 'hono';
import type { Env } from './types/env.js';
import { errorHandler } from './middleware/error-handler.js';
import auth from './routes/auth.js';
import hackathons from './routes/hackathons.js';
import teams from './routes/teams.js';
import webhooks from './routes/webhooks.js';
import submissions from './routes/submissions.js';

// Re-export Durable Object classes (CRITICAL: wrangler requires this)
export { HackathonLifecycleDO } from './durable-objects/hackathon-lifecycle.js';
export { SubmissionDO } from './durable-objects/submission.js';

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Global error handler
app.onError(errorHandler);

// Mount route groups
app.route('/api/auth', auth);
app.route('/api/hackathons', hackathons);
app.route('/api/teams', teams);
app.route('/api/webhooks', webhooks);
app.route('/api/submissions', submissions);

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'DevSage API' });
});

// Export Worker with fetch and queue handlers
export default {
  fetch: app.fetch,
  
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    // Queue consumer for GitHub webhooks
    for (const msg of batch.messages) {
      console.log('Queue message:', msg.body);
      // Future: Process webhook events, update submission state
      msg.ack();
    }
  }
};
