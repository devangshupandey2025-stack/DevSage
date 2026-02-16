import { z } from 'zod';
import { assignmentStatusSchema } from './constants.js';

export const judgeAssignmentResponseSchema = z.object({
  id: z.string().uuid(),
  judge_id: z.string().uuid(),
  submission_id: z.string().uuid(),
  hackathon_id: z.string().uuid(),
  status: assignmentStatusSchema,
  created_at: z.string().datetime(),
});

export type JudgeAssignmentResponse = z.infer<typeof judgeAssignmentResponseSchema>;
