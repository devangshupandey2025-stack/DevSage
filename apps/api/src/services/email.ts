/**
 * Email sending via custom SMTP server.
 * Fail-open pattern: returns false on error, never throws.
 *
 * Required secrets:
 *   SMTP_URL        — smtps://smtp.example.com:465 or smtp://smtp.example.com:587
 *   SMTP_USERNAME   — SMTP auth username
 *   SMTP_PASSWORD   — SMTP auth password
 *   SMTP_EMAIL_ADDR — From address (fallback: EMAIL_FROM var from wrangler.jsonc)
 */

import { sendSmtp, parseSmtpUrl, type SmtpConfig } from './smtp.js';

// ── Types ──────────────────────────────────────────────────────────

export interface EmailEnv {
  SMTP_URL?: string;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  SMTP_EMAIL_ADDR?: string;
  EMAIL_FROM: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Send an email via SMTP.
 *
 * Builds config from SMTP_URL (host/port) + SMTP_USERNAME + SMTP_PASSWORD.
 * If SMTP_URL has credentials embedded, SMTP_USERNAME/SMTP_PASSWORD override them.
 * Tries the configured port first, then falls back to the alternate port (587↔465).
 */
export async function sendEmail(
  env: EmailEnv,
  options: EmailOptions,
): Promise<boolean> {
  const to = Array.isArray(options.to) ? options.to : [options.to];
  const from = env.SMTP_EMAIL_ADDR || env.EMAIL_FROM;

  console.warn(`[email] Attempting to send "${options.subject}" to ${to.join(', ')}`);

  if (!env.SMTP_URL) {
    console.warn('[email] SMTP_URL not configured — cannot send email');
    return false;
  }

  if (!env.SMTP_USERNAME || !env.SMTP_PASSWORD) {
    console.warn('[email] SMTP_USERNAME or SMTP_PASSWORD not set — cannot send email');
    return false;
  }

  // Parse host/port from URL, use separate username/password
  const parsed = parseSmtpUrl(env.SMTP_URL);
  const config: SmtpConfig = {
    host: parsed.host,
    port: parsed.port,
    username: env.SMTP_USERNAME,
    password: env.SMTP_PASSWORD,
  };

  console.warn(`[email] SMTP config: host=${config.host} port=${config.port} user=${config.username}`);

  // Try the configured port first
  try {
    const sent = await sendSmtp(config, from, to, options.subject, options.html);
    if (sent) {
      console.warn(`[email] SMTP sent successfully on port ${config.port}`);
      return true;
    }
    console.warn(`[email] SMTP port ${config.port} returned false`);
  } catch (err) {
    console.warn(`[email] SMTP port ${config.port} error: ${err instanceof Error ? err.message : err}`);
  }

  // Fallback: try the other port (587↔465)
  const fallbackPort = config.port === 587 ? 465 : 587;
  console.warn(`[email] Trying fallback port ${fallbackPort}`);
  try {
    const sent = await sendSmtp({ ...config, port: fallbackPort }, from, to, options.subject, options.html);
    if (sent) {
      console.warn(`[email] SMTP sent successfully on fallback port ${fallbackPort}`);
      return true;
    }
    console.warn(`[email] SMTP fallback port ${fallbackPort} returned false`);
  } catch (err) {
    console.warn(`[email] SMTP fallback port ${fallbackPort} error: ${err instanceof Error ? err.message : err}`);
  }

  console.warn('[email] All SMTP attempts failed');
  return false;
}
