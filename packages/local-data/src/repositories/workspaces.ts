/**
 * Workspaces repository — workspace CRUD, members, invites.
 */

import { db } from "../db/database.js";
import type {
  WorkspaceInviteRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from "../db/schema.js";
import type { WorkspaceRole, WorkspaceType } from "@devsage/shared";
import { now, uuid } from "../lib/utils.js";

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  description?: string;
  type: WorkspaceType;
  created_by: string;
}

export interface WorkspaceMemberWithUser extends WorkspaceMemberRecord {
  user: { id: string; name: string; email: string; avatar_url: string | null } | null;
}

export const workspacesRepository = {
  async list(): Promise<WorkspaceRecord[]> {
    return db.workspaces.orderBy("created_at").reverse().toArray();
  },

  async getById(id: string): Promise<WorkspaceRecord | undefined> {
    return db.workspaces.get(id);
  },

  async getBySlug(slug: string): Promise<WorkspaceRecord | undefined> {
    return db.workspaces.where("slug").equals(slug).first();
  },

  async create(input: CreateWorkspaceInput): Promise<WorkspaceRecord> {
    if (await this.getBySlug(input.slug)) {
      throw new Error("SLUG_TAKEN");
    }
    const record: WorkspaceRecord = {
      id: uuid(),
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      type: input.type,
      created_by: input.created_by,
      created_at: now(),
      updated_at: now(),
    };
    await db.transaction("rw", db.workspaces, db.workspaceMembers, async () => {
      await db.workspaces.add(record);
      await db.workspaceMembers.add({
        id: uuid(),
        workspace_id: record.id,
        user_id: input.created_by,
        role: "owner",
        created_at: now(),
      });
    });
    return record;
  },

  async update(id: string, input: Partial<Pick<WorkspaceRecord, "name" | "description">>): Promise<WorkspaceRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;
    const updated: WorkspaceRecord = { ...existing, ...input, updated_at: now() };
    await db.workspaces.put(updated);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;
    await db.workspaces.delete(id);
    return true;
  },

  /** Transfer workspace ownership to another member. */
  async transferOwnership(id: string, newOwnerUserId: string): Promise<void> {
    await db.transaction("rw", db.workspaceMembers, async () => {
      const members = await db.workspaceMembers.where("workspace_id").equals(id).toArray();
      for (const member of members) {
        const role: WorkspaceRole = member.user_id === newOwnerUserId ? "owner" : member.role === "owner" ? "admin" : member.role;
        await db.workspaceMembers.update(member.id, { role });
      }
    });
  },

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------

  async members(workspaceId: string): Promise<WorkspaceMemberWithUser[]> {
    const rows = await db.workspaceMembers.where("workspace_id").equals(workspaceId).toArray();
    return Promise.all(
      rows.map(async (row) => {
        const user = await db.users.get(row.user_id);
        return {
          ...row,
          user: user
            ? { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url }
            : null,
        };
      }),
    );
  },

  async memberByUser(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | undefined> {
    return db.workspaceMembers
      .where("workspace_id")
      .equals(workspaceId)
      .and((m) => m.user_id === userId)
      .first();
  },

  async addMember(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMemberRecord> {
    const existing = await this.memberByUser(workspaceId, userId);
    if (existing) {
      await db.workspaceMembers.update(existing.id, { role });
      return { ...existing, role };
    }
    const record: WorkspaceMemberRecord = {
      id: uuid(),
      workspace_id: workspaceId,
      user_id: userId,
      role,
      created_at: now(),
    };
    await db.workspaceMembers.add(record);
    return record;
  },

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
    const member = await this.memberByUser(workspaceId, userId);
    if (member) await db.workspaceMembers.update(member.id, { role });
  },

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const member = await this.memberByUser(workspaceId, userId);
    if (member) await db.workspaceMembers.delete(member.id);
  },

  // -------------------------------------------------------------------------
  // Invites
  // -------------------------------------------------------------------------

  async invites(workspaceId: string): Promise<WorkspaceInviteRecord[]> {
    return db.workspaceInvites.where("workspace_id").equals(workspaceId).toArray();
  },

  async inviteByToken(token: string): Promise<WorkspaceInviteRecord | undefined> {
    return db.workspaceInvites.where("token").equals(token).first();
  },

  async createInvite(input: {
    workspace_id: string;
    email: string;
    role: Exclude<WorkspaceRole, "owner">;
    created_by: string;
  }): Promise<WorkspaceInviteRecord> {
    const record: WorkspaceInviteRecord = {
      id: uuid(),
      token: uuid().replace(/-/g, "").slice(0, 12),
      workspace_id: input.workspace_id,
      email: input.email.toLowerCase(),
      role: input.role,
      status: "pending",
      created_by: input.created_by,
      created_at: now(),
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      accepted_at: null,
    };
    await db.workspaceInvites.add(record);
    return record;
  },

  async acceptInvite(token: string, userId: string): Promise<WorkspaceInviteRecord | undefined> {
    const invite = await this.inviteByToken(token);
    if (!invite) return undefined;
    if (invite.status !== "pending") throw new Error("INVITE_NOT_PENDING");
    await db.transaction("rw", db.workspaceInvites, db.workspaceMembers, async () => {
      await this.addMember(invite.workspace_id, userId, invite.role);
      await db.workspaceInvites.update(invite.id, { status: "accepted", accepted_at: now() });
    });
    return { ...invite, status: "accepted", accepted_at: now() };
  },

  /** Decline a pending workspace invite (recipient rejected the invitation). */
  async declineInvite(token: string): Promise<WorkspaceInviteRecord | undefined> {
    const invite = await this.inviteByToken(token);
    if (!invite) return undefined;
    if (invite.status !== "pending") throw new Error("INVITE_NOT_PENDING");
    await db.workspaceInvites.update(invite.id, { status: "declined" });
    return { ...invite, status: "declined" };
  },

  async deleteInvite(id: string): Promise<boolean> {
    const existing = await db.workspaceInvites.get(id);
    if (!existing) return false;
    await db.workspaceInvites.delete(id);
    return true;
  },
};