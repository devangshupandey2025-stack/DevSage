# Permission Matrix

> Complete action × role matrix for all hackathon operations.

## Hackathon Management

| Action | organizer | co_organizer | judge | team_lead | team_member | anonymous |
|--------|:---------:|:------------:|:-----:|:---------:|:-----------:|:---------:|
| Create hackathon | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit hackathon settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete hackathon | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Transition phase | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View hackathon (public) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View hackathon (full) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

## Team Management

| Action | organizer | co_organizer | judge | team_lead | team_member | anonymous |
|--------|:---------:|:------------:|:-----:|:---------:|:-----------:|:---------:|
| Create team | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Invite team member | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Remove team member | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Transfer leadership | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Leave team | ❌ | ❌ | ❌ | ✅¹ | ✅ | ❌ |
| View own team | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| View all teams | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dissolve team | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bulk invite (Excel) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

¹ Team lead must transfer leadership before leaving.

## Submissions

| Action | organizer | co_organizer | judge | team_lead | team_member | anonymous |
|--------|:---------:|:------------:|:-----:|:---------:|:-----------:|:---------:|
| Link GitHub repo | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| View own submission | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View all submissions | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View submission diff | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Override submission status | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

## Judging

| Action | organizer | co_organizer | judge | team_lead | team_member | anonymous |
|--------|:---------:|:------------:|:-----:|:---------:|:-----------:|:---------:|
| Configure rubric | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Invite judges | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Submit scores | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| View own scores | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| View all scores | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View leaderboard | ✅ | ✅ | ✅ | ✅² | ✅² | ✅² |
| Publish results | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

² Only after results are published.

## Audit & Admin

| Action | organizer | co_organizer | judge | team_lead | team_member | anonymous |
|--------|:---------:|:------------:|:-----:|:---------:|:-----------:|:---------:|
| View audit trail | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export audit logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage notifications | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

## Implementation Pattern

In route handlers, use `requireRole()` with the minimum required role:

```ts
// requireRole('co_organizer') allows organizer AND co_organizer
app.post('/hackathons/:slug/teams', authMiddleware, requireRole('co_organizer'), createTeam);

// requireRole('team_member') allows everyone from organizer down to team_member
app.get('/hackathons/:slug/my-team', authMiddleware, requireRole('team_member'), getMyTeam);
```

For actions that need EXACT role matching (e.g., only judges can score), use `requireExactRole()`:

```ts
// Helper: requireExactRole — does NOT use hierarchy inheritance
function requireExactRole(...allowed: HackathonRole[]) {
  return async (c: Context, next: Next) => {
    const role = c.get('hackathonRole');
    if (!allowed.includes(role)) {
      return c.json({ ok: false, error: { code: 'FORBIDDEN' } }, 403);
    }
    await next();
  };
}

// Usage: only judges can submit scores (organizers cannot)
app.post('/scores', requireExactRole('judge'), submitScoreHandler);
```

**When to use which:**
- `requireRole(minRole)` — hierarchy-aware. Grants access to `minRole` and all roles above it. Use for most endpoints (e.g., `requireRole('co_organizer')` allows both organizer and co_organizer).
- `requireExactRole(...roles)` — exact match only. Use when a higher role should NOT inherit access (e.g., only judges can submit scores, not organizers).
