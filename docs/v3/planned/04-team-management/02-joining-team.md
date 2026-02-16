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

// 2. Check user not already in a team for this hackathon
const existing = await db.select()
  .from(teamMembers)
  .innerJoin(teams, eq(teamMembers.team_id, teams.id))
  .where(and(
    eq(teams.hackathon_id, hackathonId),
    eq(teamMembers.user_id, userId)
  ))
  .get();

if (existing) return errorResponse(c, 409, 'ALREADY_IN_TEAM', 'You are already in a team');

// 3. Check team size limit
const memberCount = await db.select({ count: count() })
  .from(teamMembers)
  .where(eq(teamMembers.team_id, team.id))
  .get();

if (memberCount.count >= hackathon.max_team_size) {
  return errorResponse(c, 400, 'TEAM_FULL', 'Team has reached maximum size');
}

// 4. Determine role: first member = team_lead, others = team_member
const role = memberCount.count === 0 ? 'team_lead' : 'team_member';

// 5. Insert team member
await db.insert(teamMembers).values({
  id: crypto.randomUUID(),
  team_id: team.id,
  user_id: userId,
  role: role,
  joined_at: new Date().toISOString(),
});

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
