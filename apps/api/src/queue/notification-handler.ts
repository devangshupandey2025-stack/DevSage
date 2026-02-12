import { createDbClient, teamMembers, organizerRoles, judges, teams, hackathons, users } from '@devsage/db';
import { eq, and, inArray } from 'drizzle-orm';
import { insertAuditEvent } from '../lib/audit.js';
import { sendEmail } from '../services/smtp.js';
import type { Env } from '../types/env.js';

/**
 * Notification message types for the notification queue.
 * Each type has specific fields and recipient resolution logic.
 */
export type NotificationMessage =
  | {
      type: 'submission_received';
      hackathonId: string;
      teamId: string;
      tagName: string;
      commitSha: string;
    }
  | {
      type: 'submission_invalid';
      hackathonId: string;
      teamId: string;
      tagName: string;
      reason: string;
    }
  | {
      type: 'force_push_alert';
      hackathonId: string;
      teamId: string;
      forcePushId: string;
      affectedSubmissionCount: number;
    }
  | {
      type: 'phase_transition';
      hackathonId: string;
      fromPhase: string;
      toPhase: string;
    }
  | {
      type: 'judge_invited';
      hackathonId: string;
      judgeId: string;
    }
  | {
      type: 'judge_assignment';
      hackathonId: string;
      judgeId: string;
      submissionCount: number;
    }
  | {
      type: 'scores_finalized';
      hackathonId: string;
      teamId: string;
    }
  | {
      type: 'deadline_reminder';
      hackathonId: string;
      hoursRemaining: number;
    };

interface Recipient {
  email: string;
  name: string;
}

/**
 * Resolve email recipients based on notification type.
 * 
 * Recipient resolution logic per type:
 * - submission_received: All team members
 * - submission_invalid: Team leader only
 * - force_push_alert: All organizers with moderator+ role (owner, admin, moderator)
 * - phase_transition: All hackathon participants (all team members)
 * - judge_invited: Single judge
 * - judge_assignment: Single judge
 * - scores_finalized: All team members
 * - deadline_reminder: All team leaders for teams with no final submission
 * 
 * Filters out users without email addresses.
 * 
 * @param message - Notification message with type-specific fields
 * @param env - Worker environment bindings
 * @returns Array of recipients with email and display name
 */
