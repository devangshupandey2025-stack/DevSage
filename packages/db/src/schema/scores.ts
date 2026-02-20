import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
  round: integer('round').notNull().default(1),
  scored_at: text('scored_at').notNull(),
}, (table) => ({
  submissionJudgeCriteriaRoundUniq: uniqueIndex('scores_submission_id_judge_id_criteria_id_round_unique').on(table.submission_id, table.judge_id, table.criteria_id, table.round),
  submissionIdx: index('idx_scores_submission').on(table.submission_id),
  judgeIdx: index('idx_scores_judge').on(table.judge_id),
}));
