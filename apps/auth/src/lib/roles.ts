export interface UserRoles {
  platformAdmin: boolean;
  hackathonRoles: Record<string, string[]>;
  workspaceRoles: Record<string, string>;
}

export async function getUserRoles(db: D1Database, userId: string): Promise<UserRoles> {
  const [adminRow, orgRows, judgeRows, wsRows] = await Promise.all([
    db.prepare('SELECT 1 FROM platform_admins WHERE user_id = ?').bind(userId).first(),
    db.prepare(`
      SELECT h.slug, o.role FROM organizer_roles o
      JOIN hackathons h ON h.id = o.hackathon_id
      WHERE o.user_id = ?
    `).bind(userId).all(),
    db.prepare(`
      SELECT h.slug FROM judges j
      JOIN hackathons h ON h.id = j.hackathon_id
      WHERE j.user_id = ?
    `).bind(userId).all(),
    db.prepare(`
      SELECT workspace_id, role FROM workspace_members WHERE user_id = ?
    `).bind(userId).all(),
  ]);

  const hackathonRoles: Record<string, string[]> = {};

  for (const row of (orgRows.results || []) as Array<{ slug: string; role: string }>) {
    if (!hackathonRoles[row.slug]) hackathonRoles[row.slug] = [];
    hackathonRoles[row.slug].push(row.role);
  }

  for (const row of (judgeRows.results || []) as Array<{ slug: string }>) {
    if (!hackathonRoles[row.slug]) hackathonRoles[row.slug] = [];
    if (!hackathonRoles[row.slug].includes('judge')) {
      hackathonRoles[row.slug].push('judge');
    }
  }

  const workspaceRoles: Record<string, string> = {};
  for (const row of (wsRows.results || []) as Array<{ workspace_id: string; role: string }>) {
    workspaceRoles[row.workspace_id] = row.role;
  }

  return {
    platformAdmin: !!adminRow,
    hackathonRoles,
    workspaceRoles,
  };
}
