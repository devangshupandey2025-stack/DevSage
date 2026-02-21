import { sendSmtp, parseSmtpUrl, type SmtpConfig } from './smtp.js';

export interface EmailEnv {
  SMTP_URL?: string;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(
  env: EmailEnv,
  options: EmailOptions,
): Promise<boolean> {
  const to = Array.isArray(options.to) ? options.to : [options.to];
  const from = env.EMAIL_FROM;

  if (!env.SMTP_URL || !env.SMTP_USERNAME || !env.SMTP_PASSWORD) {
    console.warn('[email] SMTP not configured — cannot send email');
    return false;
  }

  const parsed = parseSmtpUrl(env.SMTP_URL);
  const config: SmtpConfig = {
    host: parsed.host,
    port: parsed.port,
    username: env.SMTP_USERNAME,
    password: env.SMTP_PASSWORD,
  };

  try {
    const sent = await sendSmtp(config, from, to, options.subject, options.html);
    if (sent) return true;
  } catch (err) {
    console.warn(`[email] SMTP port ${config.port} error: ${err instanceof Error ? err.message : err}`);
  }

  // Fallback port
  const fallbackPort = config.port === 587 ? 465 : 587;
  try {
    return await sendSmtp({ ...config, port: fallbackPort }, from, to, options.subject, options.html);
  } catch {
    console.warn('[email] All SMTP attempts failed');
    return false;
  }
}
