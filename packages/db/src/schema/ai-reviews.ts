import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { submissions } from './submissions.js';

export const aiReviews = sqliteTable('ai_reviews', {
  id: text('id').primaryKey(),
  submission_id: text('submission_id').notNull().references(() => submissions.id),
  commit_sha: text('commit_sha').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  prompt_hash: text('prompt_hash').notNull(),
  summary: text('summary'),
  strengths: text('strengths'),
  concerns: text('concerns'),
  raw_response: text('raw_response'),
  tokens_used: integer('tokens_used'),
  created_at: text('created_at').notNull(),
});
