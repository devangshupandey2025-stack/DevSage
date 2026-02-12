# packages/shared — Zod Schemas + Types + Constants

Standalone package (only dependency: `zod`). Shared between API and web app.

## STRUCTURE

```
src/
├── index.ts              # Barrel: re-exports everything (explicit .js extensions)
└── schemas/
    ├── user.ts           # UserSchema, UserRole type
    ├── hackathon.ts      # HackathonSchema, HackathonStatusEnum, CreateHackathonRequestSchema, UpdateHackathonRequestSchema
    ├── team.ts           # TeamSchema, CreateTeamRequestSchema, JoinTeamRequestSchema
    ├── team-member.ts    # TeamMemberSchema
    ├── submission.ts     # SubmissionSchema
    ├── organizer-role.ts # OrganizerRoleSchema
    ├── judge.ts          # JudgeSchema
    ├── rubric.ts         # RubricCriteriaSchema
    ├── score.ts          # ScoreSchema
    ├── judge-assignment.ts # JudgeAssignmentSchema
    ├── ai-review.ts      # AiReviewSchema
    ├── audit-event.ts    # AuditEventSchema
    ├── commit-log.ts     # CommitLogSchema
    ├── force-push.ts     # ForcePushEventSchema
    ├── api.ts            # ApiErrorSchema, pagination types
    └── constants.ts      # HACKATHON_STATUS_TRANSITIONS, ROLES, MAX_TEAM_NAME_LENGTH, JOIN_CODE_LENGTH
```

## CONVENTIONS

- **Schema naming**: `{Entity}Schema` for base, `Create{Entity}RequestSchema` for API input, `Update{Entity}RequestSchema` for updates
- **Types**: Inferred via `z.infer<typeof Schema>` — no separate type files
- **Adding a schema**: Create file in `schemas/`, re-export from `src/index.ts` with `.js` extension
- **Status transitions**: `HACKATHON_STATUS_TRANSITIONS` is the source of truth for valid state moves
- **Roles**: 7 per-hackathon roles: `anonymous | participant | team_leader | judge | moderator | admin | owner`
- **Status enum**: 7 lowercase statuses: `draft, registration_open, registration_closed, active, judging, completed, archived`
- **Barrel exports**: Explicit `.js` extensions required (ESM strict)

## ANTI-PATTERNS

- Adding runtime deps beyond `zod`
- Defining types separately from Zod schemas (derive with `z.infer`)
- Forgetting `.js` extension in barrel re-exports
- Importing from `@devsage/shared` in `@devsage/db` (shared has no dependency on db, and db has no dependency on shared)
