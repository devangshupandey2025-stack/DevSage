# Blind Judging Mode

> Hide team identities from judges for unbiased scoring.

## How It Works

When `hackathon.settings.blind_judging = true`:

1. Judge dashboard shows submissions with anonymous identifiers (e.g., "Team A", "Team B")
2. Real team names, member names, and GitHub usernames are hidden
3. Repository URLs are visible (judges need to see code) but team identity metadata is stripped
4. Scores table doesn't expose team→submission mappings to judges

## Implementation

### API Layer

When serving submissions to judges in blind mode:

```ts
function anonymizeForJudge(submission: Submission, index: number, isBlind: boolean) {
  if (!isBlind) return submission;

  return {
    ...submission,
    team_name: `Team ${String.fromCharCode(65 + index)}`, // A, B, C...
    team_id: submission.team_id, // kept for scoring (backend needs it)
    members: [], // hidden
    github_repo_url: submission.github_repo_url, // visible (code review needed)
  };
}
```

### Judge Assignment Endpoint

```
GET /api/v1/hackathons/:slug/judges/me/assignments
```

In blind mode, this endpoint returns anonymized submission data. The `team_id` is still present (needed to submit scores) but team metadata is stripped.

### Score Submission

Scoring works identically — judges submit scores against `submission_id`. The backend resolves team identity internally.

## What's Hidden vs Visible

| Data | Visible in Blind Mode? |
|------|:---------------------:|
| Code (via GitHub repo) | ✅ |
| Commit history | ✅ |
| README content | ✅ |
| Tag name | ✅ |
| Team name | ❌ (replaced with "Team A", "Team B") |
| Team members | ❌ |
| GitHub usernames | ❌ (commit author visible in code, unavoidable) |
| Track | ✅ |

## Limitations

- Git commit history includes author names — this cannot be hidden without modifying the repo
- If teams include identifying info in their README or code, blind mode doesn't help
- Blind mode is informational — it relies on the UI not showing team names, not cryptographic guarantees

## Configuration

```ts
// Set during hackathon configuration
PATCH /api/v1/hackathons/:slug
Body: { settings: { blind_judging: true } }
```

Can only be changed before judging starts (not during).

## Implementation Notes

- Anonymization happens at the API layer, not in the database
- The same anonymized names must be consistent for a judge across requests (keyed by `hackathon_id + judge_id + submission sort order`)
- Organizers always see real team names (they configure, not judge)
