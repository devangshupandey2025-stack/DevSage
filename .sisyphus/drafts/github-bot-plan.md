# Draft: GitHub Bot for Tag-Based Submissions

## Research Findings

### Current State Analysis

The DevSage platform **already has extensive infrastructure** for tag-based submissions:

#### What's Already Implemented:

1. **Webhook Infrastructure** (`apps/api/src/routes/webhooks.ts`)
   - HMAC signature verification (constant-time via double-HMAC)
   - Event normalization via `normalizeGitHubEvent()`
   - Queue-based async processing
   - Webhook delivery tracking in `webhook_deliveries` table

2. **Tag Processing** (`apps/api/src/queue/tag-create-handler.ts`)
   - Processes `github_tag_created` events from queue
   - Validates tag against configurable pattern (`submission_tag_pattern` in hackathons table)
   - Default pattern: `submission-v*` (glob-style wildcards supported)
   - Uses Durable Object (`HackathonStateMachine`) for exactly-once submission locking
   - Creates submission records in D1 database
   - Posts commit status to GitHub API
   - Sends notifications via `NOTIFICATION_QUEUE`
   - Audit logging for all submissions

3. **Database Schema**
   - `submissions` table with fields: id, hackathon_id, team_id, tag_name, commit_sha, status, etc.
   - `team_repos` table linking teams to GitHub repos with `installation_id`
   - `hackathons` table has `submission_tag_pattern` and `allow_resubmission` fields
   - `webhook_deliveries` for idempotency

4. **GitHub Service** (`apps/api/src/services/github.ts`)
   - `postCommitStatus()` - Posts status checks to commits
   - `getTagSha()` - Resolves tag to commit SHA
   - `getInstallationToken()` - **INCOMPLETE** (has TODO for JWT signing)

5. **Durable Object State Machine** (`apps/api/src/durable-objects/hackathon-state-machine.ts`)
   - `handleAcceptSubmission()` - Exactly-once locking per team:tag combination
   - SQLite-backed storage for submission locks
   - State transitions: draft → active → judging → completed → archived

#### What's Missing (The "Bot" Features):

1. **GitHub App Authentication**
   - Need to implement JWT signing for GitHub App authentication
   - Required secrets: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`
   - Installation token exchange logic incomplete

2. **Enhanced Bot Feedback**
   - No PR/issue comments about submission status
   - Limited feedback beyond commit status
   - No validation error messages posted back to GitHub

3. **GitHub App Management**
   - No setup flow for installing GitHub App on team repos
   - No webhook URL configuration guidance

## User Requirements (CONFIRMED)

Based on consultation:

1. **Scope**: Complete GitHub App authentication (finish the TODO in `getInstallationToken()`)
2. **GitHub App**: User already has a GitHub App created
3. **Bot Behavior**: Commit status only - no PR/issue commenting needed

## Scope Decisions

### IN Scope:
- Implement JWT signing for GitHub App authentication
- Add new secrets: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`
- Update `getInstallationToken()` to work with GitHub App
- Test token exchange flow
- Update environment type definitions
- Add tests for new authentication flow

### OUT of Scope:
- PR/issue commenting features
- GitHub App creation/setup (user already has one)
- Webhook URL configuration
- New submission validation logic
- Changes to tag processing flow
- Database schema changes

## Technical Decisions Needed

### GitHub App Permissions Required:
- `contents:read` - Read repo contents
- `metadata:read` - Read repo metadata
- `statuses:write` - Post commit status (already used)
- `pull_requests:write` - Comment on PRs (if desired)
- `issues:write` - Comment on issues (if desired)

### Webhook Events to Subscribe:
- `push` - Already handled (commit logging)
- `create` (tags) - Already handled (submissions)
- `delete` (tags) - Already handled
- `installation` - Already handled
- `installation_repositories` - Already handled

### Secrets to Add:
- `GITHUB_APP_ID` - GitHub App ID
- `GITHUB_APP_PRIVATE_KEY` - PEM private key for JWT signing

## Recommended Approach

Given the existing infrastructure, the work breaks down into:

### Phase 1: GitHub App Authentication (Core)
- Implement JWT signing in `getInstallationToken()`
- Add new secrets to wrangler config
- Test token exchange flow

### Phase 2: Enhanced Bot Feedback (Optional)
- Add PR/issue commenting service
- Update tag handler to post validation feedback
- Handle resubmission scenarios

### Phase 3: Setup & Documentation (Optional)
- Create GitHub App setup guide
- Add webhook configuration UI/docs
- Document permission requirements

## Files to Modify:

1. `apps/api/src/services/github.ts` - Add JWT signing, comment posting
2. `apps/api/src/queue/tag-create-handler.ts` - Add bot feedback
3. `apps/api/wrangler.jsonc` - Add new secrets
4. `apps/api/src/types/env.ts` - Add new env bindings
5. `apps/api/src/__tests__/github.test.ts` - Add tests for new functions
6. Documentation files

## External Dependencies:

- No new npm packages needed (can use `crypto.subtle` for JWT)
- GitHub App needs to be created in GitHub UI
- Webhook URL must be configured: `https://api.devsage.org/webhooks/github`
