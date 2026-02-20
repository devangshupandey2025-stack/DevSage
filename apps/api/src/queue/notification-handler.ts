import { sendEmail } from '../services/email.js';
import type { EmailEnv } from '../services/email.js';
import { resolveNotificationRecipients } from './notification-logic.js';

interface NotificationEnv extends EmailEnv {
  DB: D1Database;
  FRONTEND_URL: string;
  PLATFORM_URL: string;
}

export async function handleNotificationMessage(
  body: {
    type: string;
    hackathon_id?: string;
    actor_id?: string;
    data?: Record<string, unknown>;
  },
  env: NotificationEnv,
): Promise<void> {
  const { type, hackathon_id, data } = body;

  // ── Idempotency (check-before, insert-after-success) ───────────
  const idempotencyKey = `${type}:${hackathon_id}:${JSON.stringify(data ?? {})}`;

  const existing = await env.DB.prepare(
    'SELECT 1 FROM notification_idempotency WHERE idempotency_key = ?',
  )
    .bind(idempotencyKey)
    .first();

  if (existing) return; // Already processed successfully

  // ── Resolve recipients ─────────────────────────────────────────
  const recipients = await resolveNotificationRecipients(
    env.DB,
    type,
    hackathon_id,
    data,
  );

  // ── Generate content (async — some types need DB lookups) ──────
  const content = await generateNotificationContent(
    env.DB,
    type,
    hackathon_id,
    data,
    env,
  );

  // ── Fan-out to each recipient ──────────────────────────────────
  let anyEmailFailed = false;

  for (const recipient of recipients) {
    const now = new Date().toISOString();

    // In-app notification
    const notifId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO in_app_notifications (id, user_id, hackathon_id, type, title, body, action_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        notifId,
        recipient.user_id,
        hackathon_id ?? null,
        type,
        content.title,
        content.body,
        content.link,
        now,
      )
      .run();

    // Email
    if (recipient.email) {
      const emailSent = await sendEmail(env, {
        to: recipient.email,
        subject: content.title,
        html: content.html,
      });

      if (!emailSent) anyEmailFailed = true;

      const deliveryId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO notification_deliveries (id, event_id, user_id, channel, notification_type, status, created_at)
         VALUES (?, ?, ?, 'email', ?, ?, ?)`,
      )
        .bind(
          deliveryId,
          notifId,
          recipient.user_id,
          type,
          emailSent ? 'sent' : 'failed',
          now,
        )
        .run();
    }
  }

  // ── Mark as processed only if all emails sent successfully ─────
  if (!anyEmailFailed) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO notification_idempotency (id, idempotency_key, created_at) VALUES (?, ?, ?)',
    )
      .bind(crypto.randomUUID(), idempotencyKey, new Date().toISOString())
      .run();
  }
}

// ── Content generation ─────────────────────────────────────────────

interface NotificationContent {
  title: string;
  body: string;
  link: string | null;
  html: string;
}

async function generateNotificationContent(
  db: D1Database,
  type: string,
  hackathonId: string | undefined,
  data: Record<string, unknown> | undefined,
  env: { FRONTEND_URL: string; PLATFORM_URL: string },
): Promise<NotificationContent> {
  switch (type) {
    // ── Judge invitation (the critical path) ───────────────────
    case 'judge.invited': {
      const hackathon = hackathonId
        ? await db
            .prepare('SELECT title, slug FROM hackathons WHERE id = ?')
            .bind(hackathonId)
            .first<{ title: string; slug: string }>()
        : null;

      const hackathonName = hackathon?.title ?? 'a hackathon';
      const judgeId = data?.judge_id as string | undefined;
      const inviteLink = `${env.PLATFORM_URL}/invite/judge/${judgeId}`;

      return {
        title: `You're invited to judge ${hackathonName}`,
        body: `You've been invited to be a judge for ${hackathonName}. Click the link to accept your invitation.`,
        link: inviteLink,
        html: buildJudgeInviteEmail(hackathonName, inviteLink),
      };
    }

    // ── Other notification types ───────────────────────────────
    case 'submission.received': {
      const simple = simpleContent(
        'Submission Received',
        `Your team's submission (tag: ${data?.tag_name ?? 'unknown'}) has been received.`,
        data?.hackathon_id
          ? `${env.FRONTEND_URL}/hackathons/${data.hackathon_id}`
          : null,
      );
      return simple;
    }

    case 'submission.validated':
      return simpleContent(
        'Submission Validated',
        'Your submission has passed validation.',
        null,
      );

    case 'submission.tag_deleted':
      return simpleContent(
        'Submission Tag Deleted',
        `Warning: The submission tag "${data?.tag_name ?? ''}" was deleted from the repository.`,
        null,
      );

    case 'hackathon.judging_started':
      return simpleContent(
        'Judging Has Started',
        'The submission period has ended and judging has begun.',
        null,
      );

    case 'force_push_detected':
      return simpleContent(
        'Force Push Detected',
        `A force push was detected by ${data?.pusher_login ?? 'unknown'}.`,
        null,
      );

    case 'team_joined':
      return simpleContent(
        'New Team Member',
        'A new member has joined your team.',
        null,
      );

    case 'deadline_reminder':
      return simpleContent(
        'Deadline Approaching',
        `Submission deadline is in ${data?.hours_remaining ?? '?'} hour(s).`,
        null,
      );

    case 'results.published':
      return simpleContent(
        'Results Published',
        'The hackathon results have been published!',
        null,
      );

    default:
      return simpleContent(
        type
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        `Notification: ${type}`,
        null,
      );
  }
}

