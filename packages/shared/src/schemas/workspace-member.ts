import { z } from 'zod';
import { workspaceRoleSchema } from './constants.js';

export const updateWorkspaceMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
});

export type UpdateWorkspaceMemberRole = z.infer<typeof updateWorkspaceMemberRoleSchema>;
