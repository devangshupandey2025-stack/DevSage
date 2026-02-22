interface Recipient {
  user_id: string;
  email: string;
}

export async function resolveNotificationRecipients(
  db: D1Database,
  type: string,
  hackathonId?: string,
  data?: Record<string, unknown>
): Promise<Recipient[]> {
  if (!hackathonId) return [];

  switch (type) {
    case 'judge.invited': {
      // Notify the invited judge (the user being invited, not organizers)
      const userId = data?.user_id as string | undefined;
      if (!userId) return [];
      const user = await db
        .prepare('SELECT id as user_id, email FROM users WHERE id = ?')
        .bind(userId)
        .first<Recipient>();
      return user ? [user] : [];
    }

    case 'submission.received':
    case 'submission.validated':
    case 'submission.tag_deleted': {
      // Notify team members + organizers
      const teamId = data?.team_id as string | undefined;
      if (!teamId) return getOrganizers(db, hackathonId);

      const teamMembers = await db.prepare(`
        SELECT u.id as user_id, u.email
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
      `).bind(teamId).all<Recipient>();

      const organizers = await getOrganizers(db, hackathonId);
      return dedup([...(teamMembers.results || []), ...organizers]);
    }

    case 'force_push_detected':
      // Notify organizers only
      return getOrganizers(db, hackathonId);

    case 'hackathon.judging_started':
    case 'results.published': {
      // Notify all participants + judges + organizers
      const all = await db.prepare(`
        SELECT DISTINCT u.id as user_id, u.email FROM users u WHERE u.id IN (
          SELECT user_id FROM organizer_roles WHERE hackathon_id = ?
          UNION
          SELECT user_id FROM judges WHERE hackathon_id = ? AND user_id IS NOT NULL
          UNION
          SELECT tm.user_id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE t.hackathon_id = ?
        )
      `).bind(hackathonId, hackathonId, hackathonId).all<Recipient>();
      return all.results || [];
    }

    case 'team_joined': {
      const teamId = data?.team_id as string | undefined;
      if (!teamId) return [];
      const members = await db.prepare(`
        SELECT u.id as user_id, u.email
        FROM team_members tm JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
      `).bind(teamId).all<Recipient>();
      return members.results || [];
    }

    case 'deadline_reminder': {
      // All team members in hackathon
      const members = await db.prepare(`
        SELECT DISTINCT u.id as user_id, u.email
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN users u ON tm.user_id = u.id
        WHERE t.hackathon_id = ? AND t.ready = 1
      `).bind(hackathonId).all<Recipient>();
      return members.results || [];
    }

    // ── Hackathon creation request notifications ─────────────
    case 'hackathon.request.submitted': {
      // Notify all platform admins
      const admins = await db.prepare(
        `SELECT u.id as user_id, u.email FROM platform_admins pa JOIN users u ON pa.user_id = u.id`
      ).all<Recipient>();
      return admins.results || [];
    }

    case 'hackathon.request.under_review':
    case 'hackathon.request.building': {
      // Notify only the requesting organizer (in-app only style)
      const requestedBy = data?.requested_by as string | undefined;
      if (!requestedBy) return [];
      const user = await db.prepare('SELECT id as user_id, email FROM users WHERE id = ?').bind(requestedBy).first<Recipient>();
      return user ? [user] : [];
    }

    case 'hackathon.request.approved':
    case 'hackathon.request.ready': {
      // Notify requesting organizer + workspace members
      const reqBy = data?.requested_by as string | undefined;
      const wsId = data?.workspace_id as string | undefined;
      if (!reqBy) return [];
      const requester = await db.prepare('SELECT id as user_id, email FROM users WHERE id = ?').bind(reqBy).first<Recipient>();
      const wsMembers = wsId ? await db.prepare(
        `SELECT u.id as user_id, u.email FROM workspace_members wm JOIN users u ON wm.user_id = u.id WHERE wm.workspace_id = ?`
      ).bind(wsId).all<Recipient>() : { results: [] };
      return dedup([...(requester ? [requester] : []), ...(wsMembers.results || [])]);
    }

    case 'hackathon.request.rejected':
    case 'hackathon.request.changes_requested': {
      // Notify requesting organizer (with reason)
      const rb = data?.requested_by as string | undefined;
      if (!rb) return [];
      const u = await db.prepare('SELECT id as user_id, email FROM users WHERE id = ?').bind(rb).first<Recipient>();
      return u ? [u] : [];
    }

    default:
      return getOrganizers(db, hackathonId);
  }
}

async function getOrganizers(db: D1Database, hackathonId: string): Promise<Recipient[]> {
  const result = await db.prepare(`
    SELECT u.id as user_id, u.email
    FROM organizer_roles o JOIN users u ON o.user_id = u.id
    WHERE o.hackathon_id = ?
  `).bind(hackathonId).all<Recipient>();
  return result.results || [];
}

function dedup(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  return recipients.filter(r => {
    if (seen.has(r.user_id)) return false;
    seen.add(r.user_id);
    return true;
  });
}
