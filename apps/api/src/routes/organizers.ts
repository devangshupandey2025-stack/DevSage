import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { requireRole } from '../middleware/role.js';
import { insertAuditEvent } from '../lib/audit.js';
import { validateBody } from '../lib/validate.js';
import { addOrganizerSchema } from '@devsage/shared';

const organizers = new Hono<AppEnv>();
organizers.use('/*', hackathonContext);

// List organizers
organizers.get('/', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const orgs = await c.env.DB.prepare(`
    SELECT o.id, o.user_id, o.role, o.created_at, u.name, u.email, u.avatar_url as image
    FROM organizer_roles o JOIN users u ON o.user_id = u.id
    WHERE o.hackathon_id = ?
    ORDER BY o.created_at ASC
  `).bind(hackathon.id).all();
  return successResponse(c, orgs.results || []);
});

// Add organizer/co-organizer
organizers.post('/', authMiddleware, requireRole('organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await validateBody(c, addOrganizerSchema);
  if (body instanceof Response) return body;

  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO organizer_roles (id, hackathon_id, user_id, role, invited_by) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, hackathon.id, body.user_id, body.role, user.id).run();
  } catch {
    return errorResponse(c, 409, 'ALREADY_ORGANIZER', 'User already has an organizer role');
  }

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'organizer.added', entity_type: 'organizer_role', entity_id: id,
      details: { target_user_id: body.user_id, role: body.role },
    })
  );

  return successResponse(c, { id, role: body.role }, { status: 201 });
});

// Remove organizer
organizers.delete('/:roleId', authMiddleware, requireRole('organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const roleId = c.req.param('roleId');

  const role = await c.env.DB.prepare(
    'SELECT user_id FROM organizer_roles WHERE id = ? AND hackathon_id = ?'
  ).bind(roleId, hackathon.id).first<{ user_id: string }>();

  if (!role) return errorResponse(c, 404, 'NOT_FOUND', 'Role not found');
  if (role.user_id === user.id) return errorResponse(c, 409, 'CANNOT_REMOVE_SELF', 'Cannot remove yourself');

  await c.env.DB.prepare('DELETE FROM organizer_roles WHERE id = ? AND hackathon_id = ?').bind(roleId, hackathon.id).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'organizer.removed', entity_type: 'organizer_role', entity_id: roleId,
    })
  );

  return successResponse(c, { removed: true });
});

export default organizers;
