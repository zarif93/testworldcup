/**
 * Phase 22: User/agent notifications – list, mark read, view details.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
    // setLocation omitted from deps to avoid re-run on router updates (infinite re-render)
  }, [authLoading, user]);

  const { data: list, isLoading, refetch } = trpc.notifications.listMine.useQuery(
    { limit: 50, offset: 0 },
    { enabled: !!user && (user.role === "user" || user.role === "agent") }
  );
  const markReadMut = trpc.notifications.markMineRead.useMutation({
    onSuccess: () => refetch(),
  });

  const notifications = list ?? [];

  if (authLoading || !user) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }
  if (user.role !== "user" && user.role !== "agent") {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-slate-400">
        <p>אין גישה להתראות כאן. מנהלים יכולים לצפות בהתראות במרכז הניהול.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/")}>
          חזרה לדף הבית
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="text-slate-400 -mr-2" onClick={() => setLocation("/")}>
          ← חזרה
        </Button>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-amber-400" />
          ההתראות שלי
        </h1>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <p className="text-slate-400 text-sm">כל ההתראות שלך. לחיצה על התראה תסמן אותה כנקראה.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
          {!isLoading && notifications.length === 0 && (
            <p className="text-slate-500 text-center py-8">אין התראות.</p>
          )}
          {!isLoading &&
            notifications.map((n) => {
              const isRead = n.status === "read" || n.readAt != null;
              const isExpanded = expandedId === n.id;
              return (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 text-right transition ${
                    isRead ? "bg-slate-800/30 border-slate-700" : "bg-slate-800/60 border-amber-500/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm">{String(n.title ?? n.type ?? "")}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{typeof n.body === "string" ? n.body : ""}</p>
                      {n.body && (
                        <button
                          type="button"
                          className="text-amber-400/90 text-xs mt-1 flex items-center gap-0.5"
                          onClick={() => setExpandedId(isExpanded ? null : n.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? "הסתר" : "פרטים"}
                        </button>
                      )}
                      {isExpanded && n.payloadJson != null && typeof n.payloadJson === "object" && (
                        <pre className="mt-2 p-2 rounded bg-slate-900/80 text-slate-400 text-xs overflow-x-auto">
                          {JSON.stringify(n.payloadJson as Record<string, unknown>, null, 2)}
                        </pre>
                      )}
                      <p className="text-slate-500 text-xs mt-1">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString("he-IL") : ""}
                      </p>
                    </div>
                    {!isRead && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-amber-400 hover:text-amber-300"
                        onClick={() => markReadMut.mutate({ id: n.id })}
                        disabled={markReadMut.isPending}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
