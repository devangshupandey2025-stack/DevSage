import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.json({ service: 'devsage-auth', ok: true }));

export default {
  fetch: app.fetch,
};
