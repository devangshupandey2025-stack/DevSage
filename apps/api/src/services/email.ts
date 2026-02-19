/**
 * Unified email sending: SMTP (preferred) → Resend API (fallback).
 * Fail-open pattern: returns false on error, never throws.
 */

import { sendSmtp, parseSmtpUrl } from './smtp.js';

const RESEND_TIMEOUT = 10_000;

// ── Types ──────────────────────────────────────────────────────────

export interface EmailEnv {
  SMTP_URL?: string;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  SMTP_EMAIL_ADDR?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Send an email using SMTP if `SMTP_URL` is configured, otherwise Resend API.
 * If both fail or neither is configured, returns false.
 */
export async function sendEmail(
  env: EmailEnv,
  options: EmailOptions,
): Promise<boolean> {
  const to = Array.isArray(options.to) ? options.to : [options.to];
  const from = env.SMTP_EMAIL_ADDR || env.EMAIL_FROM;

  console.warn(`[email] Attempting to send "${options.subject}" to ${to.join(', ')}`);

  // Try SMTP (combined URL) — primary port, then fallback to alternate port
  if (env.SMTP_URL) {
    const config = parseSmtpUrl(env.SMTP_URL);
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
      const fallbackConfig = { ...config, port: fallbackPort };
      const sent = await sendSmtp(fallbackConfig, from, to, options.subject, options.html);
      if (sent) {
        console.warn(`[email] SMTP sent successfully on fallback port ${fallbackPort}`);
        return true;
      }
      console.warn(`[email] SMTP fallback port ${fallbackPort} returned false`);
    } catch (err) {
      console.warn(`[email] SMTP fallback port ${fallbackPort} error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Fallback: individual SMTP secrets (SMTP_USERNAME + SMTP_PASSWORD)
  if (!env.SMTP_URL && env.SMTP_USERNAME && env.SMTP_PASSWORD) {
    const domain = from.split('@')[1] || 'devsage.org';
    const smtpHost = `mail.${domain}`;
    console.warn(`[email] Trying individual SMTP secrets: ${smtpHost}`);

    // Try 587 STARTTLS first, then 465 direct TLS
    for (const port of [587, 465]) {
      try {
        const config = { host: smtpHost, port, username: env.SMTP_USERNAME, password: env.SMTP_PASSWORD };
        const sent = await sendSmtp(config, from, to, options.subject, options.html);
        if (sent) {
          console.warn(`[email] SMTP (individual) sent on port ${port}`);
          return true;
        }
      } catch (err) {
        console.warn(`[email] SMTP (individual) port ${port} error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Fallback to Resend
  if (env.RESEND_API_KEY) {
    console.warn('[email] Trying Resend API fallback');
    return sendViaResend(
      env.RESEND_API_KEY,
      env.EMAIL_FROM,
      to,
      options.subject,
      options.html,
    );
  }

  console.warn(
    '[email] No email transport succeeded — set SMTP_URL or RESEND_API_KEY secret',
  );
  return false;
}

// ── Resend (fallback) ──────────────────────────────────────────────

async function sendViaResend(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, html }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`Resend error: ${res.status} ${await res.text()}`);
        return false;
      }
      return true;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.warn(
      `Resend failed: ${err instanceof Error ? err.message : err}`,
    );
    return false;
  }
}
