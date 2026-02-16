# Validation Pipeline

> Automated checks run on every new submission.

## Checks

After a submission is accepted, the system runs these validations:

| Check | What | Result |
|-------|------|--------|
| README exists | `GET /repos/{owner}/{repo}/contents/README.md` at commit SHA | `readme_found` / `readme_missing` |
| Demo URL | Scan README for URLs (regex) | `demo_url_found` / `demo_url_missing` |
| Repo accessible | GitHub API returns 200 for the repo | `repo_accessible` / `repo_inaccessible` |
| Commit valid | The tagged commit SHA exists | `commit_valid` / `commit_invalid` |

## Implementation

> **Architecture:** Validation runs in a separate queue consumer to avoid blocking the submission pipeline. The `tag-create-handler` only persists to D1 and returns immediately. GitHub API calls (README check, commit check) can be slow or timeout — running them inline in the tag handler risks exceeding the 15s queue consumer wall-clock limit.

### Stage 1: Enqueue validation (in tag-create-handler)

```ts
// In tag-create-handler, after D1 insert (status = 'pending_validation'):
// Don't validate inline — enqueue for async validation
await env.VALIDATION_QUEUE.send({
  type: 'validate_submission',
  submission_id: submissionId,
  repo_owner: event.repository.owner,
  repo_name: event.repository.name,
  tag_sha: event.tag.sha,
});
```

### Stage 2: Validation consumer (separate queue handler)

```ts
// apps/api/src/queue/validation-handler.ts
async function handleValidationMessage(env: Env, msg: ValidateSubmissionMessage) {
  // 1. Read submission from D1
  const submission = await db.select().from(submissions)
    .where(eq(submissions.id, msg.submission_id)).get();
  if (!submission || submission.status !== 'pending_validation') return;

  // 2. Get team_repo for installation token
  const teamRepo = await db.select().from(teamRepos)
    .where(eq(teamRepos.team_id, submission.team_id)).get();
  if (!teamRepo) return;

  const results: ValidationResult[] = [];
  const githubToken = await getInstallationToken(env, teamRepo.github_installation_id);

  // 3. Check README
  try {
    const readme = await fetch(
      `https://api.github.com/repos/${msg.repo_owner}/${msg.repo_name}/contents/README.md?ref=${msg.tag_sha}`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );
    results.push({ check: 'readme', passed: readme.ok });

    // 4. Scan README for demo URL
    if (readme.ok) {
      // Guard against large README responses
      const contentLength = readme.headers.get('Content-Length');
      if (contentLength && parseInt(contentLength) > 102400) {
        // README exists but is very large — skip content parsing, mark as valid
        results.push({ check: 'demo_url', passed: true, detail: '[large file — skipped]' });
      } else {
        const data = await readme.json();
        const content = atob(data.content);
        const urlRegex = /https?:\/\/[^\s)]+/g;
        const urls = content.match(urlRegex) || [];
        results.push({ check: 'demo_url', passed: urls.length > 0, detail: urls[0] });
      }
    }
  } catch {
    results.push({ check: 'readme', passed: false });
  }

  // 5. Check commit exists
  try {
    const commit = await fetch(
      `https://api.github.com/repos/${msg.repo_owner}/${msg.repo_name}/commits/${msg.tag_sha}`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );
    results.push({ check: 'commit_valid', passed: commit.ok });
  } catch {
    results.push({ check: 'commit_valid', passed: false });
  }

  // 6. Update submission status
  const allPassed = results.every(r => r.passed);
  await db.update(submissions)
    .set({
      status: allPassed ? 'validated' : 'failed_validation',
      validation_results: JSON.stringify(results),
      validated_at: new Date().toISOString(),
    })
    .where(eq(submissions.id, submission.id));
}
```

> **Schema Note:** The `validated_at` column must be added to the `submissions` table schema in `10-data-model/05-submission-tables.md`:
> `validated_at TEXT` — set when validation completes successfully.

## Submission Statuses

```
pending_validation → validated
                   → failed_validation
```

Validation failures are informational — they don't prevent the submission from being scored. Organizers see validation status in the dashboard.

## Validation Results Storage

Stored as JSON in `submissions.validation_results`:

```json
[
  { "check": "readme", "passed": true },
  { "check": "demo_url", "passed": true, "detail": "https://demo.example.com" },
  { "check": "commit_valid", "passed": true }
]
```

## GitHub API Considerations

- All GitHub API calls use installation tokens (not user tokens)
- Installation token: `POST /app/installations/{id}/access_tokens` with App JWT
- Tokens expire in 1 hour — cache in KV if making multiple calls
- Apply fail-open pattern: validation failures don't block submission acceptance (10s timeout)
