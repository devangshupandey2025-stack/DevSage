import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/env.js';

/**
 * Resolves hackathon from :slug param and sets hackathon context.
 */
export const hackathonContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const slug = c.req.param('slug');
  if (!slug) {
    return c.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Hackathon slug is required' } },
      400
    );
  }

  const hackathon = await c.env.DB.prepare(
    'SELECT id, workspace_id, slug, status FROM hackathons WHERE slug = ?'
  ).bind(slug).first<{
    id: string; workspace_id: string; slug: string; status: string;
  }>();

  if (!hackathon) {
    return c.json(
      { ok: false, error: { code: 'HACKATHON_NOT_FOUND', message: 'Hackathon not found' } },
      404
    );
  }

  c.set('hackathon', hackathon);
  return next();
};
