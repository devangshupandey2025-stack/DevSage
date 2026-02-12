import { Hono } from 'hono';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse } from '../lib/response.js';

const submissions = new Hono<AuthAppEnv>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * GET /:slug/submissions — list all submissions for a hackathon
 * Requires: participant+ (via requireRole)
 */
submissions.get(
  '/:slug/submissions',
  authMiddleware,
  requireRole('participant'),
  async (c) => {
    const hackathon = c.get('hackathon');

    const doId = c.env.HACKATHON_SM.idFromName(hackathon.id);
    const stub = c.env.HACKATHON_SM.get(doId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await stub.fetch(`http://do/submissions/${hackathon.id}`, {
        signal: controller.signal,
      });
      const payload = await readJson(response);

      if (!response.ok) {
        const errPayload = isRecord(payload) ? payload : {};
        return errorResponse(
          c,
          response.status as 400,
          String(errPayload.code ?? 'SUBMISSIONS_FETCH_FAILED'),
          String(errPayload.error ?? 'Failed to fetch submissions'),
        );
      }

      return successResponse(c, payload);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return errorResponse(c, 504, 'TIMEOUT', 'Submission query timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },
);

/**
 * GET /:slug/submissions/:teamId — get submission detail for a team
 * Requires: participant+ (via requireRole)
 */
submissions.get(
  '/:slug/submissions/:teamId',
  authMiddleware,
  requireRole('participant'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const teamId = c.req.param('teamId');

    const doId = c.env.HACKATHON_SM.idFromName(hackathon.id);
    const stub = c.env.HACKATHON_SM.get(doId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await stub.fetch(`http://do/submission/${hackathon.id}/${teamId}`, {
        signal: controller.signal,
      });
      const payload = await readJson(response);

      if (!response.ok) {
        const errPayload = isRecord(payload) ? payload : {};
        return errorResponse(
          c,
          response.status as 400,
          String(errPayload.code ?? 'SUBMISSION_FETCH_FAILED'),
          String(errPayload.error ?? 'Failed to fetch submission'),
        );
      }

      return successResponse(c, payload);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return errorResponse(c, 504, 'TIMEOUT', 'Submission query timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },
);

export default submissions;
