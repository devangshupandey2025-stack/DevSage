import { createDbClient } from '@devsage/db';
import { insertAuditEvent } from '../lib/audit.js';
import { sendEmail } from '../services/smtp.js';
import type { Env } from '../types/env.js';
import {
  resolveRecipients,
  renderEmailTemplate,
  notificationIdempotencyKey,
} from './notification-logic.js';

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
    }
  | {
      type: 'organizer_invited';
      inviteId: string;
      email: string;
      inviteCode: string;
    };

/**
 * Handle a single notification queue message.
 *
 * Processing flow:
 * 1. Idempotency check via audit_events
 * 2. Resolve recipients based on notification type
 * 3. Render plain-text email template
 * 4. Send emails via SMTP (serialized, one at a time)
 * 5. Log each send attempt to audit_events
 *
 * SMTP calls are serialized — no concurrent connections within a batch.
 * Failures are logged but do not throw (fail-open).
 */
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
      hackathonId: 'hackathonId' in message ? message.hackathonId : undefined,
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
