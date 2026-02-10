import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  name: z.string(),
  repoFullName: z.string().nullable().optional(),
  repoUrl: z.string().nullable().optional(),
  githubInstallationId: z.number().int().nullable().optional(),
  botActive: z.number().int(),
  inviteCode: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type Team = z.infer<typeof TeamSchema>;
