import { z } from 'zod';

export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  hackathonId: z.string().uuid(),
  teamId: z.string().uuid(),
  repoFullName: z.string().min(1),
  commitSha: z.string().regex(/^[0-9a-f]{40}$/i),
  submittedAt: z.string().datetime(),
  status: z.enum(['pending', 'accepted', 'locked']),
});

export type Submission = z.infer<typeof SubmissionSchema>;
