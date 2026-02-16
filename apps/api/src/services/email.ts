const TIMEOUT_MS = 10_000;

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from: string;
}

export async function sendEmail(
  apiKey: string,
  options: EmailOptions
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn(`Resend API error: ${res.status} ${text}`);
        return false;
      }

      return true;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.warn(`Email send failed (fail-open): ${err instanceof Error ? err.message : err}`);
    return false;
  }
}
