# DevSage — Technical Debt & Audit Registry

**Last audited:** 2026-02-26
**Scope:** Full backend, CI/CD, database, security, performance

## Documents

| Document | Focus | Key Findings |
|----------|-------|-------------|
| [`COMPREHENSIVE-DEBT-AUDIT.md`](COMPREHENSIVE-DEBT-AUDIT.md) | Master audit (292 items) | Source document for all fixes — 6 parts covering API, web, platform, packages, CI/CD |
| [`backend-architecture-critique.md`](backend-architecture-critique.md) | Architecture | 262 raw SQL calls, 100% dead packages/shared, fat controllers, no service layer |
| [`security-audit.md`](security-audit.md) | Security | 29 findings (2 CRITICAL, 5 HIGH) — input validation, CSRF, rate limiting |
| [`performance-audit.md`](performance-audit.md) | Performance | Missing indexes, N+1 queries, unbounded SELECTs, caching gaps |
| [`code-quality-audit.md`](code-quality-audit.md) | Code quality | Type safety theater (`as` casts), duplication, testing gaps — ~~25 pre-existing test failures~~ ✅ all fixed |
| [`data-integrity-audit.md`](data-integrity-audit.md) | Database | 7 dead tables, 25 FK orphan risks, three-schema disagreement, role value mismatches |
| [`ci-cd-audit.md`](ci-cd-audit.md) | CI/CD | No Dependabot, no coverage enforcement, no deploy previews, script injection (fixed) |

## Severity Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | ~15 | Most fixed in audit pass (CSPRNG OTP, script injection, cache auth bypass) |
| HIGH | ~30 | Partially addressed (cascade deletion, column mismatches, quality gates) |
| MEDIUM | ~80 | Documented, prioritized for future sprints |
| LOW | ~50+ | Tracked for incremental improvement |

## What Was Fixed (2026-02-26 Audit Pass)

- ✅ `Math.random()` OTP → CSPRNG (`crypto.getRandomValues`)
- ✅ Max password length (128 chars)
- ✅ Cache middleware auth bypass
- ✅ Account deletion cascade (FK cleanup)
- ✅ Judge-portal column mismatches (3 fixes)
- ✅ Hackathon route deduplication
- ✅ Cron cascade failure isolation
- ✅ CI/CD quality gates (typecheck + lint + test before deploy)
- ✅ Script injection in deploy-hackathon-site.yml
- ✅ Turbo pinned from `"latest"` to `"^2.5.0"`
- ✅ Dual lockfile removed (package-lock.json)
- ✅ Seed data role alignment
- ✅ Zod schema alignment with DB columns
- ✅ Schema timestamp defaults

## What Was Fixed (Post-Audit: 2026-02-27 — 2026-02-28)

- ✅ All 25 pre-existing test failures resolved (223 tests passing, 0 failures)
- ✅ 17 broken database indexes fixed in `0000_schema.sql`
- ✅ Migrations consolidated from 3 files to 2 (removed stale `0002_add_password_must_change.sql`)
- ✅ Queue handler column fixes (`push-handler.ts`, `installation-handler.ts` — now use `repo_full_name`)
- ✅ Cron `backfillAuditHashes` type error fixed
- ✅ `team-repos.ts` response transformation (parse `repo_full_name` → `github_owner`/`github_repo`)
- ✅ `workspaces.ts` member query field aliasing fix
- ✅ `user-flows.md` comprehensive rewrite

## Reading Order

1. Start with `COMPREHENSIVE-DEBT-AUDIT.md` for the full item list
2. Read `security-audit.md` for prioritized security remediation
3. Read `backend-architecture-critique.md` for architectural decisions
4. Remaining docs as needed per work area
