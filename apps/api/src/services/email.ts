/**
 * Unified email sending: SMTP (preferred) → Resend API (fallback).
 * Fail-open pattern: returns false on error, never throws.
 */

import { sendSmtp, parseSmtpUrl } from './smtp.js';

const RESEND_TIMEOUT = 10_000;

// ── Types ──────────────────────────────────────────────────────────

export interface EmailEnv {
  SMTP_URL?: string;
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

  // Prefer SMTP
  if (env.SMTP_URL) {
    try {
      const config = parseSmtpUrl(env.SMTP_URL);
      const sent = await sendSmtp(
        config,
        env.EMAIL_FROM,
        to,
        options.subject,
        options.html,
      );
      if (sent) return true;
      console.warn('SMTP returned false, trying Resend fallback');
    } catch (err) {
      console.warn(
        `SMTP error: ${err instanceof Error ? err.message : err}`,
      );
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
