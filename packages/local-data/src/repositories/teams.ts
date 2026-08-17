/**
 * Teams repository — team CRUD, members, invites, local seeding.
 */

import { db } from "../db/database.js";
import type { TeamInviteRecord, TeamMemberRecord, TeamRecord, TeamRepoRecord } from "../db/schema.js";
import type { TeamMemberRole } from "@devsage/shared";
import { now, uuid } from "../lib/utils.js";

export interface CreateTeamInput {
  hackathon_id: string;
  name: string;
  track_id?: string | null;
  created_by: string;
}

export interface TeamMemberWithUser extends TeamMemberRecord {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    github_username: string | null;
  } | null;
}

export interface TeamWithDetails extends TeamRecord {
  members: TeamMemberWithUser[];
  repos: TeamRepoRecord[];
}

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => INVITE_CODE_ALPHABET[b % INVITE_CODE_ALPHABET.length]).join("");
}

export const teamsRepository = {
  async listByHackathon(hackathonId: string): Promise<TeamRecord[]> {
    return db.teams.where("hackathon_id").equals(hackathonId).toArray();
  },

  async getById(id: string): Promise<TeamRecord | undefined> {
    return db.teams.get(id);
  },

  async getByInviteCode(inviteCode: string): Promise<TeamRecord | undefined> {
    return db.teams.where("invite_code").equals(inviteCode).first();
  },

  async getWithDetails(id: string): Promise<TeamWithDetails | undefined> {
    const team = await this.getById(id);
    if (!team) return undefined;
    const [members, repos] = await Promise.all([
      this.members(id),
      db.teamRepos.where("team_id").equals(id).toArray(),
    ]);
    return { ...team, members, repos };
  },

  async create(input: CreateTeamInput): Promise<TeamRecord> {
    const record: TeamRecord = {
      id: uuid(),
      hackathon_id: input.hackathon_id,
      name: input.name,
      invite_code: generateInviteCode(),
      track_id: input.track_id ?? null,
      status: "forming",
      created_at: now(),
      updated_at: now(),
    };
    await db.transaction("rw", db.teams, db.teamMembers, async () => {
      await db.teams.add(record);
      await db.teamMembers.add({
        id: uuid(),
        team_id: record.id,
        user_id: input.created_by,
        role: "leader",
        joined_at: now(),
      });
    });
    return record;
  },

  async update(id: string, input: Partial<Pick<TeamRecord, "name" | "track_id" | "status">>): Promise<TeamRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: TeamRecord = { ...existing, ...input, updated_at: now() };
    await db.teams.put(updated);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await db.teams.delete(id);
    return true;
  },

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------

  async members(teamId: string): Promise<TeamMemberWithUser[]> {
    const rows = await db.teamMembers.where("team_id").equals(teamId).toArray();
    return Promise.all(
      rows.map(async (row) => {
        const user = await db.users.get(row.user_id);
        return {
          ...row,
user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url,
            github_username: user.github_username,
          }
        : null,
        };
      }),
    );
  },

  async memberByUser(teamId: string, userId: string): Promise<TeamMemberRecord | undefined> {
    return db.teamMembers
      .where("team_id")
      .equals(teamId)
      .and((m) => m.user_id === userId)
      .first();
  },

  async addMember(teamId: string, userId: string, role: TeamMemberRole): Promise<TeamMemberRecord> {
    const existing = await this.memberByUser(teamId, userId);
    if (existing) {
      await db.teamMembers.update(existing.id, { role });
      return { ...existing, role };
    }
    const record: TeamMemberRecord = {
      id: uuid(),
      team_id: teamId,
      user_id: userId,
      role,
      joined_at: now(),
    };
    await db.teamMembers.add(record);
    return record;
  },

  async updateMemberRole(teamId: string, userId: string, role: TeamMemberRole): Promise<void> {
    const member = await this.memberByUser(teamId, userId);
    if (member) await db.teamMembers.update(member.id, { role });
  },

  async removeMember(teamId: string, userId: string): Promise<void> {
    const member = await this.memberByUser(teamId, userId);
    if (member) await db.teamMembers.delete(member.id);
  },

  // -------------------------------------------------------------------------
  // Invites
  // -------------------------------------------------------------------------

  async invites(teamId: string): Promise<TeamInviteRecord[]> {
    return db.teamInvites.where("team_id").equals(teamId).toArray();
  },

  async inviteByToken(token: string): Promise<TeamInviteRecord | undefined> {
    return db.teamInvites.where("token").equals(token).first();
  },

  async createInvite(input: { team_id: string; email: string; created_by: string }): Promise<TeamInviteRecord> {
    const record: TeamInviteRecord = {
      id: uuid(),
      token: uuid().replace(/-/g, "").slice(0, 12),
      team_id: input.team_id,
      email: input.email.toLowerCase(),
      status: "pending",
      created_by: input.created_by,
      created_at: now(),
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };
    await db.teamInvites.add(record);
    return record;
  },

  async acceptInvite(token: string, userId: string): Promise<TeamInviteRecord | undefined> {
    const invite = await this.inviteByToken(token);
    if (!invite) return undefined;
    if (invite.status !== "pending") throw new Error("INVITE_NOT_PENDING");
    await db.transaction("rw", db.teamInvites, db.teamMembers, async () => {
      await this.addMember(invite.team_id, userId, "member");
      await db.teamInvites.update(invite.id, { status: "accepted" });
    });
    return { ...invite, status: "accepted" };
  },

  async deleteInvite(id: string): Promise<boolean> {
    const existing = await db.teamInvites.get(id);
    if (!existing) return false;
    await db.teamInvites.delete(id);
    return true;
  },

  // -------------------------------------------------------------------------
  // Repos
  // -------------------------------------------------------------------------

  async repos(teamId: string): Promise<TeamRepoRecord[]> {
    return db.teamRepos.where("team_id").equals(teamId).toArray();
  },

  async linkRepo(teamId: string, repoUrl: string): Promise<TeamRepoRecord> {
    const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/);
    if (!match) throw new Error("INVALID_REPO_URL");
    const record: TeamRepoRecord = {
      id: uuid(),
      team_id: teamId,
      repo_full_name: match[1],
      repo_url: repoUrl.replace(/\/$/, ""),
      linked_at: now(),
    };
    await db.teamRepos.add(record);
    return record;
  },

  async unlinkRepo(id: string): Promise<boolean> {
    const existing = await db.teamRepos.get(id);
    if (!existing) return false;
    await db.teamRepos.delete(id);
    return true;
  },

  // -------------------------------------------------------------------------
  // Seeding
  // -------------------------------------------------------------------------

  /**
   * Generate `count` teams for a hackathon with local names and invite codes.
   * Used by the organizer "seed teams" action.
   */
  async seedTeams(hackathonId: string, count: number, prefix = "Team"): Promise<TeamRecord[]> {
    const existing = await this.listByHackathon(hackathonId);
    const created: TeamRecord[] = [];
    for (let i = 1; i <= count; i += 1) {
      const record: TeamRecord = {
        id: uuid(),
        hackathon_id: hackathonId,
        name: `${prefix} ${existing.length + i}`,
        invite_code: generateInviteCode(),
        track_id: null,
        status: "forming",
        created_at: now(),
        updated_at: now(),
      };
      await db.teams.add(record);
      created.push(record);
    }
    return created;
  },
};