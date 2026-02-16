# Account Linking

> Multi-provider identity linking — users can sign in with both GitHub and Google, connected to the same account.

## How It Works

A single `users` row can have both `github_id` and `google_id`:

```
users table:
  id | email            | github_id | google_id | auth_provider
  ---+------------------+-----------+-----------+--------------
  1  | jane@example.com | 12345     | abc-xyz   | github
```

`auth_provider` records which provider was used FIRST (original signup). Both providers can authenticate to the same account.

## Linking Logic (on OAuth callback)

```
On callback with provider P and profile:
  1. Look up user by provider ID (github_id or google_id)
     → Found? Update last_login_at, return user ✓

  2. Look up user by email
     → Found with DIFFERENT provider?
       → Link: SET {P}_id = profile.id on existing user row
       → Update last_login_at, return user ✓

  3. No match?
     → Create new user with {P}_id and email
     → Return new user ✓
```

## Conflict Resolution

| Scenario | Resolution |
|----------|------------|
| Same email, different provider | Auto-link (trusted email from OAuth providers) |
| Same provider ID, different email | Update email to provider's current email |
| GitHub account linked to user A, tries to link to user B | Reject — provider ID already bound |
| User deletes GitHub account, re-creates with same email | Matched by email, linked to existing user |

## Security

- Only verified emails trigger auto-linking (both GitHub and Google verify emails)
- Provider ID takes precedence over email for matching (prevents email takeover)
- A provider ID can only be linked to ONE user (unique constraint on `github_id` and `google_id`)

## Implementation Notes

- Account linking happens automatically during OAuth callback — no separate "link account" endpoint needed
- The `auth_provider` field is informational only — it records original signup method
- If a user signs up with GitHub and later logs in with Google (same email), both providers are linked silently
