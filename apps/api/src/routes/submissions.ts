import { Hono } from 'hono';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { successResponse, errorResponse } from '../lib/response.js';
import { isRecord } from '../lib/utils.js';
import { getStateMachineStub, fetchDO } from '../lib/do-client.js';
import { DO_PATHS } from '../lib/constants.js';

const submissions = new Hono<AuthAppEnv>();

submissions.get(
  '/:slug/submissions',
  authMiddleware,
  requireRole('team_member'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const stub = getStateMachineStub(c.env, hackathon.id);
    const result = await fetchDO(stub, DO_PATHS.submissions(hackathon.id));

    if (!result.ok) {
      const errPayload = isRecord(result.data) ? result.data : {};
      return errorResponse(
        c,
        result.status as 400,
        String(errPayload.code ?? 'SUBMISSIONS_FETCH_FAILED'),
        String(errPayload.error ?? 'Failed to fetch submissions'),
      );
    }

    return successResponse(c, result.data);
  },
);

submissions.get(
  '/:slug/submissions/:teamId',
  authMiddleware,
  requireRole('team_member'),
  async (c) => {
    const hackathon = c.get('hackathon');
    const teamId = c.req.param('teamId');
    const stub = getStateMachineStub(c.env, hackathon.id);
    const result = await fetchDO(stub, DO_PATHS.submission(hackathon.id, teamId));

    if (!result.ok) {
      const errPayload = isRecord(result.data) ? result.data : {};
      return errorResponse(
        c,
        result.status as 400,
        String(errPayload.code ?? 'SUBMISSION_FETCH_FAILED'),
        String(errPayload.error ?? 'Failed to fetch submission'),
      );
    }

    return successResponse(c, result.data);
  },
);

export default submissions;
