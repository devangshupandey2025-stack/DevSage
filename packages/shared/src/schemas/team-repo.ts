import { z } from 'zod';

export const TeamRepoSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  hackathonId: z.string(),
  provider: z.string(),
  repoFullName: z.string(),
  repoUrl: z.string(),
  installationId: z.string().nullable().optional(),
  botActive: z.number().int(),
  isPrimary: z.number().int(),
  accessTokenEncrypted: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type TeamRepo = z.infer<typeof TeamRepoSchema>;

export const ConnectTeamRepoRequestSchema = z.object({
  repoFullName: z.string().regex(/^[^/]+\/[^/]+$/, 'Must be in format owner/repo'),
  provider: z.string().optional(),
});

export type ConnectTeamRepoRequest = z.infer<typeof ConnectTeamRepoRequestSchema>;
