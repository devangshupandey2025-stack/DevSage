/**
 * Extracted logic for the notification queue handler.
 *
 * This file contains recipient resolution and email template rendering.
 * The orchestration (idempotency, send loop, audit logging) stays in
 * `notification-handler.ts`.
 */

import { createDbClient, teamMembers, organizerRoles, judges, teams, hackathons, users } from '@devsage/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { DbClient } from '@devsage/db';
import type { Env } from '../types/env.js';
import type { NotificationMessage } from './notification-handler.js';

// ─── Shared Types ────────────────────────────────────────────

export interface Recipient {
  email: string;
  name: string;
}

interface EmailTemplate {
  subject: string;
  body: string;
}

// ─── Recipient Helpers ───────────────────────────────────────

/** Filter out rows without an email and map to Recipient. */
function toRecipients(
  rows: Array<{ email: string | null; name: string }>,
): Recipient[] {
  return rows
    .filter((r): r is { email: string; name: string } => !!r.email && r.email.length > 0)
    .map((r) => ({ email: r.email, name: r.name }));
}

/** Fetch all members of a team (optionally restricted to leaders). */
async function fetchTeamMembers(
  db: DbClient,
  teamId: string,
  roleFilter?: 'leader',
): Promise<Recipient[]> {
  const baseQuery = db
    .select({ email: users.email, name: users.display_name })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.user_id, users.id));

  const rows = roleFilter
    ? await baseQuery.where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, roleFilter)))
    : await baseQuery.where(eq(teamMembers.team_id, teamId));

  return toRecipients(rows);
}

/** Fetch the display name of a team (falls back to a default). */
async function fetchTeamName(
  db: DbClient,
  teamId: string,
  fallback = 'Your team',
): Promise<string> {
  const row = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, teamId))
    .get();

  return row?.name ?? fallback;
}

/** Fetch hackathon title + slug for email rendering. */
async function fetchHackathonMeta(
  db: DbClient,
  hackathonId: string,
): Promise<{ title: string; slug: string }> {
  const row = await db
    .select({ slug: hackathons.slug, title: hackathons.title })
    .from(hackathons)
    .where(eq(hackathons.id, hackathonId))
    .get();

  return { title: row?.title ?? 'Hackathon', slug: row?.slug ?? '' };
}

// ─── Recipient Resolution ────────────────────────────────────

/**
 * Resolve email recipients based on notification type.
 *
 * Resolution rules:
 * - submission_received / scores_finalized: All team members
 * - submission_invalid: Team leader only
 * - force_push_alert: All moderator+ organizers
 * - phase_transition: All hackathon participants
 * - judge_invited / judge_assignment: Single judge
 * - deadline_reminder: Team leaders without a final submission
 *
 * Recipients without email addresses are filtered out.
 */
export async function resolveRecipients(
  message: NotificationMessage,
  env: Env,
): Promise<Recipient[]> {
  const db = createDbClient(env.DB);

  switch (message.type) {
    case 'submission_received':
    case 'scores_finalized':
      return fetchTeamMembers(db, message.teamId);

    case 'submission_invalid':
      return fetchTeamMembers(db, message.teamId, 'leader');

    case 'force_push_alert': {
      const organizers = await db
        .select({ email: users.email, name: users.display_name })
        .from(organizerRoles)
        .innerJoin(users, eq(organizerRoles.user_id, users.id))
        .where(
          and(
            eq(organizerRoles.hackathon_id, message.hackathonId),
            inArray(organizerRoles.role, ['owner', 'admin', 'moderator']),
          ),
        );
      return toRecipients(organizers);
    }

    case 'phase_transition': {
      const participants = await db
        .select({ email: users.email, name: users.display_name })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.team_id, teams.id))
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(eq(teams.hackathon_id, message.hackathonId));
      return toRecipients(participants);
    }

    case 'judge_invited':
    case 'judge_assignment': {
      const judgeRecords = await db
        .select({ email: users.email, name: users.display_name })
        .from(judges)
        .innerJoin(users, eq(judges.user_id, users.id))
        .where(eq(judges.id, message.judgeId));
      return toRecipients(judgeRecords);
    }

    case 'deadline_reminder': {
      const leadersWithoutFinal = await env.DB.prepare(`
        SELECT DISTINCT u.email, u.display_name AS name
        FROM team_members tm
        INNER JOIN teams t ON tm.team_id = t.id
        INNER JOIN users u ON tm.user_id = u.id
        WHERE t.hackathon_id = ?
          AND tm.role = 'leader'
          AND NOT EXISTS (
            SELECT 1 FROM submissions s
            WHERE s.team_id = tm.team_id
              AND s.is_final = 1
          )
      `).bind(message.hackathonId).all<{ email: string | null; name: string }>();

      return toRecipients(leadersWithoutFinal.results || []);
    }

    case 'organizer_invited':
      return [{ email: message.email, name: message.email }];

    default:
      return [];
  }
}

// ─── Email Templates ─────────────────────────────────────────

