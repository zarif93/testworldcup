import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, Users, Coins, Copy, Wallet, ArrowDownToLine, ArrowUpFromLine, History, Calendar, TrendingUp, FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";

const ACTION_LABELS: Record<string, string> = {
  deposit: "הפקדה",
  withdraw: "משיכה",
  participation: "השתתפות",
  prize: "זכייה",
  agent_transfer: "העברת סוכן",
  refund: "החזר",
  admin_approval: "אישור טופס",
};

export default function AgentDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [depositPlayer, setDepositPlayer] = useState<{ id: number; name: string } | null>(null);
  const [withdrawPlayer, setWithdrawPlayer] = useState<{ id: number; name: string; points: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [commissionFrom, setCommissionFrom] = useState("");
  const [commissionTo, setCommissionTo] = useState("");
  const [balanceFrom, setBalanceFrom] = useState("");
  const [balanceTo, setBalanceTo] = useState("");
  const [pnlFrom, setPnlFrom] = useState("");
  const [pnlTo, setPnlTo] = useState("");
  const [pnlTournamentType, setPnlTournamentType] = useState("");
  const [pnlDetailPlayerId, setPnlDetailPlayerId] = useState<number | null>(null);
  const [exportingCsv, setExportingCsv] = useState<"commission" | "pnl" | null>(null);
  const utils = trpc.useUtils();
  const TOURNAMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "כל הסוגים" },
    { value: "football", label: "כדורגל" },
    { value: "lotto", label: "לוטו" },
    { value: "chance", label: "צ'אנס" },
    { value: "football_custom", label: "כדורגל מותאם" },
  ];

  const { data: report, isLoading } = trpc.agent.getMyReport.useQuery(undefined, {
    enabled: !!user && user.role === "agent",
  });
  const { data: wallet, isLoading: walletLoading } = trpc.agent.getWallet.useQuery(undefined, {
    enabled: !!user && user.role === "agent",
  });
  const { data: commissionReport, isLoading: commissionReportLoading } = trpc.agent.getCommissionReport.useQuery(
    { from: commissionFrom || undefined, to: commissionTo || undefined, limit: 200 },
    { enabled: !!user && user.role === "agent" }
  );
  const { data: transferLog, isLoading: logLoading } = trpc.agent.getTransferLog.useQuery(
    { limit: 100 },
    { enabled: !!user && user.role === "agent" && logOpen }
  );
  const { data: myPointsHistory, isLoading: myHistoryLoading } = trpc.agent.getMyPointsHistory.useQuery(
    { limit: 100, from: balanceFrom || undefined, to: balanceTo || undefined },
    { enabled: !!user && user.role === "agent" }
  );
  const { data: agentPnL, isLoading: agentPnLLoading } = trpc.agent.getAgentPnL.useQuery(
    { from: pnlFrom || undefined, to: pnlTo || undefined, tournamentType: pnlTournamentType || undefined },
    { enabled: !!user && user.role === "agent" }
  );
  const { data: playersPnL, isLoading: playersPnLLoading } = trpc.agent.getAgentPlayersPnL.useQuery(
    { from: pnlFrom || undefined, to: pnlTo || undefined, tournamentType: pnlTournamentType || undefined },
    { enabled: !!user && user.role === "agent" }
  );
  const { data: playerPnLDetail, isLoading: playerPnLDetailLoading } = trpc.agent.getPlayerPnLDetail.useQuery(
    { playerId: pnlDetailPlayerId!, from: pnlFrom || undefined, to: pnlTo || undefined, tournamentType: pnlTournamentType || undefined },
    { enabled: !!user && user.role === "agent" && pnlDetailPlayerId != null }
  );

  const withdrawMut = trpc.agent.withdrawFromPlayer.useMutation({
    onSuccess: () => {
      toast.success("המשיכה בוצעה");
      setWithdrawPlayer(null);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: [["agent", "getWallet"]] });
    },
    onError: (e) => toast.error(e.message),
  });
  const depositMut = trpc.agent.depositToPlayer.useMutation({
    onSuccess: () => {
      toast.success("ההפקדה בוצעה");
      setDepositPlayer(null);
      setAmount("");
      queryClient.invalidateQueries({ queryKey: [["agent", "getWallet"]] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user || user.role !== "agent") {
    setLocation("/");
    return null;
  }

  const copyCode = () => {
    if (report?.referralCode) {
      navigator.clipboard.writeText(report.referralCode);
      toast.success("קוד ההפניה הועתק");
    }
  };

  if (isLoading || walletLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">לוח הסוכן</h1>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-amber-400" />
              קוד הפניה
            </h2>
            <p className="text-slate-400 text-sm">משתמשים שנרשמים עם הקוד הזה ייזקפו אליך ועמלתיך תחושב על תפוסים שאושרו.</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="text-xl font-mono bg-slate-900 px-4 py-2 rounded-lg text-amber-400 border border-amber-500/30">
                {report?.referralCode ?? "—"}
              </code>
              <Button size="sm" variant="outline" onClick={copyCode} className="border-amber-500/50 text-amber-400">
                העתק
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              ארנק נקודות
            </h2>
            <p className="text-slate-400 text-sm">יתרת הנקודות שלך, סך שחולקו לשחקנים וסך שנמשכו מהם.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">יתרה נוכחית</p>
                <p className="text-white font-bold text-xl">{wallet?.balance ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">מאזן כל השחקנים שלי</p>
                <p className="text-emerald-400 font-bold text-xl">{wallet?.totalPlayersBalance ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">סך שחולקו (הפקדות)</p>
                <p className="text-emerald-400 font-bold">{wallet?.totalDepositedToPlayers ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">סך שנמשכו</p>
                <p className="text-amber-400 font-bold">{wallet?.totalWithdrawnFromPlayers ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              דוח רווח והפסד
            </h2>
            <p className="text-slate-400 text-sm">רווח = עמלות מהשחקנים. הפסד = הפקדות לשחקנים. בחר טווח תאריכים וסוג תחרות.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-end mb-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1">מתאריך</label>
                <Input type="date" value={pnlFrom} onChange={(e) => setPnlFrom(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">עד תאריך</label>
                <Input type="date" value={pnlTo} onChange={(e) => setPnlTo(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">סוג תחרות</label>
                <select value={pnlTournamentType} onChange={(e) => setPnlTournamentType(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm w-40">
                  {TOURNAMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-500/50 text-amber-400"
                disabled={exportingCsv === "pnl"}
                onClick={async () => {
                  setExportingCsv("pnl");
                  try {
                    const { csv } = await utils.agent.exportAgentPnLCSV.fetch({
                      from: pnlFrom || undefined,
                      to: pnlTo || undefined,
                      tournamentType: pnlTournamentType || undefined,
                    });
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `pnl-agent-${pnlFrom || "all"}-${pnlTo || "all"}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("הורדת CSV החלה");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                  } finally {
                    setExportingCsv(null);
                  }
                }}
              >
                {exportingCsv === "pnl" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                <span className="mr-1">ייצוא CSV</span>
              </Button>
            </div>
            {agentPnL != null && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-3 rounded-lg bg-slate-900/80">
                <div>
                  <p className="text-slate-500 text-sm">רווח מהשחקנים</p>
                  <p className="text-xl font-bold text-emerald-400">{agentPnL.profit}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">הפסד מהשחקנים</p>
                  <p className="text-xl font-bold text-amber-400">{agentPnL.loss}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">רווח נטו</p>
                  <p className="text-xl font-bold text-amber-400">{agentPnL.net}</p>
                </div>
              </div>
            )}
            {agentPnL?.transactions && agentPnL.transactions.length > 0 && (
              <div className="overflow-x-auto mb-6">
                <p className="text-slate-400 text-sm mb-2">כל הפעולות – עמלות, הפקדות, זכיות שחקנים</p>
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="border-b border-slate-600/50 text-slate-400">
                      <th className="py-2 px-2">תאריך</th>
                      <th className="py-2 px-2">שחקן</th>
                      <th className="py-2 px-2">סוג פעולה</th>
                      <th className="py-2 px-2">סכום</th>
                      <th className="py-2 px-2">תחרות</th>
                      <th className="py-2 px-2">מאזן לאחר הפעולה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPnL.transactions.map((t) => (
                      <tr key={t.id} className="border-b border-slate-700/50">
                        <td className="py-2 px-2 text-slate-300">
                          {t.date ? new Date(t.date).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—"}
                        </td>
                        <td className="py-2 px-2 text-white">{t.playerName ?? "—"}</td>
                        <td className="py-2 px-2">
                          {t.type === "COMMISSION" && <span className="text-emerald-400">עמלה</span>}
                          {t.type === "DEPOSIT" && <span className="text-amber-400">הפקדה</span>}
                          {t.type === "PRIZE" && <span className="text-slate-400">זכייה</span>}
                        </td>
                        <td className="py-2 px-2">
                          {t.type === "DEPOSIT" && (t.amount < 0) && <span className="text-amber-400">{t.amount}</span>}
                          {(t.type === "COMMISSION" || t.type === "PRIZE") && (t.amount > 0) && <span className="text-emerald-400">+{t.amount}</span>}
                          {t.amount === 0 && "—"}
                        </td>
                        <td className="py-2 px-2 text-slate-400">{t.tournamentName ?? "—"}</td>
                        <td className="py-2 px-2 font-medium text-white">{t.balanceAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {playersPnLLoading ? (
              <p className="text-slate-500 text-center py-4">טוען...</p>
            ) : playersPnL && playersPnL.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="border-b border-slate-600/50 text-slate-400">
                      <th className="py-2 px-2">שחקן</th>
                      <th className="py-2 px-2">רווח</th>
                      <th className="py-2 px-2">הפסד</th>
                      <th className="py-2 px-2">רווח נטו</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersPnL.map((p) => (
                      <tr key={p.playerId} className="border-b border-slate-700/50">
                        <td className="py-2 px-2 text-white">{p.name || p.username || `#${p.playerId}`}</td>
                        <td className="py-2 px-2 text-emerald-400">{p.profit}</td>
                        <td className="py-2 px-2 text-amber-400">{p.loss}</td>
                        <td className="py-2 px-2 font-medium text-white">{p.net}</td>
                        <td className="py-2 px-2">
                          <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setPnlDetailPlayerId(p.playerId)}>
                            <FileText className="w-3.5 h-3.5 ml-1" />
                            צפה בדוח מפורט
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">אין שחקנים או אין נתונים בתקופה</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              שחקנים – הפקדה / משיכה
            </h2>
            <p className="text-slate-400 text-sm">ניהול יתרות השחקנים שלך. משיכה מפחיתה מהשחקן ומוסיפה אליך; הפקדה מפחיתה ממך ומוסיפה לשחקן.</p>
          </CardHeader>
          <CardContent>
            {wallet?.players && wallet.players.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="border-b border-slate-600/50 text-slate-400">
                      <th className="py-2 px-2">שם / משתמש</th>
                      <th className="py-2 px-2">יתרה</th>
                      <th className="py-2 px-2">עמלה שנרשמה</th>
                      <th className="py-2 px-2">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallet.players.map((p) => {
                      const playerCommission = (report?.commissions ?? []).filter((c) => c.userId === p.id).reduce((s, c) => s + c.commissionAmount, 0);
                      return (
                      <tr key={p.id} className="border-b border-slate-700/50">
                        <td className="py-2 px-2 text-white">{p.name || p.username || `#${p.id}`}</td>
                        <td className="py-2 px-2 font-mono text-amber-400">{p.points}</td>
                        <td className="py-2 px-2 text-emerald-400">₪{playerCommission.toLocaleString("he-IL")}</td>
                        <td className="py-2 px-2 flex flex-wrap gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-500/50 text-emerald-400"
                            onClick={() => { setDepositPlayer({ id: p.id, name: p.name || p.username || `#${p.id}` }); setAmount(""); }}
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5 ml-1" />
                            הפקדה
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-500/50 text-amber-400"
                            onClick={() => { setWithdrawPlayer({ id: p.id, name: p.name || p.username || `#${p.id}`, points: p.points }); setAmount(""); }}
                          >
                            <ArrowUpFromLine className="w-3.5 h-3.5 ml-1" />
                            משיכה
                          </Button>
                          <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setLogOpen(true)}>
                            <History className="w-3.5 h-3.5 ml-1" />
                            יומן
                          </Button>
                        </td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">אין שחקנים ברשימה או טוען...</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              סיכום
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">שחקנים שהבאת</p>
                <p className="text-white font-bold text-lg">{report?.referredUsers ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-500">סכום תפוסים (מאושרים)</p>
                <p className="text-white font-bold">₪{(report?.totalEntryAmount ?? 0).toLocaleString("he-IL")}</p>
              </div>
              <div>
                <p className="text-slate-500">סה״כ עמלה</p>
                <p className="text-emerald-400 font-bold text-lg">₪{(report?.totalCommission ?? 0).toLocaleString("he-IL")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              מאזן שלי לפי תאריכים
            </h2>
            <p className="text-slate-400 text-sm">תנועות הנקודות שלי – מאזן לאחר כל פעולה. בחר טווח או השאר ריק למאזן כללי.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-end mb-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1">מתאריך</label>
                <Input type="date" value={balanceFrom} onChange={(e) => setBalanceFrom(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">עד תאריך</label>
                <Input type="date" value={balanceTo} onChange={(e) => setBalanceTo(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
            </div>
            {myHistoryLoading ? (
              <p className="text-slate-500 text-center py-4">טוען...</p>
            ) : myPointsHistory && myPointsHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="border-b border-slate-600/50 text-slate-400">
                      <th className="py-2 px-2">תאריך</th>
                      <th className="py-2 px-2">פעולה</th>
                      <th className="py-2 px-2">כמות</th>
                      <th className="py-2 px-2">יתרה לאחר</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPointsHistory.map((row) => {
                      const label = ACTION_LABELS[row.actionType] ?? row.actionType;
                      const amt = row.amount;
                      return (
                        <tr key={row.id} className="border-b border-slate-700/50">
                          <td className="py-2 px-2 text-slate-300">{row.createdAt ? new Date(row.createdAt).toLocaleDateString("he-IL") : "—"}</td>
                          <td className="py-2 px-2 text-slate-300">{label}</td>
                          <td className={`py-2 px-2 ${amt > 0 ? "text-emerald-400" : "text-amber-400"}`}>{amt > 0 ? "+" : ""}{amt}</td>
                          <td className="py-2 px-2 text-amber-400/90">{row.balanceAfter}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">אין תנועות בתקופה הנבחרת</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              היסטוריית עמלות
            </h2>
            <p className="text-slate-400 text-sm">עמלה נרשמת אוטומטית כשטופס מאושר לשחקן שהבאת.</p>
          </CardHeader>
          <CardContent>
            {report?.commissions && report.commissions.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {report.commissions.map((c) => (
                  <li key={c.submissionId} className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-slate-400">טופס #{c.submissionId} • שחקן #{c.userId}</span>
                    <span className="text-white">₪{c.entryAmount} → <span className="text-emerald-400">₪{c.commissionAmount}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-center py-6">עדיין אין עמלות</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-600/50 mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              דוח עמלות לפי תאריכים
            </h2>
            <p className="text-slate-400 text-sm">בחר טווח תאריכים לצפייה בעמלות שנרשמו (רק לדוחות – לא נכנסות ליתרה).</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-end mb-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1">מתאריך</label>
                <Input type="date" value={commissionFrom} onChange={(e) => setCommissionFrom(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">עד תאריך</label>
                <Input type="date" value={commissionTo} onChange={(e) => setCommissionTo(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-500/50 text-amber-400"
                disabled={exportingCsv === "commission"}
                onClick={async () => {
                  setExportingCsv("commission");
                  try {
                    const { csv } = await utils.agent.exportCommissionReportCSV.fetch({
                      from: commissionFrom || undefined,
                      to: commissionTo || undefined,
                      limit: 500,
                    });
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `commission-report-${commissionFrom || "all"}-${commissionTo || "all"}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("הורדת CSV החלה");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
                  } finally {
                    setExportingCsv(null);
                  }
                }}
              >
                {exportingCsv === "commission" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                <span className="mr-1">ייצוא CSV</span>
              </Button>
            </div>
            {commissionReportLoading ? (
              <p className="text-slate-500 text-center py-4">טוען...</p>
            ) : commissionReport?.rows && commissionReport.rows.length > 0 ? (
              <>
                <p className="text-slate-400 text-sm mb-2">סך עמלות בתקופה: <span className="text-emerald-400 font-bold">₪{(commissionReport.totalCommission ?? 0).toLocaleString("he-IL")}</span></p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="border-b border-slate-600/50 text-slate-400">
                        <th className="py-2 px-2">שם שחקן</th>
                        <th className="py-2 px-2">סכום טופס</th>
                        <th className="py-2 px-2">עמלת סוכן</th>
                        <th className="py-2 px-2">תאריך</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionReport.rows.map((r) => (
                        <tr key={r.id} className="border-b border-slate-700/50">
                          <td className="py-2 px-2 text-white">{r.name || r.username || `#${r.userId}`}</td>
                          <td className="py-2 px-2">₪{(r.entryAmount ?? 0).toLocaleString("he-IL")}</td>
                          <td className="py-2 px-2 text-emerald-400">₪{(r.commissionAmount ?? 0).toLocaleString("he-IL")}</td>
                          <td className="py-2 px-2 text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("he-IL") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-center py-6">אין עמלות בתקופה הנבחרת</p>
            )}
          </CardContent>
        </Card>

        {report?.referredList && report.referredList.length > 0 && (
          <Card className="bg-slate-800/60 border-slate-600/50">
            <CardHeader>
              <h2 className="text-lg font-bold text-white">שחקנים שהבאת</h2>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-300">
                {report.referredList.map((u) => (
                  <li key={u.id}>{u.username} {u.phone && `(${u.phone})`}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!depositPlayer} onOpenChange={(open) => !open && setDepositPlayer(null)}>
          <DialogContent className="bg-slate-800 border-slate-600 text-white">
            <DialogHeader>
              <DialogTitle>הפקדה לשחקן</DialogTitle>
              <DialogDescription>הפקדת נקודות מיתרתך ל{depositPlayer?.name ?? "שחקן"}. יתרה נוכחית: {wallet?.balance ?? 0}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm">כמות נקודות</label>
              <Input
                type="number"
                min={1}
                max={wallet?.balance ?? 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDepositPlayer(null)}>ביטול</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!amount || parseInt(amount, 10) < 1 || (wallet?.balance ?? 0) < parseInt(amount, 10)}
                onClick={() => {
                  const n = parseInt(amount, 10);
                  if (depositPlayer && n >= 1) depositMut.mutate({ playerId: depositPlayer.id, amount: n });
                }}
              >
                {depositMut.isPending ? "מבצע..." : "הפקדה"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!withdrawPlayer} onOpenChange={(open) => !open && setWithdrawPlayer(null)}>
          <DialogContent className="bg-slate-800 border-slate-600 text-white">
            <DialogHeader>
              <DialogTitle>משיכה משחקן</DialogTitle>
              <DialogDescription>משיכת נקודות מ{withdrawPlayer?.name ?? "שחקן"} אליך. יתרת השחקן: {withdrawPlayer?.points ?? 0}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <label className="text-slate-400 text-sm">כמות נקודות</label>
              <Input
                type="number"
                min={1}
                max={withdrawPlayer?.points ?? 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWithdrawPlayer(null)}>ביטול</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                disabled={!amount || parseInt(amount, 10) < 1 || (withdrawPlayer?.points ?? 0) < parseInt(amount, 10)}
                onClick={() => {
                  const n = parseInt(amount, 10);
                  if (withdrawPlayer && n >= 1) withdrawMut.mutate({ playerId: withdrawPlayer.id, amount: n });
                }}
              >
                {withdrawMut.isPending ? "מבצע..." : "משיכה"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogContent className="bg-slate-800 border-slate-600 text-white max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>יומן תנועות נקודות</DialogTitle>
              <DialogDescription>כל ההפקדות והמשיכות שלך ושל השחקנים שלך.</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 min-h-0">
              {logLoading ? (
                <p className="text-slate-500 text-center py-4">טוען...</p>
              ) : transferLog && transferLog.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {(transferLog as { id: number; fromUserId: number | null; toUserId: number; amount: number; type: string; createdAt: Date; note?: string | null }[]).map((t) => (
                    <li key={t.id} className="flex justify-between items-center py-2 border-b border-slate-700/50">
                      <span className="text-slate-400">
                        {t.type === "DEPOSIT" && "הפקדה → שחקן"}
                        {t.type === "WITHDRAW" && "משיכה ← שחקן"}
                        {t.type === "ADMIN_ADJUSTMENT" && "הפקדה ממנהל"}
                        {t.type === "TRANSFER" && "העברה"}
                        {!["DEPOSIT","WITHDRAW","ADMIN_ADJUSTMENT","TRANSFER"].includes(t.type) && t.type}
                        {" "}
                        {t.note ? ` • ${t.note}` : ""}
                      </span>
                      <span className={t.type === "WITHDRAW" || t.type === "ADMIN_ADJUSTMENT" ? "text-emerald-400" : "text-amber-400"}>
                        {t.type === "WITHDRAW" || t.type === "ADMIN_ADJUSTMENT" ? "+" : ""}{t.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-center py-6">אין תנועות</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={pnlDetailPlayerId != null} onOpenChange={(open) => !open && setPnlDetailPlayerId(null)}>
          <DialogContent className="bg-slate-800 border-slate-600 text-white max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>דוח רווח והפסד מפורט – שחקן #{pnlDetailPlayerId}</DialogTitle>
              <DialogDescription>זכיות והחזרים = רווח. השתתפויות = הפסד.</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 min-h-0">
              {playerPnLDetailLoading ? (
                <p className="text-slate-500 text-center py-4">טוען...</p>
              ) : playerPnLDetail ? (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-lg bg-slate-900/80 text-sm">
                    <div><span className="text-slate-500">רווח:</span> <span className="text-emerald-400 font-bold">{playerPnLDetail.profit}</span></div>
                    <div><span className="text-slate-500">הפסד:</span> <span className="text-amber-400 font-bold">{playerPnLDetail.loss}</span></div>
                    <div><span className="text-slate-500">רווח נטו:</span> <span className="text-white font-bold">{playerPnLDetail.net}</span></div>
                  </div>
                  {playerPnLDetail.transactions.length > 0 ? (
                    <table className="w-full text-sm text-right">
                      <thead>
                        <tr className="border-b border-slate-600 text-slate-400">
                          <th className="py-2 px-2">תאריך</th>
                          <th className="py-2 px-2">סוג</th>
                          <th className="py-2 px-2">סכום</th>
                          <th className="py-2 px-2">יתרה לאחר</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playerPnLDetail.transactions.map((t) => (
                          <tr key={t.id} className="border-b border-slate-700/50">
                            <td className="py-2 px-2 text-slate-300">{t.createdAt ? new Date(t.createdAt).toLocaleDateString("he-IL") : "—"}</td>
                            <td className="py-2 px-2 text-slate-300">{t.actionType === "prize" ? "זכייה" : t.actionType === "refund" ? "החזר" : "השתתפות"}</td>
                            <td className={`py-2 px-2 ${t.kind === "profit" ? "text-emerald-400" : "text-amber-400"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
                            <td className="py-2 px-2 text-amber-400/90">{t.balanceAfter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-slate-500 text-center py-4">אין תנועות בתקופה</p>
                  )}
                </>
              ) : (
                <p className="text-slate-500 text-center py-4">לא נמצא</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPnlDetailPlayerId(null)}>סגור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
