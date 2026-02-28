import { Hono } from 'hono';
import type { AppEnv } from '../types/env.js';
import { successResponse, errorResponse, paginatedResponse } from '../lib/response.js';
import { insertAuditEvent } from '../lib/audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { hackathonContext } from '../middleware/hackathon.js';
import { requireRole } from '../middleware/role.js';
import { assignSubmissionsRoundRobin, computeLeaderboard } from '../services/judging-service.js';
import { hashPassword } from '../lib/password.js';
import { generateETag, checkConditionalRequest } from '../lib/etag.js';
import { KV_TTL } from '../lib/constants.js';
import { validateBody } from '../lib/validate.js';
import { createRubricCriterionSchema, updateRubricCriterionSchema } from '@devsage/shared';
import { z } from 'zod';

const judging = new Hono<AppEnv>();
judging.use('/*', hackathonContext);

// === Rubric CRUD (organizer+) ===

// Create rubric criterion
judging.post('/rubric', authMiddleware, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await validateBody(c, createRubricCriterionSchema.extend({ weight: z.number(), round: z.number().int().min(1).optional() }));
  if (body instanceof Response) return body;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO rubric_criteria (id, hackathon_id, name, description, max_score, weight, track_id, sort_order, round, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, hackathon.id, body.name, body.description ?? '', body.max_score ?? 10, body.weight, body.track_id ?? null, body.sort_order ?? 0, body.round ?? 1, now).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'rubric.criterion_added', entity_type: 'rubric_criteria', entity_id: id,
      details: { name: body.name },
    })
  );

  const created = await c.env.DB.prepare('SELECT * FROM rubric_criteria WHERE id = ?').bind(id).first();
  return successResponse(c, created, { status: 201 });
});

// List rubric criteria
judging.get('/rubric', async (c) => {
  const hackathon = c.get('hackathon')!;
  const criteria = await c.env.DB.prepare(
    'SELECT * FROM rubric_criteria WHERE hackathon_id = ? ORDER BY sort_order ASC'
  ).bind(hackathon.id).all();
  return successResponse(c, criteria.results || []);
});

// Update rubric criterion
judging.patch('/rubric/:criterionId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const criterionId = c.req.param('criterionId');
  const body = await validateBody(c, updateRubricCriterionSchema.extend({ weight: z.number().optional(), round: z.number().int().min(1).optional() }));
  if (body instanceof Response) return body;
  const bodyRecord = body as Record<string, unknown>;

  const allowedFields = ['name', 'description', 'max_score', 'weight', 'track_id', 'sort_order', 'round'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowedFields) {
    if (field in bodyRecord) { updates.push(`${field} = ?`); values.push(bodyRecord[field]); }
  }

  if (updates.length === 0) return errorResponse(c, 400, 'VALIDATION_ERROR', 'No fields to update');

  values.push(criterionId);
  await c.env.DB.prepare(`UPDATE rubric_criteria SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM rubric_criteria WHERE id = ?').bind(criterionId).first();
  return successResponse(c, updated);
});

// Delete rubric criterion
judging.delete('/rubric/:criterionId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const criterionId = c.req.param('criterionId');
  await c.env.DB.prepare('DELETE FROM rubric_criteria WHERE id = ?').bind(criterionId).run();
  return successResponse(c, { deleted: true });
});

// === Judge Management (organizer+) ===

function generateInviteToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

judging.post('/judges', authMiddleware, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await validateBody(c, z.object({
    email: z.string().email().optional(),
    user_id: z.string().min(1).optional(),
    track_id: z.string().min(1).nullable().optional(),
  }).refine(d => d.email || d.user_id, { message: 'email or user_id is required' }));
  if (body instanceof Response) return body;

  const email = body.email?.trim().toLowerCase();
  let targetUserId: string | null = body.user_id ?? null;

  // If email provided, look up the user (but don't require them to exist)
  if (email && !targetUserId) {
    const found = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (found) {
      targetUserId = found.id;
    }
  }

  // Auto-accept if the organizer is inviting themselves as judge
  const isSelfInvite = targetUserId === user.id;
  const initialStatus = isSelfInvite ? 'accepted' : 'pending';

  const id = crypto.randomUUID();
  const inviteToken = generateInviteToken();
  const now = new Date().toISOString();

  try {
    // user_id is NOT NULL in schema — use empty string placeholder for email-only invites
    await c.env.DB.prepare(
      `INSERT INTO judges (id, hackathon_id, user_id, email, invite_status, invite_token, track_id, invited_by, invited_at, responded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, hackathon.id, targetUserId ?? '', email ?? '', initialStatus, inviteToken, body.track_id ?? null, user.id, now, isSelfInvite ? now : null).run();
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      // Judge already exists — re-send the invite email and return the existing record
      const existing = await c.env.DB.prepare(
        'SELECT id, user_id, invite_token, invite_status FROM judges WHERE hackathon_id = ? AND (user_id = ? OR email = ?)'
      ).bind(hackathon.id, targetUserId ?? '', email ?? '').first<{ id: string; user_id: string | null; invite_token: string; invite_status: string }>();

      if (existing) {
        // Re-send invite notification so they get the email again
        c.executionCtx.waitUntil(
          c.env.NOTIFICATION_QUEUE.send({
            type: 'judge.invited',
            hackathon_id: hackathon.id,
            data: { judge_id: existing.id, user_id: existing.user_id, invite_token: existing.invite_token, email },
          })
        );
        return successResponse(c, {
          id: existing.id,
          user_id: existing.user_id,
          already_invited: true,
          invite_status: existing.invite_status,
          message: `Judge already invited (status: ${existing.invite_status}). Invite email re-sent.`,
        });
      }
      return errorResponse(c, 409, 'JUDGE_ALREADY_INVITED', 'Judge already invited');
    }
    throw err;
  }

  // Send invite notification via queue (skip for self-invites)
  if (!isSelfInvite) {
    c.executionCtx.waitUntil(
      c.env.NOTIFICATION_QUEUE.send({
        type: 'judge.invited',
        hackathon_id: hackathon.id,
        data: { judge_id: id, user_id: targetUserId, invite_token: inviteToken, email },
      })
    );
  }

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: isSelfInvite ? 'judge.self_invited' : 'judge.invited', entity_type: 'judge', entity_id: id,
      details: { user_id: targetUserId, email },
    })
  );

  return successResponse(c, { id, user_id: targetUserId, email, invite_token: inviteToken, invite_status: initialStatus, self_accepted: isSelfInvite }, { status: 201 });
});

