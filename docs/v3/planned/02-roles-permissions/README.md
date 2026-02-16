# 02 — Roles & Permissions

> Per-hackathon, per-request role resolution with a 6-tier hierarchy. Roles are never stored in JWTs — they're computed from database state on every request.

## Role Hierarchy

```
organizer          (full control of the hackathon)
  ↓
co_organizer       (manage teams, submissions, judging — cannot delete hackathon)
  ↓
judge              (view submissions, score teams)
  ↓
team_lead          (manage own team, submit, view)
  ↓
team_member        (view own team, participate)
  ↓
anonymous          (public read access only)
```

Higher roles inherit all permissions of lower roles. A user can have different roles in different hackathons.

## Resolution Algorithm

```
resolveRole(userId, hackathonId):
  1. Check organizer_roles table → organizer | co_organizer
  2. Check judges table (invite_status = 'accepted') → judge
  3. Check team_members table → team_lead | team_member
  4. Check workspace_members table → map workspace role to hackathon role
  5. Default → anonymous
```

First match wins. The check order ensures the highest applicable role is returned.

## Three Layers

| Layer | Where | What |
|-------|-------|------|
| Platform Admin | `shikdd.devsage.org` | `platform_admins` table — creates workspaces, manages platform |
| Workspace Role | Workspace-scoped | `workspace_members` table — owner/admin/member of a workspace |
| Hackathon Role | Hackathon-scoped | `organizer_roles` + `judges` + `team_members` — per-event roles |

Platform admin is a separate system. Workspace roles cascade into hackathon roles for hackathons within that workspace.

## Files in This Section

| File | What to Build |
|------|---------------|
| [01-hackathon-roles.md](./01-hackathon-roles.md) | 6-tier role definitions, DB tables, assignment |
| [02-role-resolution.md](./02-role-resolution.md) | resolveRole() algorithm, middleware implementation |
| [03-platform-admin.md](./03-platform-admin.md) | Platform admin system for shikdd.devsage.org |
| [04-workspace-roles.md](./04-workspace-roles.md) | Workspace membership and role cascading |
| [05-permission-matrix.md](./05-permission-matrix.md) | Complete action × role matrix |

## Dependencies

- `apps/api/src/middleware/role.ts` — `requireRole()`, `resolveRole()`
- `apps/api/src/middleware/platform-admin.ts` — `requirePlatformAdmin`
- `packages/db/src/schema/organizer-roles.ts`
- `packages/db/src/schema/judges.ts`
- `packages/db/src/schema/team-members.ts`
- `packages/db/src/schema/workspace-members.ts`
- `packages/db/src/schema/platform-admins.ts`
