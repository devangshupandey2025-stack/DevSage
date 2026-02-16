# Platform Admin

> `apps/api/src/middleware/platform-admin.ts` — Separate admin layer for `shikdd.devsage.org`.

## What Platform Admins Do

Platform admins manage the platform itself, NOT individual hackathons:
- Create workspaces
- Invite organizers into workspaces
- View all hackathons across workspaces
- Manage platform-level settings
- View platform-wide analytics

## How It Works

### `platform_admins` Table

```sql
CREATE TABLE platform_admins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  added_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `requirePlatformAdmin` Middleware

```ts
const requirePlatformAdmin: MiddlewareHandler<AuthAppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) return errorResponse(c, 401, 'AUTH_REQUIRED', 'Authentication required');

  const admin = await c.env.DB.select()
    .from(platformAdmins)
    .where(eq(platformAdmins.user_id, user.sub))
    .get();

  if (!admin) {
    return errorResponse(c, 403, 'NOT_PLATFORM_ADMIN', 'Platform admin access required');
  }

  await next();
};
```

## Admin Routes

All admin routes live under `/api/v1/admin` and require `requirePlatformAdmin`:

```ts
// apps/api/src/routes/admin.ts
app.use('/*', authMiddleware, requirePlatformAdmin);

app.get('/workspaces', listAllWorkspaces);
app.post('/workspaces', createWorkspace);
app.get('/workspaces/:id', getWorkspace);
app.post('/workspaces/:id/invite', inviteOrganizerToWorkspace);
app.get('/admins', listPlatformAdmins);
app.post('/admins', addPlatformAdmin);
app.delete('/admins/:id', removePlatformAdmin);
```

## Admin App

The admin panel lives at `apps/admin/` and is deployed to `shikdd.devsage.org`. It's a separate React SPA that only platform admins can access.

**Current pages:** admins, invites, login, profile.

## Relationship to Hackathon Roles

Platform admin is **separate from** hackathon roles:
- A platform admin can also be an organizer of a specific hackathon (two separate role checks)
- Platform admin status does NOT automatically grant organizer access to hackathons
- The admin endpoints operate on workspaces and platform config, not hackathon internals

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `NOT_PLATFORM_ADMIN` | 403 | User is not in platform_admins table |
