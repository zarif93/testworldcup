/**
 * Centralized Hebrew labels for RBAC permission keys.
 * Backend keys stay unchanged; only display is translated in the UI.
 */

/** Map: permission code → Hebrew label (for UI only) */
export const PERMISSION_LABELS_HE: Record<string, string> = {
  "agents.manage": "ניהול סוכנים",
  "agents.view": "צפייה בסוכנים",
  "cms.edit": "עריכת תוכן",
  "cms.view": "צפייה בתוכן",
  "competitions.create": "יצירת תחרויות",
  "competitions.delete": "מחיקת תחרויות",
  "competitions.edit": "עריכת תחרויות",
  "competitions.settle": "סגירת תחרויות",
  "competitions.view": "צפייה בתחרויות",
  "finance.export": "ייצוא דוחות פיננסיים",
  "finance.view": "צפייה פיננסית",
  "reports.export": "ייצוא דוחות",
  "reports.view": "צפייה בדוחות",
  "roles.manage": "ניהול תפקידים",
  "settings.manage": "ניהול הגדרות",
  "submissions.approve": "אישור טפסים",
  "submissions.reject": "דחיית טפסים",
  "submissions.view": "צפייה בטפסים",
  "users.manage": "ניהול משתמשים",
  "users.view": "צפייה במשתמשים",
};

/**
 * Returns Hebrew label for a permission key. Use everywhere permissions are shown in the UI.
 * Unknown keys return a generic Hebrew phrase (no English in UI).
 */
export function getPermissionLabel(permissionKey: string): string {
  if (!permissionKey || typeof permissionKey !== "string") return "—";
  return PERMISSION_LABELS_HE[permissionKey] ?? "הרשאה אחרת";
}
