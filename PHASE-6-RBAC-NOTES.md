# Phase 6: RBAC (Roles & Permissions) – Implementation Notes

## Overview

Phase 6 adds a **Role-Based Access Control** layer to the admin system: roles, permissions, and permission guards on sensitive actions. It is **additive** and **backward compatible**: existing super-admin and admin workflows continue to work.

---

## Files Changed

### New files
- **`server/rbac/index.ts`** – RBAC helpers: `isSuperAdmin`, `canAccessPermission`, `requirePermission`, `requireAnyPermission`, `getEffectivePermissions`
- **`client/src/components/admin/RolesManagementSection.tsx`** – Admin UI: list roles/permissions, assign/remove roles for users
- **`PHASE-6-RBAC-NOTES.md`** – This file

### Modified files
- **`drizzle/schema-sqlite.ts`** – Added tables: `roles`, `permissions`, `role_permissions`, `user_roles`
- **`server/db.ts`** – RBAC table creation (SQLite), seed for roles/permissions/role_permissions, exports: `getUserRoles`, `getUserPermissions`, `userHasPermission`, `userHasRole`, `assignRoleToUser`, `removeRoleFromUser`, `getAllRoles`, `getAllPermissions`, `getRolePermissions`
- **`server/routers.ts`** – `auth.me` returns `permissions`; admin procedures guarded with `requirePermission(...)`; new admin procedures: `getRoles`, `getPermissions`, `getUserRoles`, `getRolePermissions`, `assignRole`, `removeRole`
- **`client/src/contexts/AuthContext.tsx`** – `User` type and auth state include `permissions?: string[]`
- **`client/src/pages/AdminPanel.tsx`** – New nav item "תפקידים והרשאות" (when `roles.manage` or super-admin), section "roles" with `<RolesManagementSection />`; "חלוקת פרסים" card shown only when user has `competitions.settle` or is super-admin

---

## New Schema / Entities (SQLite)

| Table             | Purpose                                      |
|------------------|----------------------------------------------|
| **roles**        | id, code (unique), name, description, isSystem, createdAt, updatedAt |
| **permissions**  | id, code (unique), name, category, description |
| **role_permissions** | roleId, permissionId (junction)        |
| **user_roles**   | userId, roleId (junction)                    |

Naming follows existing project style (snake_case table names, integer timestamps in SQLite).

---

## Seeded Roles

| code               | name              | description                    |
|--------------------|-------------------|--------------------------------|
| super_admin        | Super Admin       | Full access                    |
| admin              | Admin             | Administrator                  |
| finance_manager    | Finance Manager   | Finance and reports            |
| competition_manager| Competition Manager | Competitions and submissions |
| support_agent      | Support Agent     | Submissions and users view     |
| content_manager   | Content Manager   | CMS                            |
| agent_manager     | Agent Manager     | Agents and related             |

---

## Seeded Permissions

- **competitions:** view, create, edit, delete, settle  
- **submissions:** view, approve, reject  
- **users:** view, manage  
- **agents:** view, manage  
- **finance:** view, export  
- **reports:** view, export  
- **cms:** view, edit  
- **settings:** manage  
- **roles:** manage  

Default assignment:
- **super_admin** and **admin**: all permissions  
- **finance_manager**: finance.view, finance.export, reports.view, reports.export, submissions.view, users.view  
- **competition_manager**: competitions.* (view, create, edit, settle), submissions.view, approve, reject  
- **support_agent**: submissions.view, approve, reject, users.view  
- **content_manager**: cms.view, cms.edit  
- **agent_manager**: agents.view, agents.manage, users.view, submissions.view  

---

## Compatibility / Fallback

- **Super-admin** (username in `ENV.superAdminUsernames`): bypasses all permission checks; unchanged behavior.
- **Legacy admin** (role === "admin") **with no RBAC roles assigned**: treated as having **all** permissions so existing admins keep working.  
  - Implemented in `server/rbac/index.ts`: `getEffectivePermissions` and `canAccessPermission` grant full access when `getUserRoles(userId)` is empty and user is admin.  
  - TODO in code: remove this fallback once all admins have explicit role assignment.
- **MySQL**: RBAC tables exist only in SQLite. On MySQL, `getUserRoles` / `getUserPermissions` return empty; permission checks rely on legacy admin role (and super-admin by username). No DB migration for MySQL in this phase.

---

## Guarded Actions / Routes

| Procedure / action       | Permission(s)        |
|--------------------------|----------------------|
| createTournament         | competitions.create |
| deleteTournament         | competitions.delete |
| lockTournament           | competitions.edit   |
| distributePrizes         | competitions.settle|
| approveSubmission        | submissions.approve |
| rejectSubmission         | submissions.reject  |
| createAgent              | agents.manage       |
| setUserBlocked           | users.manage        |
| depositPoints            | users.manage        |
| withdrawPoints           | users.manage        |
| assignRole / removeRole  | roles.manage        |
| getRoles, getPermissions, getUserRoles, getRolePermissions | admin only (no extra permission) |

**Super-admin-only (unchanged):** getAdmins, createAdmin, deleteAdmin, updateAdmin, getAdminAuditLogs, fullReset, deleteFinancialHistory, deleteTransparencyHistory, deletePointsLogsHistory.

---

## Admin UI Changes

- **New section "תפקידים והרשאות"** in the admin nav (visible when user has `roles.manage` or is super-admin).
- **RolesManagementSection:**  
  - List of roles; expand a role to see its permission codes.  
  - Table of admin users with current roles and an "עריכת תפקידים" button.  
  - Dialog to add/remove roles for a user (assignRole / removeRole).
- **"חלוקת פרסים לתחרות"** card is shown only if user has `competitions.settle` or is super-admin.

---

## Logging / Observability

- In `server/rbac/index.ts`, when a permission check fails (and user is not super-admin), **`logger.warn("[RBAC] Permission denied", { userId, permission })`** is called.  
- No sensitive internal details are exposed to the client; the client receives a generic "אין הרשאה לפעולה זו" (or similar) message.

---

## Known Limitations

1. **MySQL:** RBAC tables and seed are SQLite-only. MySQL continues to use legacy admin/super-admin checks.
2. **Legacy fallback:** Admins with no assigned roles still get full access; to be removed in a later phase.
3. **Export/finance routes:** Most export and finance read endpoints are still admin-only without granular permissions (e.g. finance.export, reports.export). Guards can be added later.
4. **updateMatchResult, hideTournamentFromHomepage, restoreTournamentToHomepage, markPayment, etc.:** Still use `adminProcedure` only; can be wrapped with `requirePermission` in a follow-up.
5. **UI:** Only the prize-distribution card and the roles section are permission-aware; other buttons (e.g. lock, delete, update results) are not yet hidden/disabled by permission.

---

## Recommended Next Phase

- Add permission guards to remaining admin procedures (updateMatchResult, markPayment, hide/restore tournament, league CRUD, etc.).
- Make more admin UI elements permission-aware (hide/disable by permission).
- Add MySQL migration and RBAC tables for MySQL if needed.
- Remove legacy “admin with no roles = full access” once all admins have roles.
- Optional: cache `getEffectivePermissions` per request or short TTL to avoid repeated DB calls.
