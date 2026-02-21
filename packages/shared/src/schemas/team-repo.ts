import { z } from 'zod';

export const linkRepoSchema = z.object({
  github_repo_url: z.string().url().regex(/^https:\/\/github\.com\/[^/]+\/[^/]+$/),
});

export type LinkRepo = z.infer<typeof linkRepoSchema>;
