# GDPR Anonymization

> Data anonymization and deletion for user privacy compliance.

## Overview

When a user requests account deletion, personally identifiable information (PII) is anonymized across all tables rather than deleted, preserving data integrity (audit trails, team history, scores).

## Anonymization Process

When `DELETE /auth/account` is confirmed:

```ts
async function anonymizeUser(db: DrizzleD1, userId: string) {
  const anonId = `anon_${crypto.randomUUID().slice(0, 8)}`;

  // 1. Users table
  await db.update(users).set({
    name: `Deleted User ${anonId}`,
    email: null,
    avatar_url: null,
    github_username: null,
    github_id: null,
    google_id: null,
    bio: null,
    updated_at: new Date().toISOString(),
    deleted_at: new Date().toISOString(),
  }).where(eq(users.id, userId));

  // 2. Revoke all sessions
  await db.delete(refreshTokens).where(eq(refreshTokens.user_id, userId));

  // 3. Anonymize audit events (keep events, remove PII)
  await db.update(auditEvents).set({
    actor_display_name: `Deleted User ${anonId}`,
  }).where(eq(auditEvents.actor_id, userId));

  // 4. Team memberships — keep records, anonymize
  // (team history is preserved for scoring integrity)

  // 5. Scores — keep scores, anonymize judge identity
  await db.update(scores).set({
    // Scores remain but judge name is anonymized via user join
  }).where(eq(scores.judge_id, userId));

  // 6. Notifications — delete (private data)
  await db.delete(inAppNotifications).where(eq(inAppNotifications.user_id, userId));
}
```

## Data Export (GDPR Right of Access)

`GET /auth/account/export` returns all user data as JSON:

```ts
{
  user: { ... },
  teams: [...],
  submissions: [...],
  scores: [...],           // scores the user submitted as judge
  notifications: [...],
  audit_events: [...],     // events where user is actor
}
```

## Timeline

1. User requests deletion via `DELETE /auth/account`
2. Confirmation email sent with unique token
3. User confirms via `POST /auth/account/delete-confirm` with token
4. 7-day grace period (user can cancel)
5. After grace period: anonymization runs via cron job

## Tables Affected

| Table | Action |
|-------|--------|
| `users` | Anonymize PII fields, set `deleted_at` |
| `refresh_tokens` | Delete all |
| `audit_events` | Anonymize `actor_display_name` |
| `in_app_notifications` | Delete all |
| `team_members` | Keep (role/membership history) |
| `scores` | Keep (scoring integrity) |
| `submissions` | Keep (team work, not individual) |

## Prerequisites

- Auth system (Phase 1)
- All data tables (Phase 1)
- Cron job for grace period processing

## Notes

- Anonymization over deletion — preserves referential integrity
- Audit trail entries are never deleted, only anonymized
- Team submissions belong to the team, not individuals — not affected
- Judge scores remain for leaderboard integrity
- Grace period cron: check `deleted_at + 7 days < now()`