// Bulk invite judges
judging.post('/judges/bulk', authMiddleware, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await validateBody(c, z.object({
    user_ids: z.array(z.string().min(1)).min(1),
  }));
  if (body instanceof Response) return body;

  const results: Array<{ user_id: string; status: string }> = [];
  const now = new Date().toISOString();

  // Chunk to stay under D1 param limit
  for (const userId of body.user_ids.slice(0, 50)) {
    const id = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
      `INSERT INTO judges (id, hackathon_id, user_id, invite_status, invited_by, invited_at) VALUES (?, ?, ?, 'pending', ?, ?)`
      ).bind(id, hackathon.id, userId, user.id, now).run();
      results.push({ user_id: userId, status: 'invited' });
    } catch {
      results.push({ user_id: userId, status: 'already_invited' });
    }
  }

  return successResponse(c, results, { status: 201 });
});

// List judges (public - for overview metrics)
judging.get('/judges', async (c) => {
  const hackathon = c.get('hackathon')!;
  const judges = await c.env.DB.prepare(`
    SELECT j.id, j.invite_status as status, j.user_id, j.track_id, j.invited_at, j.responded_at,
           u.name as display_name, u.email, u.avatar_url as image
    FROM judges j
    LEFT JOIN users u ON j.user_id = u.id
    WHERE j.hackathon_id = ?
    ORDER BY j.invited_at ASC
  `).bind(hackathon.id).all();
  return successResponse(c, judges.results || []);
});

// Remove judge
judging.delete('/judges/:judgeId', authMiddleware, requireRole('co_organizer'), async (c) => {
  const judgeId = c.req.param('judgeId');
  await c.env.DB.prepare('DELETE FROM judges WHERE id = ?').bind(judgeId).run();
  return successResponse(c, { deleted: true });
});

