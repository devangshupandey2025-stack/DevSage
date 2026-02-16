# Email Channel

> `apps/api/src/services/email.ts` — Transactional email delivery via Resend API.

## Email API Service

```ts
// Email service using Resend (https://resend.com)
// Free tier: 100 emails/day, 3,000/month
async function sendEmail(env: Env, options: EmailOptions): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM, // e.g., 'DevSage <noreply@devsage.dev>'
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(JSON.stringify({ event: 'email_send_failed', status: response.status, error, to: options.to }));
      return false;
    }
    return true;
  } catch (error) {
    console.error(JSON.stringify({ event: 'email_send_error', error: String(error), to: options.to }));
    return false;
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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

## Implementation Notes

- Resend REST API — works natively in Workers (no SMTP sockets needed)
- Email templates are simple inline functions — no Handlebars/Mustache
- Fail-open: email failure doesn't block the originating action

**Required configuration:**
- `RESEND_API_KEY` — secret (`wrangler secret put RESEND_API_KEY`)
- `EMAIL_FROM` — var in wrangler.jsonc (`"EMAIL_FROM": "DevSage <noreply@devsage.dev>"`)
