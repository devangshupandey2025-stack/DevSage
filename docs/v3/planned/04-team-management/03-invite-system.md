# Invite System

> Direct invites by email and bulk invite via Excel upload.

## Direct Email Invite

### `POST /api/v1/hackathons/:slug/teams/:teamId/invites`

```
Auth: authMiddleware + requireRole('team_lead') or co_organizer+
State: draft or active
```

```ts
const inviteSchema = z.object({
  email: z.string().email(),
});
```

**Implementation:**
1. Check team size won't exceed limit
2. Check email not already in a team for this hackathon
3. Create invite row with token
4. Send email notification via `NOTIFICATION_QUEUE`

```sql
CREATE TABLE team_invites (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  UNIQUE(team_id, email)
);
```

### `POST /api/v1/invites/:token/accept`

```
Auth: authMiddleware
```

Accepts the invite — adds user to the team as `team_member`.

### `POST /api/v1/invites/:token/decline`

Marks invite as declined.

## Bulk Excel Upload

### `POST /api/v1/hackathons/:slug/teams/bulk-invite`

```
Auth: authMiddleware + requireRole('co_organizer')
Content-Type: multipart/form-data
```

Organizers upload an Excel file with team assignments:

**Expected format:**

| Team Name | Email | Role |
|-----------|-------|------|
| Team Alpha | alice@example.com | team_lead |
| Team Alpha | bob@example.com | team_member |
| Team Beta | carol@example.com | team_lead |

**Implementation:**
1. Parse Excel file (xlsx)
2. Validate all rows (email format, role values)
3. Group by team name
4. For each team:
   - Create team if doesn't exist
   - Create invite for each member
   - Queue invite emails
5. Return summary: `{ teams_created, invites_sent, errors }`

**Response:**
```json
{
  "ok": true,
  "data": {
    "teams_created": 5,
    "invites_sent": 20,
    "errors": [
      { "row": 7, "email": "invalid", "reason": "Invalid email format" }
    ]
  }
}
```

## Invite Code Regeneration

### `POST /api/v1/hackathons/:slug/teams/:teamId/regenerate-code`

```
Auth: team_lead or co_organizer+
```

Generates a new invite code, invalidating the old one.

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `ALREADY_INVITED` | 409 | Email already has pending invite for this team |
| `ALREADY_IN_TEAM` | 409 | Email belongs to user already in a team |
| `INVITE_NOT_FOUND` | 404 | Invalid invite token |
| `INVITE_EXPIRED` | 400 | Invite token has expired |
| `BULK_PARSE_ERROR` | 400 | Excel file could not be parsed |
| `TEAM_FULL` | 400 | Would exceed max_team_size |
