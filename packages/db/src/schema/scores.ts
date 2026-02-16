import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { submissions } from './submissions.js';
import { judges } from './judges.js';
import { rubricCriteria } from './rubric-criteria.js';
import { judgeAssignments } from './judge-assignments.js';

export const scores = sqliteTable('scores', {
  id: text('id').primaryKey(),
  submission_id: text('submission_id').notNull().references(() => submissions.id),
  judge_id: text('judge_id').notNull().references(() => judges.id),
  criteria_id: text('criteria_id').notNull().references(() => rubricCriteria.id),
  assignment_id: text('assignment_id').notNull().references(() => judgeAssignments.id),
  score: integer('score').notNull(),
  comment: text('comment'),
  is_submitted: integer('is_submitted').notNull().default(0),
  round: integer('round').notNull().default(1),
  scored_at: text('scored_at').notNull(),
  created_at: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueSubmissionJudgeCriteriaRound: unique().on(table.submission_id, table.judge_id, table.criteria_id, table.round),
  idxScoresSubmission: index('idx_scores_submission').on(table.submission_id),
  idxScoresJudge: index('idx_scores_judge').on(table.judge_id),
}));
