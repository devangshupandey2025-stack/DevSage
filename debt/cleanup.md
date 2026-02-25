# Cleanup Tasks

Small fixes and housekeeping items.

---

## Files to Remove

### 1. `/homw.tsx` (root)
- **Issue:** Misplaced file at repository root. Contains a generic stub React component. Likely a typo of "home.tsx".
- **Not imported anywhere.** Safe to delete.

### 2. Better Auth Schema Tables (if confirmed unused)
- **Files:** `packages/db/src/schema/` — `account`, `session`, `verification`, `passkey`, `user` (the auth.user table, not the main `users` table)
- **Action:** Grep codebase for references. If unused, remove from schema and generate cleanup migration.

---

## Debug Logging to Remove

### 1. `apps/platform/src/pages/announcements.tsx`
- **Line 53:** `console.log('[announcements] Fetch result:', { ok: res.ok, count: res.data?.length ?? 0, data: res.data });`
- **Line 72:** `console.log('[announcements] Create result:', res);`
- **Action:** Remove both. Violates project lint rule (console.log banned).

---

## Vitest Config Fix

### 1. `apps/web/vitest.config.ts`
- **Issue:** Config exists but doesn't define test include patterns.
- **Action:** Add `include: ['src/**/*.test.{ts,tsx}']` to the config (or remove config until tests are written to avoid false "0 tests passed" signal).

---

## Documentation Sync

### 1. `AGENTS.md` — Structure section mentions `templates/` directory
- **Issue:** `templates/` directory does not exist in this repo. The hackathon site template lives in a separate repo (`SHIKDD-org/hackathon-template`).
- **Action:** Update AGENTS.md to clarify templates are external, or remove the `templates/` entry.

### 2. `docs/api/` path reference
- **Issue:** AGENTS.md says "docs/api/ — API endpoint documentation (14 files)" but actual docs are at `docs/` (flat, 6 files including `api-contracts.md`).
- **Action:** Update AGENTS.md to reflect actual docs structure.
