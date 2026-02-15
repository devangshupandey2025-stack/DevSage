import { z } from 'zod';

export const WorkspaceRoleEnum = z.enum(['workspace_owner', 'workspace_admin', 'workspace_member']);

export type WorkspaceRole = z.infer<typeof WorkspaceRoleEnum>;

export const WorkspaceMemberSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  role: WorkspaceRoleEnum,
  invitedBy: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
