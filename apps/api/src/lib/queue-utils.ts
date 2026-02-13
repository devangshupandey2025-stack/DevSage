import type { NotificationMessage } from '../queue/notification-handler.js';

/** All valid notification message type values. */
const NOTIFICATION_TYPES: ReadonlySet<string> = new Set<NotificationMessage['type']>([
  'submission_received',
  'submission_invalid',
  'force_push_alert',
  'phase_transition',
  'judge_invited',
  'judge_assignment',
  'scores_finalized',
  'deadline_reminder',
]);

/**
 * Type guard to determine if a queue message body is a notification
 * (as opposed to a webhook event).
 *
 * Used by the top-level queue dispatcher to route messages to the correct handler.
 */
export function isNotificationMessage(body: unknown): body is NotificationMessage {
  if (!body || typeof body !== 'object') return false;
  const type = (body as { type?: string }).type;
  return type !== undefined && NOTIFICATION_TYPES.has(type);
}
