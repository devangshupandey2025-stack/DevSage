/**
 * Local API adapter — drop-in replacement for the remote fetch layer.
 *
 * Frontends keep calling `apiRequest("/api/v1/...")`; this module resolves
 * those calls against IndexedDB repositories and returns the same
 * `{ ok, data, meta }` / `{ ok: false, error }` envelopes the API used.
 *
 * It is NOT a network server: no real auth, no cross-tab sync, no
 * validation beyond what the repositories enforce.
 */

import type {
  HackathonRequestStatus,
  JudgeAssignmentRecord,
  RoundRecord,
  TeamRecord,
  UserRecord,
} from "./db/schema.js";
import type {
  HackathonStatus,
  SubmissionStatus,
  TeamMemberRole,
  TeamStatus,
  WorkspaceRole,
  WorkspaceType,
} from "@devsage/shared";
import { db } from "./db/database.js";
import { sessionStore } from "./session/session-store.js";
import { usersRepository } from "./repositories/users.js";
import { workspacesRepository } from "./repositories/workspaces.js";
import { hackathonsRepository } from "./repositories/hackathons.js";
import { teamsRepository } from "./repositories/teams.js";
import type { TeamWithDetails } from "./repositories/teams.js";
import { submissionsRepository } from "./repositories/submissions.js";
import { roundsRepository } from "./repositories/rounds.js";
import {
  judgingRepository,
  computeLeaderboard,
  type JudgeWithUser,
  type SubmitScoreInput,
} from "./repositories/judging.js";
import { announcementsRepository } from "./repositories/announcements.js";
import { notificationsRepository } from "./repositories/notifications.js";
import { activityRepository } from "./repositories/activity.js";
import { hackathonRequestsRepository, type CreateRequestInput } from "./repositories/requests.js";
import { adminRepository } from "./repositories/admin.js";
import {
  mapAdminHackathon,
  mapAdminInvite,
  mapAdminUser,
  mapAdminWorkspace,
  mapAnnouncement,
  mapAssignment,
  mapAuditEvent,
  mapConflict,
  mapHackathonPlatform,
  mapHackathonWebView,
  mapJudge,
  mapJudgeHackathon,
  mapLeaderboard,
  mapNotification,
  mapRequest,
  mapRound,
  mapRoundResults,
  mapSubmission,
  mapTeam,
  mapTeamInvite,
  mapTeamMember,
  mapTeamWithDetails,
  mapWorkspaceDetail,
  mapWorkspaceInvite,
  mapWorkspaceMember,
  latestSubmissionDeadline,
  parseJsonArray,
  parseJsonObject,
} from "./mappers.js";

export interface LocalSuccess<T = unknown> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface LocalFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  };
}

export type LocalResult<T = unknown> = LocalSuccess<T> | LocalFailure;

/** Map repository error messages to envelope codes. */
const ERROR_CODE_MAP: Record<string, { code: string; status: number }> = {
  UNAUTHORIZED: { code: "UNAUTHORIZED", status: 401 },
  INVALID_CREDENTIALS: { code: "UNAUTHORIZED", status: 401 },
  SESSION_NOT_FOUND: { code: "UNAUTHORIZED", status: 401 },
  EMAIL_TAKEN: { code: "CONFLICT", status: 409 },
  SLUG_TAKEN: { code: "CONFLICT", status: 409 },
  INVITE_CODE_TAKEN: { code: "CONFLICT", status: 409 },
  INVALID_TRANSITION: { code: "CONFLICT", status: 409 },
  JUDGE_ALREADY_INVITED: { code: "CONFLICT", status: 409 },
  JUDGE_NOT_PENDING: { code: "CONFLICT", status: 409 },
  INVITE_NOT_PENDING: { code: "CONFLICT", status: 409 },
  INVITE_EXISTS: { code: "CONFLICT", status: 409 },
  INVITE_EMAIL_MISMATCH: { code: "CONFLICT", status: 409 },
  ALREADY_MEMBER: { code: "CONFLICT", status: 409 },
  ALREADY_DECLARED: { code: "CONFLICT", status: 409 },
  TEAM_ALREADY_FULL: { code: "CONFLICT", status: 409 },
  ASSIGNMENT_NO_SUBMISSION: { code: "CONFLICT", status: 409 },
  ROUND_NOT_DRAFT: { code: "CONFLICT", status: 409 },
  ROUND_NOT_PUBLISHED: { code: "CONFLICT", status: 409 },
  NO_ACCEPTED_JUDGES: { code: "CONFLICT", status: 409 },
  NO_SUBMISSIONS: { code: "CONFLICT", status: 409 },
  INVALID_REPO_URL: { code: "VALIDATION_ERROR", status: 400 },
  USER_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  HACKATHON_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  WORKSPACE_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  TEAM_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  ROUND_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  SUBMISSION_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  JUDGE_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  ASSIGNMENT_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  CRITERION_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  ANNOUNCEMENT_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  NOTIFICATION_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  INVITE_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  ADMIN_INVITE_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  TEAM_REPO_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  REQUEST_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  MEMBER_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  CONFLICT_NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  UNSUPPORTED_ROUTE: { code: "UNSUPPORTED_ROUTE", status: 404 },
};

const FALLBACK_ERROR = { code: "VALIDATION_ERROR", status: 400 };

function toFailure(error: unknown): LocalFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.startsWith("INVALID_TRANSITION:") ||
    message.startsWith("INVALID_REQUEST_TRANSITION:")
  ) {
    return { ok: false, error: { code: "CONFLICT", message, status: 409 } };
  }
  const mapped = ERROR_CODE_MAP[message] ?? FALLBACK_ERROR;
  return { ok: false, error: { code: mapped.code, message, status: mapped.status } };
}

function toSuccess<T>(data: T, meta?: Record<string, unknown>): LocalSuccess<T> {
  return meta ? { ok: true, data, meta } : { ok: true, data };
}

async function requireUser(): Promise<UserRecord> {
  const user = await sessionStore.getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

// ---------------------------------------------------------------------------
// Request parsing + routing
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  user: UserRecord;
}

interface Route {
  method: string;
  pattern: string[];
  /** Routes that work without a session (login/logout). */
  public?: boolean;
  /** Routes that resolve the current user optionally (null when logged out). */
  optional?: boolean;
  handler: (ctx: RouteContext) => Promise<LocalResult<unknown>>;
}

