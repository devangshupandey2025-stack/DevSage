# Issues — devsage-mvp

This file captures problems, gotchas, and edge cases discovered during implementation.

---

## [Session ses_3cf457002ffeNSxmPxux56k9hN] Started: 2026-02-06T06:19:58.380Z


## Task 8 Issues / Gotchas (2026-02-06)

- Local verification initially failed with `FOREIGN KEY constraint failed` when creating hackathons because JWT `sub` did not match an existing `users.id` in local D1.
  - Mitigation: inspect local users table and generate organiser JWT with the actual organiser user ID.
- Durable Object SQL cursor typing (`toArray()`) can trigger strict TS cast errors if directly cast to a custom row interface.
  - Mitigation: treat rows as unknown records and validate each required field before constructing typed state.
- DO non-OK responses should be safely JSON-parsed in Worker routes; malformed payloads can otherwise mask real status handling.
  - Mitigation: use defensive `readJson()` helper and fallback structured errors.
