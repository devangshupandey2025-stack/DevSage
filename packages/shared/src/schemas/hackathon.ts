import { z } from 'zod';

export const HackathonStatusEnum = z.enum([
  'draft',
  'active',
  'judging',
  'completed',
  'archived',
]);

export type HackathonStatus = z.infer<typeof HackathonStatusEnum>;

export const RegistrationModeEnum = z.enum(['open', 'domain_restricted', 'approval_based']);

export type RegistrationMode = z.infer<typeof RegistrationModeEnum>;

export const HackathonSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  slug: z.string(),
  title: z.string(),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  rulesMd: z.string().nullable().optional(),
  status: HackathonStatusEnum,
  startsAt: z.string().nullable().optional(),
  judgingStarts: z.string().nullable().optional(),
  judgingEnds: z.string().nullable().optional(),
  minTeamSize: z.number().int(),
  maxTeamSize: z.number().int(),
  maxTeams: z.number().int().nullable().optional(),
  submissionTagPattern: z.string(),
  allowResubmission: z.number().int(),
  allowRegistrationDuringActive: z.number().int(),
  notifyAllOnDeadline: z.number().int(),
  showJudgeCommentsToParticipants: z.number().int(),
  registrationMode: RegistrationModeEnum,
  allowedEmailDomains: z.string(),
  requireRepo: z.number().int(),
  timezone: z.string(),
  templateId: z.string().nullable().optional(),
  tracks: z.string(),
  prizes: z.string(),
  settings: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Hackathon = z.infer<typeof HackathonSchema>;

export const CreateHackathonRequestSchema = z.object({
  slug: z.string().min(3).max(60),
  title: z.string().min(3).max(100),
  tagline: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  rulesMd: z.string().optional(),
  startsAt: z.string().optional(),
  judgingStarts: z.string().optional(),
  judgingEnds: z.string().optional(),
  minTeamSize: z.number().int().min(1).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
  maxTeams: z.number().int().min(1).optional(),
  submissionTagPattern: z.string().optional(),
  allowResubmission: z.number().int().min(0).max(1).optional(),
  allowRegistrationDuringActive: z.number().int().min(0).max(1).optional(),
  registrationMode: RegistrationModeEnum.optional(),
  allowedEmailDomains: z.string().optional(),
  requireRepo: z.number().int().min(0).max(1).optional(),
  timezone: z.string().optional(),
  templateId: z.string().optional(),
  tracks: z.string().optional(),
  prizes: z.string().optional(),
  settings: z.string().optional(),
});

export type CreateHackathonRequest = z.infer<typeof CreateHackathonRequestSchema>;

export const UpdateHackathonRequestSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  rulesMd: z.string().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  judgingStarts: z.string().nullable().optional(),
  judgingEnds: z.string().nullable().optional(),
  minTeamSize: z.number().int().min(1).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
  maxTeams: z.number().int().min(1).nullable().optional(),
  submissionTagPattern: z.string().optional(),
  allowResubmission: z.number().int().min(0).max(1).optional(),
  allowRegistrationDuringActive: z.number().int().min(0).max(1).optional(),
  notifyAllOnDeadline: z.number().int().min(0).max(1).optional(),
  showJudgeCommentsToParticipants: z.number().int().min(0).max(1).optional(),
  registrationMode: RegistrationModeEnum.optional(),
  allowedEmailDomains: z.string().nullable().optional(),
  requireRepo: z.number().int().min(0).max(1).optional(),
  timezone: z.string().optional(),
  tracks: z.string().nullable().optional(),
  prizes: z.string().nullable().optional(),
  settings: z.string().nullable().optional(),
});

export type UpdateHackathonRequest = z.infer<typeof UpdateHackathonRequestSchema>;