function parseRequest(endpoint: string, options?: RequestInit): {
  method: string;
  segments: string[];
  query: URLSearchParams;
  body: Record<string, unknown>;
} {
  const path = endpoint.replace(/^https?:\/\/[^/]+/, "");
  const qIndex = path.indexOf("?");
  const pathPart = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const queryPart = qIndex >= 0 ? path.slice(qIndex + 1) : "";

  const method = (options?.method ?? "GET").toUpperCase();
  let body: Record<string, unknown> = {};
  if (options?.body && typeof options.body === "string") {
    try {
      const parsed: unknown = JSON.parse(options.body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }
  }

  const segmentsRaw = pathPart.split("/").filter((s) => s.length > 0);
  const segments = segmentsRaw[0] === "api" && segmentsRaw[1] === "v1" ? segmentsRaw.slice(2) : segmentsRaw;
  return { method, segments, query: new URLSearchParams(queryPart), body };
}

function matchRoute(
  segments: string[],
  routes: Route[],
  method: string,
): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method || route.pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < segments.length; i += 1) {
      const token = route.pattern[i];
      if (token.startsWith(":")) {
        params[token.slice(1)] = decodeURIComponent(segments[i]);
      } else if (token !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function paginationMeta(total: number, query: URLSearchParams): Record<string, unknown> {
  const limit = Math.max(1, Math.min(100, Number(query.get("limit")) || 20));
  const offset = Math.max(0, Number(query.get("offset")) || 0);
  return { total, limit, offset, has_more: offset + limit < total };
}

// ---------------------------------------------------------------------------
// Body coercion helpers (explicit casts, never `any`)
// ---------------------------------------------------------------------------

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function nullableStr(v: unknown): string | null {
  return v == null ? null : str(v);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function optionalNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean {
  return v === true || v === 1 || str(v).toLowerCase() === "true";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Local drop-in for the frontend `apiRequest` wrapper.
 *
 * @param endpoint  path or URL, e.g. "/api/v1/hackathons" or "https://api.devsage.org/api/v1/..."
 * @param options   fetch-style options (method, body as JSON string; headers ignored)
 */
export async function localApiRequest<T = unknown>(
  endpoint: string,
  options?: RequestInit,
): Promise<LocalResult<T>> {
  const { method, segments, query, body } = parseRequest(endpoint, options);
  const matched = matchRoute(segments, ROUTES, method);
  if (!matched) {
    return toFailure(new Error("UNSUPPORTED_ROUTE"));
  }

  try {
    const user = matched.route.public
      ? null
      : matched.route.optional
        ? await sessionStore.getCurrentUser()
        : await requireUser();
    const result = await matched.route.handler({
      params: matched.params,
      query,
      body,
      user: user as UserRecord,
    });
    return result as LocalResult<T>;
  } catch (error) {
    return toFailure(error);
  }
}

// ---------------------------------------------------------------------------
// Resolution helpers — frontends address hackathons & workspaces by slug
// ---------------------------------------------------------------------------

async function resolveHackathon(idOrSlug: string) {
  const hackathon = isUuid(idOrSlug)
    ? await hackathonsRepository.getById(idOrSlug)
    : await hackathonsRepository.getBySlug(idOrSlug);
  if (!hackathon) throw new Error("HACKATHON_NOT_FOUND");
  return hackathon;
}

async function resolveWorkspace(idOrSlug: string) {
  const workspace = isUuid(idOrSlug)
    ? await workspacesRepository.getById(idOrSlug)
    : await workspacesRepository.getBySlug(idOrSlug);
  if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
  return workspace;
}

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

const ROUTES: Route[] = [
  // ---- Auth ---------------------------------------------------------------
  {
    method: "POST",
    pattern: ["auth", "login"],
    public: true,
    handler: async ({ body }) => {
      const session = await sessionStore.login(str(body.email), str(body.password));
      return toSuccess({ session });
    },
  },
  {
    method: "POST",
    pattern: ["auth", "logout"],
    public: true,
    handler: async () => {
      await sessionStore.logout();
      return toSuccess(null);
    },
  },
{
    method: "GET",
    pattern: ["auth", "me"],
    handler: async () => {
      const me = await sessionStore.me();
      if (!me) throw new Error("UNAUTHORIZED");
      const workspaceRoles: Record<string, string> = {};
      for (const [id, roles] of Object.entries(me.workspaceRoles)) {
        workspaceRoles[id] = roles[0] ?? "";
      }
      return toSuccess({ ...me, user: { ...me.user, image: me.user.avatar_url }, workspaceRoles });
    },
  },
  {
    method: "POST",
    pattern: ["auth", "refresh"],
    public: true,
    handler: async () => {
      const me = await sessionStore.me();
      return toSuccess(me);
    },
  },
  {
    method: "POST",
    pattern: ["auth", "change-password"],
    handler: async ({ body }) => {
      const ok = await sessionStore.changePassword(str(body.current_password), str(body.next_password));
      if (!ok) throw new Error("INVALID_CREDENTIALS");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["auth", "register"],
    public: true,
    handler: async ({ body }) => {
      const user = await usersRepository.create({
        email: str(body.email),
        name: str(body.name),
        password: str(body.password),
        password_must_change: false,
      });
      const session = await sessionStore.loginAs(user.id);
      return toSuccess({ user: mapAdminUser(user), session });
    },
  },

  // ---- Users --------------------------------------------------------------
  {
    method: "GET",
    pattern: ["users", "me"],
    handler: async ({ user }) => toSuccess(mapAdminUser(user)),
  },
  {
    method: "PATCH",
    pattern: ["users", "me"],
    handler: async ({ body, user }) => {
      const updated = await usersRepository.update(user.id, {
        name: body.name !== undefined ? str(body.name) : undefined,
        avatar_url: body.avatar_url !== undefined ? nullableStr(body.avatar_url) : undefined,
        github_username:
          body.github_username !== undefined ? nullableStr(body.github_username) : undefined,
      });
      if (!updated) throw new Error("USER_NOT_FOUND");
      return toSuccess(mapAdminUser(updated));
    },
  },
  {
    method: "GET",
    pattern: ["users"],
    handler: async ({ query }) => {
      const limit = Math.max(1, Math.min(100, Number(query.get("limit")) || 20));
      const offset = Math.max(0, Number(query.get("offset")) || 0);
      const result = await usersRepository.list(limit, offset, query.get("search") ?? undefined);
      return toSuccess(
        { items: result.items.map(mapAdminUser) },
        { total: result.total, has_more: result.has_more },
      );
    },
  },

  // ---- Workspaces ---------------------------------------------------------
{
    method: "GET",
    pattern: ["workspaces"],
    handler: async ({ user, query }) => {
      const rows = await workspacesRepository.list();
      const items = await Promise.all(
        rows.map(async (w) => {
          const [members, mine] = await Promise.all([
            workspacesRepository.members(w.id),
            workspacesRepository.memberByUser(w.id, user.id),
          ]);
          return {
            ...mapWorkspaceDetail(w, members.length),
            member_role: mine?.role ?? "member",
          };
        }),
      );
      return toSuccess(items, paginationMeta(items.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["workspaces"],
    handler: async ({ body, user }) => {
      const type = (["club", "individual", "other"].includes(str(body.type)) ? str(body.type) : "club") as WorkspaceType;
      const record = await workspacesRepository.create({
        name: str(body.name),
        slug: str(body.slug) || slugify(str(body.name)),
        description: nullableStr(body.description) ?? undefined,
        type,
        created_by: user.id,
      });
      return toSuccess(mapWorkspaceDetail(record, 1));
    },
  },
  {
    method: "GET",
    pattern: ["workspaces", ":idOrSlug"],
    handler: async ({ params }) => {
      const workspace = await resolveWorkspace(params.idOrSlug);
      const [members, invites, hackathons] = await Promise.all([
        workspacesRepository.members(workspace.id),
        workspacesRepository.invites(workspace.id),
        hackathonsRepository.list({ workspace_id: workspace.id, limit: 100 }),
      ]);
      return toSuccess({
        ...mapWorkspaceDetail(workspace, members.length),
        members: members.map(mapWorkspaceMember),
        invites: invites.map(mapWorkspaceInvite),
        hackathons: hackathons.items.map(mapHackathonPlatform),
      });
    },
  },
  {
    method: "PATCH",
    pattern: ["workspaces", ":idOrSlug"],
    handler: async ({ params, body }) => {
      const workspace = await resolveWorkspace(params.idOrSlug);
      const updated = await workspacesRepository.update(workspace.id, {
        name: body.name !== undefined ? str(body.name) : undefined,
        description: body.description !== undefined ? nullableStr(body.description) : undefined,
      });
      if (!updated) throw new Error("WORKSPACE_NOT_FOUND");
      return toSuccess(mapWorkspaceDetail(updated, (await workspacesRepository.members(updated.id)).length));
    },
  },
  {
    method: "DELETE",
    pattern: ["workspaces", ":idOrSlug"],
    handler: async ({ params }) => {
      const workspace = await resolveWorkspace(params.idOrSlug);
      await workspacesRepository.remove(workspace.id);
      return toSuccess(null);
    },
  },
{
    method: "POST",
    pattern: ["workspaces", ":id", "transfer"],
    handler: async ({ params, body }) => {
      const workspace = await resolveWorkspace(params.id);
      await workspacesRepository.transferOwnership(workspace.id, str(body.new_owner_id));
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["workspaces", ":id", "members"],
    handler: async ({ params }) => {
      const workspace = await resolveWorkspace(params.id);
      const rows = await workspacesRepository.members(workspace.id);
      return toSuccess({ items: rows.map(mapWorkspaceMember) });
    },
  },
  {
    method: "POST",
    pattern: ["workspaces", ":id", "members"],
    handler: async ({ params, body }) => {
      const workspace = await resolveWorkspace(params.id);
      const role = (["owner", "admin", "member"].includes(str(body.role)) ? str(body.role) : "member") as WorkspaceRole;
      const member = await workspacesRepository.addMember(workspace.id, str(body.user_id), role);
      return toSuccess(member);
    },
  },
  {
    method: "PATCH",
    pattern: ["workspaces", ":id", "members", ":userId"],
    handler: async ({ params, body }) => {
      const workspace = await resolveWorkspace(params.id);
      const role = (["owner", "admin", "member"].includes(str(body.role)) ? str(body.role) : "member") as WorkspaceRole;
      await workspacesRepository.updateMemberRole(workspace.id, params.userId, role);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["workspaces", ":id", "members", ":userId"],
    handler: async ({ params }) => {
      const workspace = await resolveWorkspace(params.id);
      await workspacesRepository.removeMember(workspace.id, params.userId);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["workspaces", ":id", "invites"],
    handler: async ({ params }) => {
      const workspace = await resolveWorkspace(params.id);
      const rows = await workspacesRepository.invites(workspace.id);
      return toSuccess({ items: rows.map(mapWorkspaceInvite) });
    },
  },
  {
    method: "POST",
    pattern: ["workspaces", ":id", "invites"],
    handler: async ({ params, body, user }) => {
      const workspace = await resolveWorkspace(params.id);
      const role = (str(body.role) === "admin" ? "admin" : "member") as Exclude<WorkspaceRole, "owner">;
      const invite = await workspacesRepository.createInvite({
        workspace_id: workspace.id,
        email: str(body.email),
        role,
        created_by: user.id,
      });
      return toSuccess(mapWorkspaceInvite(invite));
    },
  },
{
    method: "POST",
    pattern: ["workspaces", "invites", ":token", "accept"],
    handler: async ({ params, user }) => {
      const invite = await workspacesRepository.acceptInvite(params.token, user.id);
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      return toSuccess(mapWorkspaceInvite(invite));
    },
  },
  {
    method: "GET",
    pattern: ["workspaces", "invites", "token", ":token"],
    public: true,
    handler: async ({ params }) => {
      const invite = await workspacesRepository.inviteByToken(params.token);
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      const [workspace, inviter] = await Promise.all([
        db.workspaces.get(invite.workspace_id),
        db.users.get(invite.created_by),
      ]);
      return toSuccess({
        id: invite.id,
        workspace_id: invite.workspace_id,
        workspace_name: workspace?.name ?? null,
        workspace_slug: workspace?.slug ?? null,
        email: invite.email,
        role: invite.role,
        status: invite.expires_at && invite.expires_at < new Date().toISOString() ? "expired" : invite.status,
        expires_at: invite.expires_at,
        inviter_name: inviter?.name ?? null,
      });
    },
  },
  {
    method: "POST",
    pattern: ["workspaces", "invites", "token", ":token", "accept"],
    handler: async ({ params, user }) => {
      const invite = await workspacesRepository.acceptInvite(params.token, user.id);
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["workspaces", "invites", "token", ":token", "decline"],
    handler: async ({ params }) => {
      const invite = await workspacesRepository.declineInvite(params.token);
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["invites", "judge", "token", ":token"],
    public: true,
    handler: async ({ params }) => {
      const judge = await judgingRepository.getJudgeById(params.token);
      if (!judge) throw new Error("JUDGE_NOT_FOUND");
      const hackathon = await hackathonsRepository.getById(judge.hackathon_id);
      if (!hackathon) throw new Error("HACKATHON_NOT_FOUND");
      const [judgeUser, inviter] = await Promise.all([
        usersRepository.getById(judge.user_id),
        usersRepository.getById(hackathon.created_by),
      ]);
      return toSuccess({
        id: judge.id,
        hackathon_name: hackathon.title,
        hackathon_slug: hackathon.slug,
        inviter_name: inviter?.name ?? "Organizer",
        email: judgeUser?.email ?? null,
        user_exists: Boolean(judgeUser),
        status: judge.status,
      });
    },
  },
  {
    method: "POST",
    pattern: ["invites", "judge", "token", ":token", "accept"],
    public: true,
    handler: async ({ params, body }) => {
      const judge = await judgingRepository.getJudgeById(params.token);
      if (!judge) throw new Error("JUDGE_NOT_FOUND");
      const hackathon = await hackathonsRepository.getById(judge.hackathon_id);
      if (!hackathon) throw new Error("HACKATHON_NOT_FOUND");
      let judgeUser = await usersRepository.getById(judge.user_id);
      let userCreated = false;
      if (!judgeUser) {
        judgeUser = await usersRepository.create({
          email: `judge-${judge.id.slice(0, 8)}@demo.local`,
          name: str(body.name) || "Judge",
          password: str(body.password) || "demo1234",
          password_must_change: false,
        });
        userCreated = true;
      }
      await sessionStore.loginAs(judgeUser.id, "judge");
      await judgingRepository.acceptJudgeInvite(hackathon.id, judgeUser.id);
      const existingRole = await db.roles
        .where("scope_id")
        .equals(hackathon.id)
        .and((r) => r.user_id === judgeUser.id && r.role === "judge")
        .first();
      if (!existingRole) {
        await db.roles.add({
          id: crypto.randomUUID(),
          user_id: judgeUser.id,
          scope: "hackathon",
          scope_id: hackathon.id,
          role: "judge",
          created_at: new Date().toISOString(),
        });
      }
      return toSuccess({ accepted: true, hackathon_id: hackathon.id, user_created: userCreated });
    },
  },
  {
    method: "POST",
    pattern: ["invites", "judge", "token", ":token", "decline"],
    public: true,
    handler: async ({ params }) => {
      const judge = await judgingRepository.getJudgeById(params.token);
      if (!judge) throw new Error("JUDGE_NOT_FOUND");
      await judgingRepository.declineJudgeInvite(judge.hackathon_id, judge.user_id);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["invites", "judge", ":token", "details"],
    public: true,
    handler: async ({ params }) => {
      const judge = await judgingRepository.getJudgeById(params.token);
      if (!judge) throw new Error("JUDGE_NOT_FOUND");
      const hackathon = await hackathonsRepository.getById(judge.hackathon_id);
      if (!hackathon) throw new Error("HACKATHON_NOT_FOUND");
      const inviter = await usersRepository.getById(hackathon.created_by);
      return toSuccess({
        id: judge.id,
        hackathon_name: hackathon.title,
        hackathon_slug: hackathon.slug,
        inviter_name: inviter?.name ?? "Organizer",
        status: judge.status,
        expires_at: new Date(new Date(judge.invited_at).getTime() + 30 * 86400000).toISOString(),
      });
    },
  },
  {
    method: "POST",
    pattern: ["invites", "judge", ":token"],
    handler: async ({ params, user }) => {
      const judge = await judgingRepository.getJudgeById(params.token);
      if (!judge) throw new Error("JUDGE_NOT_FOUND");
      await judgingRepository.acceptJudgeInvite(judge.hackathon_id, user.id);
      const existingRole = await db.roles
        .where("scope_id")
        .equals(judge.hackathon_id)
        .and((r) => r.user_id === user.id && r.role === "judge")
        .first();
      if (!existingRole) {
        await db.roles.add({
          id: crypto.randomUUID(),
          user_id: user.id,
          scope: "hackathon",
          scope_id: judge.hackathon_id,
          role: "judge",
          created_at: new Date().toISOString(),
        });
      }
      return toSuccess({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["workspaces", ":id", "invites", ":inviteId"],
    handler: async ({ params }) => {
      const workspace = await resolveWorkspace(params.id);
      const ok = await workspacesRepository.deleteInvite(params.inviteId);
      if (!ok) throw new Error("INVITE_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },

  // ---- Hackathons ---------------------------------------------------------
  {
    method: "GET",
    pattern: ["hackathons"],
    public: true,
    handler: async ({ query, user }) => {
      const currentUser = user as UserRecord | null;
      const limit = Math.max(1, Math.min(100, Number(query.get("limit")) || 20));
      const offset = Math.max(0, Number(query.get("offset")) || 0);
      const result = await hackathonsRepository.list({
        status: query.get("status") as HackathonStatus | undefined,
        workspace_id: query.get("workspace_id") ?? undefined,
        search: query.get("search") ?? undefined,
        limit,
        offset,
      });
const items = currentUser
        ? result.items.map(mapHackathonPlatform)
        : result.items.map(mapHackathonWebView);
      return toSuccess(items, paginationMeta(result.total, query));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons"],
    handler: async ({ body, user }) => {
const record = await hackathonsRepository.create({
        title: str(body.title),
        slug: str(body.slug) || slugify(str(body.title)),
        workspace_id: str(body.workspace_id) || str(body.workspaceId),
        created_by: user.id,
        tagline: nullableStr(body.tagline) ?? undefined,
        description: nullableStr(body.description) ?? undefined,
        rules_md: nullableStr(body.rules_md) ?? undefined,
        starts_at: nullableStr(body.starts_at) ?? nullableStr(body.startsAt) ?? undefined,
        judging_starts:
          nullableStr(body.judging_starts) ?? nullableStr(body.judgingStarts) ?? undefined,
        judging_ends: nullableStr(body.judging_ends) ?? undefined,
        min_team_size: optionalNum(body.min_team_size),
        max_team_size: optionalNum(body.max_team_size) ?? optionalNum(body.maxTeamSize),
        max_teams: optionalNum(body.max_teams),
        registration_mode: str(body.registration_mode) === "closed" ? "closed" : "open",
        require_repo: bool(body.require_repo) ? 1 : 0,
        timezone: nullableStr(body.timezone) ?? "UTC",
        template_id: nullableStr(body.template_id) ?? undefined,
        tracks: JSON.stringify(body.tracks ?? []),
        prizes: JSON.stringify(body.prizes ?? []),
        settings: JSON.stringify(body.settings ?? {}),
      });
      return toSuccess(mapHackathonPlatform(record));
    },
  },
{
    method: "GET",
    pattern: ["hackathons", ":idOrSlug"],
    optional: true,
handler: async ({ params, user }) => {
      const hackathon = await resolveHackathon(params.idOrSlug);
      const currentUser = user as UserRecord | null;
      if (!currentUser) {
        return toSuccess(mapHackathonWebView(hackathon));
      }
      const me = await sessionStore.me();
      const roles = me?.hackathonRoles[hackathon.id] ?? [];
      const privileged =
        roles.includes("organizer") ||
        roles.includes("co_organizer") ||
        roles.includes("judge");
      if (!privileged) {
        return toSuccess(mapHackathonWebView(hackathon));
      }
      const [organizers, teams, submissions, rounds] = await Promise.all([
        hackathonsRepository.organizers(hackathon.id),
        teamsRepository.listByHackathon(hackathon.id),
        submissionsRepository.listByHackathon(hackathon.id, { current_only: true }),
        roundsRepository.listByHackathon(hackathon.id),
      ]);
      const organizerViews = await Promise.all(
        organizers.map(async (o) => {
          const u = await usersRepository.getById(o.user_id);
          return {
            user_id: o.user_id,
            role: o.role,
            name: u?.name ?? null,
            email: u?.email ?? null,
            avatar_url: u?.avatar_url ?? null,
          };
        }),
      );
      return toSuccess({
        ...mapHackathonPlatform(hackathon),
        organizers: organizerViews,
        teams_count: teams.length,
        submissions_count: submissions.length,
        rounds_count: rounds.length,
      });
    },
  },
  {
    method: "PATCH",
    pattern: ["hackathons", ":idOrSlug"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.idOrSlug);
      const updated = await hackathonsRepository.update(hackathon.id, {
        ...(body.title !== undefined ? { title: str(body.title) } : {}),
        ...(body.slug !== undefined ? { slug: str(body.slug) } : {}),
        ...(body.tagline !== undefined ? { tagline: nullableStr(body.tagline) } : {}),
        ...(body.description !== undefined ? { description: nullableStr(body.description) } : {}),
        ...(body.rules_md !== undefined ? { rules_md: nullableStr(body.rules_md) } : {}),
        ...(body.starts_at !== undefined ? { starts_at: nullableStr(body.starts_at) } : {}),
        ...(body.judging_starts !== undefined
          ? { judging_starts: nullableStr(body.judging_starts) }
          : {}),
        ...(body.judging_ends !== undefined ? { judging_ends: nullableStr(body.judging_ends) } : {}),
        ...(body.min_team_size !== undefined ? { min_team_size: num(body.min_team_size) } : {}),
        ...(body.max_team_size !== undefined ? { max_team_size: num(body.max_team_size) } : {}),
        ...(body.max_teams !== undefined ? { max_teams: optionalNum(body.max_teams) ?? null } : {}),
        ...(body.registration_mode !== undefined
          ? { registration_mode: str(body.registration_mode) === "closed" ? "closed" : "open" }
          : {}),
        ...(body.require_repo !== undefined ? { require_repo: bool(body.require_repo) ? 1 : 0 } : {}),
        ...(body.tracks !== undefined ? { tracks: JSON.stringify(body.tracks ?? []) } : {}),
        ...(body.prizes !== undefined ? { prizes: JSON.stringify(body.prizes ?? []) } : {}),
        ...(body.settings !== undefined ? { settings: JSON.stringify(body.settings ?? {}) } : {}),
      });
      if (!updated) throw new Error("HACKATHON_NOT_FOUND");
      return toSuccess(mapHackathonPlatform(updated));
    },
  },
  {
    method: "DELETE",
    pattern: ["hackathons", ":idOrSlug"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.idOrSlug);
      const ok = await hackathonsRepository.remove(hackathon.id);
      if (!ok) throw new Error("HACKATHON_NOT_FOUND");
      return toSuccess(null);
    },
  },
  {
    method: "POST",
pattern: ["hackathons", ":id", "transition"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const updated = await hackathonsRepository.transition(
        hackathon.id,
        str(body.target_status) as HackathonStatus,
      );
      return toSuccess(mapHackathonPlatform(updated));
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "organizers"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await hackathonsRepository.organizers(hackathon.id);
      const items = await Promise.all(
        rows.map(async (o) => {
          const u = await usersRepository.getById(o.user_id);
          return {
            user_id: o.user_id,
            role: o.role,
            name: u?.name ?? null,
            email: u?.email ?? null,
            avatar_url: u?.avatar_url ?? null,
          };
        }),
      );
      return toSuccess({ items });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "organizers"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const role = str(body.role) === "co_organizer" ? "co_organizer" : "organizer";
      await hackathonsRepository.addOrganizer(hackathon.id, str(body.user_id), role);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["hackathons", ":id", "organizers", ":userId"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      await hackathonsRepository.removeOrganizer(hackathon.id, params.userId);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "me"],
    handler: async ({ params, user }) => {
      const hackathon = await resolveHackathon(params.id);
      const me = await sessionStore.me();
      const roles = me?.hackathonRoles[hackathon.id] ?? [];
      const judge = await judgingRepository.getJudge(hackathon.id, user.id);
      let judgeView: Record<string, unknown> | null = null;
      if (judge) {
        const judgeUser = await usersRepository.getById(judge.user_id);
        judgeView = mapJudge({
          ...judge,
          user: judgeUser
            ? { id: judgeUser.id, name: judgeUser.name, email: judgeUser.email, avatar_url: judgeUser.avatar_url }
            : null,
        });
      }
      return toSuccess({
        user: mapAdminUser(user),
        roles,
        isOrganizer: roles.includes("organizer") || roles.includes("co_organizer"),
        isJudge: roles.includes("judge") || Boolean(judge),
        judge: judgeView,
      });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "my-team"],
    handler: async ({ params, user }) => {
      const hackathon = await resolveHackathon(params.id);
      const teams = await teamsRepository.listByHackathon(hackathon.id);
      for (const team of teams) {
        const member = await teamsRepository.memberByUser(team.id, user.id);
        if (member) {
          const details = await teamsRepository.getWithDetails(team.id);
          return toSuccess(details ? mapTeamWithDetails(details) : null);
        }
      }
      return toSuccess(null);
    },
  },// ---- Teams ---------------------------------------------------------------
  {
    method: "GET",
pattern: ["hackathons", ":id", "teams"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await teamsRepository.listByHackathon(hackathon.id);
      const details = (
        await Promise.all(rows.map((r) => teamsRepository.getWithDetails(r.id)))
      ).filter((d): d is TeamWithDetails => Boolean(d));
      return toSuccess(details.map(mapTeamWithDetails), paginationMeta(details.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "teams"],
    handler: async ({ params, body, user }) => {
      const hackathon = await resolveHackathon(params.id);
      const team = await teamsRepository.create({
        hackathon_id: hackathon.id,
        name: str(body.name),
        track_id: nullableStr(body.track_id) ?? undefined,
        created_by: user.id,
      });
      return toSuccess(mapTeam(team));
    },
  },
  {
    method: "POST",
pattern: ["hackathons", ":id", "teams", "seed"],
    handler: async ({ params, body, user }) => {
      const hackathon = await resolveHackathon(params.id);
      const mode = str(body.mode) || "full_structure";
      const createdTeams: TeamRecord[] = [];
      let totalInvitesSent = 0;

      const getOrCreate = async (email: string): Promise<UserRecord> => {
        const existing = await usersRepository.getByEmail(email);
        if (existing) return existing;
        return usersRepository.create({
          email,
          name: email.split("@")[0],
          password: "demo1234",
          password_must_change: false,
        });
      };

      if (mode === "participants_only") {
        const emails = Array.isArray(body.emails) ? (body.emails as string[]) : [];
        for (const email of emails) {
          const member = await getOrCreate(email);
          const team = await teamsRepository.create({
            hackathon_id: hackathon.id,
            name: member.name || email.split("@")[0],
            created_by: member.id,
          });
          await teamsRepository.addMember(team.id, member.id, "leader");
          createdTeams.push(team);
        }
      } else {
        const teams = Array.isArray(body.teams) ? (body.teams as Record<string, unknown>[]) : [];
        for (const item of teams) {
          const leader = await getOrCreate(str(item.leader_email));
          const team = await teamsRepository.create({
            hackathon_id: hackathon.id,
            name: str(item.team_name),
            created_by: leader.id,
          });
          await teamsRepository.addMember(team.id, leader.id, "leader");
          createdTeams.push(team);
          const memberEmails = Array.isArray(item.member_emails)
            ? (item.member_emails as string[])
            : [];
          if (mode === "leaders_only") {
            for (const email of memberEmails) {
              await teamsRepository.createInvite({ team_id: team.id, email, created_by: user.id });
              totalInvitesSent += 1;
            }
          } else {
            for (const email of memberEmails) {
              const member = await getOrCreate(email);
              await teamsRepository.addMember(team.id, member.id, "member");
            }
          }
        }
      }
      return toSuccess({ total_invites_sent: totalInvitesSent, teams: createdTeams.map(mapTeam) });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "teams", ":teamId"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const details = await teamsRepository.getWithDetails(params.teamId);
      if (!details || details.hackathon_id !== hackathon.id) throw new Error("TEAM_NOT_FOUND");
      return toSuccess(mapTeamWithDetails(details));
    },
  },
  {
    method: "GET",
    pattern: ["teams", ":teamId"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      return toSuccess(mapTeam(team));
    },
  },
  {
    method: "PATCH",
    pattern: ["teams", ":teamId"],
    handler: async ({ params, body }) => {
      const updated = await teamsRepository.update(params.teamId, {
        ...(body.name !== undefined ? { name: str(body.name) } : {}),
        ...(body.track_id !== undefined ? { track_id: nullableStr(body.track_id) } : {}),
        ...(body.status !== undefined ? { status: str(body.status) as TeamStatus } : {}),
      });
      if (!updated) throw new Error("TEAM_NOT_FOUND");
      return toSuccess(mapTeam(updated));
    },
  },
  {
    method: "DELETE",
    pattern: ["teams", ":teamId"],
    handler: async ({ params }) => {
      const ok = await teamsRepository.remove(params.teamId);
      if (!ok) throw new Error("TEAM_NOT_FOUND");
      return toSuccess(null);
    },
  },
  {
    method: "POST",
    pattern: ["teams", "join"],
    handler: async ({ body, user }) => {
      const team = await teamsRepository.getByInviteCode(str(body.invite_code));
      if (!team) throw new Error("INVITE_NOT_FOUND");
      await teamsRepository.addMember(team.id, user.id, "member");
      const details = await teamsRepository.getWithDetails(team.id);
      return toSuccess(details ? mapTeamWithDetails(details) : null);
    },
  },
  {
    method: "GET",
    pattern: ["teams", ":teamId", "members"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const rows = await teamsRepository.members(params.teamId);
      return toSuccess({ items: rows.map(mapTeamMember) });
    },
  },
  {
    method: "POST",
    pattern: ["teams", ":teamId", "members"],
    handler: async ({ params, body }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const role = str(body.role) === "leader" ? "leader" : "member";
      const member = await teamsRepository.addMember(params.teamId, str(body.user_id), role);
      return toSuccess(member);
    },
  },
  {
    method: "PATCH",
    pattern: ["teams", ":teamId", "members", ":userId"],
    handler: async ({ params, body }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const role = str(body.role) === "leader" ? "leader" : "member";
      await teamsRepository.updateMemberRole(params.teamId, params.userId, role);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["teams", ":teamId", "members", ":userId"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      await teamsRepository.removeMember(params.teamId, params.userId);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["teams", ":teamId", "invites"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const rows = await teamsRepository.invites(params.teamId);
      return toSuccess({ items: rows.map(mapTeamInvite) });
    },
  },
  {
    method: "POST",
    pattern: ["teams", ":teamId", "invites"],
    handler: async ({ params, body, user }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const invite = await teamsRepository.createInvite({
        team_id: params.teamId,
        email: str(body.email),
        created_by: user.id,
      });
      return toSuccess(mapTeamInvite(invite));
    },
  },
{
    method: "POST",
    pattern: ["teams", "invites", ":token", "accept"],
    handler: async ({ params, user }) => {
      const invite = await teamsRepository.acceptInvite(params.token, user.id);
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      const details = await teamsRepository.getWithDetails(invite.team_id);
      return toSuccess(details ? mapTeamWithDetails(details) : null);
    },
  },
  {
    method: "GET",
    pattern: ["invites", ":code"],
    public: true,
    handler: async ({ params }) => {
      const invite = await teamsRepository.inviteByToken(params.code);
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      return toSuccess({
        ...mapTeamInvite(invite),
        status: invite.status === "declined" ? "revoked" : invite.status,
      });
    },
  },
  {
    method: "POST",
    pattern: ["invites", ":code", "accept"],
    handler: async ({ params, user }) => {
      const invite = await teamsRepository.acceptInvite(params.code, user.id);
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["teams", ":teamId", "invites", ":inviteId"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const ok = await teamsRepository.deleteInvite(params.inviteId);
      if (!ok) throw new Error("INVITE_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["teams", ":teamId", "repos"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const rows = await teamsRepository.repos(params.teamId);
      return toSuccess({ items: rows });
    },
  },
  {
    method: "POST",
    pattern: ["teams", ":teamId", "repos"],
    handler: async ({ params, body }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const repo = await teamsRepository.linkRepo(params.teamId, str(body.repo_url));
      return toSuccess(repo);
    },
  },
  {
    method: "DELETE",
    pattern: ["teams", ":teamId", "repos", ":repoId"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const ok = await teamsRepository.unlinkRepo(params.repoId);
      if (!ok) throw new Error("TEAM_REPO_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["teams", ":teamId", "submissions"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const rows = await submissionsRepository.listByTeam(params.teamId);
      return toSuccess({ items: rows.map(mapSubmission) });
    },
  },
  {
    method: "GET",
    pattern: ["teams", ":teamId", "submissions", "current"],
    handler: async ({ params }) => {
      const team = await teamsRepository.getById(params.teamId);
      if (!team) throw new Error("TEAM_NOT_FOUND");
      const submission = await submissionsRepository.getCurrentForTeam(params.teamId);
      return toSuccess(submission ? mapSubmission(submission) : null);
    },
  },

  // ---- Submissions ---------------------------------------------------------
  {
    method: "GET",
    pattern: ["hackathons", ":id", "submissions"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
const rows = await submissionsRepository.listByHackathon(hackathon.id, {
        round_id: query.get("round_id") ?? undefined,
        current_only:
          query.get("current_only") === "true" || query.get("current_only") === "1" ? true : undefined,
      });
      const items = await Promise.all(
        rows.map(async (s) => {
          const team = await db.teams.get(s.team_id);
          const repos = await teamsRepository.repos(s.team_id);
          return {
            ...mapSubmission(s),
            team_name: team?.name ?? null,
            repo_url: repos[0]?.repo_url ?? null,
            title: null,
            description: null,
          };
        }),
      );
      return toSuccess(items, paginationMeta(items.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "submissions"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
const submission = await submissionsRepository.create({
        hackathon_id: hackathon.id,
        team_id: str(body.team_id),
        round_id: nullableStr(body.round_id) ?? undefined,
        tag_name: str(body.tag_name),
        commit_sha: str(body.commit_sha),
      });
      return toSuccess(mapSubmission(submission));
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "submissions", ":submissionId"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const submission = await submissionsRepository.getById(params.submissionId);
      if (!submission || submission.hackathon_id !== hackathon.id) {
        throw new Error("SUBMISSION_NOT_FOUND");
      }
      const team = await db.teams.get(submission.team_id);
      const repos = await teamsRepository.repos(submission.team_id);
      return toSuccess({
        ...mapSubmission(submission),
        team_name: team?.name ?? null,
        repo_url: repos[0]?.repo_url ?? null,
        title: null,
        description: null,
      });
    },
  },
  {
    method: "GET",
    pattern: ["submissions", ":id"],
    handler: async ({ params }) => {
      const submission = await submissionsRepository.getById(params.id);
      if (!submission) throw new Error("SUBMISSION_NOT_FOUND");
      return toSuccess(mapSubmission(submission));
    },
  },
  {
    method: "PATCH",
    pattern: ["submissions", ":id"],
    handler: async ({ params, body }) => {
      const updated = await submissionsRepository.update(params.id, {
        ...(body.tag_name !== undefined ? { tag_name: str(body.tag_name) } : {}),
        ...(body.commit_sha !== undefined ? { commit_sha: str(body.commit_sha) } : {}),
        ...(body.round_id !== undefined ? { round_id: nullableStr(body.round_id) } : {}),
        ...(body.status !== undefined ? { status: str(body.status) as SubmissionStatus } : {}),
      });
      if (!updated) throw new Error("SUBMISSION_NOT_FOUND");
      return toSuccess(mapSubmission(updated));
    },
  },
  {
    method: "DELETE",
    pattern: ["submissions", ":id"],
    handler: async ({ params }) => {
      const ok = await submissionsRepository.remove(params.id);
      if (!ok) throw new Error("SUBMISSION_NOT_FOUND");
      return toSuccess(null);
    },
  },
  {
    method: "POST",
    pattern: ["submissions", ":id", "validate"],
    handler: async ({ params }) => {
      const updated = await submissionsRepository.validate(params.id);
      if (!updated) throw new Error("SUBMISSION_NOT_FOUND");
      return toSuccess(mapSubmission(updated));
    },
  },// ---- Rounds --------------------------------------------------------------
  {
    method: "GET",
pattern: ["hackathons", ":id", "rounds"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await roundsRepository.listByHackathon(hackathon.id);
      return toSuccess(rows.map(mapRound), paginationMeta(rows.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "rounds"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const round = await roundsRepository.create(hackathon.id, {
        name: str(body.name),
        description: nullableStr(body.description) ?? undefined,
        round_number: num(body.round_number) || 1,
        submission_deadline: nullableStr(body.submission_deadline) ?? undefined,
        is_elimination: bool(body.is_elimination),
        sort_order: optionalNum(body.sort_order),
      });
      return toSuccess(mapRound(round));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "rounds", "initialize"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const inputs = Array.isArray(body.rounds) ? body.rounds : [];
      const created: RoundRecord[] = [];
      for (const input of inputs) {
        const item = input as Record<string, unknown>;
        const round = await roundsRepository.create(hackathon.id, {
          name: str(item.name),
          description: nullableStr(item.description) ?? undefined,
          round_number: num(item.round_number) || created.length + 1,
          submission_deadline: nullableStr(item.submission_deadline) ?? undefined,
          is_elimination: bool(item.is_elimination),
          sort_order: optionalNum(item.sort_order),
        });
        created.push(round);
      }
      if (created.length > 0) {
        await roundsRepository.initialize(created[0].id);
      }
      return toSuccess({ items: created.map(mapRound) });
    },
  },
{
    method: "GET",
    pattern: ["hackathons", ":id", "rounds", ":roundId"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const round = await roundsRepository.getById(params.roundId);
      if (!round || round.hackathon_id !== hackathon.id) throw new Error("ROUND_NOT_FOUND");
      return toSuccess(mapRound(round));
    },
  },
  {
    method: "PATCH",
    pattern: ["hackathons", ":id", "rounds", ":roundId"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const round = await roundsRepository.getById(params.roundId);
      if (!round || round.hackathon_id !== hackathon.id) throw new Error("ROUND_NOT_FOUND");
      const updated = await roundsRepository.update(params.roundId, {
        ...(body.submission_deadline !== undefined
          ? { submission_deadline: nullableStr(body.submission_deadline) }
          : {}),
      });
      return toSuccess(mapRound(updated ?? round));
    },
  },
  {
    method: "DELETE",
    pattern: ["hackathons", ":id", "rounds", ":roundId"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const round = await roundsRepository.getById(params.roundId);
      if (!round || round.hackathon_id !== hackathon.id) throw new Error("ROUND_NOT_FOUND");
      const ok = await roundsRepository.remove(params.roundId);
      if (!ok) throw new Error("ROUND_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "rounds", ":roundId", "initialize"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const round = await roundsRepository.getById(params.roundId);
      if (!round || round.hackathon_id !== hackathon.id) throw new Error("ROUND_NOT_FOUND");
      const updated =
        bool(body.is_initialized) || num(body.is_initialized) === 1
          ? await roundsRepository.initialize(params.roundId)
          : await roundsRepository.update(params.roundId, { status: "draft" });
      return toSuccess(mapRound(updated ?? round));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "rounds", ":roundId", "publish"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const round = await roundsRepository.getById(params.roundId);
      if (!round || round.hackathon_id !== hackathon.id) throw new Error("ROUND_NOT_FOUND");
      await roundsRepository.publishResults(params.roundId);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "rounds", ":roundId", "results"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const round = await roundsRepository.getById(params.roundId);
      if (!round || round.hackathon_id !== hackathon.id) throw new Error("ROUND_NOT_FOUND");
      const rows = await roundsRepository.getResults(params.roundId);
      const items = await Promise.all(
        rows.map(async (row) => {
          const team = await db.teams.get(row.team_id);
          return {
            team_id: row.team_id,
            team_name: team?.name ?? "Unknown Team",
            rank: row.rank,
            total_score: row.total_score,
            status: row.advanced === 1 ? "advanced" : "eliminated",
          };
        }),
      );
      return toSuccess(items);
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "rounds", ":roundId", "advance"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const round = await roundsRepository.getById(params.roundId);
      if (!round || round.hackathon_id !== hackathon.id) throw new Error("ROUND_NOT_FOUND");
      await roundsRepository.advance(params.roundId);
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["rounds", ":roundId"],
    handler: async ({ params }) => {
      const round = await roundsRepository.getById(params.roundId);
      if (!round) throw new Error("ROUND_NOT_FOUND");
      return toSuccess(mapRound(round));
    },
  },
  {
    method: "PATCH",
    pattern: ["rounds", ":roundId"],
    handler: async ({ params, body }) => {
      const updated = await roundsRepository.update(params.roundId, {
        ...(body.name !== undefined ? { name: str(body.name) } : {}),
        ...(body.description !== undefined ? { description: nullableStr(body.description) } : {}),
        ...(body.round_number !== undefined ? { round_number: num(body.round_number) } : {}),
        ...(body.scoring_closes_at !== undefined
          ? { submission_deadline: nullableStr(body.scoring_closes_at) }
          : {}),
        ...(body.submission_deadline !== undefined
          ? { submission_deadline: nullableStr(body.submission_deadline) }
          : {}),
        ...(body.is_elimination !== undefined ? { is_elimination: bool(body.is_elimination) ? 1 : 0 } : {}),
        ...(body.sort_order !== undefined ? { sort_order: num(body.sort_order) } : {}),
      });
      if (!updated) throw new Error("ROUND_NOT_FOUND");
      return toSuccess(mapRound(updated));
    },
  },
  {
    method: "DELETE",
    pattern: ["rounds", ":roundId"],
    handler: async ({ params }) => {
      const ok = await roundsRepository.remove(params.roundId);
      if (!ok) throw new Error("ROUND_NOT_FOUND");
      return toSuccess(null);
    },
  },
  {
    method: "POST",
    pattern: ["rounds", ":roundId", "initialize"],
    handler: async ({ params }) => {
      const round = await roundsRepository.initialize(params.roundId);
      if (!round) throw new Error("ROUND_NOT_FOUND");
      return toSuccess(mapRound(round));
    },
  },
  {
    method: "POST",
    pattern: ["rounds", ":roundId", "publish-results"],
    handler: async ({ params }) => {
      const rows = await roundsRepository.publishResults(params.roundId);
      return toSuccess(mapRoundResults(rows));
    },
  },
  {
    method: "POST",
    pattern: ["rounds", ":roundId", "advance"],
    handler: async ({ params }) => {
      const round = await roundsRepository.advance(params.roundId);
      if (!round) throw new Error("ROUND_NOT_FOUND");
      return toSuccess(mapRound(round));
    },
  },
  {
    method: "GET",
    pattern: ["rounds", ":roundId", "results"],
    handler: async ({ params }) => {
      const rows = await roundsRepository.getResults(params.roundId);
      return toSuccess(mapRoundResults(rows));
    },
  },// ---- Judging: judges -----------------------------------------------------
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judges"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await judgingRepository.listJudges(hackathon.id);
      return toSuccess({ items: rows.map(mapJudge) });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judges"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const email = str(body.email).toLowerCase();
      try {
        const judge = await judgingRepository.inviteJudge(hackathon.id, email);
        return toSuccess({
          judge: mapJudge(judge),
          invite_status: judge.status,
          message: "Judge invited",
          token: judge.id,
          already_invited: false,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "JUDGE_ALREADY_INVITED") {
const judges = await judgingRepository.listJudges(hackathon.id);
          const existing = judges.find((j) => j.user?.email?.toLowerCase() === email);
          if (existing) {
            return toSuccess({
              judge: mapJudge(existing),
              invite_status: existing.status,
              message: "Judge already invited",
              token: existing.id,
              already_invited: true,
            });
          }
        }
        throw error;
      }
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judges", "token", ":token"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const judge = await judgingRepository.getJudgeById(params.token);
      if (!judge || judge.hackathon_id !== hackathon.id) throw new Error("JUDGE_NOT_FOUND");
      const judgeUser = await usersRepository.getById(judge.user_id);
      return toSuccess(
        mapJudge({
          ...judge,
          user: judgeUser
            ? { id: judgeUser.id, name: judgeUser.name, email: judgeUser.email, avatar_url: judgeUser.avatar_url }
            : null,
        }),
      );
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judges", "accept"],
    handler: async ({ params, user }) => {
      const hackathon = await resolveHackathon(params.id);
      const judge = await judgingRepository.acceptJudgeInvite(hackathon.id, user.id);
      if (!judge) throw new Error("JUDGE_NOT_FOUND");
      const existingRole = await db.roles
        .where("scope_id")
        .equals(hackathon.id)
        .and((r) => r.user_id === user.id && r.role === "judge")
        .first();
      if (!existingRole) {
        await db.roles.add({
          id: crypto.randomUUID(),
          user_id: user.id,
          scope: "hackathon",
          scope_id: hackathon.id,
          role: "judge",
          created_at: new Date().toISOString(),
        });
      }
      const judgeUser = await usersRepository.getById(judge.user_id);
      return toSuccess(
        mapJudge({
          ...judge,
          user: judgeUser
            ? { id: judgeUser.id, name: judgeUser.name, email: judgeUser.email, avatar_url: judgeUser.avatar_url }
            : null,
        }),
      );
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judges", "decline"],
    handler: async ({ params, user }) => {
      const hackathon = await resolveHackathon(params.id);
      const judge = await judgingRepository.declineJudgeInvite(hackathon.id, user.id);
      if (!judge) throw new Error("JUDGE_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["hackathons", ":id", "judges", ":judgeId"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const ok = await judgingRepository.removeJudge(params.judgeId);
      if (!ok) throw new Error("JUDGE_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judges", "create-account"],
    public: true,
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const email = str(body.email).toLowerCase();
      let target = await usersRepository.getByEmail(email);
      if (!target) {
        target = await usersRepository.create({
          email,
          name: str(body.name) || email.split("@")[0],
          password: str(body.password) || str(body.temp_password) || "demo1234",
          password_must_change: true,
        });
      }
      let judge = await judgingRepository.getJudge(hackathon.id, target.id);
      if (!judge) {
        const invited = await judgingRepository.inviteJudge(hackathon.id, email);
        judge = { ...invited };
      }
      const session = await sessionStore.loginAs(target.id, "judge");
      return toSuccess({
        user: mapAdminUser(target),
        judge: mapJudge({ ...judge, user: { id: target.id, name: target.name, email: target.email, avatar_url: target.avatar_url } }),
        session,
      });
    },
  },

  // ---- Judging: rubric -----------------------------------------------------
  {
    method: "GET",
    pattern: ["hackathons", ":id", "rubric"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await judgingRepository.listRubric(hackathon.id);
      return toSuccess({ items: rows });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "rubric"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const criterion = await judgingRepository.createCriterion(hackathon.id, {
        name: str(body.name),
        description: nullableStr(body.description) ?? undefined,
        max_score: num(body.max_score) || 10,
        weight: num(body.weight) || 1,
        track_id: nullableStr(body.track_id) ?? undefined,
        sort_order: optionalNum(body.sort_order),
      });
      return toSuccess(criterion);
    },
  },
  {
    method: "PATCH",
    pattern: ["rubric", ":criterionId"],
    handler: async ({ params, body }) => {
      const updated = await judgingRepository.updateCriterion(params.criterionId, {
        ...(body.name !== undefined ? { name: str(body.name) } : {}),
        ...(body.description !== undefined ? { description: nullableStr(body.description) } : {}),
        ...(body.max_score !== undefined ? { max_score: num(body.max_score) } : {}),
        ...(body.weight !== undefined ? { weight: num(body.weight) } : {}),
        ...(body.track_id !== undefined ? { track_id: nullableStr(body.track_id) } : {}),
        ...(body.sort_order !== undefined ? { sort_order: num(body.sort_order) } : {}),
      });
      if (!updated) throw new Error("CRITERION_NOT_FOUND");
      return toSuccess(updated);
    },
  },
  {
    method: "DELETE",
    pattern: ["rubric", ":criterionId"],
    handler: async ({ params }) => {
      const ok = await judgingRepository.deleteCriterion(params.criterionId);
      if (!ok) throw new Error("CRITERION_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },// ---- Judging: assignments -------------------------------------------------
  {
    method: "GET",
    pattern: ["hackathons", ":id", "assignments"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await judgingRepository.listAssignments(hackathon.id);
      return toSuccess({ items: rows.map(mapAssignment) });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "assignments"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const judges = await judgingRepository.listJudges(hackathon.id);
      const accepted = judges.filter((j) => j.status === "accepted").map((j) => j.id);
      if (accepted.length === 0) throw new Error("NO_ACCEPTED_JUDGES");
      const submissions = await submissionsRepository.listByHackathon(hackathon.id, { current_only: true });
      if (submissions.length === 0) throw new Error("NO_SUBMISSIONS");
      const rounds = await roundsRepository.listByHackathon(hackathon.id);
      const latestRound = rounds.length > 0 ? rounds[rounds.length - 1].round_number : 1;
      const created = await judgingRepository.createAssignments(
        hackathon.id,
        accepted,
        submissions.map((s) => s.id),
        latestRound,
      );
      const details = await judgingRepository.decorateAssignments(created);
      return toSuccess({ items: details.map(mapAssignment), created: created.length });
    },
  },
  {
    method: "POST",
    pattern: ["assignments"],
    handler: async ({ body }) => {
      const hackathon = await resolveHackathon(str(body.hackathon_id));
      const created = await judgingRepository.createAssignments(
        hackathon.id,
        [str(body.judge_id)],
        [str(body.submission_id)],
        num(body.round) || 1,
      );
      const details = await judgingRepository.decorateAssignments(created);
      return toSuccess({ items: details.map(mapAssignment) });
    },
  },
  {
    method: "GET",
    pattern: ["assignments", ":id"],
    handler: async ({ params }) => {
      const assignment = await judgingRepository.getAssignment(params.id);
      if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
      const [details] = await judgingRepository.decorateAssignments([assignment]);
      return toSuccess(mapAssignment(details));
    },
  },
  {
    method: "PATCH",
    pattern: ["assignments", ":id"],
    handler: async ({ params, body }) => {
      const status = str(body.status) as JudgeAssignmentRecord["status"];
      const updated = await judgingRepository.setAssignmentStatus(params.id, status);
      if (!updated) throw new Error("ASSIGNMENT_NOT_FOUND");
      const [details] = await judgingRepository.decorateAssignments([updated]);
      return toSuccess(mapAssignment(details));
    },
  },
  {
    method: "POST",
    pattern: ["assignments", ":id", "reassign"],
    handler: async ({ params, body }) => {
      const updated = await judgingRepository.reassignAssignment(params.id, str(body.judge_id));
      if (!updated) throw new Error("ASSIGNMENT_NOT_FOUND");
      const [details] = await judgingRepository.decorateAssignments([updated]);
      return toSuccess(mapAssignment(details));
    },
  },
  {
    method: "POST",
    pattern: ["assignments", ":id", "scores"],
    handler: async ({ params, body }) => {
      const scores = Array.isArray(body.scores) ? (body.scores as SubmitScoreInput[]) : [];
      const created = await judgingRepository.submitScores(params.id, scores);
      return toSuccess({ items: created });
    },
  },
  {
    method: "GET",
    pattern: ["assignments", ":id", "scores"],
    handler: async ({ params }) => {
      const assignment = await judgingRepository.getAssignment(params.id);
      if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
      const [rows, rubric] = await Promise.all([
        db.scores.where("assignment_id").equals(assignment.id).toArray(),
        judgingRepository.listRubric(assignment.hackathon_id),
      ]);
      const nameById = new Map(rubric.map((c) => [c.id, c.name]));
      return toSuccess({
        items: rows.map((s) => ({ ...s, criterion_name: nameById.get(s.criterion_id) ?? null })),
      });
    },
  },
  {
    method: "POST",
    pattern: ["assignments", ":id", "conflicts"],
    handler: async ({ params, body, user }) => {
      const assignment = await judgingRepository.getAssignment(params.id);
      if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
      const hackathon = await resolveHackathon(assignment.hackathon_id);
      const selfJudge = await judgingRepository.getJudge(hackathon.id, user.id);
      const judgeId = selfJudge?.id ?? assignment.judge_id;
      const conflict = await judgingRepository.declareConflict(assignment.id, judgeId, str(body.reason));
      return toSuccess(mapConflict(conflict));
    },
  },
  {
    method: "DELETE",
    pattern: ["assignments", ":id", "conflicts"],
    handler: async ({ params }) => {
      const ok = await judgingRepository.clearConflict(params.id);
      if (!ok) throw new Error("CONFLICT_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "conflicts"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await judgingRepository.listConflicts(hackathon.id);
      return toSuccess({ items: rows.map(mapConflict) });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "leaderboard"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const roundNumber = query.get("round_number") ? Number(query.get("round_number")) : undefined;
      const [entries, allScores, judges] = await Promise.all([
        computeLeaderboard(hackathon.id, roundNumber),
        db.scores.toArray(),
        judgingRepository.listJudges(hackathon.id),
      ]);
      const totalJudges = judges.filter((j) => j.status === "accepted").length;
      const items = entries.map((entry) => {
        const judgeIds = new Set(
          allScores
            .filter((s) => s.submission_id === entry.submission_id && s.round === entry.round)
            .map((s) => s.judge_id),
        );
        return mapLeaderboard(entry, judgeIds.size, totalJudges);
      });
return toSuccess({ items });
    },
  },

  // ---- Judging: platform (judging-prefixed) --------------------------------
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judging", "judges"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await judgingRepository.listJudges(hackathon.id);
      return toSuccess(rows.map(mapJudge), paginationMeta(rows.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judging", "judges"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const email = str(body.email).toLowerCase();
      try {
        await judgingRepository.inviteJudge(hackathon.id, email);
        return toSuccess({
          already_invited: false,
          message: "Judge invited",
          self_accepted: false,
          invite_status: "pending",
        });
      } catch (error) {
        if (error instanceof Error && error.message === "JUDGE_ALREADY_INVITED") {
          return toSuccess({
            already_invited: true,
            message: "Judge already invited",
            self_accepted: false,
            invite_status: "pending",
          });
        }
        throw error;
      }
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judging", "leaderboard"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const roundNumber = query.get("round_number") ? Number(query.get("round_number")) : undefined;
      const [entries, allScores, judges] = await Promise.all([
        computeLeaderboard(hackathon.id, roundNumber),
        db.scores.toArray(),
        judgingRepository.listJudges(hackathon.id),
      ]);
      const totalJudges = judges.filter((j) => j.status === "accepted").length;
      const items = entries.map((entry) => {
        const judgeIds = new Set(
          allScores
            .filter((s) => s.submission_id === entry.submission_id && s.round === entry.round)
            .map((s) => s.judge_id),
        );
        return mapLeaderboard(entry, judgeIds.size, totalJudges);
      });
      return toSuccess(items);
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judging", "rubric"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await judgingRepository.listRubric(hackathon.id);
      return toSuccess(rows, paginationMeta(rows.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judging", "rubric"],
    handler: async ({ params, body }) => {
      const hackathon = await resolveHackathon(params.id);
      const criterion = await judgingRepository.createCriterion(hackathon.id, {
        name: str(body.name),
        description: nullableStr(body.description) ?? undefined,
        max_score: num(body.max_score) || 10,
        weight: num(body.weight) || 1,
        track_id: nullableStr(body.track_id) ?? undefined,
        sort_order: optionalNum(body.sort_order),
      });
      return toSuccess(criterion);
    },
  },
  {
    method: "PATCH",
    pattern: ["hackathons", ":id", "judging", "rubric", ":criterionId"],
    handler: async ({ params, body }) => {
      const updated = await judgingRepository.updateCriterion(params.criterionId, {
        ...(body.name !== undefined ? { name: str(body.name) } : {}),
        ...(body.description !== undefined ? { description: nullableStr(body.description) } : {}),
        ...(body.max_score !== undefined ? { max_score: num(body.max_score) } : {}),
        ...(body.weight !== undefined ? { weight: num(body.weight) } : {}),
        ...(body.track_id !== undefined ? { track_id: nullableStr(body.track_id) } : {}),
        ...(body.sort_order !== undefined ? { sort_order: num(body.sort_order) } : {}),
      });
      if (!updated) throw new Error("CRITERION_NOT_FOUND");
      return toSuccess(updated);
    },
  },
  {
    method: "DELETE",
    pattern: ["hackathons", ":id", "judging", "rubric", ":criterionId"],
    handler: async ({ params }) => {
      const ok = await judgingRepository.deleteCriterion(params.criterionId);
      if (!ok) throw new Error("CRITERION_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judging", "my-assignments"],
    handler: async ({ params, user, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const judge = await judgingRepository.getJudge(hackathon.id, user.id);
      if (!judge) return toSuccess([]);
      const rows = await judgingRepository.listAssignmentsByJudge(judge.id, hackathon.id);
      const items = rows.map((a) => ({ ...mapAssignment(a), hackathon_slug: hackathon.slug }));
      return toSuccess(items, paginationMeta(items.length, query));
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judging", "my-scores"],
    handler: async ({ params, user }) => {
      const hackathon = await resolveHackathon(params.id);
      const judge = await judgingRepository.getJudge(hackathon.id, user.id);
      if (!judge) return toSuccess([]);
      const assignments = await judgingRepository.myScores(judge.id, hackathon.id);
      const rubric = await judgingRepository.listRubric(hackathon.id);
      const criterionById = new Map(rubric.map((c) => [c.id, c]));
      const items: Record<string, unknown>[] = [];
      for (const assignment of assignments) {
        for (const score of assignment.scores ?? []) {
          const criterion = criterionById.get(score.criterion_id);
          items.push({
            submission_id: assignment.submission_id,
            criteria_id: score.criterion_id,
            score: score.score,
            comment: score.comment,
            round: score.round,
            scored_at: score.created_at,
            criterion_name: criterion?.name ?? null,
            max_score: criterion?.max_score ?? null,
            weight: criterion?.weight ?? null,
            submission_title: assignment.submission?.tag_name ?? null,
            team_name: assignment.team?.name ?? null,
          });
        }
      }
      return toSuccess(items);
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judging", "coi"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await judgingRepository.listConflicts(hackathon.id);
      const items = await Promise.all(
        rows.map(async (c) => {
          const assignment = await db.judgeAssignments.get(c.assignment_id);
          const judge = await db.judges.get(c.judge_id);
          const judgeUser = judge ? await db.users.get(judge.user_id) : null;
          const team = assignment ? await db.teams.get(assignment.team_id) : null;
          return {
            assignment_id: c.assignment_id,
            team_id: team?.id ?? null,
            judge_id: c.judge_id,
            team_name: team?.name ?? null,
            judge_name: judgeUser?.name ?? null,
            judge_email: judgeUser?.email ?? null,
            declared_at: c.declared_at,
          };
        }),
      );
      return toSuccess(items);
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judging", "assignments", ":assignmentId", "reassign"],
    handler: async ({ params, body }) => {
      const updated = await judgingRepository.reassignAssignment(
        params.assignmentId,
        str(body.judge_id) || str(body.new_judge_id),
      );
      if (!updated) throw new Error("ASSIGNMENT_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judging", "assignments", ":assignmentId", "coi"],
    handler: async ({ params, body, user }) => {
      const hackathon = await resolveHackathon(params.id);
      const assignment = await judgingRepository.getAssignment(params.assignmentId);
      if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
      const selfJudge = await judgingRepository.getJudge(hackathon.id, user.id);
      const judgeId = selfJudge?.id ?? assignment.judge_id;
      const conflict = await judgingRepository.declareConflict(
        assignment.id,
        judgeId,
        str(body.reason) || "Conflict of interest",
      );
      return toSuccess(mapConflict(conflict));
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judging", "submissions", ":submissionId", "scores"],
    handler: async ({ params, body }) => {
      const raw = Array.isArray(body.scores) ? (body.scores as Record<string, unknown>[]) : [];
      const byAssignment = new Map<string, SubmitScoreInput[]>();
      for (const item of raw) {
        const assignmentId = str(item.assignment_id);
        if (!assignmentId) continue;
        const entry: SubmitScoreInput = {
          criterion_id: str(item.criteria_id),
          score: num(item.score),
          comment: item.comment == null ? undefined : str(item.comment),
        };
        const list = byAssignment.get(assignmentId) ?? [];
        list.push(entry);
        byAssignment.set(assignmentId, list);
      }
      for (const [assignmentId, entries] of byAssignment) {
        await judgingRepository.submitScores(assignmentId, entries);
      }
      return toSuccess({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judging", "assign"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const judges = await judgingRepository.listJudges(hackathon.id);
      const accepted = judges.filter((j) => j.status === "accepted").map((j) => j.id);
      if (accepted.length === 0) throw new Error("NO_ACCEPTED_JUDGES");
      const rounds = await roundsRepository.listByHackathon(hackathon.id);
      const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
      const submissions = latestRound
        ? await submissionsRepository.listByHackathon(hackathon.id, {
            round_id: latestRound.id,
            current_only: true,
          })
        : [];
      if (submissions.length === 0) throw new Error("NO_SUBMISSIONS");
      const created = await judgingRepository.createAssignments(
        hackathon.id,
        accepted,
        submissions.map((s) => s.id),
        latestRound?.round_number ?? 1,
      );
      return toSuccess({ assigned: created.length });
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "judging", "judges", ":judgeId", "accept"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const judge = await judgingRepository.getJudgeById(params.judgeId);
      if (!judge || judge.hackathon_id !== hackathon.id) throw new Error("JUDGE_NOT_FOUND");
      await judgingRepository.acceptJudgeInvite(hackathon.id, judge.user_id);
      const existingRole = await db.roles
        .where("scope_id")
        .equals(hackathon.id)
        .and((r) => r.user_id === judge.user_id && r.role === "judge")
        .first();
      if (!existingRole) {
        await db.roles.add({
          id: crypto.randomUUID(),
          user_id: judge.user_id,
          scope: "hackathon",
          scope_id: hackathon.id,
          role: "judge",
          created_at: new Date().toISOString(),
        });
      }
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "judging", "judges", ":judgeId", "assignments"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const judge = await judgingRepository.getJudgeById(params.judgeId);
      if (!judge || judge.hackathon_id !== hackathon.id) throw new Error("JUDGE_NOT_FOUND");
      const rows = await judgingRepository.listAssignmentsByJudge(params.judgeId, hackathon.id);
      const items = rows.map((a) => ({ id: a.id, status: a.status }));
      return toSuccess(items, paginationMeta(items.length, query));
    },
  },

  // ---- Judging: judge portal -----------------------------------------------
  {
    method: "GET",
    pattern: ["judges", "me"],
    handler: async ({ user }) => {
      const judgeRows = await db.judges.where("user_id").equals(user.id).toArray();
      const items = await Promise.all(
        judgeRows.map(async (judge) => {
          const hackathon = await hackathonsRepository.getById(judge.hackathon_id);
          if (!hackathon) return null;
          const judgeUser = await usersRepository.getById(judge.user_id);
          return {
            hackathon: mapJudgeHackathon(hackathon),
            judge: mapJudge({
              ...judge,
              user: judgeUser
                ? { id: judgeUser.id, name: judgeUser.name, email: judgeUser.email, avatar_url: judgeUser.avatar_url }
                : null,
            }),
          };
        }),
      );
      return toSuccess({ user: mapAdminUser(user), items: items.filter(Boolean) });
    },
  },
  {
    method: "GET",
    pattern: ["judges", "me", "assignments"],
    handler: async ({ query, user }) => {
      const hackathonId = query.get("hackathon_id");
      if (!hackathonId) return toSuccess({ items: [] });
      const hackathon = await resolveHackathon(hackathonId);
      const judge = await judgingRepository.getJudge(hackathon.id, user.id);
      if (!judge) return toSuccess({ items: [] });
      const rows = await judgingRepository.listAssignmentsByJudge(judge.id, hackathon.id);
      return toSuccess({ items: rows.map(mapAssignment) });
    },
  },
  {
    method: "GET",
    pattern: ["judges", "me", "scores"],
    handler: async ({ query, user }) => {
      const hackathonId = query.get("hackathon_id");
      if (!hackathonId) return toSuccess({ items: [] });
      const hackathon = await resolveHackathon(hackathonId);
      const judge = await judgingRepository.getJudge(hackathon.id, user.id);
      if (!judge) return toSuccess({ items: [] });
const rows = await judgingRepository.myScores(judge.id, hackathon.id);
      return toSuccess({ items: rows.map(mapAssignment) });
    },
  },
  {
    method: "GET",
    pattern: ["judge", "hackathons"],
    handler: async ({ user }) => {
      const judgeRows = await db.judges.where("user_id").equals(user.id).toArray();
      const items = await Promise.all<Record<string, unknown> | null>(
        judgeRows.map(async (judge) => {
          const hackathon = await hackathonsRepository.getById(judge.hackathon_id);
          if (!hackathon) return null;
          const assignments = await db.judgeAssignments
            .where("judge_id")
            .equals(judge.id)
            .toArray();
          const mine = assignments.filter((a) => a.hackathon_id === hackathon.id);
          return {
            id: hackathon.id,
            hackathon_id: hackathon.id,
            hackathon_title: hackathon.title,
            hackathon_slug: hackathon.slug,
            hackathon_status: hackathon.status,
            invite_status: judge.status,
            pending_assignments: mine.filter((a) => a.status === "pending").length,
            completed_assignments: mine.filter((a) => a.status === "scored").length,
          };
        }),
      );
      return toSuccess(items.filter((i): i is Record<string, unknown> => i !== null));
    },
  },// ---- Announcements ----------------------------------------------------------
  {
    method: "GET",
pattern: ["hackathons", ":id", "announcements"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const rows = await announcementsRepository.listByHackathon(hackathon.id);
      const items = await Promise.all(
        rows.map(async (a) => {
          const author = await db.users.get(a.created_by);
          return {
            ...mapAnnouncement(a),
            author_name: author?.name ?? null,
            author_avatar: author?.avatar_url ?? null,
          };
        }),
      );
      return toSuccess(items);
    },
  },
  {
    method: "POST",
    pattern: ["hackathons", ":id", "announcements"],
    handler: async ({ params, body, user }) => {
      const hackathon = await resolveHackathon(params.id);
const record = await announcementsRepository.create({
        hackathon_id: hackathon.id,
        title: str(body.title),
        body: nullableStr(body.content) ?? nullableStr(body.body) ?? null,
        created_by: user.id,
      });
return toSuccess(mapAnnouncement(record));
    },
  },
  {
    method: "DELETE",
    pattern: ["hackathons", ":id", "announcements", ":announcementId"],
    handler: async ({ params }) => {
      const hackathon = await resolveHackathon(params.id);
      const record = await announcementsRepository.getById(params.announcementId);
      if (!record || record.hackathon_id !== hackathon.id) throw new Error("ANNOUNCEMENT_NOT_FOUND");
      const ok = await announcementsRepository.remove(params.announcementId);
      if (!ok) throw new Error("ANNOUNCEMENT_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["announcements", ":id"],
    handler: async ({ params }) => {
      const record = await announcementsRepository.getById(params.id);
      if (!record) throw new Error("ANNOUNCEMENT_NOT_FOUND");
      return toSuccess(mapAnnouncement(record));
    },
  },
  {
    method: "PATCH",
    pattern: ["announcements", ":id"],
    handler: async ({ params, body }) => {
      const updated = await announcementsRepository.update(params.id, {
        ...(body.title !== undefined ? { title: str(body.title) } : {}),
        ...(body.body !== undefined ? { body: nullableStr(body.body) } : {}),
      });
      if (!updated) throw new Error("ANNOUNCEMENT_NOT_FOUND");
      return toSuccess(mapAnnouncement(updated));
    },
  },
  {
    method: "DELETE",
    pattern: ["announcements", ":id"],
    handler: async ({ params }) => {
      const ok = await announcementsRepository.remove(params.id);
      if (!ok) throw new Error("ANNOUNCEMENT_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },

  // ---- Notifications --------------------------------------------------------
  {
    method: "GET",
    pattern: ["notifications"],
    handler: async ({ user, query }) => {
      const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 20));
      const offset = Math.max(0, Number(query.get("offset")) || 0);
const result = await notificationsRepository.listForUser(user.id, limit, offset);
      return toSuccess(result.items.map(mapNotification), {
        total: result.total,
        limit,
        offset,
        has_more: result.has_more,
      });
    },
  },
  {
    method: "GET",
    pattern: ["notifications", "unread-count"],
    handler: async ({ user }) => {
      const count = await notificationsRepository.unreadCount(user.id);
      return toSuccess({ count });
    },
  },
  {
    method: "POST",
    pattern: ["notifications", "read-all"],
    handler: async ({ user }) => {
      const count = await notificationsRepository.markAllRead(user.id);
      return toSuccess({ count });
    },
  },
  {
    method: "PATCH",
    pattern: ["notifications", "read-all"],
    handler: async ({ user }) => {
      const count = await notificationsRepository.markAllRead(user.id);
      return toSuccess({ count });
    },
  },
  {
    method: "POST",
    pattern: ["notifications", ":id", "read"],
    handler: async ({ params, user }) => {
      const ok = await notificationsRepository.markRead(params.id, user.id);
      if (!ok) throw new Error("NOTIFICATION_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "PATCH",
    pattern: ["notifications", ":id", "read"],
    handler: async ({ params, user }) => {
      const ok = await notificationsRepository.markRead(params.id, user.id);
      if (!ok) throw new Error("NOTIFICATION_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["notifications", ":id"],
    handler: async ({ params }) => {
      const ok = await notificationsRepository.remove(params.id);
      if (!ok) throw new Error("NOTIFICATION_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },

  // ---- Hackathon requests ---------------------------------------------------
  {
    method: "GET",
    pattern: ["hackathon-requests"],
    handler: async ({ user, query }) => {
const rows = await hackathonRequestsRepository.list({
        ...(query.get("status") ? { status: query.get("status") as HackathonRequestStatus } : {}),
        ...(query.get("workspace_id") ? { workspace_id: query.get("workspace_id")! } : {}),
        ...(query.get("requested_by") ? { requested_by: query.get("requested_by")! } : {}),
      });
      return toSuccess(rows.map(mapRequest), paginationMeta(rows.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["hackathon-requests"],
    handler: async ({ body, user }) => {
      const input: CreateRequestInput = {
        workspace_id: nullableStr(body.workspace_id),
        requested_by: user.id,
        title: str(body.title),
        description: nullableStr(body.description) ?? undefined,
        slug: slugify(str(body.title)),
        starts_at: nullableStr(body.starts_at) ?? undefined,
        ends_at: nullableStr(body.ends_at) ?? undefined,
        num_events: optionalNum(body.num_events),
        expected_participants: optionalNum(body.expected_participants),
        team_min_size: optionalNum(body.team_min_size),
        team_max_size: optionalNum(body.team_max_size),
        additional_details: nullableStr(body.additional_details) ?? undefined,
      };
const record = await hackathonRequestsRepository.create(input);
      return toSuccess(mapRequest(record));
    },
  },
  {
    method: "GET",
    pattern: ["hackathon-requests", "admin", "stats"],
    handler: async () => {
      const counts = await hackathonRequestsRepository.countByStatus();
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      return toSuccess({
        total,
        ...counts,
        changes_requested: 0,
      });
    },
  },
  {
    method: "GET",
    pattern: ["hackathon-requests", "admin", "all"],
    handler: async ({ query }) => {
      const rows = await hackathonRequestsRepository.list(
        query.get("status") ? { status: query.get("status") as HackathonRequestStatus } : {},
      );
      const limit = Math.max(1, Math.min(100, Number(query.get("limit")) || 20));
      const offset = Math.max(0, Number(query.get("offset")) || 0);
      const items = await Promise.all(
        rows.slice(offset, offset + limit).map(async (r) => {
          const workspace = r.workspace_id ? await workspacesRepository.getById(r.workspace_id) : undefined;
          const requester = await usersRepository.getById(r.requested_by);
          return {
            ...mapRequest(r),
            workspace_name: workspace?.name ?? null,
            workspace_slug: workspace?.slug ?? null,
            requester_name: requester?.name ?? null,
            requester_email: requester?.email ?? null,
          };
        }),
      );
      return toSuccess(items, { total: rows.length, limit, offset, has_more: offset + limit < rows.length });
    },
  },
  {
    method: "PATCH",
    pattern: ["hackathon-requests", "admin", ":id"],
    handler: async ({ params, body }) => {
      const existing = await hackathonRequestsRepository.getById(params.id);
      if (!existing) throw new Error("REQUEST_NOT_FOUND");
      const updated = await hackathonRequestsRepository.update(params.id, {
        status: str(body.status) as HackathonRequestStatus,
        review_notes: nullableStr(body.admin_notes) ?? existing.review_notes,
      });
      if (!updated) throw new Error("REQUEST_NOT_FOUND");
      return toSuccess(mapRequest(updated));
    },
  },
  {
    method: "GET",
    pattern: ["hackathon-requests", ":id"],
    handler: async ({ params }) => {
      const record = await hackathonRequestsRepository.getById(params.id);
      if (!record) throw new Error("REQUEST_NOT_FOUND");
      return toSuccess(mapRequest(record));
    },
  },
  {
    method: "PATCH",
    pattern: ["hackathon-requests", ":id"],
    handler: async ({ params, body, user }) => {
      const updated = await hackathonRequestsRepository.update(params.id, {
        ...(body.title !== undefined ? { title: str(body.title) } : {}),
        ...(body.description !== undefined ? { description: nullableStr(body.description) } : {}),
        ...(body.slug !== undefined ? { slug: slugify(str(body.slug)) } : {}),
        ...(body.workspace_id !== undefined ? { workspace_id: nullableStr(body.workspace_id) } : {}),
        ...(body.starts_at !== undefined ? { starts_at: nullableStr(body.starts_at) } : {}),
        ...(body.ends_at !== undefined ? { ends_at: nullableStr(body.ends_at) } : {}),
        ...(body.num_events !== undefined ? { num_events: optionalNum(body.num_events) } : {}),
        ...(body.expected_participants !== undefined ? { expected_participants: optionalNum(body.expected_participants) } : {}),
        ...(body.team_min_size !== undefined ? { team_min_size: optionalNum(body.team_min_size) } : {}),
        ...(body.team_max_size !== undefined ? { team_max_size: optionalNum(body.team_max_size) } : {}),
        ...(body.additional_details !== undefined ? { additional_details: nullableStr(body.additional_details) } : {}),
      });
      if (!updated) throw new Error("REQUEST_NOT_FOUND");
      return toSuccess(mapRequest(updated));
    },
  },
{
    method: "PUT",
    pattern: ["hackathon-requests", ":id", "resubmit"],
    handler: async ({ params, body, user }) => {
      const input: CreateRequestInput = {
        workspace_id: nullableStr(body.workspace_id),
        requested_by: user.id,
        title: str(body.title),
        description: nullableStr(body.description) ?? undefined,
        slug: slugify(str(body.title)),
        starts_at: nullableStr(body.starts_at) ?? undefined,
        ends_at: nullableStr(body.ends_at) ?? undefined,
        num_events: optionalNum(body.num_events),
        expected_participants: optionalNum(body.expected_participants),
        team_min_size: optionalNum(body.team_min_size),
        team_max_size: optionalNum(body.team_max_size),
        additional_details: nullableStr(body.additional_details) ?? undefined,
      };
      const updated = await hackathonRequestsRepository.resubmit(params.id, input);
      if (!updated) throw new Error("REQUEST_NOT_FOUND");
      return toSuccess(mapRequest(updated));
    },
  },
  {
    method: "POST",
    pattern: ["hackathon-requests", ":id", "review"],
    handler: async ({ params, body, user }) => {
      const status = str(body.status) as HackathonRequestStatus;
      const updated = await hackathonRequestsRepository.review(
        params.id,
        status,
        user.id,
        nullableStr(body.notes) ?? undefined,
      );
      if (!updated) throw new Error("REQUEST_NOT_FOUND");
      return toSuccess(mapRequest(updated));
    },
  },
  {
    method: "DELETE",
    pattern: ["hackathon-requests", ":id"],
    handler: async ({ params }) => {
      const ok = await hackathonRequestsRepository.remove(params.id);
      if (!ok) throw new Error("REQUEST_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },// ---- Admin: stats & lists --------------------------------------------------
  {
    method: "GET",
    pattern: ["admin", "stats"],
handler: async () => {
      const stats = await adminRepository.stats();
      return toSuccess({ ...stats, active_hackathons: stats.hackathons_by_status.active ?? 0 });
    },
  },
  {
    method: "GET",
    pattern: ["admin", "hackathons"],
    handler: async ({ query }) => {
      const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 20));
      const offset = Math.max(0, Number(query.get("offset")) || 0);
      const result = await hackathonsRepository.list({ limit, offset });
const items = await Promise.all(
        result.items.map(async (h) => mapAdminHackathon(h, await latestSubmissionDeadline(h.id))),
      );
      return toSuccess(items, { total: result.total, limit, offset, has_more: result.has_more });
    },
  },
  {
    method: "GET",
    pattern: ["admin", "hackathons", ":id"],
    handler: async ({ params }) => {
      const hackathon = await hackathonsRepository.getById(params.id);
      if (!hackathon) throw new Error("HACKATHON_NOT_FOUND");
      const workspace = hackathon.workspace_id
        ? await workspacesRepository.getById(hackathon.workspace_id)
        : null;
      const creator = await usersRepository.getById(hackathon.created_by);
      const [teamCount, submissionCount, roundCount] = await Promise.all([
        db.teams.where("hackathon_id").equals(hackathon.id).count(),
        db.submissions.where("hackathon_id").equals(hackathon.id).count(),
        db.rounds.where("hackathon_id").equals(hackathon.id).count(),
      ]);
      return toSuccess({
        ...mapAdminHackathon(hackathon, await latestSubmissionDeadline(hackathon.id)),
        hackathon_id: hackathon.id,
        workspace_name: workspace?.name ?? null,
        workspace: workspace
          ? { id: workspace.id, name: workspace.name, slug: workspace.slug }
          : null,
        creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
        team_count: teamCount,
        submission_count: submissionCount,
        round_count: roundCount,
      });
    },
  },
  {
    method: "GET",
    pattern: ["admin", "hackathons", ":id", "rounds"],
    handler: async ({ params }) => {
      const rows = await roundsRepository.listByHackathon(params.id);
      return toSuccess(rows.map(mapRound));
    },
  },
  {
    method: "PATCH",
    pattern: ["admin", "hackathons", ":id", "rounds", ":roundId", "initialize"],
    handler: async ({ params, body }) => {
      const round = await roundsRepository.getById(params.roundId);
      if (!round) throw new Error("ROUND_NOT_FOUND");
      const updated =
        bool(body.is_initialized) || num(body.is_initialized) === 1
          ? await roundsRepository.initialize(params.roundId)
          : await roundsRepository.update(params.roundId, { status: "published" });
      if (!updated) throw new Error("ROUND_NOT_FOUND");
      return toSuccess(mapRound(updated));
    },
  },
  {
    method: "GET",
    pattern: ["admin", "workspaces"],
    handler: async ({ query }) => {
      const rows = await workspacesRepository.list();
      const items = await Promise.all(
        rows.map(async (w) => {
          const count = await db.hackathons.where("workspace_id").equals(w.id).count();
          return mapAdminWorkspace(w, count);
        }),
      );
return toSuccess(items, paginationMeta(items.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["admin", "workspaces"],
    handler: async ({ body, user }) => {
      const workspace = await workspacesRepository.create({
        name: str(body.name),
        slug: str(body.slug),
        description: nullableStr(body.description) ?? undefined,
        type: "club",
        created_by: user.id,
      });
      const ownerEmail = str(body.owner_email).toLowerCase();
      const owner = await usersRepository.getByEmail(ownerEmail);
      if (owner) {
        await workspacesRepository.addMember(workspace.id, owner.id, "admin");
      } else {
        await workspacesRepository.createInvite({
          workspace_id: workspace.id,
          email: ownerEmail,
          role: "admin",
          created_by: user.id,
        });
      }
      return toSuccess(workspace);
    },
  },
  {
    method: "GET",
    pattern: ["admin", "workspaces", ":id"],
    handler: async ({ params }) => {
      const workspace = await workspacesRepository.getById(params.id);
      if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
      const [members, hackathonCount] = await Promise.all([
        workspacesRepository.members(params.id),
        db.hackathons.where("workspace_id").equals(workspace.id).count(),
      ]);
      return toSuccess({
        ...mapAdminWorkspace(workspace, hackathonCount),
        workspace_id: workspace.id,
        members: members.map((m) => ({
          user_id: m.user_id,
          name: m.user?.name ?? null,
          email: m.user?.email ?? null,
          role: m.role,
        })),
      });
    },
  },
  {
    method: "GET",
    pattern: ["admin", "users"],
handler: async ({ query }) => {
      const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 20));
      const offset = Math.max(0, Number(query.get("offset")) || 0);
const rows = await usersRepository.list(limit, offset);
      return toSuccess(rows.items.map(mapAdminUser), {
        total: rows.total,
        limit,
        offset,
        has_more: rows.has_more,
      });
    },
  },
  {
    method: "GET",
    pattern: ["admin", "admins"],
    handler: async () => {
      const rows = await usersRepository.listPlatformAdmins();
      return toSuccess(rows.map(mapAdminUser));
    },
  },
  {
    method: "POST",
    pattern: ["admin", "admins"],
    handler: async ({ body }) => {
      const email = str(body.email).toLowerCase();
      let user = await usersRepository.getByEmail(email);
      if (!user) {
        user = await usersRepository.create({
          email,
          name: email.split("@")[0],
          password: "demo1234",
          password_must_change: true,
        });
      }
      if (!user.is_platform_admin) {
        await usersRepository.update(user.id, { is_platform_admin: true });
        user = { ...user, is_platform_admin: true };
      }
      return toSuccess(mapAdminUser(user));
    },
  },
  {
    method: "DELETE",
    pattern: ["admin", "admins", ":userId"],
    handler: async ({ params }) => {
      const user = await usersRepository.getById(params.userId);
      if (!user) throw new Error("USER_NOT_FOUND");
      await usersRepository.update(params.userId, { is_platform_admin: false });
      return toSuccess({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["admin", "audit", "backfill"],
    handler: async () => {
      return toSuccess({ processed: 0 });
    },
  },

  // ---- Admin: requests ------------------------------------------------------
  {
    method: "GET",
    pattern: ["admin", "requests"],
    handler: async ({ query }) => {
      const rows = await hackathonRequestsRepository.list({
        ...(query.get("status") ? { status: query.get("status") as HackathonRequestStatus } : {}),
      });
      return toSuccess({ items: rows.map(mapRequest) });
    },
  },
  {
    method: "GET",
    pattern: ["admin", "requests", "stats"],
    handler: async () => {
      const counts = await hackathonRequestsRepository.countByStatus();
      return toSuccess(counts);
    },
  },
  {
    method: "GET",
    pattern: ["admin", "requests", ":id"],
    handler: async ({ params }) => {
      const record = await hackathonRequestsRepository.getById(params.id);
      if (!record) throw new Error("REQUEST_NOT_FOUND");
      return toSuccess(mapRequest(record));
    },
  },
  {
    method: "PATCH",
    pattern: ["admin", "requests", ":id"],
    handler: async ({ params, body, user }) => {
      const status = str(body.status) as HackathonRequestStatus;
      const existing = await hackathonRequestsRepository.getById(params.id);
      if (!existing) throw new Error("REQUEST_NOT_FOUND");
try {
        const reviewed = await hackathonRequestsRepository.review(
          params.id,
          status,
          user.id,
          nullableStr(body.notes) ?? undefined,
        );
        if (!reviewed) throw new Error("REQUEST_NOT_FOUND");
        return toSuccess(mapRequest(reviewed));
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("INVALID_REQUEST_TRANSITION:")) {
          const updated = await hackathonRequestsRepository.update(params.id, { status });
          if (!updated) throw new Error("REQUEST_NOT_FOUND");
          return toSuccess(mapRequest(updated));
        }
        throw error;
      }
    },
  },

  // ---- Admin: invites --------------------------------------------------------
  {
    method: "GET",
    pattern: ["admin", "invites"],
handler: async ({ query }) => {
      const rows = await adminRepository.listAdminInvites();
      return toSuccess(rows.map(mapAdminInvite), paginationMeta(rows.length, query));
    },
  },
  {
    method: "POST",
    pattern: ["admin", "invites"],
    handler: async ({ body, user }) => {
      const record = await adminRepository.createAdminInvite(str(body.email), user.id);
      return toSuccess(mapAdminInvite(record));
    },
  },
  {
    method: "POST",
    pattern: ["admin", "invites", "accept"],
    handler: async ({ body, user }) => {
      const record = await adminRepository.acceptAdminInvite(str(body.token), user.id);
      if (!record) throw new Error("INVITE_NOT_FOUND");
      return toSuccess(mapAdminInvite(record));
    },
  },
  {
    method: "GET",
    pattern: ["admin", "invites", ":token"],
    handler: async ({ params }) => {
      const record = await adminRepository.inviteByToken(params.token);
      if (!record) throw new Error("INVITE_NOT_FOUND");
      return toSuccess(mapAdminInvite(record));
    },
  },
  {
    method: "DELETE",
    pattern: ["admin", "invites", ":id"],
    handler: async ({ params }) => {
      const ok = await adminRepository.deleteAdminInvite(params.id);
      if (!ok) throw new Error("INVITE_NOT_FOUND");
      return toSuccess({ ok: true });
    },
  },

  // ---- Activity --------------------------------------------------------------
  {
    method: "GET",
    pattern: ["hackathons", ":id", "activity"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const result = await activityRepository.listByHackathon(hackathon.id, {
        limit: Number(query.get("limit")) || undefined,
        cursor: query.get("cursor") ?? undefined,
      });
return toSuccess({ items: result.items.map(mapAuditEvent), next_cursor: result.next_cursor });
    },
  },
  {
    method: "GET",
    pattern: ["hackathons", ":id", "audit"],
    handler: async ({ params, query }) => {
      const hackathon = await resolveHackathon(params.id);
      const result = await activityRepository.listByHackathon(hackathon.id, {
        limit: Number(query.get("limit")) || undefined,
        cursor: query.get("cursor") ?? undefined,
      });
      return toSuccess(result.items.map(mapAuditEvent), paginationMeta(result.items.length, query));
    },
  },
  {
    method: "GET",
    pattern: ["activity"],
    handler: async ({ query }) => {
      const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 50));
      const rows = await activityRepository.listRecent(limit);
      return toSuccess({ items: rows.map(mapAuditEvent) });
    },
  },
];
