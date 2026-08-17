import { z } from 'zod';

export const hackathonStatusSchema = z.enum(['draft', 'active', 'judging', 'completed', 'archived']);
export type HackathonStatus = z.infer<typeof hackathonStatusSchema>;

export const organizerRoleSchema = z.enum(['organizer', 'co_organizer']);
export type OrganizerRole = z.infer<typeof organizerRoleSchema>;

export const hackathonRoleSchema = z.enum(['organizer', 'co_organizer', 'judge', 'team_lead', 'team_member', 'anonymous']);
export type HackathonRole = z.infer<typeof hackathonRoleSchema>;

export const teamStatusSchema = z.enum(['forming', 'ready', 'submitted', 'dissolved']);
export type TeamStatus = z.infer<typeof teamStatusSchema>;

export const submissionStatusSchema = z.enum(['pending_validation', 'validated', 'failed_validation', 'tag_deleted']);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const judgeInviteStatusSchema = z.enum(['pending', 'accepted', 'declined']);
export type JudgeInviteStatus = z.infer<typeof judgeInviteStatusSchema>;

export const teamMemberRoleSchema = z.enum(['leader', 'member']);
export type TeamMemberRole = z.infer<typeof teamMemberRoleSchema>;

export const workspaceRoleSchema = z.enum(['owner', 'admin', 'member']);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceTypeSchema = z.enum(['club', 'individual']);
export type WorkspaceType = z.infer<typeof workspaceTypeSchema>;

export const auditActorTypeSchema = z.enum(['user', 'system', 'bot', 'cron']);
export type AuditActorType = z.infer<typeof auditActorTypeSchema>;

export const sponsorTierSchema = z.enum(['platinum', 'gold', 'silver', 'bronze']);
export type SponsorTier = z.infer<typeof sponsorTierSchema>;

export const webhookDeliveryStatusSchema = z.enum(['queued', 'processed', 'failed', 'ignored']);
export const notificationChannelSchema = z.enum(['email', 'in_app']);
export const notificationDeliveryStatusSchema = z.enum(['sent', 'failed', 'bounced']);
export const teamInviteStatusSchema = z.enum(['pending', 'accepted', 'declined', 'expired']);
export const workspaceInviteStatusSchema = z.enum(['pending', 'accepted', 'expired']);
export const deletionRequestStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled']);
export const assignmentStatusSchema = z.enum(['pending', 'scored', 'skipped']);
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;
