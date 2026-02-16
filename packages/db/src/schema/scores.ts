import { sqliteTable, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { hackathons } from './hackathons.js';
import { submissions } from './submissions.js';
import { judges } from './judges.js';
import { rubricCriteria } from './rubric-criteria.js';

export const scores = sqliteTable('scores', {
  id: text('id').primaryKey(),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  submission_id: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  judge_id: text('judge_id').notNull().references(() => judges.id, { onDelete: 'cascade' }),
  criterion_id: text('criterion_id').notNull().references(() => rubricCriteria.id, { onDelete: 'cascade' }),
  score: real('score').notNull(),
  notes: text('notes'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updated_at: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  judgeSubmissionCriterionUniq: uniqueIndex('uq_scores_judge_submission_criterion').on(table.judge_id, table.submission_id, table.criterion_id),
  submissionIdx: index('idx_scores_submission').on(table.submission_id),
  judgeIdx: index('idx_scores_judge').on(table.judge_id),
}));
