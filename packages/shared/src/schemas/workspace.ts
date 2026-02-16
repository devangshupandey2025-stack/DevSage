import { z } from 'zod';
import { workspaceTypeSchema, workspaceRoleSchema } from './constants.js';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  type: workspaceTypeSchema,
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial().omit({ slug: true, type: true });

export const inviteWorkspaceMemberSchema = z.object({
  email: z.string().email(),
  role: workspaceRoleSchema.exclude(['owner']),
});

export const workspaceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  type: workspaceTypeSchema,
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>;
export type InviteWorkspaceMember = z.infer<typeof inviteWorkspaceMemberSchema>;
export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;
