# Member Management

> Adding/removing members and transferring team leadership.

## Remove Member

### `DELETE /api/v1/hackathons/:slug/teams/:teamId/members/:userId`

```
Auth: team_lead or co_organizer+
State: draft or active
```

**Rules:**
- Team lead cannot remove themselves (must transfer leadership first)
- Organizer/co-organizer can remove any member
- Removed user can join a different team

```ts
// 1. Check target is not team_lead (if remover is team_lead)
// 2. Delete team_members row
// 3. Audit: team.member_removed
```

## Leave Team

### `POST /api/v1/hackathons/:slug/teams/:teamId/leave`

```
Auth: authMiddleware (must be member of team)
State: draft or active
```

**Rules:**
- Team lead CANNOT leave without transferring leadership
- Last member leaving dissolves the team

```ts
const member = await getMember(teamId, userId);

if (member.role === 'team_lead') {
  return errorResponse(c, 400, 'LEAD_CANNOT_LEAVE', 'Transfer leadership before leaving');
}

// Atomic leave + conditional dissolve via db.batch() (D1 does not support SQL transactions)
await db.batch([
  // 1. Remove the member
  db.delete(teamMembers).where(
    and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
  ),
  // 2. Conditionally dissolve if no members remain
  db.run(sql`
    UPDATE teams SET status = 'dissolved', updated_at = ${new Date().toISOString()}
    WHERE id = ${teamId}
    AND NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id != ${userId})
  `),
]);
```

## Transfer Leadership

### `POST /api/v1/hackathons/:slug/teams/:teamId/transfer-lead`

```
Auth: current team_lead or co_organizer+
State: draft or active
```

```ts
const transferSchema = z.object({
  new_lead_user_id: z.string().uuid(),
});
```

**Implementation:**
1. Verify new lead is a member of the team
2. Update old lead: `role = 'team_member'`
3. Update new lead: `role = 'team_lead'`
4. Audit: `team.leadership_transferred`

Both updates happen in a single `db.batch()` call for atomicity (D1 does not support SQL transactions).

```ts
// Leadership transfer — atomic via db.batch()
await db.batch([
  db.update(teamMembers).set({ role: 'team_member' }).where(eq(teamMembers.id, oldLeadId)),
  db.update(teamMembers).set({ role: 'team_lead' }).where(eq(teamMembers.id, newLeadId)),
]);
```

## Dissolve Team

### `DELETE /api/v1/hackathons/:slug/teams/:teamId`

```
Auth: organizer or co_organizer only
State: draft or active
```

Removes the team and all its members. Cascades to `team_members`, `team_invites`, `team_repos`.

**Cannot dissolve** if team has finalized submissions.

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `LEAD_CANNOT_LEAVE` | 400 | Team lead trying to leave without transfer |
| `NOT_TEAM_MEMBER` | 404 | Target user not in this team |
| `CANNOT_REMOVE_LEAD` | 400 | Trying to remove team lead |
| `NEW_LEAD_NOT_MEMBER` | 400 | Transfer target not in team |
| `TEAM_HAS_SUBMISSIONS` | 400 | Cannot dissolve team with submissions |
