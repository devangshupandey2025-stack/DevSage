# packages/shared — Zod Schemas + Types + Constants

Standalone package (only dependency: `zod`). Shared between API, web, platform, and admin apps.

## STRUCTURE

```
src/
├── index.ts              # Barrel: re-exports all 26 schemas (explicit .js extensions)
└── schemas/
    ├── constants.ts      # All enums: hackathonStatus (5), hackathonRole (6), organizerRole, teamStatus, etc.
    ├── api.ts            # ApiErrorSchema, pagination types
    ├── user.ts           # UserSchema
    ├── hackathon.ts      # HackathonSchema, CreateHackathonRequestSchema, UpdateHackathonRequestSchema
    ├── workspace.ts      # WorkspaceSchema, CreateWorkspaceRequestSchema
    ├── workspace-member.ts # WorkspaceMemberSchema
    ├── team.ts           # TeamSchema, CreateTeamRequestSchema, JoinTeamRequestSchema
    ├── team-member.ts    # TeamMemberSchema
    ├── team-invite.ts    # TeamInviteSchema
    ├── team-repo.ts      # TeamRepoSchema
    ├── team-message.ts   # TeamMessageSchema
    ├── submission.ts     # SubmissionSchema
    ├── rubric.ts         # RubricCriteriaSchema
    ├── judge.ts          # JudgeSchema
    ├── judge-assignment.ts # JudgeAssignmentSchema
    ├── judge-track.ts    # JudgeTrackSchema
    ├── score.ts          # ScoreSchema
    ├── organizer-role.ts # OrganizerRoleSchema
    ├── hackathon-round.ts # HackathonRoundSchema
    ├── hackathon-template.ts # HackathonTemplateSchema
    ├── hackathon-sponsor.ts # HackathonSponsorSchema
    ├── round-result.ts   # RoundResultSchema
    ├── audit-event.ts    # AuditEventSchema
    ├── in-app-notification.ts # InAppNotificationSchema
    ├── commit-log.ts     # CommitLogSchema
    └── force-push.ts     # ForcePushEventSchema
```

## KEY ENUMS (constants.ts)

| Enum | Values |
|------|--------|
| `hackathonStatusSchema` | `draft, active, judging, completed, archived` (5 states) |
| `hackathonRoleSchema` | `organizer, co_organizer, judge, team_lead, team_member, anonymous` (6 roles) |
| `organizerRoleSchema` | `organizer, co_organizer` |
| `workspaceRoleSchema` | `owner, admin, member` |
| `teamStatusSchema` | `forming, ready, submitted, dissolved` |
| `submissionStatusSchema` | `pending_validation, validated, failed_validation, tag_deleted` |
| `judgeInviteStatusSchema` | `pending, accepted, declined` |
| `teamMemberRoleSchema` | `team_lead, team_member` |
| `assignmentStatusSchema` | `pending, scored, skipped` |
| `sponsorTierSchema` | `platinum, gold, silver, bronze` |

## CONVENTIONS

- **Schema naming**: `{Entity}Schema` for base, `Create{Entity}RequestSchema` for API input, `Update{Entity}RequestSchema` for updates
- **Types**: Inferred via `z.infer<typeof Schema>` — no separate type files
- **Adding a schema**: Create file in `schemas/`, re-export from `src/index.ts` with `.js` extension
- **State machine**: `draft → active → judging → completed → archived`. Forward-only except `archived → completed` (un-archive)
- **Roles**: 6 per-hackathon roles resolved per-request via `resolveRole()`, NOT stored in JWT
- **Barrel exports**: Explicit `.js` extensions required (ESM strict)

## ANTI-PATTERNS

- Adding runtime deps beyond `zod`
- Defining types separately from Zod schemas (derive with `z.infer`)
- Forgetting `.js` extension in barrel re-exports
- Importing from `@devsage/shared` in `@devsage/db` (no cross-dependency between these packages)