// ── Template helpers ───────────────────────────────────────────────

function simpleContent(
  title: string,
  body: string,
  link: string | null,
): NotificationContent {
  const linkHtml = link
    ? `<p style="margin:24px 0;text-align:center;"><a href="${link}" style="display:inline-block;background:#CCFF00;color:#000;font-weight:bold;padding:12px 28px;border-radius:8px;text-decoration:none;">View Details</a></p>`
    : '';
  return {
    title,
    body,
    link,
    html: wrapEmailTemplate(title, `<p style="color:#a0a0a0;line-height:1.6;">${body}</p>${linkHtml}`),
  };
}

function buildJudgeInviteEmail(
  hackathonName: string,
  inviteLink: string,
): string {
  return wrapEmailTemplate(
    "You're Invited to Judge!",
    `
    <h1 style="font-size:24px;font-weight:800;color:#fff;margin:0 0 16px;">You're Invited to Judge!</h1>
    <p style="color:#a0a0a0;line-height:1.6;margin:0 0 8px;">
      You've been invited to be a judge for <strong style="color:#fff;">${hackathonName}</strong>.
    </p>
    <p style="color:#a0a0a0;line-height:1.6;margin:0 0 24px;">
      As a judge you'll evaluate team submissions and help determine the winners. Click below to accept.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${inviteLink}"
         style="display:inline-block;background:#CCFF00;color:#000;font-weight:bold;
                padding:14px 36px;border-radius:8px;text-decoration:none;font-size:16px;">
        Accept Invitation
      </a>
    </div>
    <p style="color:#666;font-size:12px;margin:24px 0 0;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${inviteLink}" style="color:#CCFF00;word-break:break-all;">${inviteLink}</a>
    </p>
    `,
  );
}

/** Shared dark-themed email wrapper matching DevSage branding. */
function wrapEmailTemplate(preheader: string, innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${preheader}</title></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <!-- Logo -->
  <div style="text-align:center;padding:0 0 32px;">
    <span style="font-size:28px;font-weight:900;color:#CCFF00;letter-spacing:-0.5px;">DevSage</span>
  </div>
  <!-- Card -->
  <div style="background:#111;border:1px solid #222;border-radius:16px;padding:32px;">
    ${innerHtml}
  </div>
  <!-- Footer -->
  <div style="text-align:center;padding:24px 0 0;color:#444;font-size:11px;">
    <p style="margin:0;">DevSage &mdash; The edge-native hackathon platform</p>
    <p style="margin:4px 0 0;">You received this because an action was taken on your DevSage account.</p>
  </div>
</div>
</body>
</html>`;
}
