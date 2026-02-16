import { sendEmail } from '../services/email.js';
import { resolveNotificationRecipients } from './notification-logic.js';

interface NotificationEnv {
  DB: D1Database;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  FRONTEND_URL: string;
  PLATFORM_URL: string;
}

export async function handleNotificationMessage(
  body: { type: string; hackathon_id?: string; actor_id?: string; data?: Record<string, unknown> },
  env: NotificationEnv
): Promise<void> {
  const { type, hackathon_id, data } = body;

  // Idempotency check
  const idempotencyKey = `${type}:${hackathon_id}:${JSON.stringify(data ?? {})}`;
  const idempotencyId = crypto.randomUUID();

  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO notification_idempotency (id, idempotency_key) VALUES (?, ?)'
  ).bind(idempotencyId, idempotencyKey).run();

  if (inserted.meta.rows_written === 0) return; // Already processed

  // Resolve recipients
  const recipients = await resolveNotificationRecipients(env.DB, type, hackathon_id, data);

  // Fan-out: send to each recipient
  for (const recipient of recipients) {
    // In-app notification
    const notifId = crypto.randomUUID();
    const { title, body: notifBody, link } = generateNotificationContent(type, data, env);

    await env.DB.prepare(
      `INSERT INTO in_app_notifications (id, user_id, hackathon_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(notifId, recipient.user_id, hackathon_id ?? null, type, title, notifBody, link).run();

    // Email (if recipient has email and hasn't disabled it)
    if (recipient.email) {
      const emailSent = await sendEmail(env.RESEND_API_KEY, {
        to: recipient.email,
        subject: title,
        html: `<p>${notifBody}</p>${link ? `<p><a href="${link}">View Details</a></p>` : ''}`,
        from: env.EMAIL_FROM,
      });

      // Record delivery
      const deliveryId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO notification_deliveries (id, notification_type, channel, recipient_id, recipient_email, status) VALUES (?, ?, 'email', ?, ?, ?)`
      ).bind(deliveryId, type, recipient.user_id, recipient.email, emailSent ? 'sent' : 'failed').run();
    }
  }
}

function generateNotificationContent(
  type: string,
  data: Record<string, unknown> | undefined,
  env: { FRONTEND_URL: string; PLATFORM_URL: string }
): { title: string; body: string; link: string | null } {
  switch (type) {
    case 'submission.received':
      return {
        title: 'Submission Received',
        body: `Your team's submission (tag: ${data?.tag_name ?? 'unknown'}) has been received.`,
        link: data?.hackathon_id ? `${env.FRONTEND_URL}/hackathons/${data.hackathon_id}` : null,
      };
    case 'submission.validated':
      return {
        title: 'Submission Validated',
        body: 'Your submission has passed validation.',
        link: null,
      };
    case 'submission.tag_deleted':
      return {
        title: 'Submission Tag Deleted',
        body: `Warning: The submission tag "${data?.tag_name ?? ''}" was deleted from the repository.`,
        link: null,
      };
    case 'hackathon.judging_started':
      return {
        title: 'Judging Has Started',
        body: 'The submission period has ended and judging has begun.',
        link: null,
      };
    case 'force_push_detected':
      return {
        title: 'Force Push Detected',
        body: `A force push was detected by ${data?.pusher_login ?? 'unknown'}.`,
        link: null,
      };
    case 'team_joined':
      return {
        title: 'New Team Member',
        body: 'A new member has joined your team.',
        link: null,
      };
    case 'deadline_reminder':
      return {
        title: 'Deadline Approaching',
        body: `Submission deadline is in ${data?.hours_remaining ?? '?'} hour(s).`,
        link: null,
      };
    case 'results.published':
      return {
        title: 'Results Published',
        body: 'The hackathon results have been published!',
        link: null,
      };
    default:
      return {
        title: type.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        body: `Notification: ${type}`,
        link: null,
      };
  }
}
