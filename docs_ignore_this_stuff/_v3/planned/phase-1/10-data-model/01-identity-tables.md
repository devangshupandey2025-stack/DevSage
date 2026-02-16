# Identity Tables

> Core user authentication, session management, platform admin access, and account deletion.

## Tables

### users

Primary identity table. One row per human who has ever authenticated.

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,            -- crypto.randomUUID()
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  github_id   INTEGER UNIQUE,             -- GitHub numeric user ID
  github_username TEXT,
  google_id   TEXT UNIQUE,                -- Google `sub` claim
  avatar_url  TEXT,
  auth_provider TEXT NOT NULL,            -- 'github' | 'google'
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

### refresh_tokens

Rotating refresh token families for replay detection. Each refresh rotates the family; reuse of an old token revokes the entire family.

```sql
CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   TEXT NOT NULL,              -- groups tokens for replay detection
  token_hash  TEXT NOT NULL UNIQUE,       -- SHA-256 of opaque token
  revoked_at  TEXT,                       -- set on rotation or logout
  expires_at  TEXT NOT NULL,              -- 30 days from creation
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family  ON refresh_tokens(family_id);
```

### platform_admins

Grants access to `shikdd.devsage.org` admin panel. Checked by `requirePlatformAdmin` middleware.

```sql
CREATE TABLE platform_admins (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  added_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

### deletion_requests

GDPR / account-deletion flow. User requests deletion → confirmation email → hard delete after grace period.

```sql
CREATE TABLE deletion_requests (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmation_token  TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  confirmed_at        TEXT
);

CREATE INDEX idx_deletion_requests_user ON deletion_requests(user_id);
```

## Schema Files

- `packages/db/src/schema/users.ts`
- `packages/db/src/schema/refresh-tokens.ts`
- `packages/db/src/schema/platform-admins.ts`
- `packages/db/src/schema/deletion-requests.ts`

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `users.email` | users | `(email)` | Login lookup (UNIQUE) |
| `users.github_id` | users | `(github_id)` | OAuth link (UNIQUE) |
| `users.google_id` | users | `(google_id)` | OAuth link (UNIQUE) |
| `idx_refresh_tokens_user` | refresh_tokens | `(user_id)` | Revoke all tokens on logout |
| `idx_refresh_tokens_family` | refresh_tokens | `(family_id)` | Replay detection |
| `idx_deletion_requests_user` | deletion_requests | `(user_id)` | Check pending deletion |

## Notes

- `auth_provider` records the _initial_ provider; users may link both GitHub and Google later.
- Refresh token rotation: on each use the old token is revoked and a new one issued in the same family. Reuse of a revoked token triggers revocation of the entire family.
- Platform admins are a separate access layer from per-hackathon roles.
