import { useState } from "react";
import { Loader2, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { getPermissionLabel } from "@/lib/permissionLabels";
import { toast } from "sonner";

/** Hebrew display names for roles (internal codes stay in English in DB/API). */
const ROLE_DISPLAY_NAME_HE: Record<string, string> = {
  super_admin: "סופר אדמין",
  admin: "מנהל",
  finance_manager: "מנהל כספים",
  competition_manager: "מנהל תחרויות",
  support_agent: "נציג תמיכה",
  content_manager: "מנהל תוכן",
  agent_manager: "מנהל סוכנים",
};

function getRoleDisplayName(role: { code: string; name: string }): string {
  return ROLE_DISPLAY_NAME_HE[role.code] ?? role.name;
}

export function RolesManagementSection() {
  const [expandedRoleId, setExpandedRoleId] = useState<number | null>(null);
  const [userRolesModal, setUserRolesModal] = useState<{ userId: number; username: string } | null>(null);

  const { data: roles, isLoading: rolesLoading } = trpc.admin.getRoles.useQuery();
  const { data: permissions } = trpc.admin.getPermissions.useQuery();
  const { data: adminUsers, isLoading: usersLoading } = trpc.admin.getUsersList.useQuery({ role: "admin" });
  const { data: rolePerms, isLoading: rolePermsLoading } = trpc.admin.getRolePermissions.useQuery(
    { roleId: expandedRoleId! },
    { enabled: expandedRoleId != null }
  );
  const utils = trpc.useUtils();
  const { data: userRoles, isLoading: userRolesLoading } = trpc.admin.getUserRoles.useQuery(
    { userId: userRolesModal?.userId ?? 0 },
    { enabled: userRolesModal != null }
  );
  const assignMut = trpc.admin.assignRole.useMutation({
    onSuccess: (_, vars) => { toast.success("תפקיד נוסף"); utils.admin.getUserRoles.invalidate({ userId: vars.userId }); },
    onError: (e) => toast.error(e.message),
  });
  const removeMut = trpc.admin.removeRole.useMutation({
    onSuccess: (_, vars) => { toast.success("תפקיד הוסר"); utils.admin.getUserRoles.invalidate({ userId: vars.userId }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            תפקידים והרשאות
          </h2>
          <p className="text-slate-400 text-sm">צפייה בתפקידים, הרשאות לכל תפקיד, ושיוך תפקידים למנהלים.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {rolesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-slate-400 text-sm font-medium">תפקידים ({roles?.length ?? 0})</p>
              {(roles ?? []).map((role) => (
                <div key={role.id} className="rounded-lg bg-slate-900/50 border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-right text-white hover:bg-slate-800/50"
                    onClick={() => setExpandedRoleId(expandedRoleId === role.id ? null : role.id)}
                  >
                    <span className="font-medium">{getRoleDisplayName(role)}</span>
                    <span className="text-slate-500 text-sm" title="קוד תפקיד">{role.code}</span>
                    {expandedRoleId === role.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedRoleId === role.id && (
                    <div className="px-4 py-3 border-t border-slate-700 bg-slate-900/80">
                      {rolePermsLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                      ) : (
                        <div className="text-slate-400 text-sm">
                          <p className="font-medium text-slate-300 mb-1">הרשאות:</p>
                          {(rolePerms ?? []).length ? (
                            <ul className="list-none flex flex-wrap gap-1.5" dir="rtl">
                              {(rolePerms ?? []).map((code) => (
                                <li key={code}>
                                  <span className="inline-block px-2 py-0.5 rounded bg-slate-700/80 text-slate-200 text-xs" title={code}>
                                    {getPermissionLabel(code)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>אין</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <h3 className="text-lg font-bold text-white">מנהלים ושיוך תפקידים</h3>
          <p className="text-slate-400 text-sm">לחץ על משתמש כדי לערוך את תפקידיו.</p>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="py-2 px-3 text-slate-400 font-medium">משתמש</th>
                    <th className="py-2 px-3 text-slate-400 font-medium">תפקידים</th>
                    <th className="py-2 px-3 text-slate-400 font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {(adminUsers ?? []).map((u: { id: number; username?: string | null; name?: string | null }) => (
                    <tr key={u.id} className="border-b border-slate-700/50">
                      <td className="py-2 px-3 text-white">{u.username ?? u.name ?? `#${u.id}`}</td>
                      <td className="py-2 px-3">
                        <UserRolesCell userId={u.id} />
                      </td>
                      <td className="py-2 px-3">
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={() => setUserRolesModal({ userId: u.id, username: String(u.username ?? u.name ?? u.id) })}>
                          שיוך תפקידים
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={userRolesModal != null} onOpenChange={(open) => !open && setUserRolesModal(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">שיוך תפקידים למשתמש: {userRolesModal?.username}</DialogTitle>
          </DialogHeader>
          {userRolesModal && (
            <UserRolesEditor
              userId={userRolesModal.userId}
              currentRoles={userRoles ?? []}
              allRoles={roles ?? []}
              loading={userRolesLoading}
              onAssign={(roleId) => assignMut.mutate({ userId: userRolesModal.userId, roleId })}
              onRemove={(roleId) => removeMut.mutate({ userId: userRolesModal.userId, roleId })}
              isAssigning={assignMut.isPending}
              isRemoving={removeMut.isPending}
            />
          )}
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setUserRolesModal(null)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserRolesCell({ userId }: { userId: number }) {
  const { data: userRoles } = trpc.admin.getUserRoles.useQuery({ userId });
  const roleNames = (userRoles ?? []).map((r) => getRoleDisplayName(r)).join(", ") || "—";
  return <span className="text-slate-400 text-sm">{roleNames}</span>;
}

function UserRolesEditor({
  userId,
  currentRoles,
  allRoles,
  loading,
  onAssign,
  onRemove,
  isAssigning,
  isRemoving,
}: {
  userId: number;
  currentRoles: { id: number; code: string; name: string }[];
  allRoles: { id: number; code: string; name: string }[];
  loading: boolean;
  onAssign: (roleId: number) => void;
  onRemove: (roleId: number) => void;
  isAssigning: boolean;
  isRemoving: boolean;
}) {
  const currentIds = new Set(currentRoles.map((r) => r.id));
  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  return (
    <div className="space-y-2 py-2">
      {allRoles.map((role) => {
        const has = currentIds.has(role.id);
        return (
          <div key={role.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/50 px-3 py-2">
            <span className="text-white">{getRoleDisplayName(role)}</span>
            {has ? (
              <Button size="sm" variant="outline" className="border-red-500/50 text-red-400" disabled={isRemoving} onClick={() => onRemove(role.id)}>הסר</Button>
            ) : (
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" disabled={isAssigning} onClick={() => onAssign(role.id)}>הוסף</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
