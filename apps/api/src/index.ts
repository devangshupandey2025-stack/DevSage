import { createApp } from './app.js';
import authHandler from './routes/auth-handler.js';
import health from './routes/health.js';
import hackathonShell from './routes/hackathon-shell.js';

// Queue & Cron (existing — will be updated in future stories)
import { queueHandler } from './queue/index.js';
import { cronHandler } from './cron/index.js';

const app = createApp()
  .route('/api/auth', authHandler)
  .route('/api/v1', health)
  .route('/api/v1', hackathonShell);

export type AppType = typeof app;

// Export Worker handlers
export default {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: cronHandler,
};

// Durable Object re-export (REQUIRED for wrangler)
export { HackathonStateMachine } from './durable-objects/hackathon-state-machine.js';
