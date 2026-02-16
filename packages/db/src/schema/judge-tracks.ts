import { sqliteTable, text, unique, index } from 'drizzle-orm/sqlite-core';
import { judges } from './judges.js';
import { hackathonTracks } from './hackathon-tracks.js';

export const judgeTracks = sqliteTable('judge_tracks', {
  id: text('id').primaryKey(),
  judge_id: text('judge_id').notNull().references(() => judges.id, { onDelete: 'cascade' }),
  track_id: text('track_id').notNull().references(() => hackathonTracks.id, { onDelete: 'cascade' }),
}, (table) => ({
  uniqueJudgeTrack: unique().on(table.judge_id, table.track_id),
  idxJudgeTracksJudge: index('idx_judge_tracks_judge').on(table.judge_id),
  idxJudgeTracksTrack: index('idx_judge_tracks_track').on(table.track_id),
}));
