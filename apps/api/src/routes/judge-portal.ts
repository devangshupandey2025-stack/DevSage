import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Routes for the judge portal (judge.devsage.org).
 * Mounted at /api/v1/judge
 */
const judgePortal = new Hono<AppEnv>();

// All routes require authentication
judgePortal.use('/*', authMiddleware);

/**
 * GET /api/v1/judge/hackathons
 * Returns all hackathons where the current user is an accepted judge,
 * with assignment summary (pending, completed counts).
 */
judgePortal.get('/hackathons', async (c) => {
  const user = c.get('user');
  if (!user) return errorResponse(c, 401, 'UNAUTHORIZED', 'Not authenticated');

  const rows = await c.env.DB.prepare(`
    SELECT
      h.id,
      h.title,
      h.slug,
      h.status,
      h.tagline,
      h.start_date,
      h.end_date,
      h.judging_deadline,
      j.id AS judge_id,
      j.track_id,
      (
        SELECT COUNT(*)
        FROM judge_assignments ja
        WHERE ja.judge_id = j.id
      ) AS total_assignments,
      (
        SELECT COUNT(*)
        FROM judge_assignments ja
        WHERE ja.judge_id = j.id AND ja.status = 'completed'
      ) AS completed_assignments
    FROM judges j
    JOIN hackathons h ON h.id = j.hackathon_id
    WHERE j.user_id = ? AND j.invite_status = 'accepted'
    ORDER BY h.end_date DESC
  `)
    .bind(user.id)
    .all();

  const hackathons = (rows.results || []).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    tagline: row.tagline,
    start_date: row.start_date,
    end_date: row.end_date,
    judging_deadline: row.judging_deadline,
    judge_id: row.judge_id,
    track_id: row.track_id,
    total_assignments: row.total_assignments ?? 0,
    completed_assignments: row.completed_assignments ?? 0,
    pending_assignments: Number(row.total_assignments ?? 0) - Number(row.completed_assignments ?? 0),
  }));

  return successResponse(c, hackathons);
});

export default judgePortal;
