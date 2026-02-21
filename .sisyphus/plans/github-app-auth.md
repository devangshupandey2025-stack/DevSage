# GitHub App Authentication Implementation

## TL;DR

> **Quick Summary**: Implement GitHub App JWT authentication to enable the DevSage bot to post commit statuses on submissions. The codebase already has tag-based submission infrastructure; this completes the authentication piece that currently has a TODO.
> 
> **Deliverables**:
> - RS256 JWT signing function for GitHub App auth
> - Updated `getInstallationToken()` with full GitHub App flow
> - New secrets: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`
> - Comprehensive test suite
> - Updated environment types
> 
> **Estimated Effort**: Short (2-3 hours)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 7

---

## Context

### Original Request
Add a GitHub bot that can receive submissions based on tags.

### Current State
The DevSage platform already has comprehensive tag-based submission infrastructure:
- Webhook receiver at `/webhooks/github` with HMAC verification
- Tag processing via queue (`tag-create-handler.ts`)
- Exactly-once submission locking via Durable Objects
- Commit status posting via `postCommitStatus()`

**What's Missing**: The `getInstallationToken()` function in `apps/api/src/services/github.ts` has a TODO for GitHub App JWT authentication. Currently it only returns cached tokens and warns if not cached.

### Metis Review Findings
**Critical Gap**: Algorithm mismatch - existing JWT uses HS256 (HMAC), but GitHub App requires RS256 (RSA-SHA256). This requires a completely new `signAppJWT()` function, not just completing the TODO.

**Other Gaps Addressed**:
- Private key multiline PEM handling
- TTL configuration (using 55 min to stay under GitHub's 60-min limit)
- Error handling for malformed keys, API failures, rate limits
- Testing strategy for RSA operations
- Type safety improvements

---

## Work Objectives

### Core Objective
Implement GitHub App JWT authentication so the DevSage bot can reliably post commit statuses on team submissions.

### Concrete Deliverables
1. `signAppJWT()` function using `crypto.subtle` with RS256
2. Updated `getInstallationToken()` with full JWT → token exchange flow
3. `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` environment bindings
4. Test suite covering JWT signing, token exchange, caching, error cases
5. Updated environment type definitions

### Definition of Done
- [ ] `bun test apps/api/src/__tests__/github.test.ts` → all tests pass
- [ ] Manual test: submission tag triggers commit status update
- [ ] No TypeScript errors (`pnpm typecheck` passes)

### Must Have
- RS256 JWT signing for GitHub App authentication
- Token caching in KV (55-minute TTL)
- Fail-open error handling (never throw, log warnings)
- Proper error handling for 401/403/rate limits
- Complete test coverage

### Must NOT Have (Guardrails)
- No PR/issue commenting (out of scope)
- No changes to tag processing logic
- No database schema changes
- No external JWT libraries (use `crypto.subtle` only)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest + @cloudflare/vitest-pool-workers)
- **Automated tests**: Tests-after (implement then test)
- **Framework**: bun test / vitest
- **Style**: Integration tests with mocked GitHub API

### QA Policy
Every task includes agent-executed QA scenarios using Playwright or Bash.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - can all start immediately):
├── Task 1: Update environment types and wrangler config
├── Task 2: Update KV constants (TTL 55 min)
└── Task 3: Implement RS256 JWT signing (signAppJWT)

Wave 2 (Core Implementation - after Wave 1):
├── Task 4: Update getInstallationToken() with GitHub App flow
└── Task 5: Add comprehensive error handling

Wave 3 (Testing & Verification - after Wave 2):
├── Task 6: Write test suite for GitHub service
└── Task 7: Manual integration test

Wave FINAL (Review - after ALL):
├── Task F1: Plan compliance audit (oracle)
└── Task F2: Code quality review (unspecified-high)
```

### Dependency Matrix

- **1**: — — 3, 4, 1
- **2**: — — 4, 2
- **3**: 1 — 4, 5, 3
- **4**: 1, 2, 3 — 5, 6, 4
- **5**: 4 — 6, 5
- **6**: 4, 5 — 7, 6
- **7**: 6 — F1, F2, 7

Critical Path: Task 1 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → F1-F2

### Agent Dispatch Summary

- **1**: **3** → T1 (`quick`), T2 (`quick`), T3 (`unspecified-high`)
- **2**: **2** → T4 (`unspecified-high`), T5 (`unspecified-high`)
- **3**: **2** → T6 (`deep`), T7 (`unspecified-high`)
- **FINAL**: **2** → F1 (`oracle`), F2 (`unspecified-high`)

---

## TODOs