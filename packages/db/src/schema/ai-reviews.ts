import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { submissions } from './submissions.js';

export const aiReviews = sqliteTable('ai_reviews', {
  id: text('id').primaryKey(),
  submission_id: text('submission_id').notNull().references(() => submissions.id),
  commit_sha: text('commit_sha').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  prompt_hash: text('prompt_hash').notNull(),
  prompt_template_version: text('prompt_template_version').notNull(),
  summary: text('summary'),
  strengths: text('strengths'),
  concerns: text('concerns'),
  raw_response: text('raw_response'),
  tokens_used: integer('tokens_used'),
  latency_ms: integer('latency_ms'),
  created_at: text('created_at').notNull(),
}, (table) => ({
  idxAiReviewsSubmission: index('idx_ai_reviews_submission').on(table.submission_id),
  idxAiReviewsCommitSha: index('idx_ai_reviews_commit_sha').on(table.commit_sha),
}));