// Create judge account with temporary credentials
judging.post('/judges/create-account', authMiddleware, requireRole('co_organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await validateBody(c, z.object({
    email: z.string().email(),
    name: z.string().min(1).max(200),
    temp_password: z.string().min(8).max(128),
    track_id: z.string().min(1).nullable().optional(),
  }));
  if (body instanceof Response) return body;

  const email = body.email.trim().toLowerCase();
  const now = new Date().toISOString();

  // Check if user already exists
  let existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first<{ id: string }>();

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create new user with temp password + forced reset
    userId = crypto.randomUUID();
    const passwordHash = await hashPassword(body.temp_password);
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, password_hash, password_must_change, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 1, ?, ?)`
    ).bind(userId, email, body.name, passwordHash, now, now).run();
  }

  // Create judge record (auto-accepted since organizer is creating the account)
  const judgeId = crypto.randomUUID();
  const inviteToken = generateInviteToken();
  try {
    await c.env.DB.prepare(
      `INSERT INTO judges (id, hackathon_id, user_id, email, invite_status, invite_token, track_id, invited_by, invited_at, responded_at)
       VALUES (?, ?, ?, ?, 'accepted', ?, ?, ?, ?, ?)`
    ).bind(judgeId, hackathon.id, userId, email, inviteToken, body.track_id ?? null, user.id, now, now).run();
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return errorResponse(c, 409, 'JUDGE_ALREADY_EXISTS', 'Judge already exists for this hackathon');
    }
    throw err;
  }

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'judge.account_created', entity_type: 'judge', entity_id: judgeId,
      details: { user_id: userId, email, with_credentials: true },
    })
  );

  return successResponse(c, {
    judge_id: judgeId,
    user_id: userId,
    email,
    name: body.name,
    password_must_change: !existingUser,
    invite_status: 'accepted',
  }, { status: 201 });
});

// Assign judge to a track
judging.post('/judges/:judgeId/tracks', authMiddleware, requireRole('co_organizer'), async (c) => {
  const judgeId = c.req.param('judgeId');
  const body = await validateBody(c, z.object({
    track_id: z.string().min(1).nullable(),
  }));
  if (body instanceof Response) return body;

  await c.env.DB.prepare('UPDATE judges SET track_id = ? WHERE id = ?').bind(body.track_id ?? null, judgeId).run();

  return successResponse(c, { updated: true });
});

// Organizer-accept a judge invite (for testing/manual approval workflows)
judging.post('/judges/:judgeId/accept', authMiddleware, requireRole('co_organizer'), async (c) => {
  const judgeId = c.req.param('judgeId');
  const now = new Date().toISOString();
  const judge = await c.env.DB.prepare(
    'SELECT id, invite_status FROM judges WHERE id = ?'
  ).bind(judgeId).first<{ id: string; invite_status: string }>();

  if (!judge) return errorResponse(c, 404, 'NOT_FOUND', 'Judge not found');
  if (judge.invite_status === 'accepted') return successResponse(c, { already_accepted: true });

  await c.env.DB.prepare(
    'UPDATE judges SET invite_status = ?, responded_at = ? WHERE id = ?'
  ).bind('accepted', now, judgeId).run();

  return successResponse(c, { accepted: true });
});

// === Assignments (organizer+) ===

// Auto-assign submissions to judges (round-robin)
judging.post('/assign', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ round_id?: string }>().catch((): { round_id?: string } => ({}));

  const result = await assignSubmissionsRoundRobin(c.env.DB, hackathon.id, body.round_id);
  return successResponse(c, result);
});

// Get assignments for a judge
judging.get('/judges/:judgeId/assignments', authMiddleware, async (c) => {
  const judgeId = c.req.param('judgeId');
  const assignments = await c.env.DB.prepare(`
    SELECT ja.id, ja.submission_id, ja.team_id, ja.round, ja.status, ja.assigned_at, ja.completed_at,
           s.tag_name, s.commit_sha, t.name as team_name
    FROM judge_assignments ja
    LEFT JOIN submissions s ON ja.submission_id = s.id
    JOIN teams t ON ja.team_id = t.id
    WHERE ja.judge_id = ?
    ORDER BY ja.assigned_at ASC
  `).bind(judgeId).all();
  return successResponse(c, assignments.results || []);
});

// Get MY assignments (for current user as judge)
judging.get('/my-assignments', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;

  // Find judge record for current user
  const judge = await c.env.DB.prepare(
    'SELECT id FROM judges WHERE hackathon_id = ? AND user_id = ? AND invite_status = ?'
  ).bind(hackathon.id, user.id, 'accepted').first<{ id: string }>();

  if (!judge) return successResponse(c, []);

  const assignments = await c.env.DB.prepare(`
    SELECT ja.id, ja.submission_id, ja.team_id, ja.round, ja.status, ja.assigned_at, ja.completed_at,
           s.tag_name, s.commit_sha, t.name as team_name
    FROM judge_assignments ja
    LEFT JOIN submissions s ON ja.submission_id = s.id
    JOIN teams t ON ja.team_id = t.id
    WHERE ja.judge_id = ?
    ORDER BY ja.assigned_at ASC
  `).bind(judge.id).all();

  return successResponse(c, assignments.results || []);
});

// Get MY scores summary (all scores I've submitted)
judging.get('/my-scores', authMiddleware, async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;

  const judge = await c.env.DB.prepare(
    'SELECT id FROM judges WHERE hackathon_id = ? AND user_id = ? AND invite_status = ?'
  ).bind(hackathon.id, user.id, 'accepted').first<{ id: string }>();

  if (!judge) return successResponse(c, []);

  const scores = await c.env.DB.prepare(`
    SELECT s.submission_id, s.criteria_id, s.score, s.comment, s.round, s.scored_at,
           rc.name as criterion_name, rc.max_score, rc.weight,
           sub.title as submission_title, t.name as team_name
    FROM scores s
    JOIN rubric_criteria rc ON s.criteria_id = rc.id
    LEFT JOIN submissions sub ON s.submission_id = sub.id
    LEFT JOIN teams t ON sub.team_id = t.id
    WHERE s.judge_id = ?
    ORDER BY s.scored_at DESC
    LIMIT 200
  `).bind(judge.id).all();

  return successResponse(c, scores.results || []);
});

// === Scoring (judges only) ===

// Submit scores for a submission
judging.post('/submissions/:submissionId/scores', authMiddleware, requireRole('judge'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const submissionId = c.req.param('submissionId');
  const body = await validateBody(c, z.object({
    scores: z.array(z.object({
      criteria_id: z.string().min(1),
      score: z.number().min(0),
      comment: z.string().max(1000).optional(),
      assignment_id: z.string().min(1),
      round: z.number().int().min(1).optional(),
    })).min(1),
  }));
  if (body instanceof Response) return body;

  // Get judge record
  const judge = await c.env.DB.prepare(
    'SELECT id FROM judges WHERE hackathon_id = ? AND user_id = ? AND invite_status = ?'
  ).bind(hackathon.id, user.id, 'accepted').first<{ id: string }>();

  if (!judge) return errorResponse(c, 403, 'FORBIDDEN', 'Not an accepted judge');

  // Verify assignment exists
  const assignment = await c.env.DB.prepare(
    'SELECT id FROM judge_assignments WHERE judge_id = ? AND submission_id = ?'
  ).bind(judge.id, submissionId).first<{ id: string }>();

  if (!assignment) return errorResponse(c, 403, 'NOT_ASSIGNED', 'Not assigned to this submission');

  const now = new Date().toISOString();

  // Upsert scores
  for (const s of body.scores) {
    const round = s.round ?? 1;
    const assignmentId = s.assignment_id;
    await c.env.DB.prepare(`
      INSERT INTO scores (id, submission_id, judge_id, criteria_id, assignment_id, score, comment, round, scored_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(submission_id, judge_id, criteria_id, round) DO UPDATE SET score = ?, comment = ?, scored_at = ?
    `).bind(
      crypto.randomUUID(), submissionId, judge.id, s.criteria_id, assignmentId, s.score, s.comment ?? null, round, now,
      s.score, s.comment ?? null, now
    ).run();
  }

  // Update assignment status
  await c.env.DB.prepare(
    'UPDATE judge_assignments SET status = ?, completed_at = ? WHERE id = ?'
  ).bind('scored', now, assignment.id).run();

  // Invalidate leaderboard cache
  await c.env.KV.delete(`leaderboard:${hackathon.id}`);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'score.submitted', entity_type: 'submission', entity_id: submissionId,
      details: { judge_id: judge.id, scores_count: body.scores.length },
    })
  );

  return successResponse(c, { scored: true });
});

// Get scores for a submission
judging.get('/submissions/:submissionId/scores', authMiddleware, requireRole('judge'), async (c) => {
  const submissionId = c.req.param('submissionId');
  const scores = await c.env.DB.prepare(`
    SELECT s.id, s.criteria_id, s.judge_id, s.assignment_id, s.score, s.comment, s.round, s.scored_at,
           rc.name as criterion_name, rc.max_score, rc.weight
    FROM scores s
    JOIN rubric_criteria rc ON s.criteria_id = rc.id
    WHERE s.submission_id = ?
    ORDER BY rc.sort_order ASC
  `).bind(submissionId).all();
  return successResponse(c, scores.results || []);
});

// === Leaderboard ===

judging.get('/leaderboard', async (c) => {
  const hackathon = c.get('hackathon')!;
  const roundId = c.req.query('round_id');
  const trackId = c.req.query('track_id');

  // Check KV cache
  const cacheKey = `leaderboard:${hackathon.id}:${roundId ?? 'all'}:${trackId ?? 'all'}`;
  const cached = await c.env.KV.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    const etag = await generateETag(data);
    if (checkConditionalRequest(c.req.header('If-None-Match'), etag)) {
      return c.body(null, 304);
    }
    c.header('ETag', etag);
    c.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    return successResponse(c, data);
  }

  const leaderboard = await computeLeaderboard(c.env.DB, hackathon.id, roundId, trackId);

  // Cache with appropriate TTL
  const ttl = hackathon.status === 'judging' ? KV_TTL.LEADERBOARD_JUDGING : KV_TTL.LEADERBOARD_COMPLETED;
  c.executionCtx.waitUntil(
    c.env.KV.put(cacheKey, JSON.stringify(leaderboard), { expirationTtl: ttl })
  );

  const etag = await generateETag(leaderboard);
  c.header('ETag', etag);
  c.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
  return successResponse(c, leaderboard);
});

// === Conflict of Interest (COI) ===

// Judge declares a conflict of interest for an assignment
judging.post('/assignments/:assignmentId/coi', authMiddleware, requireRole('judge'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const assignmentId = c.req.param('assignmentId');
  const body = await validateBody(c, z.object({
    reason: z.string().trim().min(1),
  }));
  if (body instanceof Response) return body;

  const judge = await c.env.DB.prepare(
    'SELECT id FROM judges WHERE hackathon_id = ? AND user_id = ? AND invite_status = ?'
  ).bind(hackathon.id, user.id, 'accepted').first<{ id: string }>();

  if (!judge) return errorResponse(c, 403, 'FORBIDDEN', 'Not an accepted judge');

  const assignment = await c.env.DB.prepare(
    'SELECT id, team_id, status FROM judge_assignments WHERE id = ? AND judge_id = ?'
  ).bind(assignmentId, judge.id).first<{ id: string; team_id: string; status: string }>();

  if (!assignment) return errorResponse(c, 404, 'NOT_FOUND', 'Assignment not found');
  if (assignment.status === 'scored') {
    return errorResponse(c, 409, 'ALREADY_SCORED', 'Cannot declare COI after scoring');
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "UPDATE judge_assignments SET status = 'conflict', completed_at = ? WHERE id = ?"
  ).bind(now, assignmentId).run();

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'judge.coi_declared', entity_type: 'judge_assignment', entity_id: assignmentId,
      details: { reason: body.reason, team_id: assignment.team_id },
    })
  );

  return successResponse(c, { conflict_declared: true, assignment_id: assignmentId });
});

// Event Lead: List all COI declarations for reassignment
judging.get('/coi', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;

  const conflicts = await c.env.DB.prepare(`
    SELECT ja.id as assignment_id, ja.team_id, ja.judge_id, ja.round, ja.completed_at as declared_at,
           t.name as team_name, u.name as judge_name, u.email as judge_email
    FROM judge_assignments ja
    JOIN teams t ON ja.team_id = t.id
    JOIN judges j ON ja.judge_id = j.id
    LEFT JOIN users u ON j.user_id = u.id
    WHERE ja.hackathon_id = ? AND ja.status = 'conflict'
    ORDER BY ja.completed_at DESC
  `).bind(hackathon.id).all();

  return successResponse(c, conflicts.results || []);
});

// Event Lead: Reassign a conflicted assignment to another judge
judging.post('/assignments/:assignmentId/reassign', authMiddleware, requireRole('co_organizer'), async (c) => {
  const hackathon = c.get('hackathon')!;
  const user = c.get('user')!;
  const assignmentId = c.req.param('assignmentId');
  const body = await validateBody(c, z.object({
    new_judge_id: z.string().min(1),
  }));
  if (body instanceof Response) return body;

  const assignment = await c.env.DB.prepare(
    "SELECT id, team_id, submission_id, round FROM judge_assignments WHERE id = ? AND hackathon_id = ? AND status = 'conflict'"
  ).bind(assignmentId, hackathon.id).first<{ id: string; team_id: string; submission_id: string | null; round: number }>();

  if (!assignment) return errorResponse(c, 404, 'NOT_FOUND', 'Conflicted assignment not found');

  const newJudge = await c.env.DB.prepare(
    "SELECT id FROM judges WHERE id = ? AND hackathon_id = ? AND invite_status = 'accepted'"
  ).bind(body.new_judge_id, hackathon.id).first<{ id: string }>();

  if (!newJudge) return errorResponse(c, 404, 'NOT_FOUND', 'New judge not found or not accepted');

  const now = new Date().toISOString();
  const newAssignmentId = crypto.randomUUID();

  await c.env.DB.batch([
    // Mark old assignment as reassigned
    c.env.DB.prepare(
      "UPDATE judge_assignments SET status = 'reassigned' WHERE id = ?"
    ).bind(assignmentId),
    // Create new assignment for the new judge
    c.env.DB.prepare(
      `INSERT INTO judge_assignments (id, hackathon_id, judge_id, team_id, submission_id, round, status, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(newAssignmentId, hackathon.id, body.new_judge_id, assignment.team_id, assignment.submission_id, assignment.round, now),
  ]);

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'judge.assignment_reassigned', entity_type: 'judge_assignment', entity_id: newAssignmentId,
      details: { old_assignment_id: assignmentId, new_judge_id: body.new_judge_id, team_id: assignment.team_id },
    })
  );

  return successResponse(c, { reassigned: true, new_assignment_id: newAssignmentId });
});

