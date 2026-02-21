import { z } from 'zod';

export const createTeamInviteSchema = z.object({
  email: z.string().email(),
});

export const bulkTeamInviteSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
});

export type CreateTeamInvite = z.infer<typeof createTeamInviteSchema>;
export type BulkTeamInvite = z.infer<typeof bulkTeamInviteSchema>;
