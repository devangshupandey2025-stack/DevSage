import { z } from 'zod';
import { assignmentStatusSchema } from './constants.js';

export const judgeAssignmentResponseSchema = z.object({
  id: z.string().uuid(),
  hackathon_id: z.string().uuid(),
  judge_id: z.string().uuid(),
  team_id: z.string().uuid(),
  submission_id: z.string().uuid().nullable(),
  round: z.number().int().default(1),
  status: assignmentStatusSchema,
  assigned_at: z.string(),
  completed_at: z.string().nullable().optional(),
});

export type JudgeAssignmentResponse = z.infer<typeof judgeAssignmentResponseSchema>;
