import { z } from 'zod';
import { submissionStatusSchema } from './constants.js';

export const submissionResponseSchema = z.object({
  id: z.string().uuid(),
  hackathon_id: z.string().uuid(),
  team_id: z.string().uuid(),
  round_id: z.string().uuid().nullable(),
  tag_name: z.string(),
  commit_sha: z.string(),
  submitted_at: z.string().datetime(),
  status: submissionStatusSchema,
  validated_at: z.string().datetime().nullable(),
  is_current: z.boolean(),
  created_at: z.string().datetime(),
});

export type SubmissionResponse = z.infer<typeof submissionResponseSchema>;
