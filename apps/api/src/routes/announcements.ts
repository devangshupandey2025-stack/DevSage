import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { requireRole } from '../middleware/role.js';
import { validateBody } from '../lib/validate.js';
import { z } from 'zod';

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  pinned: z.boolean().optional(),
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  pinned: z.boolean().optional(),
});

const announcements = new Hono<AppEnv>();
announcements.use('/*', hackathonContext);

// List announcements (public)
announcements.get('/', async (c) => {
  const hackathon = c.get('hackathon')!;
  try {
    const rows = await c.env.DB.prepare(
      `SELECT a.*, u.name as author_name, u.avatar_url as author_avatar
       FROM announcements a
       LEFT JOIN users u ON a.author_id = u.id
       WHERE a.hackathon_id = ?
       ORDER BY a.pinned DESC, a.created_at DESC`
    ).bind(hackathon.id).all();
    return successResponse(c, rows.results || []);
  } catch (err) {
    console.error('[announcements] List error:', err);
    return successResponse(c, []);
  }
});

// Create announcement (organizer+)
announcements.post('/', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const user = c.get('user');
  
  const body = await validateBody(c, createAnnouncementSchema);
  if (body instanceof Response) return body;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO announcements (id, hackathon_id, author_id, title, content, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, hackathon.id, user?.id, body.title, body.content, body.pinned ? 1 : 0, now, now).run();

  const created = await c.env.DB.prepare(
    `SELECT a.*, u.name as author_name, u.avatar_url as author_avatar
     FROM announcements a
     LEFT JOIN users u ON a.author_id = u.id
     WHERE a.id = ?`
  ).bind(id).first();

  return successResponse(c, created, { status: 201 });
});

// Update announcement (organizer+)
announcements.patch('/:announcementId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const announcementId = c.req.param('announcementId');
  const body = await validateBody(c, updateAnnouncementSchema);
  if (body instanceof Response) return body;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) {
    updates.push('title = ?');
    values.push(body.title);
  }
  if (body.content !== undefined) {
    updates.push('content = ?');
    values.push(body.content);
  }
  if (body.pinned !== undefined) {
    updates.push('pinned = ?');
    values.push(body.pinned ? 1 : 0);
  }

  if (updates.length === 0) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'No fields to update');
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(announcementId);

  await c.env.DB.prepare(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await c.env.DB.prepare(
    `SELECT a.*, u.name as author_name, u.avatar_url as author_avatar
     FROM announcements a
     LEFT JOIN users u ON a.author_id = u.id
     WHERE a.id = ?`
  ).bind(announcementId).first();

  return successResponse(c, updated);
});

// Delete announcement (organizer+)
announcements.delete('/:announcementId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const announcementId = c.req.param('announcementId');
  await c.env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(announcementId).run();
  return successResponse(c, { deleted: true });
});

export default announcements;
