# Decisions — devsage-mvp

This file captures architectural choices and rationales.

---

## [Session ses_3cf457002ffeNSxmPxux56k9hN] Started: 2026-02-06T06:19:58.380Z


## Task 8 Decisions (2026-02-06)

- **Durable Object authority**: Lifecycle truth is owned by `HackathonLifecycleDO` SQLite state, not D1. Rationale: DO gives serialized mutation semantics and CAS-friendly versioning.
- **Versioned CAS**: Every transition requires `expectedVersion` and increments `version`. Rationale: explicit conflict detection for stale clients and concurrent updates.
- **Strict linear transitions**: Action map enforces `DRAFT -> REGISTRATION_OPEN -> HACKING -> SUBMISSION_CLOSED -> COMPLETED` with no skip/backward paths. Rationale: prevent invalid lifecycle jumps.
- **Alarm scope**: Automatic transitions are limited to deadline-driven steps (`REGISTRATION_OPEN -> HACKING`, `HACKING -> SUBMISSION_CLOSED`). Rationale: matches plan deadlines while keeping completion manual.
- **Worker-mediated D1 sync**: API route updates D1 after DO transition, and lifecycle reads reconcile drift. Rationale: preserve "DO authoritative, D1 eventually consistent" model without DO-to-D1 coupling.
- **DO identity strategy**: `idFromName(hackathonId)` chosen for deterministic lookup and one lifecycle object per hackathon.