async function resolveRecipients(
  message: NotificationMessage,
  env: Env
): Promise<Recipient[]> {
  const db = createDbClient(env.DB);

  switch (message.type) {
    case 'submission_received': {
      // All team members
      const members = await db
        .select({
          email: users.email,
          name: users.display_name,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(eq(teamMembers.team_id, message.teamId));

      return members
        .filter((m) => m.email && m.email.length > 0)
        .map((m) => ({ email: m.email!, name: m.name }));
    }

    case 'submission_invalid': {
      // Team leader only
      const leaders = await db
        .select({
          email: users.email,
          name: users.display_name,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(and(eq(teamMembers.team_id, message.teamId), eq(teamMembers.role, 'leader')));

      return leaders
        .filter((l) => l.email && l.email.length > 0)
        .map((l) => ({ email: l.email!, name: l.name }));
    }

    case 'force_push_alert': {
      // All organizers with moderator+ role (owner, admin, moderator)
      const organizers = await db
        .select({
          email: users.email,
          name: users.display_name,
        })
        .from(organizerRoles)
        .innerJoin(users, eq(organizerRoles.user_id, users.id))
        .where(
          and(
            eq(organizerRoles.hackathon_id, message.hackathonId),
            inArray(organizerRoles.role, ['owner', 'admin', 'moderator'])
          )
        );

      return organizers
        .filter((o) => o.email && o.email.length > 0)
        .map((o) => ({ email: o.email!, name: o.name }));
    }

    case 'phase_transition': {
      // All hackathon participants (all team members)
      const participants = await db
        .select({
          email: users.email,
          name: users.display_name,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.team_id, teams.id))
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(eq(teams.hackathon_id, message.hackathonId));

      return participants
        .filter((p) => p.email && p.email.length > 0)
        .map((p) => ({ email: p.email!, name: p.name }));
    }

    case 'judge_invited':
    case 'judge_assignment': {
      // Single judge
      const judgeRecords = await db
        .select({
          email: users.email,
          name: users.display_name,
        })
        .from(judges)
        .innerJoin(users, eq(judges.user_id, users.id))
        .where(eq(judges.id, message.judgeId));

      return judgeRecords
        .filter((j) => j.email && j.email.length > 0)
        .map((j) => ({ email: j.email!, name: j.name }));
    }

    case 'scores_finalized': {
      // All team members
      const members = await db
        .select({
          email: users.email,
          name: users.display_name,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(eq(teamMembers.team_id, message.teamId));

      return members
        .filter((m) => m.email && m.email.length > 0)
        .map((m) => ({ email: m.email!, name: m.name }));
    }

    case 'deadline_reminder': {
      // All team leaders for teams with no final submission
      const leadersWithoutFinal = await env.DB.prepare(`
        SELECT DISTINCT u.email, u.display_name
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
      `).bind(message.hackathonId).all<{ email: string | null; display_name: string }>();

      return (leadersWithoutFinal.results || [])
        .filter((l) => l.email && l.email.length > 0)
        .map((l) => ({ email: l.email!, name: l.display_name }));
    }

    default:
      return [];
  }
}

/**
 * Render plain text email template based on notification type.
 * 
 * All emails:
 * - Subject: `[DevSage] {Event Title}`
 * - Body: Plain text with hackathon name, event description, relevant links
 * - Include FRONTEND_URL links for user actions
 * 
 * @param message - Notification message with type-specific fields
 * @param env - Worker environment bindings (for FRONTEND_URL)
 * @returns Email subject and body (plain text only)
 */
async function renderEmailTemplate(
  message: NotificationMessage,
  env: Env
): Promise<{ subject: string; body: string }> {
  const db = createDbClient(env.DB);

  // Fetch hackathon details
  const hackathonRecord = await db
    .select({
      slug: hackathons.slug,
      title: hackathons.title,
    })
    .from(hackathons)
    .where(eq(hackathons.id, message.hackathonId))
    .limit(1);

  const hackathonTitle = hackathonRecord[0]?.title ?? 'Hackathon';
  const hackathonSlug = hackathonRecord[0]?.slug ?? '';

  switch (message.type) {
    case 'submission_received': {
      // Fetch team name
      const teamRecord = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, message.teamId))
        .limit(1);

      const teamName = teamRecord[0]?.name ?? 'Your team';

      return {
        subject: `[DevSage] Submission Received`,
        body: `Hi,

Your team "${teamName}" has successfully submitted to ${hackathonTitle}.

Tag: ${message.tagName}
Commit: ${message.commitSha.substring(0, 7)}

View your submission: ${env.FRONTEND_URL}/hackathons/${hackathonSlug}/team

Good luck!`,
      };
    }

    case 'submission_invalid': {
      const teamRecord = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, message.teamId))
        .limit(1);

      const teamName = teamRecord[0]?.name ?? 'Your team';

      return {
        subject: `[DevSage] Submission Invalid`,
        body: `Hi,

Your team "${teamName}" attempted to submit to ${hackathonTitle}, but the submission was rejected.

Tag: ${message.tagName}
Reason: ${message.reason}

Please fix the issues and submit again.

View your team: ${env.FRONTEND_URL}/hackathons/${hackathonSlug}/team`,
      };
    }

    case 'force_push_alert': {
      const teamRecord = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, message.teamId))
        .limit(1);

      const teamName = teamRecord[0]?.name ?? 'Unknown team';

      return {
        subject: `[DevSage] Force Push Alert`,
        body: `Hi,

A force push was detected in ${hackathonTitle}.

Team: ${teamName}
Affected submissions: ${message.affectedSubmissionCount}

This event has been logged and flagged for review.

View force push events: ${env.FRONTEND_URL}/hackathons/${hackathonSlug}/admin/force-pushes`,
      };
    }

    case 'phase_transition': {
      return {
        subject: `[DevSage] ${hackathonTitle} - Phase Transition`,
        body: `Hi,

${hackathonTitle} has transitioned from ${message.fromPhase} to ${message.toPhase}.

Visit the hackathon page for more details: ${env.FRONTEND_URL}/hackathons/${hackathonSlug}`,
      };
    }

    case 'judge_invited': {
      return {
        subject: `[DevSage] Judge Invitation - ${hackathonTitle}`,
        body: `Hi,

You've been invited to judge ${hackathonTitle}.

Please accept or decline the invitation: ${env.FRONTEND_URL}/hackathons/${hackathonSlug}/judge/invite

We look forward to your participation!`,
      };
    }

    case 'judge_assignment': {
      return {
        subject: `[DevSage] Judge Assignment - ${hackathonTitle}`,
        body: `Hi,

You have been assigned ${message.submissionCount} submission(s) to review for ${hackathonTitle}.

Start reviewing: ${env.FRONTEND_URL}/hackathons/${hackathonSlug}/judge/review

Thank you for your time!`,
      };
    }

    case 'scores_finalized': {
      const teamRecord = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, message.teamId))
        .limit(1);

      const teamName = teamRecord[0]?.name ?? 'Your team';

      return {
        subject: `[DevSage] Scores Finalized`,
        body: `Hi,

Judging for ${hackathonTitle} has concluded and scores have been finalized for your team "${teamName}".

View results: ${env.FRONTEND_URL}/hackathons/${hackathonSlug}/results

Thank you for participating!`,
      };
    }

    case 'deadline_reminder': {
      return {
        subject: `[DevSage] Submission Deadline Reminder - ${hackathonTitle}`,
        body: `Hi,

This is a reminder that the submission deadline for ${hackathonTitle} is in ${message.hoursRemaining} hours.

Your team has not yet submitted a final submission. Please submit before the deadline.

Submit now: ${env.FRONTEND_URL}/hackathons/${hackathonSlug}/team`,
      };
    }

    default:
      return {
        subject: `[DevSage] Notification`,
        body: `You have a new notification from DevSage.`,
      };
  }
}

