import { z } from 'zod';

export const commitLogResponseSchema = z.object({
  id: z.string().uuid(),
  commit_sha: z.string(),
  commit_message: z.string(),
  author_login: z.string().nullable(),
  committed_at: z.string().datetime(),
});

export type CommitLogResponse = z.infer<typeof commitLogResponseSchema>;
