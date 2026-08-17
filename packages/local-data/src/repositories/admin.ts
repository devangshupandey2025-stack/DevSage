/**
 * Admin repository — platform admins, admin invites, dashboard stats.
 *
 * Admin statistics are computed from local IndexedDB data.
 */

import { db } from "../db/database.js";
import type { AdminInviteRecord } from "../db/schema.js";
import { now, uuid } from "../lib/utils.js";
import { usersRepository } from "./users.js";
import { hackathonsRepository } from "./hackathons.js";
import { workspacesRepository } from "./workspaces.js";
import { hackathonRequestsRepository } from "./requests.js";
import { teamsRepository } from "./teams.js";
import { submissionsRepository } from "./submissions.js";

export interface DashboardStats {
  total_users: number;
  total_admins: number;
  total_workspaces: number;
  total_hackathons: number;
  total_teams: number;
  total_submissions: number;
  total_requests: number;
  pending_requests: number;
  hackathons_by_status: Record<string, number>;
  requests_by_status: Record<string, number>;
}

export const adminRepository = {
  async stats(): Promise<DashboardStats> {
    const [users, admins, workspaces, hackathons, requests] = await Promise.all([
      usersRepository.count(),
      usersRepository.listPlatformAdmins().then((rows) => rows.length),
      db.workspaces.count(),
      db.hackathons.count(),
      db.hackathonRequests.count(),
    ]);
    const hackathonsByStatus = await hackathonsRepository.countByStatus();
    const requestsByStatus = await hackathonRequestsRepository.countByStatus();
    const totalTeams = await db.teams.count();
    const totalSubmissions = await db.submissions.count();
    return {
      total_users: users,
      total_admins: admins,
      total_workspaces: workspaces,
      total_hackathons: hackathons,
      total_teams: totalTeams,
      total_submissions: totalSubmissions,
      total_requests: requests,
      pending_requests: requestsByStatus.submitted + requestsByStatus.under_review,
      hackathons_by_status: { ...hackathonsByStatus },
      requests_by_status: { ...requestsByStatus },
    };
  },

  // -------------------------------------------------------------------------
  // Admin invites
  // -------------------------------------------------------------------------

  async listAdminInvites(): Promise<AdminInviteRecord[]> {
    const rows = await db.adminInvites.orderBy("created_at").reverse().toArray();
    return rows;
  },

  async inviteByToken(token: string): Promise<AdminInviteRecord | undefined> {
    return db.adminInvites.where("token").equals(token).first();
  },

  async createAdminInvite(email: string, invitedBy: string): Promise<AdminInviteRecord> {
    const existing = await db.adminInvites
      .where("email")
      .equals(email.toLowerCase())
      .and((i) => i.status === "pending")
      .first();
    if (existing) throw new Error("INVITE_EXISTS");
    const record: AdminInviteRecord = {
      id: uuid(),
      email: email.toLowerCase(),
      token: uuid().replace(/-/g, "").slice(0, 12),
      status: "pending",
      invited_by: invitedBy,
      created_at: now(),
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };
    await db.adminInvites.add(record);
    return record;
  },

  async deleteAdminInvite(id: string): Promise<boolean> {
    const existing = await db.adminInvites.get(id);
    if (!existing) return false;
    await db.adminInvites.delete(id);
    return true;
  },

  /** Accept a pending admin invite: promote the user to platform admin. */
  async acceptAdminInvite(token: string, userId: string): Promise<AdminInviteRecord | undefined> {
    const invite = await this.inviteByToken(token);
    if (!invite) return undefined;
    if (invite.status !== "pending") throw new Error("INVITE_NOT_PENDING");
    const user = await usersRepository.getById(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    if (user.email.toLowerCase() !== invite.email) throw new Error("INVITE_EMAIL_MISMATCH");
    await db.transaction("rw", db.adminInvites, db.users, async () => {
      await usersRepository.setPlatformAdmin(userId, true);
      await db.adminInvites.update(invite.id, { status: "accepted" });
    });
    return { ...invite, status: "accepted" };
  },

  // Re-exported convenience views used by admin routes.
  workspacesRepository,
  teamsRepository,
  submissionsRepository,
  hackathonsRepository,
  hackathonRequestsRepository,
};