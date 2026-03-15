/**
 * Phase 6: RBAC resolver utilities.
 * - Super-admin (username in ENV.superAdminUsernames) bypasses all permission checks.
 * - Legacy admin (role === "admin") with no RBAC roles assigned is treated as having all permissions for backward compatibility.
 * - Otherwise, permissions are resolved from user_roles + role_permissions (SQLite only).
 */

import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import { logger, securityAudit } from "../_core/logger";

function getReqIp(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } } | undefined): string | undefined {
  if (!req) return undefined;
  const xff = req.headers?.["x-forwarded-for"];
  if (xff) {
    const first = Array.isArray(xff) ? xff[0] : (typeof xff === "string" ? xff.split(",")[0] : "");
    return first?.trim() ?? undefined;
  }
  return req.socket?.remoteAddress;
}
import {
  getUserRoles,
  getUserPermissions,
  userHasPermission,
  USE_SQLITE,
} from "../db";

export type TrpcUser = { id: number; role?: string; username?: string | null };

/** True if the user is super-admin (by username list). */
export function isSuperAdmin(user: TrpcUser | null): boolean {
  if (!user || user.role !== "admin") return false;
  const username = (user as { username?: string | null }).username;
  return !!(username && ENV.superAdminUsernames.includes(username));
}

/**
 * Returns true if the user is allowed for this permission in the current system.
 * - Super-admin: always true.
 * - Legacy admin with no RBAC roles: true (backward compat).
 * - Otherwise: true only if user has the permission via RBAC (SQLite).
 */
export async function canAccessPermission(userId: number, permissionCode: string, userRole: string): Promise<boolean> {
  if (userRole !== "admin") return false;
  // Super-admin is checked at call site via isSuperAdmin(ctx.user)
  const perms = await getUserPermissions(userId);
  if (perms.includes(permissionCode.trim())) return true;
  // Legacy admin with no RBAC roles: allow (backward compatibility)
  if (USE_SQLITE) {
    const roles = await getUserRoles(userId);
    if (roles.length === 0) return true; // TODO Phase 6: remove once all admins have roles
  }
  return false;
}

/**
 * Require a single permission. Use as adminProcedure.use(requirePermission("competitions.create")).
 * Super-admin bypasses. Legacy admin with no roles bypasses. Otherwise checks RBAC.
 */
export function requirePermission(permissionCode: string) {
  return async (opts: { ctx: { user: TrpcUser; req?: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } } }; next: () => Promise<unknown> }) => {
    const user = opts.ctx.user;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
    if (isSuperAdmin(user)) return opts.next();
    const allowed = await canAccessPermission(user.id, permissionCode, user.role ?? "");
    if (!allowed) {
      securityAudit("permission_denied", { userId: user.id, username: (user as { username?: string }).username, permission: permissionCode, ip: getReqIp(opts.ctx.req) });
      throw new TRPCError({ code: "FORBIDDEN", message: "אין הרשאה לפעולה זו" });
    }
    return opts.next();
  };
}

/**
 * Require any of the given permissions.
 */
export function requireAnyPermission(permissionCodes: string[]) {
  return async (opts: { ctx: { user: TrpcUser; req?: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } } }; next: () => Promise<unknown> }) => {
    const user = opts.ctx.user;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
    if (isSuperAdmin(user)) return opts.next();
    const codes = permissionCodes.map((c) => c.trim());
    for (const code of codes) {
      const allowed = await canAccessPermission(user.id, code, user.role ?? "");
      if (allowed) return opts.next();
    }
    securityAudit("permission_denied", { userId: user.id, username: (user as { username?: string }).username, permissions: codes, ip: getReqIp(opts.ctx.req) });
    throw new TRPCError({ code: "FORBIDDEN", message: "אין הרשאה לפעולה זו" });
  };
}

/** Get permissions for a user (for UI). Super-admin returns all known codes. Legacy admin with no roles returns all. */
export async function getEffectivePermissions(user: TrpcUser | null): Promise<string[]> {
  if (!user || user.role !== "admin") return [];
  if (isSuperAdmin(user)) {
    return [
      "competitions.view", "competitions.create", "competitions.edit", "competitions.delete", "competitions.settle",
      "submissions.view", "submissions.approve", "submissions.reject",
      "users.view", "users.manage", "agents.view", "agents.manage",
      "finance.view", "finance.export", "reports.view", "reports.export",
      "cms.view", "cms.edit", "settings.manage", "roles.manage",
    ];
  }
  const perms = await getUserPermissions(user.id);
  if (USE_SQLITE && perms.length === 0) {
    const roles = await getUserRoles(user.id);
    if (roles.length === 0) {
      // Legacy admin with no RBAC roles: grant all (backward compat)
      return [
        "competitions.view", "competitions.create", "competitions.edit", "competitions.delete", "competitions.settle",
        "submissions.view", "submissions.approve", "submissions.reject",
        "users.view", "users.manage", "agents.view", "agents.manage",
        "finance.view", "finance.export", "reports.view", "reports.export",
        "cms.view", "cms.edit", "settings.manage", "roles.manage",
      ];
    }
  }
  return perms;
}
