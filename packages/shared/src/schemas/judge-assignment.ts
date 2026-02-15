import { z } from 'zod';

export const JudgeAssignmentStatusEnum = z.enum(['pending', 'in_progress', 'completed']);

export type JudgeAssignmentStatus = z.infer<typeof JudgeAssignmentStatusEnum>;

export const JudgeAssignmentSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  judgeId: z.string(),
  teamId: z.string(),
  submissionId: z.string().nullable().optional(),
  round: z.number().int(),
  status: JudgeAssignmentStatusEnum,
  assignedAt: z.string(),
  completedAt: z.string().nullable().optional(),
});

export type JudgeAssignment = z.infer<typeof JudgeAssignmentSchema>;
