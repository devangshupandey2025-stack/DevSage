# Role Resolution

> `apps/api/src/middleware/role.ts` — Per-request role resolution from database state.

## resolveRole()

Called by `requireRole()` middleware. Queries DB tables in priority order:

```ts
async function resolveRole(db: D1Database, userId: string, hackathonId: string): Promise<HackathonRole> {
  // 1. Check organizer_roles
  const orgRole = await db.select()
    .from(organizerRoles)
    .where(and(
      eq(organizerRoles.hackathon_id, hackathonId),
      eq(organizerRoles.user_id, userId)
    ))
    .get();

  if (orgRole) return orgRole.role; // 'organizer' | 'co_organizer'

  // 2. Check judges (accepted only)
  const judge = await db.select()
    .from(judges)
    .where(and(
      eq(judges.hackathon_id, hackathonId),
      eq(judges.user_id, userId),
      eq(judges.invite_status, 'accepted')
    ))
    .get();

  if (judge) return 'judge';

  // 3. Check team_members (via team → hackathon)
  const member = await db.select()
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.team_id, teams.id))
    .where(and(
      eq(teams.hackathon_id, hackathonId),
      eq(teamMembers.user_id, userId)
    ))
    .get();

  if (member) return member.team_members.role; // 'team_lead' | 'team_member'

  // 4. Check workspace_members (cascade workspace role → hackathon role)
  const hackathon = await db.select({ workspace_id: hackathons.workspace_id })
    .from(hackathons)
    .where(eq(hackathons.id, hackathonId))
    .get();

  if (hackathon?.workspace_id) {
    const wsMember = await db.select()
      .from(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspace_id, hackathon.workspace_id),
        eq(workspaceMembers.user_id, userId)
      ))
      .get();

    if (wsMember) {
      // Workspace owner/admin → organizer, member → co_organizer
      if (wsMember.role === 'owner' || wsMember.role === 'admin') return 'organizer';
      return 'co_organizer';
    }
  }

  // 5. Default
  return 'anonymous';
}
```

## requireRole() Middleware

```ts
const ROLE_HIERARCHY: HackathonRole[] = [
  'organizer', 'co_organizer', 'judge', 'team_lead', 'team_member', 'anonymous'
];

function requireRole(minRole: HackathonRole): MiddlewareHandler<AuthAppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) return errorResponse(c, 401, 'AUTH_REQUIRED', 'Authentication required');

    const hackathonId = c.get('hackathonId'); // set by hackathon middleware
    if (!hackathonId) return errorResponse(c, 400, 'HACKATHON_REQUIRED', 'Hackathon context required');

    const role = await resolveRole(c.env.DB, user.sub, hackathonId);
    c.set('role', role);

    if (!isRoleAtLeast(role, minRole)) {
      return errorResponse(c, 403, 'INSUFFICIENT_ROLE',
        `Requires ${minRole} role, you have ${role}`);
    }

    await next();
  };
}

function isRoleAtLeast(actual: HackathonRole, required: HackathonRole): boolean {
  return ROLE_HIERARCHY.indexOf(actual) <= ROLE_HIERARCHY.indexOf(required);
}
```

## Hackathon Context Middleware

Role resolution requires knowing WHICH hackathon. The hackathon middleware extracts it from the URL:

```ts
// apps/api/src/middleware/hackathon.ts
// Resolves :slug → hackathon ID, sets c.set('hackathonId', id)
```

## Route Usage

```ts
// Organizer only
app.post('/hackathons/:slug/transition', authMiddleware, requireRole('organizer'), handler);

// Organizer + co-organizer
app.post('/hackathons/:slug/teams', authMiddleware, requireRole('co_organizer'), handler);

// Any participant
app.get('/hackathons/:slug/my-team', authMiddleware, requireRole('team_member'), handler);

// Judges and above
app.get('/hackathons/:slug/submissions', authMiddleware, requireRole('judge'), handler);
```

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `AUTH_REQUIRED` | 401 | No authenticated user |
| `HACKATHON_REQUIRED` | 400 | No hackathon context in request |
| `INSUFFICIENT_ROLE` | 403 | User's role is below the minimum required |
| `HACKATHON_NOT_FOUND` | 404 | Slug doesn't match any hackathon |
