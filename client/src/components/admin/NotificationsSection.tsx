/**
 * Phase 19: Admin notifications center – list, filter, mark read, inspect details.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Bell, Check, ChevronDown, ChevronUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NOTIFICATION_TYPES = [
  "competition_created",
  "competition_closing_soon",
  "competition_closed",
  "tournament_settled",
  "automation_failed",
  "automation_skipped",
  "submission_approved",
  "submission_rejected",
] as const;

export function NotificationsSection() {
  const [recipientType, setRecipientType] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: list, isLoading, refetch } = trpc.admin.listNotifications.useQuery({
    recipientType: recipientType as "admin" | "user" | "agent" | "system" | undefined,
    type: typeFilter,
    status: statusFilter,
    limit: 50,
    offset: 0,
  });

  const markReadMut = trpc.admin.markNotificationRead.useMutation({
    onSuccess: () => refetch(),
  });

  const notifications = list ?? [];

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          מרכז התראות (Phase 19)
        </h2>
        <p className="text-slate-400 text-sm">התראות מערכת ומנהלים. קריאה בלבד + סימון כנקרא.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={recipientType ?? "all"} onValueChange={(v) => setRecipientType(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-600 text-white">
              <SelectValue placeholder="נמען" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הנמענים</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="user">user</SelectItem>
              <SelectItem value="agent">agent</SelectItem>
              <SelectItem value="system">system</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter ?? "all"} onValueChange={(v) => setTypeFilter(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[200px] bg-slate-900 border-slate-600 text-white">
              <SelectValue placeholder="סוג" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסוגים</SelectItem>
              {NOTIFICATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter ?? "all"} onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[120px] bg-slate-900 border-slate-600 text-white">
              <SelectValue placeholder="סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="created">created</SelectItem>
              <SelectItem value="read">read</SelectItem>
              <SelectItem value="sent">sent</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => refetch()}>
            רענן
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <p className="text-slate-500 text-center py-8">אין התראות להצגה.</p>
        )}

        {!isLoading && notifications.length > 0 && (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border p-3 ${n.readAt ? "bg-slate-900/50 border-slate-700" : "bg-slate-900 border-slate-600"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">{n.title ?? n.type}</p>
                    <p className="text-slate-400 text-sm truncate">{n.body ?? ""}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {n.type} · {n.recipientType}
                      {n.recipientId != null ? ` · #${n.recipientId}` : ""} · {n.status}
                      {n.createdAt ? ` · ${new Date(n.createdAt).toLocaleString("he-IL")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.readAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white"
                        onClick={() => markReadMut.mutate({ id: n.id })}
                        disabled={markReadMut.isPending}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                    >
                      {expandedId === n.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {expandedId === n.id && (
                  <div className="mt-3 pt-3 border-t border-slate-700 text-xs font-mono text-slate-400 break-all">
                    {n.payloadJson != null && (
                      <pre className="whitespace-pre-wrap">{JSON.stringify(n.payloadJson, null, 2)}</pre>
                    )}
                    {n.lastError && <p className="text-red-400 mt-1">lastError: {n.lastError}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
