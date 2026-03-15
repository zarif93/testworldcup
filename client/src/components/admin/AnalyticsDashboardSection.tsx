/**
 * Phase 21: Analytics / BI Dashboard – read-only summary cards and tables.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  Trophy,
  Users,
  UserPlus,
  DollarSign,
  BarChart3,
  Zap,
  Bell,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Props = { onBack: () => void };

const COLORS = ["#f59e0b", "#10b981", "#6366f1", "#ec4899", "#14b8a6"];

export function AnalyticsDashboardSection({ onBack }: Props) {
  const { data: overview, isLoading: overviewLoading } = trpc.admin.getDashboardOverview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: competitionAnalytics, isLoading: compLoading } = trpc.admin.getCompetitionAnalytics.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: revenueAnalytics } = trpc.admin.getRevenueAnalytics.useQuery(undefined, { refetchOnWindowFocus: false });
  const { data: agentAnalytics } = trpc.admin.getAgentAnalytics.useQuery(undefined, { refetchOnWindowFocus: false });
  const { data: automationAnalytics } = trpc.admin.getAutomationAnalytics.useQuery(undefined, { refetchOnWindowFocus: false });
  const { data: notificationAnalytics } = trpc.admin.getNotificationAnalytics.useQuery(undefined, { refetchOnWindowFocus: false });

  const loading = overviewLoading || compLoading;
  const o = overview ?? null;
  const rev = revenueAnalytics ?? null;
  const agents = agentAnalytics?.agents ?? [];
  const auto = automationAnalytics ?? null;
  const unread = notificationAnalytics?.unreadCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" className="text-slate-400 -ml-2 md:ml-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 ml-1" />
          חזרה
        </Button>
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
        <BarChart3 className="w-6 h-6 md:w-8 md:h-8 text-amber-400 shrink-0" />
        אנליטיקה / BI
      </h2>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}

      {!loading && o && (
        <>
          {/* Summary cards */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">סיכום פלטפורמה</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3 md:p-4">
                  <p className="text-slate-400 text-xs">סה״כ תחרויות</p>
                  <p className="text-lg md:text-xl font-bold text-white tabular-nums mt-0.5">{o.totalCompetitions}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3 md:p-4">
                  <p className="text-slate-400 text-xs">תחרויות פתוחות/פעילות</p>
                  <p className="text-lg md:text-xl font-bold text-emerald-400 tabular-nums mt-0.5">{o.openCompetitions} / {o.activeCompetitions}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3 md:p-4">
                  <p className="text-slate-400 text-xs">טפסים</p>
                  <p className="text-lg md:text-xl font-bold text-white tabular-nums mt-0.5">{o.totalSubmissions}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3 md:p-4">
                  <p className="text-slate-400 text-xs">משתמשים / סוכנים</p>
                  <p className="text-lg md:text-xl font-bold text-white tabular-nums mt-0.5">{o.totalUsers} / {o.totalAgents}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3 md:p-4">
                  <p className="text-slate-400 text-xs">התראות לא נקראו</p>
                  <p className="text-lg md:text-xl font-bold tabular-nums mt-0.5">{unread > 0 ? <span className="text-amber-400">{unread}</span> : <span className="text-slate-500">0</span>}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Revenue row */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">כספים (סיכום)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-slate-800/50 border-amber-500/20 rounded-xl">
                <CardContent className="p-3 md:p-4">
                  <p className="text-slate-500 text-xs">הכנסות</p>
                  <p className="text-lg font-bold text-amber-400 tabular-nums">{o.totalRevenue}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
                <CardContent className="p-3 md:p-4">
                  <p className="text-slate-500 text-xs">פרסים ששולמו</p>
                  <p className="text-lg font-bold text-white tabular-nums">{o.totalPayouts}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-emerald-500/20 rounded-xl">
                <CardContent className="p-3 md:p-4">
                  <p className="text-slate-500 text-xs">רווח נקי</p>
                  <p className="text-lg font-bold text-emerald-400 tabular-nums">{o.netProfit}</p>
                </CardContent>
              </Card>
              {rev && (
                <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
                  <CardContent className="p-3 md:p-4">
                    <p className="text-slate-500 text-xs">החזרים</p>
                    <p className="text-lg font-bold text-slate-300 tabular-nums">{rev.totalRefunds}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          {/* Phase 30: Payment summary */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">תשלומים (סיכום)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-500 text-xs">ממתינים</p>
                  <p className="text-lg font-bold tabular-nums">{(o as { paymentPendingCount?: number }).paymentPendingCount ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-emerald-500/20 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-500 text-xs">שולמו</p>
                  <p className="text-lg font-bold text-emerald-400 tabular-nums">{(o as { paymentPaidCount?: number }).paymentPaidCount ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">סכום: {(o as { paymentPaidAmount?: number }).paymentPaidAmount ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-amber-500/20 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-500 text-xs">הוחזרו</p>
                  <p className="text-lg font-bold text-amber-400 tabular-nums">{(o as { paymentRefundedCount?: number }).paymentRefundedCount ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">סכום: {(o as { paymentRefundedAmount?: number }).paymentRefundedAmount ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-red-500/20 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-500 text-xs">נכשלו</p>
                  <p className="text-lg font-bold text-red-400 tabular-nums">{(o as { paymentFailedCount?: number }).paymentFailedCount ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-500 text-xs">בנקודות</p>
                  <p className="text-lg font-bold text-slate-300 tabular-nums">{(o as { paymentPointsDeductedCount?: number }).paymentPointsDeductedCount ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-500 text-xs">חיצוני</p>
                  <p className="text-lg font-bold text-slate-300 tabular-nums">{(o as { paymentExternalCount?: number }).paymentExternalCount ?? 0}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* This week / month */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">השבוע / החודש</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-400 text-xs">תחרויות השבוע</p>
                  <p className="text-lg font-bold text-white tabular-nums">{o.competitionsThisWeek}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-400 text-xs">תחרויות החודש</p>
                  <p className="text-lg font-bold text-white tabular-nums">{o.competitionsThisMonth}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-400 text-xs">טפסים השבוע</p>
                  <p className="text-lg font-bold text-white tabular-nums">{o.submissionsThisWeek}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700/80 rounded-xl">
                <CardContent className="p-3">
                  <p className="text-slate-400 text-xs">טפסים החודש</p>
                  <p className="text-lg font-bold text-white tabular-nums">{o.submissionsThisMonth}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Competition by status / type */}
          {competitionAnalytics && (competitionAnalytics.byStatus.length > 0 || competitionAnalytics.byType.length > 0) && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {competitionAnalytics.byType.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
                  <CardHeader className="pb-2">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      תחרויות לפי סוג
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={competitionAnalytics.byType} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="type" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }} labelStyle={{ color: "#e2e8f0" }} />
                          <Bar dataKey="count" name="כמות" radius={[4, 4, 0, 0]}>
                            {competitionAnalytics.byType.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
              {competitionAnalytics.byStatus.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
                  <CardHeader className="pb-2">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-amber-400" />
                      תחרויות לפי סטטוס
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {competitionAnalytics.byStatus.map(({ status, count }) => (
                        <Badge key={status} variant="secondary" className="bg-slate-700 text-slate-200 border-slate-600">
                          {status}: {count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {/* Automation health */}
          {auto && (auto.executed > 0 || auto.skipped > 0 || auto.failed > 0 || ((auto as { failedLast24h?: number }).failedLast24h ?? 0) > 0 || ((auto as { stuckSettlingCount?: number }).stuckSettlingCount ?? 0) > 0) && (
            <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
              <CardHeader className="pb-2">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  אוטומציה – סיכום ובריאות
                </h3>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <span className="text-slate-400">בוצעו: <strong className="text-emerald-400">{auto.executed}</strong></span>
                  <span className="text-slate-400">דולגו: <strong className="text-slate-300">{auto.skipped}</strong></span>
                  <span className="text-slate-400">נכשלו: <strong className="text-red-400">{auto.failed}</strong></span>
                  {"failedLast24h" in auto && Number((auto as { failedLast24h?: number }).failedLast24h ?? 0) > 0 && (
                    <span className="text-slate-400">נכשלו (24ש): <strong className="text-red-400">{(auto as { failedLast24h?: number }).failedLast24h ?? 0}</strong></span>
                  )}
                  {"totalRetries" in auto && Number((auto as { totalRetries?: number }).totalRetries ?? 0) > 0 && (
                    <span className="text-slate-400">ניסיונות חוזרים: <strong className="text-amber-400">{(auto as { totalRetries?: number }).totalRetries ?? 0}</strong></span>
                  )}
                  {"longPendingCount" in auto && Number((auto as { longPendingCount?: number }).longPendingCount ?? 0) > 0 && (
                    <span className="text-slate-400">תקועים (7+ ימים): <strong className="text-amber-400">{(auto as { longPendingCount?: number }).longPendingCount ?? 0}</strong></span>
                  )}
                  {"stuckSettlingCount" in auto && Number((auto as { stuckSettlingCount?: number }).stuckSettlingCount ?? 0) > 0 && (
                    <span className="text-slate-400">תקועים ב-SETTLING: <strong className="text-red-400">{(auto as { stuckSettlingCount?: number }).stuckSettlingCount ?? 0}</strong></span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top agents */}
          {agents.length > 0 && (
            <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
              <CardHeader className="pb-2">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  סוכנים (רווח/הפסד)
                </h3>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-600">
                        <th className="py-2 px-2">שם / משתמש</th>
                        <th className="py-2 px-2">רווח</th>
                        <th className="py-2 px-2">הפסד</th>
                        <th className="py-2 px-2">נקי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.slice(0, 10).map((a) => (
                        <tr key={a.id} className="border-b border-slate-700/50">
                          <td className="py-1.5 px-2 text-white">{a.name || a.username || `#${a.id}`}</td>
                          <td className="py-1.5 px-2 text-emerald-400">{a.profit}</td>
                          <td className="py-1.5 px-2 text-red-400">{a.loss}</td>
                          <td className="py-1.5 px-2 text-slate-300">{a.net}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!loading && o && o.totalCompetitions === 0 && o.totalSubmissions === 0 && (
        <Card className="bg-slate-800/50 border-slate-700 rounded-xl">
          <CardContent className="py-8 text-center text-slate-400">
            אין עדיין נתונים להצגה. התחרויות והטפסים יופיעו כאן לאחר שייווצרו.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