/**
 * Render a plain-text email template for a notification.
 *
 * All emails follow the pattern:
 * - Subject: `[DevSage] {Event Title}`
 * - Body: Plain text with hackathon name, event description, relevant links
 */
export async function renderEmailTemplate(
  message: NotificationMessage,
  env: Env,
): Promise<EmailTemplate> {
  if (message.type === 'organizer_invited') {
    const acceptUrl = `${env.PLATFORM_URL}/invite/${message.inviteCode}`;
    return {
      subject: `[DevSage] Organizer Invitation`,
      body: `Hi,

You've been invited to become an organizer on DevSage.

Accept your invitation and set up your account: ${acceptUrl}

This invite expires in 14 days. If you didn't expect this email, you can safely ignore it.`,
    };
  }

  const db = createDbClient(env.DB);
  const hackathonId = (message as { hackathonId: string }).hackathonId;
  const { title, slug } = await fetchHackathonMeta(db, hackathonId);
  const baseUrl = env.FRONTEND_URL;

  switch (message.type) {
    case 'submission_received': {
      const teamName = await fetchTeamName(db, message.teamId);
      return {
        subject: `[DevSage] Submission Received`,
        body: `Hi,

Your team "${teamName}" has successfully submitted to ${title}.

Tag: ${message.tagName}
Commit: ${message.commitSha.substring(0, 7)}

View your submission: ${baseUrl}/hackathons/${slug}/team

Good luck!`,
      };
    }

    case 'submission_invalid': {
      const teamName = await fetchTeamName(db, message.teamId);
      return {
        subject: `[DevSage] Submission Invalid`,
        body: `Hi,

Your team "${teamName}" attempted to submit to ${title}, but the submission was rejected.

Tag: ${message.tagName}
Reason: ${message.reason}

Please fix the issues and submit again.

View your team: ${baseUrl}/hackathons/${slug}/team`,
      };
    }

    case 'force_push_alert': {
      const teamName = await fetchTeamName(db, message.teamId, 'Unknown team');
      return {
        subject: `[DevSage] Force Push Alert`,
        body: `Hi,

A force push was detected in ${title}.

Team: ${teamName}
Affected submissions: ${message.affectedSubmissionCount}

This event has been logged and flagged for review.

View force push events: ${baseUrl}/hackathons/${slug}/admin/force-pushes`,
      };
    }

    case 'phase_transition':
      return {
        subject: `[DevSage] ${title} - Phase Transition`,
        body: `Hi,

${title} has transitioned from ${message.fromPhase} to ${message.toPhase}.

Visit the hackathon page for more details: ${baseUrl}/hackathons/${slug}`,
      };

    case 'judge_invited':
      return {
        subject: `[DevSage] Judge Invitation - ${title}`,
        body: `Hi,

You've been invited to judge ${title}.

Please accept or decline the invitation: ${baseUrl}/hackathons/${slug}/judge/invite

We look forward to your participation!`,
      };

    case 'judge_assignment':
      return {
        subject: `[DevSage] Judge Assignment - ${title}`,
        body: `Hi,

You have been assigned ${message.submissionCount} submission(s) to review for ${title}.

Start reviewing: ${baseUrl}/hackathons/${slug}/judge/review

Thank you for your time!`,
      };

    case 'scores_finalized': {
      const teamName = await fetchTeamName(db, message.teamId);
      return {
        subject: `[DevSage] Scores Finalized`,
        body: `Hi,

Judging for ${title} has concluded and scores have been finalized for your team "${teamName}".

View results: ${baseUrl}/hackathons/${slug}/results

Thank you for participating!`,
      };
    }

    case 'deadline_reminder':
      return {
        subject: `[DevSage] Submission Deadline Reminder - ${title}`,
        body: `Hi,

This is a reminder that the submission deadline for ${title} is in ${message.hoursRemaining} hours.

Your team has not yet submitted a final submission. Please submit before the deadline.

Submit now: ${baseUrl}/hackathons/${slug}/team`,
      };

    default:
      return {
        subject: `[DevSage] Notification`,
        body: `You have a new notification from DevSage.`,
      };
  }
}

// ─── Idempotency ─────────────────────────────────────────────

/**
 * Generate a stable idempotency key for a notification message.
 * Combines type + hackathonId + discriminator fields.
 */
export function notificationIdempotencyKey(message: NotificationMessage): string {
  const parts: string[] = [message.type];
  if ('hackathonId' in message) parts.push(message.hackathonId);
  if ('inviteId' in message) parts.push(message.inviteId);
  if ('teamId' in message && message.teamId) parts.push(message.teamId);
  if ('judgeId' in message && message.judgeId) parts.push(message.judgeId);
  if ('forcePushId' in message && message.forcePushId) parts.push(message.forcePushId);
  if ('fromPhase' in message && message.fromPhase) parts.push(message.fromPhase);
  if ('hoursRemaining' in message) parts.push(String(message.hoursRemaining));
  return parts.join(':');
}
