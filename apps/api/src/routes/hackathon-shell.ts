import { createRoute, z } from '@hono/zod-openapi';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthAppEnv } from '../types/env.js';

const hackathonShellSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  rules: z.array(z.string()),
  submission_instructions: z.object({
    git_tag_workflow: z.string(),
    example_command: z.string(),
    docs_url: z.string(),
    manual_upload_available: z.boolean(),
  }),
  is_stub_data: z.boolean(),
});

const shellRoute = createRoute({
  method: 'get',
  path: '/hackathon-shell',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            ok: z.literal(true),
            data: hackathonShellSchema,
          }),
        },
      },
      description: 'Stubbed hackathon shell data',
    },
  },
});

const app = new OpenAPIHono<AuthAppEnv>();

app.openapi(shellRoute, (c) => {
  return c.json(
    {
      ok: true as const,
      data: {
        name: 'DevSage Launch Hackathon',
        tagline: 'Build something amazing in 48 hours',
        description:
          'Join developers from around the world in our inaugural hackathon. Create innovative solutions using any technology stack.',
        start_date: '2026-04-01T09:00:00Z',
        end_date: '2026-04-03T09:00:00Z',
        rules: [
          'Teams of 1-5 members',
          'All code must be written during the hackathon period',
          'Submissions must include a working demo or video',
          'Use of open-source libraries and APIs is encouraged',
          'Projects must be submitted via Git tags before the deadline',
        ],
        submission_instructions: {
          git_tag_workflow:
            'Tag your submission commit and push it to trigger automatic capture. Use the pattern r1_submission_v{n} where {n} is your version number.',
          example_command: 'git tag r1_submission_v1 && git push origin --tags',
          docs_url: '#',
          manual_upload_available: false,
        },
        is_stub_data: true,
      },
    },
    200,
  );
});

export default app;
