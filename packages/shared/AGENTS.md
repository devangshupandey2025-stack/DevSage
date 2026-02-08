# packages/shared — Zod Schemas + Types + Constants

Standalone package (only dependency: `zod`). Shared between API and web app.

## STRUCTURE

```
src/
├── index.ts              # Barrel: re-exports everything
└── schemas/
    ├── user.ts           # UserSchema, UserRole type
    ├── hackathon.ts      # HackathonSchema, CreateHackathonRequestSchema, HackathonStatus
    ├── team.ts           # TeamSchema, CreateTeamRequestSchema, JoinTeamRequestSchema
    ├── team-member.ts    # TeamMemberSchema
    ├── registration.ts   # RegistrationSchema
    ├── submission.ts     # SubmissionSchema
    ├── api.ts            # ApiErrorSchema, pagination types
    └── constants.ts      # HACKATHON_STATUS_TRANSITIONS, ROLES, MAX_TEAM_NAME_LENGTH, JOIN_CODE_LENGTH
```

## CONVENTIONS

- **Schema naming**: `{Entity}Schema` for base, `Create{Entity}RequestSchema` for API input
- **Types**: Inferred via `z.infer<typeof Schema>` — no separate type files
- **Adding a schema**: Create file in `schemas/`, re-export from `src/index.ts` with `.js` extension
- **Status transitions**: `HACKATHON_STATUS_TRANSITIONS` is the source of truth for valid state moves
- **Roles**: `ROLES = ['organiser', 'participant'] as const` — never add more

## ANTI-PATTERNS

- Adding runtime deps beyond `zod`
- Defining types separately from Zod schemas (derive with `z.infer`)
- Forgetting `.js` extension in barrel re-exports
