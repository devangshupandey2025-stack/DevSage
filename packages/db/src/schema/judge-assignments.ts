import { sqliteTable, text, unique, index } from 'drizzle-orm/sqlite-core';
import { judges } from './judges.js';
import { teams } from './teams.js';
import { hackathons } from './hackathons.js';
import { submissions } from './submissions.js';

export const judgeAssignments = sqliteTable('judge_assignments', {
  id: text('id').primaryKey(),
  judge_id: text('judge_id').notNull().references(() => judges.id, { onDelete: 'cascade' }),
  team_id: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  hackathon_id: text('hackathon_id').notNull().references(() => hackathons.id, { onDelete: 'cascade' }),
  submission_id: text('submission_id').references(() => submissions.id),
  status: text('status', { enum: ['pending', 'in_progress', 'completed'] }).notNull().default('pending'),
  assigned_at: text('assigned_at').notNull(),
}, (table) => ({
  uniqueJudgeTeam: unique().on(table.judge_id, table.team_id),
  idxJudgeAssignmentsJudge: index('idx_judge_assignments_judge').on(table.judge_id),
  idxJudgeAssignmentsHackathon: index('idx_judge_assignments_hackathon').on(table.hackathon_id),
}));
