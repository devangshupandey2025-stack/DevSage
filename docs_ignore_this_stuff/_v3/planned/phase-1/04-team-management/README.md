# 04 — Team Management

> Team lifecycle from creation through member management, GitHub repo linking, and readiness checks.

## Team Lifecycle

```
Organizer creates team (with invite code)
  → Team lead invited/assigned
    → Team lead invites members (via code or direct invite)
      → Team lead links GitHub repo
        → Bot activated on repo
          → Team is "ready"
```

## Key Rules

- One user can belong to ONE team per hackathon
- Each team has exactly ONE team lead
- Team mutations (create, join, leave) only allowed in `draft` and `active` states
- Team lead must transfer leadership before leaving
- Minimum and maximum team sizes enforced by hackathon settings

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-team-creation.md](./01-team-creation.md) | Creating teams, invite code generation |
| [02-joining-team.md](./02-joining-team.md) | Joining via invite code |
| [03-invite-system.md](./03-invite-system.md) | Invite generation, bulk Excel upload |
| [04-github-repo-linking.md](./04-github-repo-linking.md) | Linking repos, bot activation |
| [05-member-management.md](./05-member-management.md) | Add/remove, leadership transfer |
| [06-team-readiness.md](./06-team-readiness.md) | Readiness checks, validation |

## Dependencies

- `apps/api/src/routes/teams.ts`
- `apps/api/src/routes/team-repos.ts`
- `packages/db/src/schema/teams.ts`
- `packages/db/src/schema/team-members.ts`
- `packages/db/src/schema/team-invites.ts`
- `packages/db/src/schema/team-repos.ts`
