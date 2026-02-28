import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, cursorPaginatedResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { requireRole } from '../middleware/role.js';
import { safeParseInt, safeJsonParse } from '../lib/validate.js';

const audit = new Hono<AppEnv>();

// Query audit events for a hackathon (organizer+)
audit.get('/', hackathonContext, authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const limit = Math.min(Math.max(safeParseInt(c.req.query('limit'), 20), 1), 100);
  const cursor = c.req.query('cursor');
  const eventType = c.req.query('action');
  const entityType = c.req.query('entity_type');
  const entityId = c.req.query('entity_id');
  const actorId = c.req.query('actor_id');

  let query = 'SELECT * FROM audit_events WHERE hackathon_id = ?';
  const params: unknown[] = [hackathon.id];

  if (cursor) {
    const cursorVal = safeParseInt(cursor, 0);
    if (cursorVal > 0) { query += ' AND sequence > ?'; params.push(cursorVal); }
  }
  if (eventType) { query += ' AND action = ?'; params.push(eventType); }
  if (entityType) { query += ' AND entity_type = ?'; params.push(entityType); }
  if (entityId) { query += ' AND entity_id = ?'; params.push(entityId); }
  if (actorId) { query += ' AND actor_id = ?'; params.push(actorId); }

  query += ' ORDER BY sequence ASC LIMIT ?';
  params.push(limit + 1); // Fetch one extra for cursor

  const rows = await c.env.DB.prepare(query).bind(...params).all<{ sequence: number } & Record<string, unknown>>();
  const results = rows.results || [];

  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && data.length > 0 ? String(data[data.length - 1].sequence) : null;

  // Parse JSON fields safely (never crash on corrupt data)
  const parsed = data.map(row => ({
    ...row,
    details: safeJsonParse(row.details as string | null, null),
    changes: safeJsonParse(row.changes as string | null, null),
  }));

  return cursorPaginatedResponse(c, parsed, nextCursor);
});

export default audit;
