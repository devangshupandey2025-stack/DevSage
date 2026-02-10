import { z } from 'zod';

export const AiReviewSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  commitSha: z.string(),
  provider: z.string(),
  model: z.string(),
  promptHash: z.string(),
  summary: z.string().nullable().optional(),
  strengths: z.string().nullable().optional(),
  concerns: z.string().nullable().optional(),
  rawResponse: z.string().nullable().optional(),
  tokensUsed: z.number().int().nullable().optional(),
  createdAt: z.string(),
});

export type AiReview = z.infer<typeof AiReviewSchema>;