// === Results Publication (organizer) ===

judging.post('/results/publish', authMiddleware, requireRole('organizer'), async (c) => {
  const user = c.get('user')!;
  const hackathon = c.get('hackathon')!;
  const body = await c.req.json<{ round_id?: string }>().catch((): { round_id?: string } => ({}));

  if (hackathon.status !== 'judging' && hackathon.status !== 'completed') {
    return errorResponse(c, 409, 'INVALID_STATE', 'Cannot publish results in current state');
  }

  const leaderboard = await computeLeaderboard(c.env.DB, hackathon.id, body.round_id);

  // Resolve round ID
  const now = new Date().toISOString();
  let targetRoundId = body.round_id ?? null;
  if (!targetRoundId) {
    const defaultRound = await c.env.DB.prepare(
      'SELECT id FROM hackathon_rounds WHERE hackathon_id = ? ORDER BY round_number ASC LIMIT 1'
    ).bind(hackathon.id).first<{ id: string }>();
    if (defaultRound) targetRoundId = defaultRound.id;
  }

  if (!targetRoundId) {
    return errorResponse(c, 400, 'NO_ROUNDS', 'No rounds found for this hackathon');
  }

  // Batch upsert results (D1 batch limit: 100 bound params, so chunk)
  const statements = leaderboard.map((entry) =>
    c.env.DB.prepare(`
      INSERT INTO round_results (id, hackathon_id, round_id, team_id, status, rank, total_score, decided_by, created_at)
      VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?)
      ON CONFLICT(round_id, team_id) DO UPDATE SET rank = ?, total_score = ?, status = 'published', decided_by = ?
    `).bind(
      crypto.randomUUID(), hackathon.id, targetRoundId, entry.team_id,
      entry.rank, entry.total_score, user.id, now,
      entry.rank, entry.total_score, user.id
    )
  );

  // Execute in chunks of 20 (staying under D1 bound parameter limit)
  for (let i = 0; i < statements.length; i += 20) {
    await c.env.DB.batch(statements.slice(i, i + 20));
  }

  // Notify
  c.executionCtx.waitUntil(
    c.env.NOTIFICATION_QUEUE.send({
      type: 'results.published',
      hackathon_id: hackathon.id,
      data: { round_id: body.round_id, results_count: leaderboard.length },
    })
  );

  c.executionCtx.waitUntil(
    insertAuditEvent(c.env.DB, {
      hackathon_id: hackathon.id, actor_id: user.id, actor_type: 'user',
      action: 'results.published', entity_type: 'hackathon', entity_id: hackathon.id,
      details: { results_count: leaderboard.length },
    })
  );

  return successResponse(c, { published: true, results: leaderboard });
});

export default judging;