/**
 * Handle notification queue message.
 * 
 * Processing flow:
 * 1. Resolve recipients based on notification type (see resolveRecipients)
 * 2. Render plain text email template (see renderEmailTemplate)
 * 3. Send emails via SMTP service (serialized, one at a time)
 * 4. Log each send attempt to audit_events (success or failure)
 * 
 * Important:
 * - SMTP calls are SERIALIZED (no concurrent connections within batch)
 * - Max 10 messages per batch (rate limiting enforced at queue level)
 * - Fail-open: SMTP failures are logged but do not throw errors
 * - Recipients without email addresses are filtered out
 * 
 * @param message - Notification message from queue
 * @param env - Worker environment bindings
 */
/**
 * Generate a stable idempotency key for a notification message.
 * Uses type + hackathonId + discriminator fields to produce a unique key.
 */
function notificationIdempotencyKey(message: NotificationMessage): string {
  const parts = [message.type, message.hackathonId];
  if ('teamId' in message && message.teamId) parts.push(message.teamId);
  if ('judgeId' in message && message.judgeId) parts.push(message.judgeId);
  if ('forcePushId' in message && message.forcePushId) parts.push(message.forcePushId);
  if ('fromPhase' in message && message.fromPhase) parts.push(message.fromPhase);
  if ('hoursRemaining' in message) parts.push(String(message.hoursRemaining));
  return parts.join(':');
}

export async function handleNotification(message: NotificationMessage, env: Env): Promise<void> {
  const db = createDbClient(env.DB);
  const idempotencyKey = notificationIdempotencyKey(message);

  // Idempotency check: skip if already processed
  const alreadySent = await env.DB.prepare(`
    SELECT 1 FROM audit_events
    WHERE action = 'notification.sent' AND entity_type = 'notification' AND entity_id = ?
    LIMIT 1
  `).bind(idempotencyKey).first();

  if (alreadySent) {
    console.warn('handleNotification: duplicate, skipping', { type: message.type, key: idempotencyKey });
    return;
  }

  // 1. Resolve recipients based on type
  const recipients = await resolveRecipients(message, env);

  if (recipients.length === 0) {
    console.warn('handleNotification: no recipients found', { type: message.type });
    return;
  }

  // 2. Render email template
  const { subject, body } = await renderEmailTemplate(message, env);

  // 3. Send via SMTP (serialized, no concurrent connections)
  for (const recipient of recipients) {
    const result = await sendEmail(env, {
      to: recipient.email,
      subject,
      body,
    });

    // 4. Log send status to audit_events
    const action = result.success ? 'notification.sent' : 'notification.failed';
    await insertAuditEvent(db, {
      hackathonId: message.hackathonId,
      actorType: 'system',
      action,
      entityType: 'notification',
      entityId: idempotencyKey,
      details: {
        recipient: recipient.email,
        type: message.type,
        success: result.success,
        error: result.error,
      },
    });
  }
}
