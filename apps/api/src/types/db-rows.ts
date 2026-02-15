/**
 * Shared row-level interfaces for raw D1 query results.
 *
 * These are used by queue handlers that query D1 directly (via prepared
 * statements) rather than through the Drizzle ORM client.
 */

/** Minimal team repo row returned by raw D1 lookups in queue handlers. */
export interface TeamRepoRow {
  id: string;
  team_id: string;
  hackathon_id: string;
  repo_full_name: string;
}

/** Minimal hackathon row for submission-related queries. */
export interface HackathonRow {
  submission_tag_pattern: string;
}

/** Minimal round row for deadline-related queries. */
export interface RoundRow {
  id: string;
  hackathon_id: string;
  round_number: number;
  status: string;
  submission_deadline: string | null;
}
