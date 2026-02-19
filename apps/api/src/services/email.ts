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

  // Prefer SMTP (combined URL)
  if (env.SMTP_URL) {
    try {
      const config = parseSmtpUrl(env.SMTP_URL);
      const from = env.SMTP_EMAIL_ADDR || env.EMAIL_FROM;
      const sent = await sendSmtp(config, from, to, options.subject, options.html);
      if (sent) return true;
      console.warn('SMTP (URL) returned false, trying next transport');
    } catch (err) {
      console.warn(`SMTP (URL) error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Fallback: individual SMTP secrets (SMTP_USERNAME + SMTP_PASSWORD)
  if (!env.SMTP_URL && env.SMTP_USERNAME && env.SMTP_PASSWORD) {
    try {
      // Derive SMTP host from email domain (e.g. noreply@devsage.org → mail.spacemail.com is configured per-domain)
      // Use the EMAIL_FROM domain to build a reasonable host guess, or use the explicit SMTP_URL next time
      const from = env.SMTP_EMAIL_ADDR || env.EMAIL_FROM;
      const domain = from.split('@')[1] || 'devsage.org';
      const smtpHost = `mail.${domain}`;
      const config = { host: smtpHost, port: 465, username: env.SMTP_USERNAME, password: env.SMTP_PASSWORD };
      const sent = await sendSmtp(config, from, to, options.subject, options.html);
      if (sent) return true;
      console.warn('SMTP (individual secrets) returned false, trying Resend');
    } catch (err) {
      console.warn(`SMTP (individual) error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Fallback to Resend
  if (env.RESEND_API_KEY) {
    return sendViaResend(
      env.RESEND_API_KEY,
      env.EMAIL_FROM,
      to,
      options.subject,
      options.html,
    );
  }

  console.warn(
    'No email transport configured — set SMTP_URL or RESEND_API_KEY secret',
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
