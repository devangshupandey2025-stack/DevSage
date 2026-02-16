# Email Channel

> `apps/api/src/services/smtp.ts` — Transactional email delivery via SMTP.

## SMTP Service

```ts
async function sendEmail(env: Env, options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  try {
    const response = await fetch(env.SMTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${env.SMTP_USERNAME}:${env.SMTP_PASSWORD}`)}`,
      },
      body: JSON.stringify({
        from: { email: env.SMTP_EMAIL_ADDR, name: 'DevSage' },
        to: [{ email: options.to }],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    return response.ok;
  } catch (error) {
    console.warn(`Email send failed: ${error}`);
    return false; // fail-open
  }
}
```

## Email Templates

Templates are inline functions (no template engine dependency):

```ts
function renderSubmissionEmail(data: { teamName: string; tagName: string; hackathonName: string }): { subject: string; html: string; text: string } {
  return {
    subject: `[${data.hackathonName}] Submission received: ${data.tagName}`,
    text: `Your team "${data.teamName}" submitted ${data.tagName}.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Submission Received</h2>
        <p>Your team <strong>${data.teamName}</strong> submitted <code>${data.tagName}</code>.</p>
        <p>View your submission on the DevSage dashboard.</p>
      </div>
    `,
  };
}
```

**Template categories:**
- Auth: invite, password reset
- Team: member joined, invite sent
- Submission: captured, validated, failed
- Judging: judge invited, scores ready, results published
- Deadline: 24h reminder, 1h reminder
- System: force push detected, bot activated

## Delivery Tracking

```sql
CREATE TABLE notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app')),
  recipient_id TEXT REFERENCES users(id),
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Implementation Notes

- SMTP is a REST API call (not raw SMTP protocol) — works in Workers
- All emails include both HTML and plain text versions
- Email templates are simple inline functions — no Handlebars/Mustache
- Fail-open: email failure doesn't block the originating action
- Required secrets: `SMTP_URL`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_EMAIL_ADDR`
