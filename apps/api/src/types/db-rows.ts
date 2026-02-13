/**
 * Shared row-level interfaces for raw D1 query results.
 *
 * These are used by queue handlers that query D1 directly (via prepared
 * statements) rather than through the Drizzle ORM client.
 */

/** Minimal team row returned by raw D1 lookups in queue handlers. */
export interface TeamRow {
  id: string;
  hackathon_id: string;
}

/** Minimal hackathon row for submission-related queries. */
export interface HackathonRow {
  submission_tag_pattern: string;
  submission_deadline: string;
}
