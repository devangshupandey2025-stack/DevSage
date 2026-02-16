import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { judges } from './judges.js';
import { submissions } from './submissions.js';
import { hackathons } from './hackathons.js';

export const judgeAssignments = sqliteTable('judge_assignments', {
  id: text('id').primaryKey(),
  judge_id: text('judge_id').notNull().references(() => judges.id, { onDelete: 'cascade' }),
  submission_id: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
}, (table) => ({
  judgeSubmissionUniq: uniqueIndex('uq_judge_assignments_judge_submission').on(table.judge_id, table.submission_id),
  submissionIdx: index('idx_judge_assignments_submission').on(table.submission_id),
  hackathonIdx: index('idx_judge_assignments_hackathon').on(table.hackathon_id),
}));
