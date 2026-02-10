import type { Env } from '../types/env.js';

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send a plain text email via SMTP.
 * Uses HTTP-based email API (Cloudflare Workers don't support raw TCP/SMTP).
 * Fail-open: logs warning if SMTP not configured or send fails.
 * Bounded: 10s timeout via AbortController.
 */
export async function sendEmail(env: Env, params: SendEmailParams): Promise<SendEmailResult> {
  // Validate SMTP configuration
  if (!env.SMTP_URL) {
    console.warn('sendEmail: SMTP_URL not configured, skipping');
    return { success: false, error: 'SMTP not configured' };
  }

  if (!env.SMTP_USERNAME || !env.SMTP_PASSWORD || !env.SMTP_EMAIL_ADDR) {
    console.warn('sendEmail: SMTP credentials incomplete, skipping');
    return { success: false, error: 'SMTP credentials not configured' };
  }

  // Validate email parameters
  if (!params.to || !params.subject || !params.body) {
    console.warn('sendEmail: missing required email parameters (to, subject, body)');
    return { success: false, error: 'Missing required email parameters' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Prepare Basic Auth header
    const credentials = Buffer.from(`${env.SMTP_USERNAME}:${env.SMTP_PASSWORD}`).toString('base64');

    const response = await fetch(env.SMTP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DevSage',
      },
      body: JSON.stringify({
        from: env.SMTP_EMAIL_ADDR,
        to: params.to,
        subject: params.subject,
        text: params.body,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const statusText = response.statusText || `HTTP ${response.status}`;
      console.warn(
        `sendEmail: SMTP API returned ${response.status} (${statusText}) for ${params.to}`,
      );
      return {
        success: false,
        error: `SMTP server returned ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`sendEmail: timeout sending email to ${params.to}`);
      return { success: false, error: 'Request timeout' };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`sendEmail: failed to send email to ${params.to}: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
