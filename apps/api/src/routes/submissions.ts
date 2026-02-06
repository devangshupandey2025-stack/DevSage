import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { createDbClient, teams } from '@devsage/db';
import type { AuthAppEnv } from '../types/auth.js';
import { authMiddleware } from '../middleware/auth.js';

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

function parseLinkRepoBody(value: unknown): { repoFullName: string } | null {
  if (!isRecord(value) || typeof value.repoFullName !== 'string' || value.repoFullName.length === 0) {
    return null;
  }

  return { repoFullName: value.repoFullName };
}

submissions.use('*', authMiddleware);

submissions.get('/:id/submissions', async (c) => {
  const hackathonId = c.req.param('id');

  const doId = c.env.SUBMISSION.idFromName(hackathonId);
  const stub = c.env.SUBMISSION.get(doId);
  const response = await stub.fetch(`http://do/submissions/${hackathonId}`);
  const payload = await readJson(response);

  if (!response.ok) {
    return c.json(
      isRecord(payload)
        ? payload
        : {
            error: 'Failed to fetch submissions',
            code: 'SUBMISSIONS_FETCH_FAILED',
          },
      response.status as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  return c.json(payload, 200);
});

submissions.get('/:id/submissions/:teamId', async (c) => {
  const hackathonId = c.req.param('id');
  const teamId = c.req.param('teamId');

  const doId = c.env.SUBMISSION.idFromName(hackathonId);
  const stub = c.env.SUBMISSION.get(doId);
  const response = await stub.fetch(`http://do/submission/${hackathonId}/${teamId}`);
  const payload = await readJson(response);

  if (!response.ok) {
    return c.json(
      isRecord(payload)
        ? payload
        : {
            error: 'Failed to fetch submission',
            code: 'SUBMISSION_FETCH_FAILED',
          },
      response.status as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  return c.json(payload, 200);
});

submissions.post(
  '/:hackathonId/teams/:teamId/repo',
  async (c) => {
    const hackathonId = c.req.param('hackathonId');
    const teamId = c.req.param('teamId');
    const user = c.get('user');
    let bodyRaw: unknown;
    try {
      bodyRaw = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400);
    }

    const body = parseLinkRepoBody(bodyRaw);
    if (!body) {
      return c.json({ error: 'Expected { repoFullName }', code: 'INVALID_BODY' }, 400);
    }
    const db = createDbClient(c.env.DB);

    const team = await db
      .select({
        id: teams.id,
        captainId: teams.captain_id,
      })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.hackathon_id, hackathonId)))
      .get();

    if (!team) {
      return c.json({ error: 'Team not found', code: 'NOT_FOUND' }, 404);
    }

    if (team.captainId !== user.sub) {
      return c.json({ error: 'Only team captain can link repository', code: 'FORBIDDEN' }, 403);
    }

    const doId = c.env.SUBMISSION.idFromName(hackathonId);
    const stub = c.env.SUBMISSION.get(doId);
    const linkResponse = await stub.fetch('http://do/link-repo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hackathonId,
        teamId,
        repoFullName: body.repoFullName,
      }),
    });

    const linkPayload = await readJson(linkResponse);
    if (!linkResponse.ok) {
      return c.json(
        isRecord(linkPayload)
          ? linkPayload
          : {
              error: 'Failed to link repository',
              code: 'REPO_LINK_FAILED',
            },
        linkResponse.status as 400 | 401 | 403 | 404 | 409 | 500
      );
    }

    await c.env.KV.put(
      `repo:${body.repoFullName}`,
      JSON.stringify({
        hackathonId,
        teamId,
      })
    );

    return c.json(
      {
        message: 'Repository linked',
        repoFullName: body.repoFullName,
      },
      200
    );
  }
);

export default submissions;
