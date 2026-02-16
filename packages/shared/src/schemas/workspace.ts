import { z } from 'zod';

export const WorkspaceTypeEnum = z.enum(['club', 'individual']);

export type WorkspaceType = z.infer<typeof WorkspaceTypeEnum>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: WorkspaceTypeEnum,
  description: z.string(),
  logoUrl: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  settings: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceRequestSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(3).max(60),
  type: WorkspaceTypeEnum.optional().default('individual'),
  description: z.string().max(500).optional(),
  website: z.string().url().optional(),
});

export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;
