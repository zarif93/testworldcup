/**
 * Phase 27: Read-only ops/system status for post-launch monitoring and support.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowLeft, Database, FolderOpen, Bell, Zap, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Props = { onBack: () => void };

export function OpsStatusSection({ onBack }: Props) {
  const { data: status, isLoading } = trpc.admin.getSystemStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchInterval: 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" className="text-slate-400 -ml-2 md:ml-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 ml-1" />
          חזרה
        </Button>
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
        <Activity className="w-6 h-6 md:w-8 md:h-8 text-amber-400 shrink-0" />
        סטטוס מערכת / Ops
      </h2>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}

      {!isLoading && status && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">סיכום מערכת (לקריאה בלבד)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="p-3 md:p-4">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  סביבה
                </p>
                <p className="text-lg font-bold text-white mt-0.5">
                  <Badge variant={status.mode === "production" ? "default" : "secondary"} className="bg-slate-600">
                    {status.mode}
                  </Badge>
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="p-3 md:p-4">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Database className="w-3.5 h-3.5" />
                  מסד נתונים
                </p>
                <p className="text-lg font-bold text-slate-200 mt-0.5">{status.db}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="p-3 md:p-4">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5" />
                  תיקיית העלאות
                </p>
                <p className="text-lg font-bold mt-0.5">
                  {status.uploadsExists ? (
                    <span className="text-emerald-400">קיימת</span>
                  ) : (
                    <span className="text-amber-400">לא קיימת</span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="p-3 md:p-4">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  אוטומציה נכשלו
                </p>
                <p className="text-lg font-bold tabular-nums mt-0.5">
                  {status.automationFailed > 0 ? (
                    <span className="text-red-400">{status.automationFailed}</span>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="p-3 md:p-4">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5" />
                  התראות לא נקראו
                </p>
                <p className="text-lg font-bold tabular-nums mt-0.5">
                  {status.unreadNotifications > 0 ? (
                    <span className="text-amber-400">{status.unreadNotifications}</span>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
              <CardContent className="p-3 md:p-4">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  גרסת אפליקציה
                </p>
                <p className="text-lg font-bold text-slate-200 mt-0.5 tabular-nums">{status.version}</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            נתונים אלה משמשים לתמיכה ולאבחון. להנחיות השחזור והבדיקות הראשוניות ראה PHASE-27-OPS-MONITORING-NOTES.md.
          </p>
        </section>
      )}
    </div>
  );
}
