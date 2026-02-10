import { z } from 'zod';

export const JudgeAssignmentStatusEnum = z.enum(['pending', 'in_progress', 'completed']);

export type JudgeAssignmentStatus = z.infer<typeof JudgeAssignmentStatusEnum>;

export const JudgeAssignmentSchema = z.object({
  id: z.string(),
  judgeId: z.string(),
  teamId: z.string(),
  hackathonId: z.string(),
  submissionId: z.string().nullable().optional(),
  status: JudgeAssignmentStatusEnum,
  assignedAt: z.string(),
});

export type JudgeAssignment = z.infer<typeof JudgeAssignmentSchema>;
