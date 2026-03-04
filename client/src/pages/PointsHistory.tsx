import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gem, Loader2, Calendar, TrendingUp, FileDown } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

const ACTION_LABELS: Record<string, string> = {
  deposit: "הפקדה מנהל",
  withdraw: "משיכה מנהל",
  participation: "השתתפות",
  prize: "זכייה",
  admin_approval: "אישור טופס",
  agent_transfer: "העברת סוכן",
  refund: "החזר",
};

const TOURNAMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "כל הסוגים" },
  { value: "football", label: "כדורגל" },
  { value: "lotto", label: "לוטו" },
  { value: "chance", label: "צ'אנס" },
  { value: "football_custom", label: "כדורגל מותאם" },
];

export default function PointsHistory() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tournamentType, setTournamentType] = useState("");
  const [exportingReport, setExportingReport] = useState(false);
  const utils = trpc.useUtils();

  const { data: history, isLoading } = trpc.auth.getPointsHistory.useQuery(
    {
      limit: 200,
      from: useDateFilter && dateFrom ? dateFrom : undefined,
      to: useDateFilter && dateTo ? dateTo : undefined,
    },
    { enabled: !!isAuthenticated }
  );

  const { data: pnl, isLoading: pnlLoading } = trpc.auth.getPlayerPnL.useQuery(
    {
      from: useDateFilter && dateFrom ? dateFrom : undefined,
      to: useDateFilter && dateTo ? dateTo : undefined,
      tournamentType: tournamentType || undefined,
    },
    { enabled: !!isAuthenticated }
  );

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <Gem className="w-8 h-8 text-amber-400" />
            היסטוריית נקודות
          </h1>
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
            className="border-slate-600 rounded-xl hover:bg-slate-700/50"
          >
            חזרה לדף הבית
          </Button>
        </div>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Gem className="w-5 h-5 text-amber-400" />
              יתרה נוכחית
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-400">
              {user?.role === "admin" ? "ללא הגבלה" : (user?.points ?? 0)}
              <span className="text-xl text-slate-400 mr-2">💎</span>
            </p>
          </CardContent>
        </Card>

        {user?.role !== "admin" && (
          <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                רווח והפסד
              </CardTitle>
              <p className="text-slate-400 text-sm">רווח = זכיות והחזרים. הפסד = השתתפויות. ניתן לסנן לפי תאריכים וסוג תחרות.</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 items-center mb-4">
                <select
                  value={tournamentType}
                  onChange={(e) => setTournamentType(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {TOURNAMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {pnlLoading ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  טוען...
                </div>
              ) : pnl != null ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-lg bg-slate-900/80">
                  <div>
                    <p className="text-slate-500 text-sm">רווח</p>
                    <p className="text-xl font-bold text-emerald-400">{pnl.profit}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm">הפסד</p>
                    <p className="text-xl font-bold text-amber-400">{pnl.loss}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm">רווח נטו</p>
                    <p className="text-xl font-bold text-white">{pnl.net}</p>
                  </div>
                </div>
              ) : null}
              {user?.role === "user" && (
                <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-slate-700">
                  <span className="text-slate-500 text-sm">ייצוא דוח לפי תאריכים:</span>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="w-36 bg-slate-900 border-slate-600 text-white text-sm" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="w-36 bg-slate-900 border-slate-600 text-white text-sm" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                    disabled={exportingReport}
                    onClick={async () => {
                      setExportingReport(true);
                      try {
                        const { csv } = await utils.auth.exportMyPlayerReport.fetch({
                          from: dateFrom || undefined,
                          to: dateTo || undefined,
                          tournamentType: tournamentType || undefined,
                        });
                        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `דוח-שחקן-${dateFrom || "all"}-${dateTo || "all"}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setExportingReport(false);
                      }
                    }}
                  >
                    {exportingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    <span className="mr-1">ייצא דוח</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="bg-slate-800/60 border-slate-600/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">תנועות ומאזן לאחר כל פעולה</CardTitle>
            <p className="text-slate-400 text-sm">מאזן כללי או לפי טווח תאריכים.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-center mb-4">
              {user?.role !== "admin" && (
                <select
                  value={tournamentType}
                  onChange={(e) => setTournamentType(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {TOURNAMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              <Button
                variant={!useDateFilter ? "default" : "outline"}
                size="sm"
                onClick={() => setUseDateFilter(false)}
                className={!useDateFilter ? "bg-amber-600 hover:bg-amber-700" : ""}
              >
                מאזן כללי
              </Button>
              <Button
                variant={useDateFilter ? "default" : "outline"}
                size="sm"
                onClick={() => setUseDateFilter(true)}
                className={useDateFilter ? "bg-amber-600 hover:bg-amber-700" : ""}
              >
                <Calendar className="w-4 h-4 ml-1" />
                מאזן לפי תאריכים
              </Button>
              {useDateFilter && (
                <>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40 bg-slate-900 border-slate-600 text-white" placeholder="dd/mm/yyyy" title="dd/mm/yyyy" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40 bg-slate-900 border-slate-600 text-white" placeholder="dd/mm/yyyy" title="dd/mm/yyyy" />
                </>
              )}
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
              </div>
            ) : !history?.length ? (
              <p className="text-slate-400 text-center py-6">אין עדיין תנועות נקודות.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-600 text-slate-400">
                      <th className="py-3 px-2">תאריך</th>
                      <th className="py-3 px-2">פעולה</th>
                      <th className="py-3 px-2">כמות</th>
                      <th className="py-3 px-2">יתרה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => {
                      const date = row.createdAt
                        ? new Date(row.createdAt).toLocaleDateString("he-IL", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "-";
                      const label = ACTION_LABELS[row.actionType] ?? row.actionType;
                      const amount = row.amount;
                      const isPositive = amount > 0;
                      return (
                        <tr key={row.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-3 px-2 text-slate-300">{date}</td>
                          <td className="py-3 px-2 text-slate-300">{label}</td>
                          <td className={`py-3 px-2 font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                            {isPositive ? "+" : ""}
                            {amount}
                          </td>
                          <td className="py-3 px-2 text-amber-400/90">{row.balanceAfter}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
