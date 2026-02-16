import { z } from 'zod';

export const ScoreSchema = z.object({
  id: z.string(),
  submissionId: z.string(),
  judgeId: z.string(),
  criteriaId: z.string(),
  assignmentId: z.string(),
  score: z.number().int().min(0),
  comment: z.string().nullable().optional(),
  isSubmitted: z.number().int().default(0),
  round: z.number().int(),
  scoredAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Score = z.infer<typeof ScoreSchema>;

export const SubmitScoreRequestSchema = z.object({
  submissionId: z.string(),
  criteriaId: z.string(),
  score: z.number().int().min(0),
  comment: z.string().optional(),
});
