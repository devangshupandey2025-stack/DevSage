import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { submissions } from './submissions.js';
import { judges } from './judges.js';
import { rubricCriteria } from './rubric-criteria.js';

export const scores = sqliteTable('scores', {
  id: text('id').primaryKey(),
  submission_id: text('submission_id').notNull().references(() => submissions.id),
  judge_id: text('judge_id').notNull().references(() => judges.id),
  criteria_id: text('criteria_id').notNull().references(() => rubricCriteria.id),
  score: integer('score').notNull(),
  comment: text('comment'),
  scored_at: text('scored_at').notNull(),
}, (table) => ({
  uniqueSubmissionJudgeCriteria: unique().on(table.submission_id, table.judge_id, table.criteria_id),
  idxScoresSubmission: index('idx_scores_submission').on(table.submission_id),
  idxScoresJudge: index('idx_scores_judge').on(table.judge_id),
}));
