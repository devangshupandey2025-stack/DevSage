/**
 * Round-robin assignment: distribute submissions evenly across judges.
 */
export async function assignSubmissionsRoundRobin(
  db: D1Database,
  hackathonId: string,
  roundId?: string
): Promise<{ assigned: number }> {
  // Get accepted judges for this hackathon
  const judges = await db.prepare(
    'SELECT id FROM judges WHERE hackathon_id = ? AND invite_status = ?'
  ).bind(hackathonId, 'accepted').all<{ id: string }>();

  if (!judges.results || judges.results.length === 0) {
    return { assigned: 0 };
  }

  // Get current submissions that need assignment
  let submissionQuery = 'SELECT s.id FROM submissions s WHERE s.hackathon_id = ? AND s.is_current = 1 AND s.status = ?';
  const params: unknown[] = [hackathonId, 'validated'];

  if (roundId) {
    submissionQuery += ' AND s.round_id = ?';
    params.push(roundId);
  }

  const submissions = await db.prepare(submissionQuery).bind(...params).all<{ id: string }>();
  if (!submissions.results || submissions.results.length === 0) {
    return { assigned: 0 };
  }

  // Get existing assignments to avoid duplicates
  const existing = await db.prepare(
    'SELECT judge_id, submission_id FROM judge_assignments WHERE hackathon_id = ?'
  ).bind(hackathonId).all<{ judge_id: string; submission_id: string }>();

  const existingSet = new Set(
    (existing.results || []).map(a => `${a.judge_id}:${a.submission_id}`)
  );

  // Round-robin assign
  let assigned = 0;
  const judgeIds = judges.results.map(j => j.id);
  let judgeIndex = 0;

  for (const sub of submissions.results) {
    const judgeId = judgeIds[judgeIndex % judgeIds.length];
    const key = `${judgeId}:${sub.id}`;

    if (!existingSet.has(key)) {
      const id = crypto.randomUUID();
      await db.prepare(
        'INSERT OR IGNORE INTO judge_assignments (id, judge_id, submission_id, hackathon_id) VALUES (?, ?, ?, ?)'
      ).bind(id, judgeId, sub.id, hackathonId).run();
      assigned++;
    }

    judgeIndex++;
  }

  return { assigned };
}

/**
 * Compute leaderboard with two-level aggregation.
 * 1. Per-judge: sum(score/max_score * weight * 100) for each submission
 * 2. Cross-judge: avg of per-judge totals for each team
 */
export async function computeLeaderboard(
  db: D1Database,
  hackathonId: string,
  roundId?: string,
  trackId?: string
): Promise<Array<{
  team_id: string;
  team_name: string;
  total_score: number;
  rank: number;
  judge_count: number;
}>> {
  let query = `
    SELECT
      t.id as team_id,
      t.name as team_name,
      AVG(judge_total) as total_score,
      COUNT(DISTINCT s2.judge_id) as judge_count
    FROM (
      SELECT
        s.judge_id,
        sub.team_id,
        SUM(CAST(s.score AS REAL) / rc.max_score * rc.weight * 100) as judge_total
      FROM scores s
      JOIN rubric_criteria rc ON s.criterion_id = rc.id
      JOIN submissions sub ON s.submission_id = sub.id
      WHERE s.hackathon_id = ?
        AND sub.is_current = 1
  `;

  const params: unknown[] = [hackathonId];

  if (roundId) {
    query += ' AND sub.round_id = ?';
    params.push(roundId);
  }

  query += `
      GROUP BY s.judge_id, sub.team_id
    ) s2
    JOIN teams t ON s2.team_id = t.id
  `;

  if (trackId) {
    query += ' WHERE t.track_id = ?';
    params.push(trackId);
  }

  query += `
    GROUP BY s2.team_id
    ORDER BY total_score DESC
  `;

  const results = await db.prepare(query).bind(...params)
    .all<{ team_id: string; team_name: string; total_score: number; judge_count: number }>();

  if (!results.results) return [];

  return results.results.map((row, index) => ({
    ...row,
    total_score: Math.round(row.total_score * 100) / 100,
    rank: index + 1,
  }));
}
