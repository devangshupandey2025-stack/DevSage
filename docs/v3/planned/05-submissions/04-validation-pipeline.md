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

```ts
// In tag-create-handler, after DO accepts:
async function validateSubmission(env: Env, submission: Submission, teamRepo: TeamRepo) {
  const results: ValidationResult[] = [];
  const githubToken = await getInstallationToken(env, teamRepo.github_installation_id);

  // 1. Check README
  try {
    const readme = await fetch(
      `https://api.github.com/repos/${teamRepo.github_owner}/${teamRepo.github_repo}/contents/README.md?ref=${submission.commit_sha}`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );
    results.push({ check: 'readme', passed: readme.ok });

    // 2. Scan README for demo URL
    if (readme.ok) {
      const content = atob((await readme.json()).content);
      const urlRegex = /https?:\/\/[^\s)]+/g;
      const urls = content.match(urlRegex) || [];
      results.push({ check: 'demo_url', passed: urls.length > 0, detail: urls[0] });
    }
  } catch {
    results.push({ check: 'readme', passed: false });
  }

  // 3. Check commit exists
  try {
    const commit = await fetch(
      `https://api.github.com/repos/${teamRepo.github_owner}/${teamRepo.github_repo}/commits/${submission.commit_sha}`,
      { headers: { Authorization: `Bearer ${githubToken}` } }
    );
    results.push({ check: 'commit_valid', passed: commit.ok });
  } catch {
    results.push({ check: 'commit_valid', passed: false });
  }

  // 4. Update submission status
  const allPassed = results.every(r => r.passed);
  await db.update(submissions)
    .set({
      status: allPassed ? 'validated' : 'failed_validation',
      validation_results: JSON.stringify(results),
      validated_at: new Date().toISOString(),
    })
    .where(eq(submissions.id, submission.id));

  return results;
}
```

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
