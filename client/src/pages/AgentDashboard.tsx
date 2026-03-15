import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Loader2, Users, Coins, Copy, Wallet, ArrowDownToLine, ArrowUpFromLine, History, Calendar, TrendingUp, FileText, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "agent") setLocation("/");
    // setLocation omitted from deps to avoid re-run on router updates (infinite re-render)
  }, [authLoading, user]);
  const [depositPlayer, setDepositPlayer] = useState<{ id: number; name: string } | null>(null);
  const [withdrawPlayer, setWithdrawPlayer] = useState<{ id: number; name: string; points: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [commissionFrom, setCommissionFrom] = useState("");
  const [commissionTo, setCommissionTo] = useState("");
  const [balanceFrom, setBalanceFrom] = useState("");
  const [balanceTo, setBalanceTo] = useState("");
  const [balanceFilterOpen, setBalanceFilterOpen] = useState(false);
  const [commissionFilterOpen, setCommissionFilterOpen] = useState(false);
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }
  if (!user || user.role !== "agent") {
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
    <div className="min-h-screen py-4 sm:py-8 overflow-x-hidden max-w-full">
      <div className="container mx-auto px-3 sm:px-4 max-w-2xl min-w-0">
        <h1 className="text-2xl font-bold text-white mb-4">לוח הסוכן</h1>

        {/* סיכום עליון – מובייל */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-slate-800/80 border border-slate-600/50 p-4 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">יתרה</p>
            <p className="text-white font-bold text-lg sm:text-xl">{wallet?.balance ?? 0}</p>
          </div>
          <div className="rounded-xl bg-slate-800/80 border border-slate-600/50 p-4 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">מאזן שחקנים</p>
            <p className="text-emerald-400 font-bold text-lg sm:text-xl">{wallet?.totalPlayersBalance ?? 0}</p>
          </div>
          <div className="rounded-xl bg-slate-800/80 border border-slate-600/50 p-4 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">שחקנים</p>
            <p className="text-white font-bold text-lg sm:text-xl">{report?.referredUsers ?? 0}</p>
          </div>
          <div className="rounded-xl bg-slate-800/80 border border-slate-600/50 p-4 sm:p-4">
            <p className="text-slate-400 text-xs sm:text-sm">עמלה</p>
            <p className="text-emerald-400 font-bold text-lg sm:text-xl">₪{(report?.totalCommission ?? 0).toLocaleString("he-IL")}</p>
          </div>
        </div>

        {/* מובייל: אקורדיון; דסקטופ: כרטיסים רגילים */}
        <div className="md:hidden">
          <Accordion type="single" collapsible className="space-y-2">
            <AccordionItem value="referral" className="border border-slate-600/50 rounded-xl bg-slate-800/60 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-white hover:no-underline hover:bg-slate-700/50 [&>svg]:text-slate-400">
                <span className="flex items-center gap-2">
                  <Copy className="w-5 h-5 text-amber-400" />
                  קוד הפניה
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <p className="text-slate-400 text-sm mb-3">משתמשים שנרשמים עם הקוד הזה ייזקפו אליך.</p>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-mono bg-slate-900 px-3 py-2 rounded-lg text-amber-400 border border-amber-500/30 flex-1 min-w-0">
                    {report?.referralCode ?? "—"}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyCode} className="border-amber-500/50 text-amber-400 shrink-0 min-h-[44px]">
                    העתק
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="wallet" className="border border-slate-600/50 rounded-xl bg-slate-800/60 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-white hover:no-underline hover:bg-slate-700/50 [&>svg]:text-slate-400">
                <span className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-400" />
                  ארנק נקודות
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-slate-900/80">
                    <p className="text-slate-500 text-xs">יתרה נוכחית</p>
                    <p className="text-white font-bold text-lg">{wallet?.balance ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80">
                    <p className="text-slate-500 text-xs">מאזן שחקנים</p>
                    <p className="text-emerald-400 font-bold text-lg">{wallet?.totalPlayersBalance ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80">
                    <p className="text-slate-500 text-xs">סך שחולקו</p>
                    <p className="text-emerald-400 font-bold">{wallet?.totalDepositedToPlayers ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80">
                    <p className="text-slate-500 text-xs">סך שנמשכו</p>
                    <p className="text-amber-400 font-bold">{wallet?.totalWithdrawnFromPlayers ?? 0}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="players" className="border border-slate-600/50 rounded-xl bg-slate-800/60 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-white hover:no-underline hover:bg-slate-700/50 [&>svg]:text-slate-400">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  שחקנים – הפקדה / משיכה
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                {wallet?.players && wallet.players.length > 0 ? (
                  <div className="overflow-x-auto -mx-1 min-w-0">
                    <p className="text-slate-400 text-xs mb-2">גלול ימינה לראות פעולות. שם שחקן קבוע.</p>
                    <table className="w-full text-xs sm:text-sm text-right min-w-[320px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-600 bg-slate-800/90 text-slate-400 sticky top-0 z-10">
                          <th className="py-1.5 sm:py-2 px-2 text-right whitespace-nowrap bg-slate-800/95 sticky right-0 z-20 border-l border-slate-600/50 min-w-[4.5rem]">שחקן</th>
                          <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">יתרה</th>
                          <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">עמלה</th>
                          <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">הפקדה</th>
                          <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">משיכה</th>
                          <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">יומן</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wallet.players.map((p, idx) => {
                          const playerCommission = (report?.commissions ?? []).filter((c) => c.userId === p.id).reduce((s, c) => s + c.commissionAmount, 0);
                          return (
                            <tr key={p.id} className={`border-b border-slate-700/50 ${idx % 2 === 1 ? "bg-slate-800/30" : ""}`}>
                              <td className="py-1.5 sm:py-2 px-2 text-white font-medium whitespace-nowrap bg-slate-800/95 sm:bg-transparent sticky right-0 z-10 border-l border-slate-600/50">{p.name || p.username || `#${p.id}`}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-amber-400 font-mono whitespace-nowrap">{p.points}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-emerald-400 text-xs whitespace-nowrap">₪{playerCommission.toLocaleString("he-IL")}</td>
                              <td className="py-1.5 sm:py-2 px-2 whitespace-nowrap">
                                <Button size="sm" variant="outline" className="border-emerald-500/50 text-emerald-400 text-xs h-7" onClick={() => { setDepositPlayer({ id: p.id, name: p.name || p.username || `#${p.id}` }); setAmount(""); }}>
                                  <ArrowDownToLine className="w-3 h-3 ml-0.5" /> הפקדה
                                </Button>
                              </td>
                              <td className="py-1.5 sm:py-2 px-2 whitespace-nowrap">
                                <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-400 text-xs h-7" onClick={() => { setWithdrawPlayer({ id: p.id, name: p.name || p.username || `#${p.id}`, points: p.points }); setAmount(""); }}>
                                  <ArrowUpFromLine className="w-3 h-3 ml-0.5" /> משיכה
                                </Button>
                              </td>
                              <td className="py-1.5 sm:py-2 px-2 whitespace-nowrap">
                                <Button size="sm" variant="ghost" className="text-slate-400 text-xs h-7" onClick={() => setLogOpen(true)}>
                                  <History className="w-3 h-3 ml-0.5" /> יומן
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-6">אין שחקנים ברשימה</p>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="summary" className="border border-slate-600/50 rounded-xl bg-slate-800/60 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-white hover:no-underline hover:bg-slate-700/50 [&>svg]:text-slate-400">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  סיכום
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-slate-900/80">
                    <p className="text-slate-500 text-xs">שחקנים שהבאת</p>
                    <p className="text-white font-bold text-lg">{report?.referredUsers ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80">
                    <p className="text-slate-500 text-xs">סכום תפוסים מאושרים</p>
                    <p className="text-white font-bold">₪{(report?.totalEntryAmount ?? 0).toLocaleString("he-IL")}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 sm:col-span-2">
                    <p className="text-slate-500 text-xs">סה״כ עמלה</p>
                    <p className="text-emerald-400 font-bold text-lg">₪{(report?.totalCommission ?? 0).toLocaleString("he-IL")}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="balance" className="border border-slate-600/50 rounded-xl bg-slate-800/60 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-white hover:no-underline hover:bg-slate-700/50 [&>svg]:text-slate-400">
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  מאזן שלי לפי תאריכים
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <Button variant="outline" size="sm" className="mb-3 border-slate-500 text-slate-300 w-full min-h-[44px]" onClick={() => setBalanceFilterOpen(true)}>
                  <Filter className="w-4 h-4 ml-2" />
                  סינון תאריכים
                </Button>
                {myHistoryLoading ? (
                  <p className="text-slate-500 text-center py-4">טוען...</p>
                ) : myPointsHistory && myPointsHistory.length > 0 ? (
                  <div className="overflow-x-auto -mx-1 min-w-0">
                    <table className="w-full text-xs sm:text-sm text-right min-w-[260px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-600 bg-slate-800/90 text-slate-400 sticky top-0 z-10">
                          <th className="py-1.5 sm:py-2 px-2 text-right whitespace-nowrap">תאריך</th>
                          <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">סוג</th>
                          <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">סכום</th>
                          <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">יתרה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myPointsHistory.map((row, idx) => {
                          const label = ACTION_LABELS[row.actionType] ?? row.actionType;
                          const amt = row.amount;
                          return (
                            <tr key={row.id} className={`border-b border-slate-700/50 ${idx % 2 === 1 ? "bg-slate-800/30" : ""}`}>
                              <td className="py-1.5 sm:py-2 px-2 text-slate-300 whitespace-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleDateString("he-IL") : "—"}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-slate-400 text-xs whitespace-nowrap">{label}</td>
                              <td className={`py-1.5 sm:py-2 px-2 whitespace-nowrap ${amt > 0 ? "text-emerald-400" : "text-amber-400"}`}>{amt > 0 ? "+" : ""}{amt}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-amber-400/90 text-xs whitespace-nowrap">{row.balanceAfter}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-6">אין תנועות בתקופה הנבחרת</p>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="commissions" className="border border-slate-600/50 rounded-xl bg-slate-800/60 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-white hover:no-underline hover:bg-slate-700/50 [&>svg]:text-slate-400">
                <span className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  היסטוריית עמלות
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
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
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="commissionReport" className="border border-slate-600/50 rounded-xl bg-slate-800/60 overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-white hover:no-underline hover:bg-slate-700/50 [&>svg]:text-slate-400">
                <span className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  דוח עמלות לפי תאריכים
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <Button variant="outline" size="sm" className="mb-3 border-slate-500 text-slate-300 w-full min-h-[44px]" onClick={() => setCommissionFilterOpen(true)}>
                  <Filter className="w-4 h-4 ml-2" />
                  סינון תאריכים
                </Button>
                {commissionReportLoading ? (
                  <p className="text-slate-500 text-center py-4">טוען...</p>
                ) : commissionReport?.rows && commissionReport.rows.length > 0 ? (
                  <>
                    <p className="text-slate-400 text-sm mb-2">סך עמלות: <span className="text-emerald-400 font-bold">₪{(commissionReport.totalCommission ?? 0).toLocaleString("he-IL")}</span></p>
                    <div className="overflow-x-auto -mx-1 min-w-0">
                      <table className="w-full text-xs sm:text-sm text-right min-w-[280px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-600 bg-slate-800/90 text-slate-400 sticky top-0 z-10">
                            <th className="py-1.5 sm:py-2 px-2 text-right whitespace-nowrap bg-slate-800/95 sticky right-0 z-20 border-l border-slate-600/50 min-w-[4rem]">שם</th>
                            <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">תאריך</th>
                            <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">סכום</th>
                            <th className="py-1.5 sm:py-2 px-2 whitespace-nowrap">עמלה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commissionReport.rows.map((r, idx) => (
                            <tr key={r.id} className={`border-b border-slate-700/50 ${idx % 2 === 1 ? "bg-slate-800/30" : ""}`}>
                              <td className="py-1.5 sm:py-2 px-2 text-white font-medium whitespace-nowrap bg-slate-800/95 sm:bg-transparent sticky right-0 z-10 border-l border-slate-600/50">{r.name || r.username || `#${r.userId}`}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-slate-400 whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("he-IL") : "—"}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-slate-300 whitespace-nowrap">₪{(r.entryAmount ?? 0).toLocaleString("he-IL")}</td>
                              <td className="py-1.5 sm:py-2 px-2 text-emerald-400 whitespace-nowrap">₪{(r.commissionAmount ?? 0).toLocaleString("he-IL")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500 text-center py-6">אין עמלות בתקופה הנבחרת</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {report?.referredList && report.referredList.length > 0 && (
              <AccordionItem value="referred" className="border border-slate-600/50 rounded-xl bg-slate-800/60 overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-white hover:no-underline hover:bg-slate-700/50 [&>svg]:text-slate-400">
                  שחקנים שהבאת
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0">
                  <ul className="space-y-2 text-sm text-slate-300">
                    {report.referredList.map((u) => (
                      <li key={u.id}>{u.username} {u.phone && `(${u.phone})`}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* דסקטופ: כרטיסים מלאים כמו קודם */}
        <div className="hidden md:block">
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
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end mb-4">
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
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-stretch sm:items-end mb-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1">מתאריך</label>
                <Input type="date" value={commissionFrom} onChange={(e) => setCommissionFrom(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1">עד תאריך</label>
                <Input type="date" value={commissionTo} onChange={(e) => setCommissionTo(e.target.value)} placeholder="dd/mm/yyyy" title="dd/mm/yyyy" className="bg-slate-900 border-slate-600 text-white w-40" />
              </div>
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

        </div>

        {/* גיליונות סינון למובייל */}
        <Sheet open={balanceFilterOpen} onOpenChange={setBalanceFilterOpen}>
          <SheetContent side="left" className="bg-slate-800 border-slate-600 text-white w-[min(100vw-2rem,320px)]">
            <SheetHeader>
              <SheetTitle>סינון מאזן לפי תאריכים</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-slate-400 text-sm block mb-1">מתאריך</label>
                <Input type="date" value={balanceFrom} onChange={(e) => setBalanceFrom(e.target.value)} className="bg-slate-900 border-slate-600 text-white w-full" />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">עד תאריך</label>
                <Input type="date" value={balanceTo} onChange={(e) => setBalanceTo(e.target.value)} className="bg-slate-900 border-slate-600 text-white w-full" />
              </div>
              <Button className="w-full min-h-[44px]" onClick={() => setBalanceFilterOpen(false)}>החל סינון</Button>
            </div>
          </SheetContent>
        </Sheet>
        <Sheet open={commissionFilterOpen} onOpenChange={setCommissionFilterOpen}>
          <SheetContent side="left" className="bg-slate-800 border-slate-600 text-white w-[min(100vw-2rem,320px)]">
            <SheetHeader>
              <SheetTitle>סינון דוח עמלות</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-slate-400 text-sm block mb-1">מתאריך</label>
                <Input type="date" value={commissionFrom} onChange={(e) => setCommissionFrom(e.target.value)} className="bg-slate-900 border-slate-600 text-white w-full" />
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1">עד תאריך</label>
                <Input type="date" value={commissionTo} onChange={(e) => setCommissionTo(e.target.value)} className="bg-slate-900 border-slate-600 text-white w-full" />
              </div>
              <Button className="w-full min-h-[44px]" onClick={() => setCommissionFilterOpen(false)}>החל סינון</Button>
            </div>
          </SheetContent>
        </Sheet>

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
              <Button variant="outline" onClick={() => setDepositPlayer(null)} className="min-h-[44px]">ביטול</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 min-h-[44px]"
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
              <Button variant="outline" onClick={() => setWithdrawPlayer(null)} className="min-h-[44px]">ביטול</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 min-h-[44px]"
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

      </div>
    </div>
  );
}
