# Joining a Team

> `POST /api/v1/hackathons/:slug/teams/join` — Participant joins a team via invite code.

## Endpoint

```
POST /api/v1/hackathons/:slug/teams/join
Auth: authMiddleware
State: draft or active only
```

## Request Body

```ts
const joinTeamSchema = z.object({
  invite_code: z.string().min(6).max(12),
});
```

## Implementation

```ts
// 1. Find team by invite_code within this hackathon
const team = await db.select()
  .from(teams)
  .where(and(
    eq(teams.hackathon_id, hackathonId),
    eq(teams.invite_code, body.invite_code)
  ))
  .get();

if (!team) return errorResponse(c, 404, 'INVALID_INVITE_CODE', 'Invite code not found');

// 2–5. Atomic join: single INSERT with subquery guards + batch
// Uses a single INSERT with subquery guards for atomicity — D1 does not support BEGIN TRANSACTION.
const result = await db.batch([
  // 1. Check user isn't already in any team for this hackathon
  db.run(sql`
    INSERT INTO team_members (id, team_id, user_id, role, created_at)
    SELECT ${crypto.randomUUID()}, ${team.id}, ${userId}, 'team_member', ${new Date().toISOString()}
    WHERE NOT EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE t.hackathon_id = ${hackathonId} AND tm.user_id = ${userId}
    )
    AND (SELECT COUNT(*) FROM team_members WHERE team_id = ${team.id}) < ${hackathon.max_team_size}
  `),
  // 2. Update team status if needed
  db.run(sql`UPDATE teams SET status = 'active' WHERE id = ${team.id} AND status = 'forming'`),
]);

if (result[0].meta.changes === 0) {
  // Either user already in a team or team is full
  return c.json({ ok: false, error: { code: 'JOIN_FAILED', message: 'Already in a team or team is full' } }, 409);
}

// 6. Audit: team.member_joined
```

## Response

```json
{
  "ok": true,
  "data": {
    "team_id": "uuid",
    "team_name": "Team Alpha",
    "role": "team_member",
    "joined_at": "2026-02-15T..."
  }
}
```

## First Member = Team Lead

The first person to join a team using the invite code becomes the `team_lead`. All subsequent members are `team_member`. This allows organizers to create teams and share invite codes — whoever joins first leads.

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `INVALID_INVITE_CODE` | 404 | No team with this invite code in this hackathon |
| `ALREADY_IN_TEAM` | 409 | User already belongs to a team in this hackathon |
| `TEAM_FULL` | 400 | Team at max_team_size |
| `HACKATHON_NOT_ACTIVE` | 400 | Hackathon not in draft/active state |
