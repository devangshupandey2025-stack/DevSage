import type { MiddlewareHandler } from 'hono';
import { createDbClient, hackathons } from '@devsage/db';
import { eq } from 'drizzle-orm';
import { errorResponse } from '../lib/response.js';
import type { AuthAppEnv } from '../types/auth.js';

export const hackathonMiddleware: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const slug = c.req.param('slug');
  if (!slug) {
    return errorResponse(c, 400, 'BAD_REQUEST', 'Missing hackathon slug');
  }

  const db = createDbClient(c.env.DB);
  try {
    const hackathon = await db
      .select()
      .from(hackathons)
      .where(eq(hackathons.slug, slug))
      .get();

    if (!hackathon) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Hackathon not found');
    }

    c.set('hackathon', hackathon);
    await next();
  } catch (err) {
    console.error('hackathonMiddleware error:', err instanceof Error ? err.message : String(err));
    return errorResponse(c, 500, 'DB_ERROR', 'Failed to load hackathon');
  }
};
