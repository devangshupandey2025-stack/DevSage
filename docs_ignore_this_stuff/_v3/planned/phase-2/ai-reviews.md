# AI-Assisted Code Reviews

> Workers AI-powered automated code review on submissions.

## Overview

When a submission is captured (via tag), automatically analyze the code diff using Workers AI and generate review feedback. Results are stored and shown to judges as supplementary input.

## Flow

```
Tag webhook → Submission captured → Queue AI review job
  → Workers AI (LLM) → Generate review
  → Store in ai_reviews table
  → Notify team + judges
```

## Implementation

```ts
// apps/api/src/services/ai-review.ts
export async function generateAIReview(
  env: Env,
  submission: Submission,
  diff: string
): Promise<AIReview> {
  const prompt = buildReviewPrompt(submission, diff);

  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: 'You are a code reviewer for a hackathon...' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1000,
  });

  return {
    submission_id: submission.id,
    model: '@cf/meta/llama-3.1-8b-instruct',
    summary: response.response,
    created_at: new Date().toISOString(),
  };
}
```

## New Binding

```jsonc
// wrangler.jsonc (Phase 2 addition)
"ai": { "binding": "AI" }
```

## New Table

```sql
CREATE TABLE ai_reviews (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  model TEXT NOT NULL,
  summary TEXT NOT NULL,
  score_suggestion REAL,
  created_at TEXT NOT NULL
);
```

## Review Criteria

The AI evaluates:
- Code quality and readability
- README completeness
- Security concerns
- Architecture patterns
- Innovation factor

## Prerequisites

- Submissions system (Phase 1)
- GitHub webhook pipeline (Phase 1)
- Workers AI binding (`AI`)

## Notes

- AI reviews are advisory — judges make final decisions
- Rate limit AI calls: max 1 review per submission
- Use fail-open pattern: if AI is unavailable, submission proceeds without review
- Workers AI pricing: pay-per-token (varies by model)
